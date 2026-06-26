/* RoomBoard marketing site — interactions */
(function () {
  "use strict";

  var root = document.documentElement;

  /* ---------- Theme ---------- */
  var stored = null;
  try { stored = localStorage.getItem("rb-theme"); } catch (e) {}
  if (stored) {
    root.setAttribute("data-theme", stored);
  } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    root.setAttribute("data-theme", "dark");
  }
  var themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("rb-theme", next); } catch (e) {}
    });
  }

  /* ---------- Nav shadow on scroll + back-to-top + board tilt ---------- */
  var nav = document.getElementById("nav");
  var toTop = document.getElementById("toTop");
  function onScroll() {
    var y = window.pageYOffset || document.documentElement.scrollTop;
    if (nav) nav.classList.toggle("scrolled", y > 8);
    if (toTop) toTop.classList.toggle("show", y > 600);
    /* Flatten the hero board perspective as the user scrolls past it */
    var boardEl = document.getElementById("boardDemo");
    if (boardEl && window.innerWidth > 940) {
      var progress = Math.min(y / (window.innerHeight * 0.55), 1);
      var tilt = 8 * (1 - progress);
      boardEl.style.transform = "perspective(1800px) rotateX(" + tilt + "deg)";
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  if (toTop) toTop.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });

  /* ---------- Mobile menu ---------- */
  var menuBtn = document.getElementById("menuBtn");
  var mobileMenu = document.getElementById("mobileMenu");
  function closeMenu() { if (mobileMenu) mobileMenu.classList.remove("open"); }
  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener("click", function () { mobileMenu.classList.toggle("open"); });
    mobileMenu.addEventListener("click", function (e) {
      if (e.target.tagName === "A") closeMenu();
    });
  }

  /* ---------- Scroll reveal with stagger ---------- */
  var revealEls = [].slice.call(document.querySelectorAll(".reveal"));
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          // stagger siblings that enter together
          var parent = entry.target.parentElement;
          var siblings = parent ? [].slice.call(parent.children).filter(function(c){ return c.classList.contains("reveal"); }) : [];
          var idx = siblings.indexOf(entry.target);
          if (idx > 0) entry.target.style.setProperty("--reveal-delay", (idx * 60) + "ms");
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.10, rootMargin: "0px 0px -30px 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------- FAQ accordion ---------- */
  [].slice.call(document.querySelectorAll(".qa-q")).forEach(function (btn) {
    btn.addEventListener("click", function () {
      var qa = btn.closest(".qa");
      var ans = qa.querySelector(".qa-a");
      var isOpen = qa.classList.contains("open");
      // close siblings
      [].slice.call(document.querySelectorAll(".qa.open")).forEach(function (other) {
        if (other !== qa) {
          other.classList.remove("open");
          other.querySelector(".qa-a").style.maxHeight = null;
        }
      });
      if (isOpen) {
        qa.classList.remove("open");
        ans.style.maxHeight = null;
      } else {
        qa.classList.add("open");
        ans.style.maxHeight = ans.scrollHeight + "px";
      }
    });
  });

  /* ---------- Settings tabs demo ---------- */
  var tabbar = document.getElementById("tabbar");
  if (tabbar) {
    tabbar.addEventListener("click", function (e) {
      var t = e.target.closest(".t");
      if (!t) return;
      [].slice.call(tabbar.querySelectorAll(".t")).forEach(function (x) { x.classList.remove("active"); });
      t.classList.add("active");
      var targetId = t.getAttribute("data-p");
      var panels = [].slice.call(document.querySelectorAll("#tabsDemo .panel"));
      panels.forEach(function (p) {
        if (p.id === targetId) return;
        p.classList.add("hidden");
      });
      var target = document.getElementById(targetId);
      if (target) {
        target.classList.remove("hidden");
        target.style.opacity = "0";
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { target.style.opacity = ""; });
        });
      }
    });
  }

  /* ---------- Branding panel — theme picker + clinic name ---------- */
  var btpRow = document.getElementById("btpRow");
  var bbp = document.getElementById("brandBoardPreview");
  var bbpName = document.getElementById("bbpClinicName");

  if (btpRow && bbp) {
    btpRow.addEventListener("click", function (e) {
      var btn = e.target.closest(".btp");
      if (!btn) return;
      [].slice.call(btpRow.querySelectorAll(".btp")).forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      var bg = btn.getAttribute("data-bg");
      var panel = btn.getAttribute("data-panel");
      var text = btn.getAttribute("data-text");
      var border = btn.getAttribute("data-border");
      bbp.style.background = bg;
      bbp.style.borderColor = border;
      bbp.querySelector(".bbp-bar").style.borderBottomColor = border;
      bbp.querySelector(".bbp-name").style.color = text;
    });
  }

  var clinicPills = document.querySelectorAll(".bbp-clinic-pill");
  var bbpLogo = document.getElementById("bbpLogo");
  if (clinicPills.length && bbpName) {
    clinicPills.forEach(function (pill) {
      pill.addEventListener("click", function () {
        clinicPills.forEach(function (p) { p.classList.remove("active"); });
        pill.classList.add("active");
        bbpName.textContent = pill.getAttribute("data-name");
        if (bbpLogo) {
          var logo = pill.querySelector("svg");
          if (logo) bbpLogo.innerHTML = logo.outerHTML;
        }
      });
    });
  }

  /* ---------- Pricing billing toggle ---------- */
  var billingSwitch = document.getElementById("billingSwitch");
  var btMonthly = document.getElementById("btMonthly");
  var btAnnual = document.getElementById("btAnnual");
  var pricingGrid = document.getElementById("pricingGrid");
  var isAnnual = false;

  function updatePricing() {
    var key = isAnnual ? "annual" : "monthly";
    if (billingSwitch) {
      billingSwitch.classList.toggle("billing-annual", isAnnual);
      billingSwitch.classList.toggle("billing-monthly", !isAnnual);
    }
    if (btMonthly) btMonthly.classList.toggle("active", !isAnnual);
    if (btAnnual) btAnnual.classList.toggle("active", isAnnual);
    if (pricingGrid) {
      [].slice.call(pricingGrid.querySelectorAll(".price-num")).forEach(function (el) {
        el.textContent = el.getAttribute("data-" + key);
      });
      [].slice.call(pricingGrid.querySelectorAll(".plan-billing")).forEach(function (el) {
        el.textContent = el.getAttribute("data-" + key);
      });
    }
  }

  if (billingSwitch) {
    billingSwitch.addEventListener("click", function () { isAnnual = !isAnnual; updatePricing(); });
  }
  if (btMonthly) btMonthly.addEventListener("click", function () { isAnnual = false; updatePricing(); });
  if (btAnnual) btAnnual.addEventListener("click", function () { isAnnual = true; updatePricing(); });

  /* ---------- Footer year ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------- Live board demo ---------- */
  var grid = document.getElementById("bdGrid");
  if (grid) {
    // Visit types with soft color fills (the whole tile fills with this color).
    var TYPES = {
      exam:      { label: "Exam",      c: "#3b82f6" },
      followup:  { label: "Follow-up", c: "#18b06b" },
      procedure: { label: "Procedure", c: "#ef476f" },
      consult:   { label: "Consult",   c: "#8b5cf6" },
      workin:    { label: "Work-In",   c: "#f59e0b" }
    };
    // Doctor -> animal badge + initials, like the real board (turtle "LS").
    var BASE = "../public/roomboard/";
    var DOCS = {
      "Dr. Maro":   { img: BASE + "seaturtle-badge.png", init: "JM" },
      "Dr. Reyes":  { img: BASE + "strawberry-badge.png", init: "AR" },
      "Dr. Okafor": { img: BASE + "crab-badge.png", init: "MO" },
      "Dr. Park":   { img: BASE + "french-bulldog-badge.png", init: "SP" },
      "Dr. Hahn":   { img: BASE + "flower-badge.png", init: "EH" }
    };
    var TIMER_WARN = 20 * 60;   // amber
    var TIMER_ALERT = 45 * 60;  // red border + red timer

    var rooms = [
      { name: "Room 1", patient: "R. Patel",  doc: "Dr. Maro",   type: "exam",      secs: 72 * 60 + 14, state: "active", note: "BP 140/90 — refill Lisinopril ready at front desk" },
      { name: "Room 2", patient: "J. Nguyen", doc: "Dr. Reyes",  type: "followup",  secs: 24 * 60 + 8,  state: "active", note: "Follow-up: knee MRI results. Patient anxious — take extra time." },
      { name: "Room 3", patient: "M. Ortiz",  doc: "Dr. Reyes",  type: "procedure", secs: 8 * 60 + 33,  state: "active", note: "Allergic to penicillin. Consent signed. Pre-procedure vitals done." },
      { name: "Room 4", patient: "",          doc: "",           type: "exam",      secs: 0,            state: "empty",  note: "" },
      { name: "Room 5", patient: "C. Wells",  doc: "Dr. Park",   type: "consult",   secs: 31 * 60 + 47, state: "active", note: "Spanish interpreter requested. Family member present." },
      { name: "Room 6", patient: "D. Flynn",  doc: "Dr. Park",   type: "workin",    secs: 7 * 60 + 19,  state: "active", note: "Walk-in: chest tightness. Vitals taken, EKG ordered." }
    ];

    function fmt(secs) {
      var p = function (n) { return (n < 10 ? "0" : "") + n; };
      return p(Math.floor(secs / 3600)) + ":" + p(Math.floor((secs % 3600) / 60)) + ":" + p(secs % 60);
    }

    function esc(s) {
      return String(s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; });
    }

    // Readable text color for a fill (mirrors the app's contrast pick).
    function readableText(hex) {
      var h = hex.replace("#", "");
      if (h.length === 3) h = h.replace(/(.)/g, "$1$1");
      var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.58 ? "#12233b" : "#ffffff";
    }

    function makeCard(r) {
      var ty = TYPES[r.type] || TYPES.exam;
      var el = document.createElement("article");
      var alert = r.state === "active" && r.secs > TIMER_ALERT;
      var warn = r.state === "active" && r.secs > TIMER_WARN && !alert;
      el.className = "room" + (r.state === "empty" ? " empty" : "") + (r.state === "cleaning" ? " cleaning" : "") + (alert ? " alert" : "");
      el.setAttribute("data-room", r.name);
      el.setAttribute("data-type", r.type || "");
      if (r.state === "active") { el.style.setProperty("--c", ty.c); el.style.color = readableText(ty.c); }
      var dischargeBtn = "";
      if (r.state === "active") {
        dischargeBtn = '<button class="roomDischargeBtn" data-discharge title="Discharge patient">🚪 Discharge</button>';
      } else if (r.state === "cleaning") {
        dischargeBtn = '<button class="roomDischargeBtn cleaning" data-discharge title="Mark room clean">🧹 Mark clean</button>';
      }
      var top = '<div class="roomTop"><span class="roomName">' + esc(r.name) + '</span>' + dischargeBtn + '</div>';
      var body;
      var noteRow = "";
      var wbRow = "";
      if (r.state === "empty") {
        body = '<div class="roomBody"><span class="roomEmptyText">Empty</span>'
          + '<div class="roomFoot"><span class="timer" data-timer>' + fmt(0) + '</span></div></div>';
        wbRow = '<div class="wbRow">'
          + '<div class="wbCell wbCellRoom">' + esc(r.name) + '</div>'
          + '<div class="wbCell" style="opacity:.3">Empty</div>'
          + '<div class="wbCell"></div>'
          + '<div class="wbCell"></div>'
          + '<div class="wbCell"></div>'
          + '<div class="wbCell wbTm" data-wb-timer>' + fmt(0) + '</div>'
          + '</div>';
      } else if (r.state === "cleaning") {
        body = '<div class="roomBody"><span class="roomCleanPill">NEEDS TO BE CLEANED</span>'
          + '<div class="roomFoot"><span class="timer warn" data-timer>' + fmt(r.secs) + '</span></div></div>';
        wbRow = '<div class="wbRow">'
          + '<div class="wbCell wbCellRoom">' + esc(r.name) + '</div>'
          + '<div class="wbCell wbCellTy" style="color:#fbbf24">Cleaning</div>'
          + '<div class="wbCell"></div>'
          + '<div class="wbCell"></div>'
          + '<div class="wbCell"></div>'
          + '<div class="wbCell wbTm warn" data-wb-timer>' + fmt(r.secs) + '</div>'
          + '</div>';
      } else {
        var d = DOCS[r.doc] || { img: BASE + "seaturtle-badge.png", init: "DR" };
        var info = esc(r.patient) + '<span class="sep">•</span>' + esc(ty.label) + '<span class="sep">•</span>' + esc(r.doc);
        var badge = '<span class="docBadge"><img alt="" src="' + d.img
          + '" onerror="this.parentNode.classList.add(\'fallback\');this.remove();">'
          + '<span class="docBadgeInit">' + d.init + '</span></span>';
        var notePop = '<div class="notePopover">'
          + '<div class="notePopoverLabel">Notes</div>'
          + '<div class="notePopoverInput">' + esc(r.note) + '</div>'
          + '</div>';
        body = '<div class="roomBody">'
          + '<span class="noteDock' + (r.note ? ' has-note' : '') + '">📝' + notePop + '</span>'
          + '<div class="roomInfoLine">' + info + '</div>'
          + '<div class="roomFoot"><span class="timer' + (alert ? " alert" : (warn ? " warn" : "")) + '" data-timer>' + fmt(r.secs) + '</span>'
          + badge + '</div></div>';
        wbRow = '<div class="wbRow">'
          + '<div class="wbCell wbCellRoom">' + esc(r.name) + '</div>'
          + '<div class="wbCell wbCellPt">' + esc(r.patient) + '</div>'
          + '<div class="wbCell wbCellTy">' + esc(ty.label) + '</div>'
          + '<div class="wbCell wbCellDr"><span class="wbDocInit">' + esc(d.init) + '</span>' + esc(r.doc) + '</div>'
          + '<div class="wbCell wbCellNote' + (r.note ? '' : ' empty') + '">' + (r.note ? esc(r.note) : '—') + '</div>'
          + '<div class="wbCell wbTm' + (alert ? " alert" : (warn ? " warn" : "")) + '" data-wb-timer>' + fmt(r.secs) + '</div>'
          + '</div>';
      }
      el.innerHTML = top + body + noteRow + wbRow;
      return el;
    }

    function renderOne(r) {
      var old = grid.querySelector('[data-room="' + r.name + '"]');
      var neu = makeCard(r);
      if (old) grid.replaceChild(neu, old);
      else grid.appendChild(neu);
    }

    var wbHeaderEl = document.getElementById("bdWbHeader");

    function render() {
      grid.innerHTML = "";
      if (wbHeaderEl) grid.appendChild(wbHeaderEl);
      rooms.forEach(function (r) { grid.appendChild(makeCard(r)); });
    }

    function renderGrouped() {
      grid.innerHTML = "";
      if (wbHeaderEl) grid.appendChild(wbHeaderEl);
      var active = rooms.filter(function (r) { return r.state === "active"; });
      var byDoc = {}, order = [];
      active.forEach(function (r) {
        if (!byDoc[r.doc]) { byDoc[r.doc] = []; order.push(r.doc); }
        byDoc[r.doc].push(r);
      });
      order.forEach(function (doc) {
        var d = DOCS[doc] || { init: "DR" };
        var div = document.createElement("div");
        div.className = "activeDoctorDivider";
        div.innerHTML = '<span class="activeDoctorDividerLabel">'
          + '<span class="wbDocInit">' + esc(d.init) + '</span>'
          + esc(doc)
          + '</span>';
        grid.appendChild(div);
        byDoc[doc].forEach(function (r) { grid.appendChild(makeCard(r)); });
      });
    }

    render();

    // Tick timers in-place — update only the text node, never rebuild DOM,
    // so badge images don't flash on every second.
    setInterval(function () {
      rooms.forEach(function (r) {
        if (r.state === "empty") return;
        r.secs += 1;
        var el = grid.querySelector('[data-room="' + r.name + '"]');
        if (!el) return;
        var alert = r.state === "active" && r.secs > TIMER_ALERT;
        var warn  = r.state === "active" && r.secs > TIMER_WARN && !alert;
        var timerEl = el.querySelector("[data-timer]");
        if (timerEl) {
          timerEl.textContent = fmt(r.secs);
          timerEl.className = "timer" + (alert ? " alert" : (warn ? " warn" : ""));
        }
        var wbTimer = el.querySelector("[data-wb-timer]");
        if (wbTimer) {
          wbTimer.textContent = fmt(r.secs);
          wbTimer.className = "wbTm" + (alert ? " alert" : (warn ? " warn" : ""));
        }
        el.classList.toggle("alert", alert);
      });
    }, 1000);

    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduceMotion) {
      // occasional live-feeling state changes
      var names = ["S. Rivera", "K. Adams", "T. Brooks", "L. Hayes", "D. Flynn", "C. Wells", "P. Shah"];
      var docKeys = Object.keys(DOCS);
      var typeKeys = Object.keys(TYPES);
      var flips = 0;
      setInterval(function () {
        if (dragState && dragState.started) return; // don't reshuffle mid-drag
        var r = rooms[flips % rooms.length];
        flips++;
        // Rooms are only ever discharged by the discharge button — the live
        // feel comes from empty rooms picking up a new patient on their own.
        if (r.state === "empty") {
          r.state = "active";
          r.patient = names[Math.floor(Math.random() * names.length)];
          r.doc = docKeys[Math.floor(Math.random() * docKeys.length)];
          r.type = typeKeys[Math.floor(Math.random() * typeKeys.length)];
          r.secs = Math.floor(Math.random() * 5 * 60) + 30;
        } else { return; } // no state change, skip redraw
        if (onlyActive) { renderGrouped(); } else { renderOne(r); }
        updateActiveCount();
      }, 2800);
    }

    /* ---------- Board interactivity ---------- */
    function updateActiveCount() {
      var el = document.getElementById("bdActiveCount");
      if (el) el.textContent = rooms.filter(function (r) { return r.state === "active"; }).length;
    }

    function hideTryHint() {
      var hint = document.getElementById("bdTryHint");
      if (hint) hint.classList.add("hidden");
    }

    var clickNames = ["S. Rivera", "K. Adams", "T. Brooks", "L. Hayes", "D. Flynn", "C. Wells", "P. Shah", "B. Carter"];
    var clickDocs  = Object.keys(DOCS);
    var clickTypes = Object.keys(TYPES);

    function randomPatient(r) {
      r.state   = "active";
      r.patient = clickNames[Math.floor(Math.random() * clickNames.length)];
      r.doc     = clickDocs[Math.floor(Math.random() * clickDocs.length)];
      r.type    = clickTypes[Math.floor(Math.random() * clickTypes.length)];
      r.secs    = Math.floor(Math.random() * 4 * 60) + 60;
    }

    function closeAllNotePopovers() {
      [].slice.call(grid.querySelectorAll(".notePopover.open")).forEach(function (p) {
        p.classList.remove("open");
        var dock = p.closest(".noteDock");
        if (dock) dock.classList.remove("pop-open");
        var card = p.closest(".room");
        if (card) card.classList.remove("noteOpen");
      });
    }
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".noteDock")) closeAllNotePopovers();
    });

    /* Click a room to cycle its state (also handles noteDock + notePopover) */
    grid.addEventListener("click", function (e) {
      /* A drag just finished — swallow the click it would otherwise fire */
      if (suppressClick) { suppressClick = false; return; }
      /* noteDock: toggle that room's note popover */
      var dock = e.target.closest(".noteDock");
      if (dock) {
        e.stopPropagation();
        var card = dock.closest(".room");
        var pop = dock.querySelector(".notePopover");
        if (pop) {
          var opening = !pop.classList.contains("open");
          closeAllNotePopovers();
          pop.classList.toggle("open", opening);
          dock.classList.toggle("pop-open", opening);
          if (card) card.classList.toggle("noteOpen", opening);
          if (opening) { /* display only */ }
        }
        return;
      }
      /* notePopoverInput: stop propagation so clicking inside doesn't cycle room */
      if (e.target.classList.contains("notePopoverInput")) { e.stopPropagation(); return; }

      /* Discharge button: the ONLY way to take a patient out of a room */
      var dischargeEl = e.target.closest("[data-discharge]");
      if (dischargeEl) {
        e.stopPropagation();
        var dCard = dischargeEl.closest(".room");
        var dRoom = rooms.find(function (r) { return r.name === dCard.getAttribute("data-room"); });
        if (!dRoom) return;
        if (dRoom.state === "active")        { dRoom.state = "cleaning"; dRoom.secs = 0; }
        else if (dRoom.state === "cleaning") { dRoom.state = "empty";    dRoom.secs = 0; }
        if (onlyActive) { renderGrouped(); }
        else { renderOne(dRoom); var dc = grid.querySelector('[data-room="' + dRoom.name + '"]'); if (dc) { dc.classList.add("click-flash"); setTimeout(function () { dc.classList.remove("click-flash"); }, 380); } }
        updateActiveCount();
        hideTryHint();
        return;
      }

      var card = e.target.closest(".room");
      if (!card) return;
      var roomName = card.getAttribute("data-room");
      var room = rooms.find(function (r) { return r.name === roomName; });
      if (!room) return;

      /* Tapping a card no longer discharges — empty rooms just gain a patient */
      if (room.state !== "empty") return;
      randomPatient(room);

      if (onlyActive) {
        renderGrouped();
      } else {
        renderOne(room);
        var newCard = grid.querySelector('[data-room="' + roomName + '"]');
        if (newCard) {
          newCard.classList.add("click-flash");
          setTimeout(function () { newCard.classList.remove("click-flash"); }, 380);
        }
      }
      updateActiveCount();
      hideTryHint();
    });

    /* Note input handler removed — notes are display-only in the demo */
    grid.addEventListener("input", function (e) {
      if (!e.target.classList.contains("notePopoverInput")) return;
    });

    /* ---------- Drag a patient card onto another room to move / swap ---------- */
    var dragState = null;      // { name, startX, startY, started, srcEl, ghost, offX, offY, pointerId }
    var suppressClick = false; // true right after a drag, so the trailing click is ignored
    var DRAG_THRESHOLD = 6;    // px before a press becomes a drag (so taps still cycle state)

    function roomByName(name) { return rooms.find(function (r) { return r.name === name; }); }

    function cardUnder(x, y) {
      var els = document.elementsFromPoint(x, y);
      for (var i = 0; i < els.length; i++) {
        var c = els[i].closest ? els[i].closest(".room") : null;
        if (c && c.parentNode === grid) return c;
      }
      return null;
    }

    function clearDropTarget() {
      var prev = grid.querySelector(".room.drop-target");
      if (prev) prev.classList.remove("drop-target");
    }

    function flashRoom(name) {
      var el = grid.querySelector('[data-room="' + name + '"]');
      if (!el) return;
      el.classList.add("click-flash");
      setTimeout(function () { el.classList.remove("click-flash"); }, 380);
    }

    function swapOccupants(a, b) {
      ["patient", "doc", "type", "secs", "state", "note"].forEach(function (k) {
        var tmp = a[k]; a[k] = b[k]; b[k] = tmp;
      });
    }

    function endDrag(removeGhost) {
      if (dragState) {
        if (removeGhost && dragState.ghost && dragState.ghost.parentNode) {
          dragState.ghost.parentNode.removeChild(dragState.ghost);
        }
        if (dragState.srcEl) dragState.srcEl.classList.remove("dragging");
      }
      clearDropTarget();
      grid.classList.remove("drag-active");
      dragState = null;
    }

    function startDrag(e) {
      dragState.started = true;
      closeAllNotePopovers();
      var card = dragState.srcEl;
      var rect = card.getBoundingClientRect();
      var ghost = card.cloneNode(true);
      ghost.classList.add("drag-ghost");
      ghost.style.width = rect.width + "px";
      ghost.style.height = rect.height + "px";
      dragState.offX = dragState.startX - rect.left;
      dragState.offY = dragState.startY - rect.top;
      document.body.appendChild(ghost);
      dragState.ghost = ghost;
      moveGhost(e.clientX, e.clientY);
      card.classList.add("dragging");
      grid.classList.add("drag-active");
      hideTryHint();
    }

    function moveGhost(x, y) {
      if (!dragState || !dragState.ghost) return;
      dragState.ghost.style.transform =
        "translate(" + (x - dragState.offX) + "px," + (y - dragState.offY) + "px) rotate(2deg) scale(1.03)";
    }

    grid.addEventListener("pointerdown", function (e) {
      if (e.button != null && e.button > 0) return; // primary button / touch only
      if (isListView) return;                        // grid views only
      if (e.target.closest(".noteDock")) return;     // let notes open normally
      if (e.target.closest("[data-discharge]")) return; // discharge button isn't a drag handle
      var card = e.target.closest(".room");
      if (!card || card.parentNode !== grid) return;
      var room = roomByName(card.getAttribute("data-room"));
      if (!room || room.state !== "active") return;  // only occupied rooms are draggable
      dragState = {
        name: room.name, startX: e.clientX, startY: e.clientY,
        started: false, srcEl: card, pointerId: e.pointerId
      };
    });

    window.addEventListener("pointermove", function (e) {
      if (!dragState) return;
      if (!dragState.started) {
        if (Math.abs(e.clientX - dragState.startX) < DRAG_THRESHOLD &&
            Math.abs(e.clientY - dragState.startY) < DRAG_THRESHOLD) return;
        startDrag(e);
      }
      moveGhost(e.clientX, e.clientY);
      clearDropTarget();
      var tgt = cardUnder(e.clientX, e.clientY);
      if (tgt && tgt !== dragState.srcEl) tgt.classList.add("drop-target");
    }, { passive: true });

    window.addEventListener("pointerup", function (e) {
      if (!dragState) return;
      if (!dragState.started) { dragState = null; return; } // a tap → let click cycle state
      var srcName = dragState.name;
      var tgtEl = cardUnder(e.clientX, e.clientY);
      var srcRoom = roomByName(srcName);
      var tgtRoom = (tgtEl && tgtEl !== dragState.srcEl) ? roomByName(tgtEl.getAttribute("data-room")) : null;
      endDrag(true);
      suppressClick = true; // a real drag happened — cancel the click that follows
      if (srcRoom && tgtRoom) {
        swapOccupants(srcRoom, tgtRoom);
        if (onlyActive) { renderGrouped(); } else { render(); }
        flashRoom(srcRoom.name);
        flashRoom(tgtRoom.name);
        updateActiveCount();
      }
    });

    window.addEventListener("pointercancel", function () {
      if (dragState && dragState.started) endDrag(true);
      else dragState = null;
    });

    /* "+" button: add patient to first empty room, shake if none available */
    var addBtn = document.getElementById("bdAddBtn");
    if (addBtn) {
      addBtn.addEventListener("click", function () {
        var empty = rooms.find(function (r) { return r.state === "empty"; });
        if (empty) {
          randomPatient(empty); renderOne(empty); updateActiveCount(); hideTryHint();
        } else {
          addBtn.classList.add("shake");
          setTimeout(function () { addBtn.classList.remove("shake"); }, 380);
        }
      });
    }

    /* ONLY ACTIVE toggle — filters to active rooms grouped by doctor */
    var onlyActiveBtn = document.getElementById("bdOnlyActive");
    var onlyActive = false;
    if (onlyActiveBtn) {
      onlyActiveBtn.addEventListener("click", function () {
        onlyActive = !onlyActive;
        onlyActiveBtn.classList.toggle("on", onlyActive);
        grid.classList.toggle("only-active", onlyActive);
        if (onlyActive) { renderGrouped(); } else { render(); }
      });
    }

    /* Grid / List view toggle */
    var viewToggleBtn = document.getElementById("bdViewToggle");
    var isListView = false;
    if (viewToggleBtn) {
      viewToggleBtn.addEventListener("click", function () {
        isListView = !isListView;
        grid.classList.toggle("list-view", isListView);
        viewToggleBtn.classList.toggle("active", isListView);
        viewToggleBtn.textContent = isListView ? "☰" : "▦";
      });
    }

    /* Notes mode toggle: open all note popovers at once */
    var notesToggleBtn = document.getElementById("bdNotesToggle");
    var notesMode = false;
    if (notesToggleBtn) {
      notesToggleBtn.addEventListener("click", function () {
        notesMode = !notesMode;
        notesToggleBtn.classList.toggle("active", notesMode);
        if (notesMode) {
          [].slice.call(grid.querySelectorAll(".room:not(.empty):not(.cleaning) .notePopover")).forEach(function (p) {
            p.classList.add("open");
          });
        } else {
          closeAllNotePopovers();
        }
      });
    }
  }

  /* ---------- Scroll progress bar ---------- */
  var progressBar = document.getElementById("scrollProgress");
  function updateProgress() {
    if (!progressBar) return;
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    progressBar.style.width = (docHeight > 0 ? (scrollTop / docHeight) * 100 : 0) + "%";
  }
  window.addEventListener("scroll", updateProgress, { passive: true });
  updateProgress();

  /* ---------- Enhanced board parallax — Y shift added to existing tilt ---------- */
  /* Override the onScroll board tilt to also add a gentle Y translation */
  (function patchBoardScroll() {
    var boardEl = document.getElementById("boardDemo");
    if (!boardEl) return;
    var origOnScroll = onScroll;
    window.removeEventListener("scroll", origOnScroll);
    window.addEventListener("scroll", function () {
      var y = window.pageYOffset || document.documentElement.scrollTop;
      /* nav + back-to-top (replicate original) */
      if (nav) nav.classList.toggle("scrolled", y > 8);
      if (toTop) toTop.classList.toggle("show", y > 600);
      updateProgress();
      /* Board tilt + parallax Y */
      if (window.innerWidth > 940) {
        var progress = Math.min(y / (window.innerHeight * 0.55), 1);
        var tilt  = 8 * (1 - progress);
        var yShift = -progress * 28;
        boardEl.style.transform = "perspective(1800px) rotateX(" + tilt + "deg) translateY(" + yShift + "px)";
      }
    }, { passive: true });
  }());

  /* ---------- Count-up animation for waitstat numbers ---------- */
  var countEls = [].slice.call(document.querySelectorAll("[data-count]"));
  if (countEls.length && "IntersectionObserver" in window) {
    var countIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var target = parseFloat(el.getAttribute("data-count"));
        var suffix = el.getAttribute("data-suffix") || "";
        var decimals = (target % 1 !== 0) ? 1 : 0;
        var duration = 1600;
        var startTime = null;
        function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
        function tick(now) {
          if (!startTime) startTime = now;
          var t = Math.min((now - startTime) / duration, 1);
          el.textContent = (target * easeOut(t)).toFixed(decimals) + suffix;
          if (t < 1) { requestAnimationFrame(tick); }
          else { el.textContent = target.toFixed(decimals) + suffix; el.classList.add("counted"); }
        }
        requestAnimationFrame(tick);
        countIO.unobserve(el);
      });
    }, { threshold: 0.4 });
    countEls.forEach(function (el) { countIO.observe(el); });
  }

  /* ---------- Section-head entrance animation ---------- */
  var sectionHeads = [].slice.call(document.querySelectorAll(".section-head"));
  if (sectionHeads.length && "IntersectionObserver" in window) {
    var headIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("head-in");
          headIO.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    sectionHeads.forEach(function (el) { headIO.observe(el); });
  }

})();

