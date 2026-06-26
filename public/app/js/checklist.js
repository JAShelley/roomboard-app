    // ===== Practice Checklist =====
    // Single JSONB row per clinic in practice_checklist.
    // Loaded inside the existing loadPracticeData() Promise.all — zero extra round-trips.
    // Writes are debounced; realtime fires a single re-fetch when another device saves.

    var checklistItems = [];
    var checklistSaveTimer = null;
    var checklistPanelOpen = false;
    var CHECKLIST_SAVE_DELAY_MS = 600;

    function applyChecklistData(row){
      checklistItems = Array.isArray(row && row.items) ? JSON.parse(JSON.stringify(row.items)) : [];
      renderChecklistItems();
    }
    window.applyChecklistData = applyChecklistData;

    function renderChecklistItems(){
      var list = document.getElementById("checklistList");
      if(!list) return;
      if(!checklistItems.length){
        list.innerHTML = '<li class="checklistEmpty">No items yet. Add one above.</li>';
        return;
      }
      list.innerHTML = checklistItems.map(function(item, idx){
        var done = !!item.done;
        return '<li class="checklistItem' + (done ? " isDone" : "") + '" data-idx="' + idx + '">'
          + '<button class="checklistItemCheck" data-action="toggle" data-idx="' + idx + '" type="button">'
          + (done ? "✓" : "") + '</button>'
          + '<span class="checklistItemText">' + escapeHtml(String(item.text || "")) + '</span>'
          + '<button class="checklistItemDelete" data-action="delete" data-idx="' + idx + '" title="Remove" type="button">×</button>'
          + '</li>';
      }).join("");
    }

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

    // ===== Advanced-plan gating =====
    // The checklist is an Advanced-only feature. Base subscribers can't open it.
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

    // Reflect plan state on the header button and close the panel if a user
    // loses access (e.g. downgrade or plan refresh). Called from the central
    // refreshAdvancedPlanGating() hook in settings.js.
    window.refreshChecklistGate = function(){
      var btn = document.getElementById("checklistBtn");
      var gated = checklistIsGated();
      if(btn){
        btn.classList.toggle("isPlanGated", gated);
        btn.setAttribute("title", gated ? "Checklist · Advanced plan" : "Open checklist");
      }
      if(gated && checklistPanelOpen) closeChecklist();
    };

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

    document.addEventListener("click", function(e){
      var target = e.target;
      if(!target) return;

      if(target.id === "checklistBtn"){
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

      var action = target.getAttribute("data-action");
      if(!action) return;
      var idx = target.getAttribute("data-idx");
      if(idx == null) return;
      if(action === "toggle") toggleChecklistItem(idx);
      else if(action === "delete") deleteChecklistItem(idx);
    });

    document.addEventListener("keydown", function(e){
      if(e.key === "Escape" && checklistPanelOpen){ closeChecklist(); return; }
      if(e.key === "Enter" && e.target && e.target.id === "checklistNewItemInput"){
        var input = e.target;
        addChecklistItem(input.value);
        input.value = "";
      }
    });

    // Reflect plan gating on load (billing status refresh re-runs this too).
    try{ window.refreshChecklistGate(); }catch(e){}
