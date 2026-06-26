    // ===== Practice Checklist =====
    var checklistItems = [];
    var checklistSaveTimer = null;
    var checklistPanelOpen = false;
    var CHECKLIST_SAVE_DELAY_MS = 600;

    // ---- Helpers ----

    function clFormatTime(isoStr){
      if(!isoStr) return "";
      try{
        var d = new Date(isoStr);
        var now = new Date();
        var diffMs = now - d;
        var diffMin = Math.floor(diffMs / 60000);
        var diffHr  = Math.floor(diffMs / 3600000);
        var diffDay = Math.floor(diffMs / 86400000);
        if(diffMin < 1)  return "Just now";
        if(diffMin < 60) return diffMin + "m ago";
        if(diffHr < 24)  return diffHr + "h ago";
        if(diffDay < 7)  return diffDay + "d ago";
        return d.toLocaleDateString(undefined, { month:"short", day:"numeric" });
      }catch(e){ return ""; }
    }

    function clEsc(s){ return typeof escapeHtml === "function" ? escapeHtml(String(s == null ? "" : s)) : String(s == null ? "" : s); }

    // ---- Render ----

    function renderChecklistItems(){
      var list = document.getElementById("checklistList");
      if(!list) return;

      // Sort: active first, done at bottom (preserve relative order within each group)
      var active = checklistItems.filter(function(i){ return !i.done; });
      var done   = checklistItems.filter(function(i){ return  i.done; });
      var sorted = active.concat(done);

      if(!sorted.length){
        list.innerHTML = '<li class="checklistEmpty">No items yet — add one above.</li>';
      } else {
        list.innerHTML = sorted.map(function(item, sortIdx){
          var realIdx = checklistItems.indexOf(item);
          var timeLabel = clFormatTime(item.created_at);
          return '<li class="checklistItem' + (item.done ? " isDone" : "") + '" data-idx="' + realIdx + '" draggable="true">'
            + '<span class="checklistDragHandle" aria-hidden="true">⠿</span>'
            + '<button class="checklistItemCheck" data-action="toggle" data-idx="' + realIdx + '" type="button" aria-label="Toggle">'
            + (item.done ? '<svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4.5L4 7.5L10 1.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : "")
            + '</button>'
            + '<div class="checklistItemMain">'
              + '<span class="checklistItemText" data-action="edit" data-idx="' + realIdx + '">' + clEsc(item.text || "") + '</span>'
              + (timeLabel ? '<span class="checklistItemTime">' + clEsc(timeLabel) + '</span>' : "")
            + '</div>'
            + '<button class="checklistItemDelete" data-action="delete" data-idx="' + realIdx + '" title="Remove" type="button" aria-label="Remove">×</button>'
            + '</li>';
        }).join("");
      }

      updateChecklistMeta();
      bindDragHandlers();
    }

    function updateChecklistMeta(){
      var total = checklistItems.length;
      var doneCount = checklistItems.filter(function(i){ return i.done; }).length;
      var undone = total - doneCount;

      // Header count
      var countEl = document.getElementById("checklistHeaderCount");
      if(countEl) countEl.textContent = total ? doneCount + "/" + total : "";

      // Progress bar
      var fill = document.getElementById("checklistProgressFill");
      var bar  = document.getElementById("checklistProgressBar");
      if(fill && bar){
        var pct = total ? Math.round((doneCount / total) * 100) : 0;
        fill.style.width = pct + "%";
        bar.style.display = total ? "block" : "none";
      }

      // Toolbar badge (undone count)
      var badge = document.getElementById("checklistBtnBadge");
      if(badge){
        if(undone > 0){
          badge.textContent = undone;
          badge.hidden = false;
        } else {
          badge.hidden = true;
        }
      }

      var allDone = total > 0 && doneCount === total;

      // Mark all complete button — show when there are uncompleted items
      var markAllBtn = document.getElementById("markAllDoneBtn");
      if(markAllBtn) markAllBtn.hidden = !(total > 0 && !allDone);

      // All-done banner
      var banner = document.getElementById("checklistAllDoneBanner");
      if(banner) banner.hidden = !allDone;

      // Clear done button — below banner, only when there are done items
      var actionsEl = document.getElementById("checklistActions");
      if(actionsEl) actionsEl.hidden = doneCount === 0;
    }

    // ---- Drag to reorder ----

    var dragSrcIdx = null;

    function bindDragHandlers(){
      var list = document.getElementById("checklistList");
      if(!list) return;
      var items = list.querySelectorAll(".checklistItem[draggable]");
      for(var i = 0; i < items.length; i++){
        (function(el){
          el.addEventListener("dragstart", function(e){
            dragSrcIdx = parseInt(el.getAttribute("data-idx"), 10);
            e.dataTransfer.effectAllowed = "move";
            el.classList.add("isDragging");
          });
          el.addEventListener("dragend", function(){
            el.classList.remove("isDragging");
            var list2 = document.getElementById("checklistList");
            if(list2) list2.querySelectorAll(".checklistItem").forEach(function(li){ li.classList.remove("isDragOver"); });
            dragSrcIdx = null;
          });
          el.addEventListener("dragover", function(e){
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            var list2 = document.getElementById("checklistList");
            if(list2) list2.querySelectorAll(".checklistItem").forEach(function(li){ li.classList.remove("isDragOver"); });
            el.classList.add("isDragOver");
          });
          el.addEventListener("drop", function(e){
            e.preventDefault();
            var destIdx = parseInt(el.getAttribute("data-idx"), 10);
            if(dragSrcIdx == null || dragSrcIdx === destIdx) return;
            var moved = checklistItems.splice(dragSrcIdx, 1)[0];
            checklistItems.splice(destIdx, 0, moved);
            renderChecklistItems();
            scheduleChecklistSave();
          });
        })(items[i]);
      }
    }

    // ---- Inline edit ----

    function startInlineEdit(idx){
      var list = document.getElementById("checklistList");
      if(!list) return;
      var textEl = list.querySelector('.checklistItemText[data-idx="' + idx + '"]');
      if(!textEl) return;
      var item = checklistItems[idx];
      if(!item) return;

      var input = document.createElement("input");
      input.type = "text";
      input.value = item.text || "";
      input.className = "checklistInlineInput";
      textEl.replaceWith(input);
      input.focus();
      input.select();

      function commit(){
        var newText = input.value.trim();
        if(newText && newText !== item.text){
          item.text = newText;
          scheduleChecklistSave();
        }
        renderChecklistItems();
      }

      input.addEventListener("blur", commit);
      input.addEventListener("keydown", function(e){
        if(e.key === "Enter"){ e.preventDefault(); input.blur(); }
        if(e.key === "Escape"){ input.value = item.text || ""; input.blur(); }
      });
    }

    // ---- Mutations ----

    function applyChecklistData(row){
      checklistItems = Array.isArray(row && row.items) ? JSON.parse(JSON.stringify(row.items)) : [];
      renderChecklistItems();
    }
    window.applyChecklistData = applyChecklistData;

    function addChecklistItem(text){
      text = String(text || "").trim();
      if(!text) return;
      checklistItems.push({
        id: "cl-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
        text: text,
        done: false,
        created_at: new Date().toISOString()
      });
      renderChecklistItems();
      scheduleChecklistSave();
    }

    function toggleChecklistItem(idx){
      var item = checklistItems[parseInt(idx, 10)];
      if(!item) return;
      item.done = !item.done;
      renderChecklistItems();
      scheduleChecklistSave();
    }

    function deleteChecklistItem(idx){
      checklistItems.splice(parseInt(idx, 10), 1);
      renderChecklistItems();
      scheduleChecklistSave();
    }

    function markAllDone(){
      checklistItems.forEach(function(i){ i.done = true; });
      renderChecklistItems();
      scheduleChecklistSave();
    }

    function clearDoneItems(){
      checklistItems = checklistItems.filter(function(i){ return !i.done; });
      renderChecklistItems();
      scheduleChecklistSave();
    }

    function scheduleChecklistSave(){
      if(checklistSaveTimer) clearTimeout(checklistSaveTimer);
      checklistSaveTimer = setTimeout(flushChecklistSave, CHECKLIST_SAVE_DELAY_MS);
    }

    function flushChecklistSave(){
      checklistSaveTimer = null;
      if(!window.supabase || !window.currentPracticeId) return;
      window.supabase.from("practice_checklist").upsert({
        practice_id: window.currentPracticeId,
        items: JSON.parse(JSON.stringify(checklistItems))
      }, { onConflict: "practice_id" }).then(function(res){
        if(res && res.error) console.warn("Checklist save failed:", res.error);
      });
    }
    window.flushChecklistSave = flushChecklistSave;

    // ---- Plan gating ----

    function checklistIsGated(){
      var plan = typeof window.roomboardGetCurrentPlan === "function" ? window.roomboardGetCurrentPlan() : null;
      return !!(plan && String(plan).indexOf("base") !== -1);
    }

    function promptChecklistUpgrade(){
      if(typeof window.toast === "function") window.toast("The checklist is an Advanced plan feature. Upgrade in Settings → Clinic.");
      if(typeof window.openRoomBoardSettingsDrawer === "function"){
        window.openRoomBoardSettingsDrawer();
        if(typeof window.activateRoomBoardSettingsTab === "function") window.activateRoomBoardSettingsTab("tabAccount");
        var card = document.getElementById("billingCard");
        if(card) setTimeout(function(){ card.scrollIntoView({ behavior: "smooth" }); }, 140);
      }
    }

    window.refreshChecklistGate = function(){
      var btn = document.getElementById("checklistBtn");
      var gated = checklistIsGated();
      if(btn){
        btn.classList.toggle("isPlanGated", gated);
        btn.setAttribute("title", gated ? "Checklist · Advanced plan" : "Open checklist");
      }
      if(gated && checklistPanelOpen) closeChecklist();
    };

    // ---- Open / close ----

    function openChecklist(){
      if(checklistIsGated()){ promptChecklistUpgrade(); return; }
      document.body.classList.add("checklistOpen");
      checklistPanelOpen = true;
      var input = document.getElementById("checklistNewItemInput");
      if(input) setTimeout(function(){ input.focus(); }, 180);
    }

    function closeChecklist(){
      document.body.classList.remove("checklistOpen");
      checklistPanelOpen = false;
    }

    // Re-fetch from DB when another device saves (called by realtime handler)
    window.refreshChecklistFromRemote = function(){
      if(!window.supabase || !window.currentPracticeId) return;
      window.supabase.from("practice_checklist")
        .select("items")
        .eq("practice_id", window.currentPracticeId)
        .maybeSingle()
        .then(function(res){
          if(res && !res.error && res.data) applyChecklistData(res.data);
        });
    };

    // ---- Event listeners ----

    document.addEventListener("click", function(e){
      var target = e.target;
      if(!target) return;

      if(target.id === "checklistBtn" || target.closest && target.closest("#checklistBtn")){
        if(checklistPanelOpen) closeChecklist(); else openChecklist();
        return;
      }
      if(target.id === "closeChecklistBtn" || target.id === "checklistBackdrop"){
        closeChecklist();
        return;
      }
      if(target.id === "checklistAddBtn"){
        var input = document.getElementById("checklistNewItemInput");
        if(input){ addChecklistItem(input.value); input.value = ""; input.focus(); }
        return;
      }
      if(target.id === "clearDoneBtn"){
        clearDoneItems();
        return;
      }
      if(target.id === "markAllDoneBtn"){
        markAllDone();
        return;
      }

      var action = target.getAttribute ? target.getAttribute("data-action") : null;
      if(!action) return;
      var idx = target.getAttribute("data-idx");
      if(idx == null) return;
      if(action === "toggle") toggleChecklistItem(idx);
      else if(action === "delete") deleteChecklistItem(idx);
      else if(action === "edit") startInlineEdit(parseInt(idx, 10));
    });

    document.addEventListener("keydown", function(e){
      // Shift+C opens checklist (unless focus is in an input)
      if(e.key === "C" && e.shiftKey && !e.ctrlKey && !e.metaKey){
        var tag = document.activeElement && document.activeElement.tagName;
        if(tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT"){
          if(checklistPanelOpen) closeChecklist(); else openChecklist();
          return;
        }
      }
      if(e.key === "Escape" && checklistPanelOpen){ closeChecklist(); return; }
      if(e.key === "Enter" && e.target && e.target.id === "checklistNewItemInput"){
        var input = e.target;
        addChecklistItem(input.value);
        input.value = "";
      }
    });

    try{ window.refreshChecklistGate(); }catch(e){}