/* ---------- Logged-in practice badge ----------
   When a RoomBoard session is active (same-origin localStorage), replace the
   nav "Sign in" / "Start free trial" buttons with a small box showing the
   practice name that links straight to the board. */
(function () {
  "use strict";

  var AUTH_KEY = "roomboard.website.auth.v1";        // Supabase session (set by the app)
  var BADGE_KEY = "roomboard.website.practiceBadge.v1"; // { name, userId, ts }

  function readJson(store, key) {
    try { var raw = store.getItem(key); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  }

  function getSession() {
    var s = readJson(window.localStorage, AUTH_KEY) || readJson(window.sessionStorage, AUTH_KEY);
    if (!s) return null;
    if (s.currentSession) s = s.currentSession; // tolerate older session shapes
    return s;
  }

  function isLoggedIn() {
    var s = getSession();
    if (!s || !s.access_token) return false;
    var exp = Number(s.expires_at); // unix seconds
    if (isFinite(exp) && exp > 0 && exp * 1000 <= Date.now()) return false; // expired
    return true;
  }

  function getPracticeName() {
    var b = readJson(window.localStorage, BADGE_KEY);
    return b && b.name ? String(b.name).trim() : "";
  }

  function render() {
    var actions = document.querySelector(".nav-actions");
    if (!actions) return;

    var name = getPracticeName();
    var loggedIn = !!name && isLoggedIn();

    // The Sign in / trial buttons and the badge all set an explicit `display`,
    // so toggle a container class and let CSS control which one is visible
    // (relying on the [hidden] attribute would be overridden by those rules).
    actions.classList.toggle("is-authed", loggedIn);

    if (loggedIn) {
      var badge = document.getElementById("navPracticeBadge");
      if (!badge) {
        badge = document.createElement("a");
        badge.id = "navPracticeBadge";
        badge.className = "nav-practice-badge";
        badge.href = "/app/index.html?next=board";
        badge.title = "Open your board";
        badge.innerHTML = '<span class="nav-practice-dot" aria-hidden="true"></span><span class="nav-practice-name"></span>';
        actions.appendChild(badge);
      }
      badge.querySelector(".nav-practice-name").textContent = name;
    }
  }

  render();

  // Reflect login/logout that happens in another tab.
  window.addEventListener("storage", function (e) {
    if (!e.key || e.key === AUTH_KEY || e.key === BADGE_KEY) render();
  });
})();
