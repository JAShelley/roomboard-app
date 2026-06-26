    // ===== Per-patient checklist (Advanced) =====
    // A dropdown checklist attached to each occupied room card. Single-click a
    // card opens it; double-click still opens the edit panel. Items live on
    // room.checklist (synced with the rest of room state) and seed from the
    // practice default when a patient is added. Advanced-plan only.

    var openPatientChecklistRoomId = "";
    var pclClickTimer = null;
    var pclSaveTimer = null;

    function pclIsGated(){
      var plan = typeof window.roomboardGetCurrentPlan === "function" ? window.roomboardGetCurrentPlan() : null;
      return !!(plan && String(plan).indexOf("base") !== -1);
    }

    function pclEligibleRoom(room){
      return !!(room && room.patientName && !room.needsCleaning);
    }

    function pclEsc(s){
      return (typeof escapeHtml === "function") ? escapeHtml(String(s == null ? "" : s)) : String(s == null ? "" : s);
    }

    function pclItemsHtml(room){
      var items = Array.isArray(room.checklist) ? room.checklist : [];
      if(!items.length) return '<li class="pclEmpty">No items yet — add one below.</li>';
      return items.map(function(item, idx){
        var done = !!item.done;
        return '<li class="pclItem' + (done ? " isDone" : "") + '" data-pcl-idx="' + idx + '">'
          + '<button class="pclCheck" data-pcl-check="' + pclEsc(room.id) + '" data-pcl-idx="' + idx + '" type="button" aria-label="Toggle">' + (done ? "✓" : "") + '</button>'
          + '<span class="pclText">' + pclEsc(item.text || "") + '</span>'
          + '<button class="pclDel" data-pcl-del="' + pclEsc(room.id) + '" data-pcl-idx="' + idx + '" type="button" title="Remove" aria-label="Remove">×</button>'
          + '</li>';
      }).join("");
    }

    function pclFeatureEnabled(){
      return !(typeof state !== "undefined" && state && state.settings && state.settings.patientChecklistEnabled === false);
    }

    // Called from the room card renderer (rendering.js).
    window.buildPatientChecklistDockHtml = function(room){
      if(pclIsGated() || !pclFeatureEnabled() || !pclEligibleRoom(room)) return "";
      var items = Array.isArray(room.checklist) ? room.checklist : [];
      var doneCount = 0;
      for(var i = 0; i < items.length; i++){ if(items[i] && items[i].done) doneCount++; }
      var isOpen = (openPatientChecklistRoomId === room.id);
      return '<div class="pclDock' + (isOpen ? " isOpen" : "") + '" data-pcl-room="' + pclEsc(room.id) + '">'
        + '<div class="pclPanel">'
          + '<div class="pclPanelInner">'
            + '<div class="pclHeader">'
              + '<span class="pclHeaderLabel">Checklist</span>'
              + '<span class="pclCount">' + doneCount + '/' + items.length + '</span>'
            + '</div>'
            + '<ul class="pclList">' + pclItemsHtml(room) + '</ul>'
            + '<div class="pclAddRow">'
              + '<input class="pclInput" data-pcl-input="' + pclEsc(room.id) + '" type="text" placeholder="Add item…" maxlength="120">'
              + '<button class="btn sm primary pclAddBtn" data-pcl-add="' + pclEsc(room.id) + '" type="button">Add</button>'
            + '</div>'
          + '</div>'
        + '</div>'
      + '</div>';
    };

    function pclFindDock(roomId){
      return document.querySelector('.pclDock[data-pcl-room="' + (window.CSS && CSS.escape ? CSS.escape(roomId) : roomId) + '"]');
    }

    // Re-render one dock's list + count in place (keeps the panel open / focus).
    function pclRerenderDock(room){
      var dock = pclFindDock(room.id);
      if(!dock) return;
      var list = dock.querySelector(".pclList");
      if(list) list.innerHTML = pclItemsHtml(room);
      var items = Array.isArray(room.checklist) ? room.checklist : [];
      var doneCount = 0;
      for(var i = 0; i < items.length; i++){ if(items[i] && items[i].done) doneCount++; }
      var count = dock.querySelector(".pclCount");
      if(count) count.textContent = doneCount + "/" + items.length;
    }

    function pclTogglePanel(roomId){
      openPatientChecklistRoomId = (openPatientChecklistRoomId === roomId) ? "" : roomId;
      var docks = document.querySelectorAll(".pclDock");
      for(var i = 0; i < docks.length; i++){
        docks[i].classList.toggle("isOpen", docks[i].getAttribute("data-pcl-room") === openPatientChecklistRoomId);
      }
      if(openPatientChecklistRoomId){
        var dock = pclFindDock(openPatientChecklistRoomId);
        var input = dock ? dock.querySelector(".pclInput") : null;
        if(input) setTimeout(function(){ try{ input.focus(); }catch(e){} }, 120);
      }
    }

    function pclScheduleSave(){
      if(typeof holdRemoteUpdates === "function") holdRemoteUpdates(1500);
      if(pclSaveTimer) clearTimeout(pclSaveTimer);
      pclSaveTimer = setTimeout(function(){
        pclSaveTimer = null;
        if(typeof saveLocal === "function") saveLocal();
        if(typeof commitBoardInBackground === "function") commitBoardInBackground({ immediate: true });
      }, 500);
    }

    function pclAddItem(roomId, text){
      text = String(text || "").trim();
      if(!text) return;
      var room = (typeof findRoomById === "function") ? findRoomById(roomId) : null;
      if(!room) return;
      if(!Array.isArray(room.checklist)) room.checklist = [];
      var item = (typeof window.makeChecklistItem === "function")
        ? window.makeChecklistItem(text)
        : { id: "pcl-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8), text: text, done: false };
      room.checklist.push(item);
      pclRerenderDock(room);
      pclScheduleSave();
    }

    function pclToggleItem(roomId, idx){
      var room = (typeof findRoomById === "function") ? findRoomById(roomId) : null;
      if(!room || !Array.isArray(room.checklist)) return;
      var item = room.checklist[parseInt(idx, 10)];
      if(!item) return;
      item.done = !item.done;
      pclRerenderDock(room);
      pclScheduleSave();
    }

    function pclDeleteItem(roomId, idx){
      var room = (typeof findRoomById === "function") ? findRoomById(roomId) : null;
      if(!room || !Array.isArray(room.checklist)) return;
      room.checklist.splice(parseInt(idx, 10), 1);
      pclRerenderDock(room);
      pclScheduleSave();
    }

    // Re-run after a plan change: gated users lose the dock + open panel.
    window.refreshPatientChecklistGate = function(){
      if(pclIsGated()){
        openPatientChecklistRoomId = "";
        if(typeof requestRenderDisplay === "function") requestRenderDisplay();
        else if(typeof renderDisplay === "function") renderDisplay();
      }
    };

    document.addEventListener("click", function(e){
      var t = e.target;
      if(!t || !t.closest) return;

      var addBtn = t.closest("[data-pcl-add]");
      if(addBtn){
        var addRid = addBtn.getAttribute("data-pcl-add");
        var dock = pclFindDock(addRid);
        var input = dock ? dock.querySelector(".pclInput") : null;
        if(input){ pclAddItem(addRid, input.value); input.value = ""; input.focus(); }
        e.stopPropagation();
        return;
      }
      var checkBtn = t.closest("[data-pcl-check]");
      if(checkBtn){
        pclToggleItem(checkBtn.getAttribute("data-pcl-check"), checkBtn.getAttribute("data-pcl-idx"));
        e.stopPropagation();
        return;
      }
      var delBtn = t.closest("[data-pcl-del]");
      if(delBtn){
        pclDeleteItem(delBtn.getAttribute("data-pcl-del"), delBtn.getAttribute("data-pcl-idx"));
        e.stopPropagation();
        return;
      }
      var togBtn = t.closest("[data-pcl-toggle]");
      if(togBtn){
        pclTogglePanel(togBtn.getAttribute("data-pcl-toggle"));
        e.stopPropagation();
        return;
      }
      // Clicks inside an open panel shouldn't bubble up to the card toggle.
      if(t.closest(".pclPanel")){ return; }

      // Single-click on a room card body → toggle checklist (double-click = edit).
      var grid = document.getElementById("displayGrid");
      if(!grid || !grid.contains(t)) return;
      var card = t.closest(".room");
      if(!card) return;
      if(t.closest("button, .btn, .iconBtn, [data-action], input, textarea, select, a, summary, .roomNotesDock, .pclPanel")) return;
      var rid = card.getAttribute("data-room-id") || (card.dataset && card.dataset.roomId) || "";
      if(!rid) return;
      var room = (typeof findRoomById === "function") ? findRoomById(rid) : null;
      if(!room || pclIsGated() || !pclFeatureEnabled() || !pclEligibleRoom(room)) return;
      // Disambiguate from a double-click (which opens edit): the second click of
      // a pair cancels the pending single-click toggle.
      if(pclClickTimer){ clearTimeout(pclClickTimer); pclClickTimer = null; return; }
      pclClickTimer = setTimeout(function(){ pclClickTimer = null; pclTogglePanel(rid); }, 250);
    });

    document.addEventListener("dblclick", function(){
      if(pclClickTimer){ clearTimeout(pclClickTimer); pclClickTimer = null; }
    });

    document.addEventListener("keydown", function(e){
      if(e.key === "Enter" && e.target && e.target.classList && e.target.classList.contains("pclInput")){
        var rid = e.target.getAttribute("data-pcl-input");
        pclAddItem(rid, e.target.value);
        e.target.value = "";
        e.preventDefault();
      }
    });
