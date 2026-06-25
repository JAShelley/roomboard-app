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
      { name: "Room 1", patient: "R. Patel",  doc: "Dr. Maro",   type: "exam",      secs: 72 * 60 + 14, state: "active" },
      { name: "Room 2", patient: "J. Nguyen", doc: "Dr. Reyes",  type: "followup",  secs: 24 * 60 + 8,  state: "active" },
      { name: "Room 3", patient: "M. Ortiz",  doc: "Dr. Okafor", type: "procedure", secs: 8 * 60 + 33,  state: "active" },
      { name: "Room 4", patient: "",          doc: "",           type: "exam",      secs: 0,            state: "empty"  },
      { name: "Room 5", patient: "C. Wells",  doc: "Dr. Park",   type: "consult",   secs: 31 * 60 + 47, state: "active" },
      { name: "Room 6", patient: "D. Flynn",  doc: "Dr. Hahn",   type: "workin",    secs: 7 * 60 + 19,  state: "active" }
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
      if (r.state === "active") { el.style.setProperty("--c", ty.c); el.style.color = readableText(ty.c); }
      var icons = '<span class="roomIcons">🐾 ↪ ▤</span>';
      var top = '<div class="roomTop"><span class="roomName">' + esc(r.name) + '</span>' + icons + '</div>';
      var body;
      if (r.state === "empty") {
        body = '<div class="roomBody"><span class="roomEmptyText">Empty</span>'
          + '<div class="roomFoot"><span class="timer" data-timer>' + fmt(0) + '</span></div></div>';
      } else if (r.state === "cleaning") {
        body = '<div class="roomBody"><span class="roomCleanPill">NEEDS TO BE CLEANED</span>'
          + '<div class="roomFoot"><span class="timer warn" data-timer>' + fmt(r.secs) + '</span></div></div>';
      } else {
        var d = DOCS[r.doc] || { img: BASE + "seaturtle-badge.png", init: "DR" };
        var info = esc(r.patient) + '<span class="sep">•</span>' + esc(ty.label) + '<span class="sep">•</span>' + esc(r.doc);
        var badge = '<span class="docBadge"><img alt="" src="' + d.img
          + '" onerror="this.parentNode.classList.add(\'fallback\');this.remove();">'
          + '<span class="docBadgeInit">' + d.init + '</span></span>';
        body = '<div class="roomBody">'
          + '<span class="noteDock">📝</span>'
          + '<div class="roomInfoLine">' + info + '</div>'
          + '<div class="roomFoot"><span class="timer' + (alert ? " alert" : (warn ? " warn" : "")) + '" data-timer>' + fmt(r.secs) + '</span>'
          + badge + '</div></div>';
      }
      el.innerHTML = top + body;
      return el;
    }

    function renderOne(r) {
      var old = grid.querySelector('[data-room="' + r.name + '"]');
      var neu = makeCard(r);
      if (old) grid.replaceChild(neu, old);
      else grid.appendChild(neu);
    }

    function render() {
      grid.innerHTML = "";
      rooms.forEach(function (r) { grid.appendChild(makeCard(r)); });
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
        var timerEl = el.querySelector("[data-timer]");
        if (!timerEl) return;
        var alert = r.state === "active" && r.secs > TIMER_ALERT;
        var warn  = r.state === "active" && r.secs > TIMER_WARN && !alert;
        timerEl.textContent = fmt(r.secs);
        timerEl.className = "timer" + (alert ? " alert" : (warn ? " warn" : ""));
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
        var r = rooms[flips % rooms.length];
        flips++;
        if (r.state === "empty") {
          r.state = "active";
          r.patient = names[Math.floor(Math.random() * names.length)];
          r.doc = docKeys[Math.floor(Math.random() * docKeys.length)];
          r.type = typeKeys[Math.floor(Math.random() * typeKeys.length)];
          r.secs = Math.floor(Math.random() * 5 * 60) + 30;
        } else if (r.state === "cleaning") {
          r.state = "empty"; r.secs = 0;
        } else if (r.secs > TIMER_ALERT && Math.random() > 0.5) {
          r.state = "cleaning"; r.secs = Math.floor(Math.random() * 60) + 5;
        } else { return; } // no state change, skip redraw
        // Only redraw the single card that changed
        renderOne(r);
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

    /* Click a room to cycle its state */
    grid.addEventListener("click", function (e) {
      var card = e.target.closest(".room");
      if (!card) return;
      var roomName = card.getAttribute("data-room");
      var room = rooms.find(function (r) { return r.name === roomName; });
      if (!room) return;

      if (room.state === "active")        { room.state = "cleaning"; room.secs = 0; }
      else if (room.state === "cleaning") { room.state = "empty";    room.secs = 0; }
      else                                { randomPatient(room); }

      renderOne(room);
      /* Flash the new card (renderOne already replaced the DOM node) */
      var newCard = grid.querySelector('[data-room="' + roomName + '"]');
      if (newCard) {
        newCard.classList.add("click-flash");
        setTimeout(function () { newCard.classList.remove("click-flash"); }, 380);
      }
      updateActiveCount();
      hideTryHint();
    });

    /* "+" button adds a patient to the first empty room */
    var addBtn = document.getElementById("bdAddBtn");
    if (addBtn) {
      addBtn.addEventListener("click", function () {
        var empty = rooms.find(function (r) { return r.state === "empty"; });
        if (empty) { randomPatient(empty); renderOne(empty); updateActiveCount(); hideTryHint(); }
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
