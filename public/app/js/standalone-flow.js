(function(){
  var AUTH_STORAGE_KEY = "roomboard.website.auth.v1";
  var standaloneClickBound = false;

  function getParams(){
    try{ return new URLSearchParams(window.location.search || ""); }catch(e){ return new URLSearchParams(""); }
  }

  function normalizeAuthMode(value){
    var mode = String(value || "").toLowerCase();
    return mode === "create" || mode === "signup" || mode === "sign-up" ? "create" : "login";
  }

  // Opt-in: when a link carries ?next=board, skip the Setup step and go
  // straight to the live board once the user is authenticated.
  function wantsBoard(){
    return String(getParams().get("next") || "").toLowerCase() === "board";
  }

  function getRoute(){
    var params = getParams();
    var mode = String(params.get("mode") || "").toLowerCase();
    var auth = params.get("auth");
    var standalone = mode === "startup"
      || mode === "setup"
      || mode === "login"
      || mode === "signup"
      || auth != null;
    return {
      mode: mode,
      authMode: normalizeAuthMode(auth || mode),
      standalone: standalone
    };
  }

  function hasSessionInStorage(storage){
    if(!storage) return false;
    try{
      var raw = storage.getItem(AUTH_STORAGE_KEY);
      if(!raw) return false;
      if(raw.indexOf("access_token") >= 0 || raw.indexOf("refresh_token") >= 0) return true;
      var parsed = JSON.parse(raw);
      return !!(parsed && (parsed.access_token || parsed.refresh_token || parsed.currentSession));
    }catch(e){
      return false;
    }
  }

  function hasStoredAuthSession(){
    return hasSessionInStorage(window.localStorage) || hasSessionInStorage(window.sessionStorage);
  }

  // Extract Supabase tokens from any storage format the client might use.
  function getStoredTokens(){
    var storages = [window.localStorage, window.sessionStorage];
    for(var i = 0; i < storages.length; i++){
      try{
        var raw = storages[i] && storages[i].getItem(AUTH_STORAGE_KEY);
        if(!raw) continue;
        var parsed = JSON.parse(raw);
        if(!parsed) continue;
        var sess = parsed.currentSession || parsed;
        if(sess && sess.access_token){
          return { accessToken: sess.access_token, refreshToken: sess.refresh_token || "" };
        }
      }catch(e){}
    }
    return null;
  }

  function setVisualStage(stage){
    var route = getRoute();
    if(!document.body) return;
    document.body.classList.toggle("roomboardStandaloneMode", route.standalone);
    document.body.classList.toggle("standaloneAuthMode", route.standalone && stage === "auth");
    document.body.classList.toggle("standaloneSetupMode", route.standalone && stage === "setup");
  }

  function openSettingsSurface(){
    if(typeof window.openRoomBoardSettingsDrawer === "function"){
      window.openRoomBoardSettingsDrawer();
    } else if(document.body) {
      document.body.classList.add("drawerOpen");
    }
  }

  function closeSettingsSurface(){
    if(typeof window.closeRoomBoardSettingsDrawer === "function"){
      window.closeRoomBoardSettingsDrawer();
    } else if(document.body) {
      document.body.classList.remove("drawerOpen");
    }
  }

  function activateSettingsTab(tabId){
    if(typeof window.activateRoomBoardSettingsTab === "function"){
      window.activateRoomBoardSettingsTab(tabId);
      return;
    }
    window.setTimeout(function(){ activateSettingsTab(tabId); }, 25);
  }

  function applyAuthMode(mode){
    var authMode = normalizeAuthMode(mode);
    if(typeof window.setRoomBoardAuthAccessMode === "function"){
      window.setRoomBoardAuthAccessMode(authMode);
      return;
    }
    var selector = '.authModeBtn[data-auth-mode="' + authMode + '"]';
    var btn = document.querySelector(selector);
    if(btn) btn.click();
  }

  function replaceMode(mode){
    try{
      var url = new URL(window.location.href);
      url.searchParams.set("mode", mode);
      url.searchParams.delete("auth");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }catch(e){}
  }

  /* ── Auth overlay ──────────────────────────────────────────────────── */

  function injectAuthOverlayStyles(){
    if(document.getElementById("rbAuthOverlayStyles")) return;
    var s = document.createElement("style");
    s.id = "rbAuthOverlayStyles";
    s.textContent = [
      "#rbAuthOverlay{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;",
        "background:rgba(4,9,18,.93);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);",
        "padding:20px;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;}",
      ".rbACard{background:#0d1929;border:1px solid rgba(255,255,255,.11);border-radius:22px;",
        "padding:36px 38px;max-width:460px;width:100%;box-shadow:0 48px 96px rgba(0,0,0,.75);",
        "overflow-y:auto;max-height:90vh;}",
      ".rbABrand{display:flex;align-items:center;gap:11px;justify-content:center;margin-bottom:28px;}",
      ".rbAMark{width:36px;height:36px;border-radius:11px;display:grid;place-items:center;flex:none;",
        "background:linear-gradient(140deg,#11a39b,#0a5f5b);color:#fff;}",
      ".rbAMark svg{width:21px;height:21px;}",
      ".rbAWordmark{font-size:24px;font-weight:800;color:#eaf1ff;letter-spacing:-.04em;font-style:italic;}",
      ".rbATabs{display:flex;background:rgba(255,255,255,.06);border-radius:12px;padding:3px;gap:3px;margin-bottom:24px;}",
      ".rbATab{flex:1;background:none;border:none;color:rgba(220,232,255,.45);font-size:14px;font-weight:600;",
        "padding:10px;border-radius:9px;cursor:pointer;transition:background .15s,color .15s;}",
      ".rbATab.active{background:rgba(255,255,255,.11);color:#eaf1ff;}",
      ".rbAField{margin-bottom:14px;}",
      ".rbAField label{display:block;font-size:11.5px;font-weight:700;color:rgba(160,178,218,.75);",
        "text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;}",
      ".rbAField input,.rbAField select{width:100%;padding:11px 13px;",
        "background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.10);",
        "border-radius:10px;color:#eaf1ff;font-size:14px;outline:none;",
        "transition:border-color .15s,box-shadow .15s;-webkit-appearance:none;}",
      ".rbAField input:focus,.rbAField select:focus{border-color:rgba(17,163,155,.65);",
        "box-shadow:0 0 0 3px rgba(17,163,155,.14);}",
      ".rbAField input::placeholder{color:rgba(160,178,218,.35);}",
      ".rbAField select option{background:#0d1929;color:#eaf1ff;}",
      ".rbARow{display:grid;grid-template-columns:1fr 1fr;gap:12px;}",
      "@media(max-width:500px){.rbARow{grid-template-columns:1fr;}}",
      ".rbAError{background:rgba(239,68,68,.11);border:1px solid rgba(239,68,68,.28);border-radius:10px;",
        "padding:10px 14px;font-size:13px;color:#fca5a5;margin-bottom:14px;display:none;}",
      ".rbASubmit{width:100%;padding:14px;border-radius:12px;border:none;cursor:pointer;",
        "font-size:15px;font-weight:700;letter-spacing:-.01em;",
        "background:linear-gradient(135deg,#11a39b,#0a6060);color:#fff;",
        "transition:opacity .15s,transform .2s cubic-bezier(.22,1,.36,1);margin-bottom:16px;}",
      ".rbASubmit:hover:not(:disabled){opacity:.88;transform:translateY(-1px);}",
      ".rbASubmit:disabled{opacity:.5;cursor:default;transform:none;}",
      ".rbAFooter{text-align:center;}",
      ".rbAFooter a{color:rgba(160,178,218,.5);font-size:13px;text-decoration:none;transition:color .15s;}",
      ".rbAFooter a:hover{color:rgba(160,178,218,.85);}",
      ".rbADivider{height:1px;background:rgba(255,255,255,.07);margin:18px 0;}"
    ].join("");
    (document.head || document.documentElement).appendChild(s);
  }

  function showAuthOverlay(initMode){
    injectAuthOverlayStyles();
    if(document.getElementById("rbAuthOverlay")){ setOverlayMode(initMode); return; }

    var SPECIALTIES = ["General Practice","Dental","Dermatology","Cardiology","Pediatrics",
      "Orthopedics","Ophthalmology","Obstetrics & Gynecology","ENT","Urgent Care","Other"];
    var specOpts = SPECIALTIES.map(function(s){ return '<option value="'+s+'">'+s+'</option>'; }).join("");

    var overlay = document.createElement("div");
    overlay.id = "rbAuthOverlay";
    overlay.innerHTML = [
      '<div class="rbACard">',
        '<div class="rbABrand">',
          '<span class="rbAMark"><svg viewBox="0 0 24 24" fill="none">',
            '<rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" stroke-width="2"/>',
            '<path d="M3 9h18M9 9v11" stroke="currentColor" stroke-width="2"/>',
          '</svg></span>',
          '<span class="rbAWordmark">RoomBoard</span>',
        '</div>',
        '<div class="rbATabs" id="rbATabs">',
          '<button class="rbATab" data-mode="login" type="button">Sign in</button>',
          '<button class="rbATab" data-mode="create" type="button">Create clinic</button>',
        '</div>',
        '<div id="rbACreateFields" style="display:none">',
          '<div class="rbARow">',
            '<div class="rbAField"><label>Practice name</label><input id="rbaPracticeName" placeholder="Clinic name" type="text" autocomplete="organization"></div>',
            '<div class="rbAField"><label>Admin name</label><input id="rbaFullName" placeholder="Your name" type="text" autocomplete="name"></div>',
          '</div>',
          '<div class="rbARow">',
            '<div class="rbAField"><label>Phone</label><input id="rbaPhone" placeholder="(555) 000-0000" type="tel" autocomplete="tel"></div>',
            '<div class="rbAField"><label>City &amp; State</label><input id="rbaLocation" placeholder="Austin, TX" type="text"></div>',
          '</div>',
          '<div class="rbAField"><label>Specialty</label><select id="rbaSpecialty">'+specOpts+'</select></div>',
          '<div class="rbAField" id="rbaSpecialtyOtherWrap" style="display:none"><label>Describe specialty</label><input id="rbaSpecialtyOther" placeholder="e.g. Sports Medicine" type="text"></div>',
          '<div class="rbADivider"></div>',
        '</div>',
        '<div class="rbAField"><label>Email</label><input id="rbaEmail" placeholder="name@clinic.com" type="email" autocomplete="username"></div>',
        '<div class="rbAField"><label>Password</label><input id="rbaPassword" placeholder="Password" type="password" autocomplete="current-password"></div>',
        '<div class="rbAError" id="rbAError"></div>',
        '<button class="rbASubmit" id="rbaSubmit" type="button">Sign in</button>',
        '<div class="rbAFooter"><a href="/">← Back to theroomboard.com</a></div>',
      '</div>'
    ].join("");
    document.body.appendChild(overlay);

    var tabs       = overlay.querySelectorAll(".rbATab");
    var createWrap = document.getElementById("rbACreateFields");
    var submitBtn  = document.getElementById("rbaSubmit");
    var errorDiv   = document.getElementById("rbAError");
    var specSel    = document.getElementById("rbaSpecialty");
    var specOther  = document.getElementById("rbaSpecialtyOtherWrap");
    var curMode    = (initMode === "create") ? "create" : "login";

    function applyMode(mode){
      curMode = mode;
      tabs.forEach(function(t){ t.classList.toggle("active", t.getAttribute("data-mode") === mode); });
      createWrap.style.display = mode === "create" ? "" : "none";
      submitBtn.textContent = mode === "create" ? "Create clinic" : "Sign in";
      hideErr();
    }
    function showErr(msg){ errorDiv.textContent = msg; errorDiv.style.display = ""; }
    function hideErr(){ errorDiv.style.display = "none"; }
    var busyWatchdog = null;
    function setBusy(b){
      submitBtn.disabled = !!b;
      submitBtn.textContent = b ? (curMode === "create" ? "Creating clinic…" : "Signing in…") : (curMode === "create" ? "Create clinic" : "Sign in");
      // Safety net: never let the button hang on "Signing in…" forever. If the
      // overlay is still up after 18s, reset and surface a clear message.
      if(busyWatchdog){ clearTimeout(busyWatchdog); busyWatchdog = null; }
      if(b){
        busyWatchdog = setTimeout(function(){
          if(!document.getElementById("rbAuthOverlay")) return; // already advanced to board
          setBusy(false);
          showErr("That took longer than expected. Check your connection and try again.");
        }, 18000);
      }
    }

    window.roomboardShowAuthError = function(msg){ showErr(msg); setBusy(false); };
    window.setOverlayMode = applyMode;

    tabs.forEach(function(t){ t.addEventListener("click", function(){ applyMode(t.getAttribute("data-mode")); }); });
    if(specSel) specSel.addEventListener("change", function(){ specOther.style.display = specSel.value === "Other" ? "" : "none"; });

    function gVal(id){ var el = document.getElementById(id); return el ? (el.value || "").trim() : ""; }
    function sVal(id, v){ var el = document.getElementById(id); if(el) el.value = v; }

    submitBtn.addEventListener("click", function(){
      hideErr();
      var email = gVal("rbaEmail"), pass = gVal("rbaPassword");
      if(!email || !pass){ showErr("Email and password are required."); return; }

      if(curMode === "create"){
        var pName = gVal("rbaPracticeName"), admin = gVal("rbaFullName");
        if(!pName || !admin){ showErr("Practice name and your name are required."); return; }
        sVal("practiceName", pName);
        sVal("fullName", admin);
        sVal("email", email);
        sVal("password", pass);
        sVal("practicePhone", gVal("rbaPhone"));
        sVal("practiceLocation", gVal("rbaLocation"));
        var spec = specSel ? specSel.value : "General Practice";
        sVal("practiceSpecialty", spec);
        if(spec === "Other") sVal("practiceSpecialtyOther", gVal("rbaSpecialtyOther"));
        setBusy(true);
        if(typeof window.roomboardAuthSignup === "function") window.roomboardAuthSignup();
      } else {
        sVal("email", email);
        sVal("password", pass);
        setBusy(true);
        if(typeof window.roomboardAuthLogin === "function") window.roomboardAuthLogin();
      }
    });

    overlay.addEventListener("keydown", function(e){ if(e.key === "Enter" && e.target.tagName !== "BUTTON") submitBtn.click(); });
    applyMode(curMode);
    window.setTimeout(function(){ var f = document.getElementById("rbaEmail"); if(f) f.focus(); }, 60);
  }

  function hideAuthOverlay(){
    var el = document.getElementById("rbAuthOverlay");
    if(el) el.parentNode.removeChild(el);
    window.roomboardShowAuthError = null;
  }

  function setOverlayMode(mode){
    if(typeof window.setOverlayMode === "function") window.setOverlayMode(mode);
  }

  function enterAuth(){
    var route = getRoute();
    if(!route.standalone) return;
    setVisualStage("auth");
    showAuthOverlay(route.authMode);
  }

  function enterSetup(options){
    var route = getRoute();
    if(!route.standalone) return;
    hideAuthOverlay();
    setVisualStage("setup");
    activateSettingsTab("tabRooms");
    openSettingsSurface();
    if(!options || !options.keepUrl) replaceMode("setup");
  }

  /* ── Billing gate ──────────────────────────────────────────────────── */

  function injectPaywallStyles(){
    if(document.getElementById("rbPaywallStyles")) return;
    var style = document.createElement("style");
    style.id = "rbPaywallStyles";
    style.textContent = [
      "#rbPaywall{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;",
        "background:rgba(7,13,24,.85);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);",
        "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;padding:20px;}",
      ".rbPaywallCard{background:#0f1a2a;border:1px solid rgba(255,255,255,.1);border-radius:20px;",
        "padding:36px 40px;max-width:620px;width:100%;text-align:center;",
        "box-shadow:0 32px 64px rgba(0,0,0,.6);}",
      ".rbPaywallLogo{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:20px;}",
      ".rbPaywallLogoMark{width:26px;height:26px;border-radius:7px;background:linear-gradient(135deg,#3b82f6,#06b6d4);display:inline-block;}",
      ".rbPaywallLogo strong{font-size:17px;font-weight:700;color:#f0f6ff;letter-spacing:-.3px;}",
      "#rbPaywall h1{font-size:21px;font-weight:700;color:#f0f6ff;margin:0 0 8px;line-height:1.25;}",
      "#rbPaywall p{font-size:14px;color:#8ba8c4;margin:0 0 22px;line-height:1.5;}",
      /* toggle */
      ".rbPaywallToggle{display:inline-flex;background:rgba(255,255,255,.06);border-radius:10px;padding:3px;margin-bottom:22px;gap:2px;}",
      ".rbPaywallToggleBtn{background:none;border:none;color:#8ba8c4;font-size:13px;font-weight:600;",
        "padding:7px 16px;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:6px;transition:background .15s,color .15s;}",
      ".rbPaywallToggleBtn.active{background:#1e3a5f;color:#e0f0ff;}",
      ".rbPaywallSaveBadge{font-size:10px;font-weight:700;background:#10b981;color:#fff;",
        "border-radius:99px;padding:2px 6px;letter-spacing:.02em;}",
      /* tiers */
      ".rbPaywallTiers{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;}",
      "@media(max-width:480px){.rbPaywallTiers{grid-template-columns:1fr;}}",
      ".rbPaywallTier{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);",
        "border-radius:14px;padding:20px;text-align:left;position:relative;}",
      ".rbPaywallTierFeatured{border-color:rgba(59,130,246,.5);background:rgba(59,130,246,.08);}",
      ".rbPaywallTierBadge{position:absolute;top:-11px;left:50%;transform:translateX(-50%);",
        "background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;font-size:11px;font-weight:700;",
        "padding:3px 12px;border-radius:99px;white-space:nowrap;}",
      ".rbPaywallTierName{font-size:13px;font-weight:700;color:#8ba8c4;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;}",
      ".rbPaywallTierPrice{display:flex;align-items:baseline;gap:4px;margin-bottom:14px;}",
      ".rbPaywallAmount{font-size:28px;font-weight:800;color:#f0f6ff;}",
      ".rbPaywallPer{font-size:13px;color:#8ba8c4;}",
      ".rbPaywallFeatures{list-style:none;margin:0 0 16px;padding:0;display:flex;flex-direction:column;gap:6px;}",
      ".rbPaywallFeatures li{font-size:13px;color:#c8daf0;padding-left:18px;position:relative;}",
      ".rbPaywallFeatures li::before{content:'✓';position:absolute;left:0;color:#3b82f6;font-weight:700;}",
      /* buttons */
      ".rbPaywallBtn{width:100%;padding:11px 16px;border-radius:10px;font-size:14px;font-weight:600;",
        "border:none;cursor:pointer;transition:opacity .15s;}",
      ".rbPaywallBtn:disabled{opacity:.6;cursor:default;}",
      ".rbPaywallBtnPrimary{background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;}",
      ".rbPaywallBtnPrimary:hover:not(:disabled){opacity:.9;}",
      ".rbPaywallBtnSecondary{background:rgba(255,255,255,.06);color:#c8daf0;border:1px solid rgba(255,255,255,.12);}",
      ".rbPaywallBtnSecondary:hover:not(:disabled){background:rgba(255,255,255,.1);}",
      ".rbPaywallFooter{display:flex;justify-content:center;gap:20px;}",
      ".rbPaywallLink{background:none;border:none;color:#8ba8c4;font-size:13px;cursor:pointer;padding:4px 0;",
        "text-decoration:underline;text-underline-offset:3px;}"
    ].join("");
    (document.head || document.documentElement).appendChild(style);
  }

  function showPaywall(info){
    injectPaywallStyles();
    var el = document.getElementById("rbPaywall");
    if(el) el.parentNode.removeChild(el);

    var overlay = document.createElement("div");
    overlay.id = "rbPaywall";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Subscription required");

    // A practice that has never had a Stripe subscription is starting its
    // card-up-front free trial. One that had a subscription (now lapsed) is
    // resubscribing after the trial ended or a cancellation.
    var startingTrial = !info.hasSubscription;
    var heading, sub, ctaLabel;
    if(startingTrial){
      heading = "Start your 14-day free trial";
      sub = "Pick a plan and add a card to begin. You won't be charged until your trial ends in 14 days — we'll remind you before then, and you can cancel anytime.";
      ctaLabel = "Start free trial";
    } else {
      heading = "Your free trial has ended";
      sub = "Resubscribe to restore access to your clinic board.";
      ctaLabel = "Subscribe";
    }

    var manageHtml = info.hasCustomer
      ? '<button class="rbPaywallLink" data-action="portal">Manage or cancel billing</button>'
      : "";

    overlay.innerHTML = [
      '<div class="rbPaywallCard">',
      '  <div class="rbPaywallLogo"><span class="rbPaywallLogoMark"></span><strong>RoomBoard</strong></div>',
      '  <h1>' + heading + '</h1>',
      '  <p>' + sub + '</p>',
      '  <div class="rbPaywallToggle" role="group" aria-label="Billing period">',
      '    <button class="rbPaywallToggleBtn active" data-period="monthly">Monthly</button>',
      '    <button class="rbPaywallToggleBtn" data-period="annual">Annual <span class="rbPaywallSaveBadge">save 17%</span></button>',
      '  </div>',
      '  <div class="rbPaywallTiers">',
      '    <div class="rbPaywallTier">',
      '      <div class="rbPaywallTierName">Base</div>',
      '      <div class="rbPaywallTierPrice"><span class="rbPaywallAmount" data-monthly="$4.99" data-annual="$49.99">$4.99</span><span class="rbPaywallPer" data-monthly="/ mo" data-annual="/ yr">/ mo</span></div>',
      '      <ul class="rbPaywallFeatures">',
      '        <li>Live room board</li>',
      '        <li>Timers &amp; alerts</li>',
      '        <li>Doctor badges</li>',
      '        <li>Quick notes</li>',
      '      </ul>',
      '      <button class="rbPaywallBtn rbPaywallBtnSecondary" data-plan="base-monthly">' + ctaLabel + '</button>',
      '    </div>',
      '    <div class="rbPaywallTier rbPaywallTierFeatured">',
      '      <div class="rbPaywallTierBadge">Most popular</div>',
      '      <div class="rbPaywallTierName">Advanced</div>',
      '      <div class="rbPaywallTierPrice"><span class="rbPaywallAmount" data-monthly="$9.99" data-annual="$99.99">$9.99</span><span class="rbPaywallPer" data-monthly="/ mo" data-annual="/ yr">/ mo</span></div>',
      '      <ul class="rbPaywallFeatures">',
      '        <li>Everything in Base</li>',
      '        <li>Desktop capture app</li>',
      '        <li>Stats &amp; history</li>',
      '        <li>Priority support</li>',
      '      </ul>',
      '      <button class="rbPaywallBtn rbPaywallBtnPrimary" data-plan="advanced-monthly">' + ctaLabel + '</button>',
      '    </div>',
      '  </div>',
      '  <div class="rbPaywallFooter">',
      '    ' + manageHtml,
      '    <button class="rbPaywallLink" data-action="signout">Sign out</button>',
      '  </div>',
      '</div>'
    ].join("\n");

    // Period toggle wires up price display and button plan attributes
    overlay.addEventListener("click", function(e){
      var toggleBtn = e.target && e.target.closest ? e.target.closest(".rbPaywallToggleBtn") : null;
      if(toggleBtn){
        var period = toggleBtn.getAttribute("data-period");
        overlay.querySelectorAll(".rbPaywallToggleBtn").forEach(function(b){ b.classList.toggle("active", b === toggleBtn); });
        overlay.querySelectorAll(".rbPaywallAmount").forEach(function(el){ el.textContent = el.getAttribute("data-" + period) || el.textContent; });
        overlay.querySelectorAll(".rbPaywallPer").forEach(function(el){ el.textContent = el.getAttribute("data-" + period) || el.textContent; });
        var baseBtn = overlay.querySelector("[data-plan^='base']");
        var advBtn  = overlay.querySelector("[data-plan^='advanced']");
        if(baseBtn) baseBtn.setAttribute("data-plan", "base-" + period);
        if(advBtn)  advBtn.setAttribute("data-plan", "advanced-" + period);
        return;
      }
      var btn = e.target && e.target.closest ? e.target.closest("[data-plan],[data-action]") : null;
      if(!btn) return;
      var plan   = btn.getAttribute("data-plan");
      var action = btn.getAttribute("data-action");
      if(plan)                    startCheckout(plan, btn);
      if(action === "portal")     openBillingPortal();
      if(action === "signout")    billingSignOut();
    });

    document.body.appendChild(overlay);
  }

  function hidePaywall(){
    var el = document.getElementById("rbPaywall");
    if(el) el.parentNode.removeChild(el);
  }

  function startCheckout(plan, btn){
    var tokens = getStoredTokens();
    if(!tokens){ enterAuth(); return; }
    if(btn){ btn.disabled = true; btn.querySelector("span") && (btn.querySelector("span").textContent = "Loading…"); }
    var returnUrl = (window.location.origin || "") + "/app/index.html?mode=startup&next=board";
    fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: plan, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, returnUrl: returnUrl })
    })
    .then(function(r){ return r.json(); })
    .then(function(data){ if(data.url) window.location.href = data.url; })
    .catch(function(){ if(btn){ btn.disabled = false; } });
  }

  function openBillingPortal(){
    var tokens = getStoredTokens();
    if(!tokens) return;
    fetch("/api/billing/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, returnUrl: window.location.href })
    })
    .then(function(r){ return r.json(); })
    .then(function(data){ if(data.url) window.location.href = data.url; })
    .catch(function(){});
  }

  function billingSignOut(){
    try{ window.localStorage.removeItem(AUTH_STORAGE_KEY); }catch(e){}
    try{ window.sessionStorage.removeItem(AUTH_STORAGE_KEY); }catch(e){}
    window.location.href = "/app/index.html?mode=startup&auth=login";
  }

  // Check /api/billing/status and call onAccess() if the practice has access;
  // show the paywall otherwise. On network error, allow access so legitimate
  // users are never blocked by a transient failure.
  function checkBillingThenOpen(onAccess){
    var tokens = getStoredTokens();
    if(!tokens){ onAccess(); return; }
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function(){ if(controller) controller.abort(); onAccess(); }, 8000);
    var done = false;
    function finish(fn){ if(done) return; done = true; clearTimeout(timer); fn(); }
    fetch("/api/billing/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }),
      signal: controller ? controller.signal : undefined
    })
    .then(function(r){ return r.json(); })
    .then(function(data){
      if(data.hasAccess){
        finish(function(){ hidePaywall(); onAccess(); });
      } else {
        finish(function(){
          showPaywall({
            trialing: !!data.trialing,
            trialDaysLeft: data.trialDaysLeft || 0,
            subscribed: !!data.subscribed,
            hasCustomer: !!data.hasCustomer,
            hasSubscription: !!data.hasSubscription
          });
        });
      }
    })
    .catch(function(){ finish(onAccess); });
  }

  /* ── Board open ────────────────────────────────────────────────────── */

  function openBoard(){
    if(typeof window.roomboardCanOpenBoard === "function" && !window.roomboardCanOpenBoard()){
      return;
    }
    // Gate the board behind an active trial or subscription.
    checkBillingThenOpen(function(){
      hideAuthOverlay();
      if(document.body){
        document.body.classList.remove("roomboardStandaloneMode", "standaloneAuthMode", "standaloneSetupMode");
      }
      closeSettingsSurface();
      replaceMode("board");
      window.setTimeout(function(){
        if(typeof window.scheduleActiveDisplayFit === "function"){
          window.scheduleActiveDisplayFit("standalone-open-board");
        }
      }, 0);
    });
  }

  function bindOpenBoardButtons(){
    if(standaloneClickBound) return;
    standaloneClickBound = true;
    document.addEventListener("click", function(event){
      var target = event.target && event.target.closest ? event.target.closest(".standaloneOpenBoardBtn, #headerBoardBtn") : null;
      if(!target) return;
      event.preventDefault();
      openBoard();
    });
  }

  function syncInitialRoute(){
    var route = getRoute();
    if(!route.standalone) return;
    if((route.mode === "setup" || route.mode === "startup") && hasStoredAuthSession()){
      if(wantsBoard()){ openBoard(); return; }
      enterSetup({ keepUrl: route.mode === "setup" });
      return;
    }
    enterAuth();
  }

  window.roomboardStandaloneFlow = {
    enterAuth: enterAuth,
    enterSetup: enterSetup,
    openBoard: openBoard,
    onAuthState: function(state){
      var route = getRoute();
      if(!route.standalone) return;
      if(state && state.loggedIn && state.hasPractice){
        // Always run the billing gate. A brand-new clinic has no card on file
        // yet, so openBoard() surfaces the "Start your free trial" paywall;
        // once the trial is active it opens straight to the board.
        openBoard();
      } else {
        enterAuth();
      }
    }
  };

  bindOpenBoardButtons();
  (function primeVisualStage(){
    var route = getRoute();
    if(!route.standalone) return;
    if((route.mode === "setup" || route.mode === "startup") && hasStoredAuthSession()){
      if(wantsBoard()) return; // avoid flashing Setup before openBoard runs
      setVisualStage("setup");
    } else {
      setVisualStage("auth");
    }
  })();
  window.setTimeout(syncInitialRoute, 0);
})();
