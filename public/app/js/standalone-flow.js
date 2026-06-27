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
      /* overlay shell */
      "#rbAuthOverlay{position:fixed;inset:0;z-index:10000;display:flex;align-items:stretch;",
        "background:#06101e;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;}",
      /* ── left branding panel ── */
      ".rbALeft{flex:1;display:flex;flex-direction:column;padding:52px 56px;min-width:0;",
        "background:linear-gradient(150deg,#081524 0%,#060f1c 55%,#0a1a2e 100%);",
        "border-right:1px solid rgba(255,255,255,.06);position:relative;overflow:hidden;}",
      ".rbALeft::before{content:'';position:absolute;top:-10%;right:-15%;width:480px;height:480px;",
        "background:radial-gradient(circle,rgba(14,165,233,.10) 0%,transparent 65%);pointer-events:none;}",
      ".rbALeft::after{content:'';position:absolute;bottom:-5%;left:10%;width:320px;height:320px;",
        "background:radial-gradient(circle,rgba(251,146,60,.06) 0%,transparent 65%);pointer-events:none;}",
      ".rbALeftBrand{display:flex;align-items:center;gap:10px;margin-bottom:0;}",
      ".rbAMark{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;flex:none;",
        "background:linear-gradient(135deg,#0ea5e9,#0369a1);color:#fff;}",
      ".rbAMark svg{width:19px;height:19px;}",
      ".rbAWordmark{font-size:19px;font-weight:800;color:#eaf1ff;letter-spacing:-.04em;font-style:italic;}",
      ".rbALeftBody{flex:1;display:flex;flex-direction:column;justify-content:center;padding:0 0 20px;}",
      ".rbALeftTagline{font-size:36px;font-weight:800;line-height:1.13;color:#eaf1ff;",
        "letter-spacing:-.03em;margin:0 0 16px;}",
      ".rbALeftSub{font-size:15px;color:rgba(148,178,220,.7);line-height:1.65;margin:0 0 36px;max-width:340px;}",
      ".rbAFeatures{display:flex;flex-direction:column;gap:14px;}",
      ".rbAFeature{display:flex;align-items:flex-start;gap:12px;}",
      ".rbAFeatureIcon{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;flex:none;",
        "background:rgba(14,165,233,.12);border:1px solid rgba(14,165,233,.18);}",
      ".rbAFeatureIcon svg{width:15px;height:15px;color:#38bdf8;}",
      ".rbAFeatureCopy strong{display:block;font-size:13.5px;font-weight:600;color:rgba(224,238,255,.9);margin-bottom:2px;}",
      ".rbAFeatureCopy span{font-size:12.5px;color:rgba(148,178,220,.6);line-height:1.45;}",
      ".rbALeftFooter{font-size:12px;color:rgba(148,178,220,.4);}",
      /* ── right form panel ── */
      ".rbARight{display:flex;align-items:center;justify-content:center;",
        "flex:none;width:460px;padding:40px 48px;overflow-y:auto;}",
      ".rbAForm{width:100%;max-width:360px;}",
      ".rbAFormHead{margin-bottom:28px;}",
      ".rbAFormTitle{font-size:24px;font-weight:800;color:#eaf1ff;letter-spacing:-.03em;margin:0 0 6px;}",
      ".rbAFormSub{font-size:14px;color:rgba(148,178,220,.65);margin:0;}",
      /* tabs */
      ".rbATabs{display:flex;background:rgba(255,255,255,.055);border-radius:11px;padding:3px;gap:3px;margin-bottom:24px;}",
      ".rbATab{flex:1;background:none;border:none;color:rgba(200,218,255,.4);font-size:13.5px;font-weight:600;",
        "padding:9px;border-radius:8px;cursor:pointer;transition:background .15s,color .15s;}",
      ".rbATab.active{background:rgba(255,255,255,.10);color:#eaf1ff;}",
      /* fields */
      ".rbAField{margin-bottom:14px;}",
      ".rbAField label{display:block;font-size:11px;font-weight:700;color:rgba(148,178,220,.65);",
        "text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px;}",
      ".rbAField input,.rbAField select{width:100%;padding:11px 14px;box-sizing:border-box;",
        "background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);",
        "border-radius:10px;color:#eaf1ff;font-size:14px;outline:none;",
        "transition:border-color .15s,box-shadow .15s;-webkit-appearance:none;appearance:none;}",
      ".rbAField input:focus,.rbAField select:focus{border-color:rgba(14,165,233,.55);",
        "box-shadow:0 0 0 3px rgba(14,165,233,.12);}",
      ".rbAField input::placeholder{color:rgba(148,178,220,.3);}",
      ".rbAField select option{background:#0d1929;color:#eaf1ff;}",
      ".rbARow{display:grid;grid-template-columns:1fr 1fr;gap:12px;}",
      "@media(max-width:500px){.rbARow{grid-template-columns:1fr;}}",
      /* error */
      ".rbAError{background:rgba(239,68,68,.10);border:1px solid rgba(239,68,68,.25);border-radius:10px;",
        "padding:10px 14px;font-size:13px;color:#fca5a5;margin-bottom:14px;display:none;}",
      /* submit */
      ".rbASubmit{width:100%;padding:13px;border-radius:11px;border:none;cursor:pointer;",
        "font-size:15px;font-weight:700;letter-spacing:-.01em;margin-bottom:18px;",
        "background:linear-gradient(135deg,#0ea5e9 0%,#0369a1 100%);color:#fff;",
        "box-shadow:0 4px 24px rgba(14,165,233,.30);",
        "transition:opacity .15s,transform .18s cubic-bezier(.22,1,.36,1),box-shadow .15s;}",
      ".rbASubmit:hover:not(:disabled){opacity:.92;transform:translateY(-1px);box-shadow:0 6px 28px rgba(14,165,233,.40);}",
      ".rbASubmit:disabled{opacity:.45;cursor:default;transform:none;box-shadow:none;}",
      /* status line below submit */
      ".rbAStatus{font-size:12px;color:rgba(148,178,220,.45);text-align:center;",
        "margin:-10px 0 14px;min-height:1.4em;font-style:italic;",
        "transition:opacity .2s ease;}",
      /* footer */
      ".rbAFooterLinks{display:flex;justify-content:center;gap:20px;}",
      ".rbAFooterLinks a{color:rgba(148,178,220,.45);font-size:12.5px;text-decoration:none;transition:color .15s;}",
      ".rbAFooterLinks a:hover{color:rgba(148,178,220,.8);}",
      ".rbADivider{height:1px;background:rgba(255,255,255,.07);margin:16px 0;}",
      /* mobile: hide left panel, stack form */
      "@media(max-width:760px){",
        ".rbALeft{display:none;}",
        ".rbARight{width:100%;padding:32px 24px;align-items:flex-start;padding-top:48px;}",
        ".rbAForm{max-width:100%;}",
        ".rbAFormHead{text-align:center;}",
      "}"
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
      /* ── left panel ── */
      '<div class="rbALeft">',
        '<div class="rbALeftBrand">',
          '<span class="rbAMark"><svg viewBox="0 0 24 24" fill="none">',
            '<rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" stroke-width="2"/>',
            '<path d="M3 9h18M9 9v11" stroke="currentColor" stroke-width="2"/>',
          '</svg></span>',
          '<span class="rbAWordmark">RoomBoard</span>',
        '</div>',
        '<div class="rbALeftBody">',
          '<h2 class="rbALeftTagline">The board your<br>clinic deserves.</h2>',
          '<p class="rbALeftSub">Real-time room tracking built for medical practices that move fast.</p>',
          '<div class="rbAFeatures">',
            '<div class="rbAFeature">',
              '<span class="rbAFeatureIcon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75">',
                '<circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2"/>',
              '</svg></span>',
              '<div class="rbAFeatureCopy"><strong>Live room status</strong><span>Everyone sees the same board, updated instantly.</span></div>',
            '</div>',
            '<div class="rbAFeature">',
              '<span class="rbAFeatureIcon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75">',
                '<path d="M3 8h10M8 3l5 5-5 5"/>',
              '</svg></span>',
              '<div class="rbAFeatureCopy"><strong>One-click capture</strong><span>Pull appointments from any scheduler into the board.</span></div>',
            '</div>',
            '<div class="rbAFeature">',
              '<span class="rbAFeatureIcon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75">',
                '<rect x="2" y="3" width="12" height="10" rx="2"/><path d="M5 13v2M11 13v2M3 13h10"/>',
              '</svg></span>',
              '<div class="rbAFeatureCopy"><strong>Any device</strong><span>Works on TV displays, tablets, and phones.</span></div>',
            '</div>',
          '</div>',
        '</div>',
        '<div class="rbALeftFooter">© '+new Date().getFullYear()+' RoomBoard</div>',
      '</div>',
      /* ── right form panel ── */
      '<div class="rbARight">',
        '<div class="rbAForm">',
          '<div class="rbAFormHead">',
            '<h3 class="rbAFormTitle" id="rbAFormTitle">Welcome back</h3>',
            '<p class="rbAFormSub" id="rbAFormSub">Sign in to your clinic account.</p>',
          '</div>',
          '<div class="rbATabs" id="rbATabs">',
            '<button class="rbATab" data-mode="login" type="button">Sign in</button>',
            '<button class="rbATab" data-mode="create" type="button">Create clinic</button>',
          '</div>',
          '<div id="rbACreateFields" style="display:none">',
            '<div class="rbARow">',
              '<div class="rbAField"><label>Practice name</label><input id="rbaPracticeName" placeholder="Clinic name" type="text" autocomplete="organization"></div>',
              '<div class="rbAField"><label>Your name</label><input id="rbaFullName" placeholder="Full name" type="text" autocomplete="name"></div>',
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
          '<p class="rbAStatus" id="rbAStatus"></p>',
          '<div class="rbAFooterLinks">',
            '<a href="#" id="rbaForgotLink">Forgot password?</a>',
            '<a href="/">← theroomboard.com</a>',
          '</div>',
        '</div>',
      '</div>',
    ].join("");
    document.body.appendChild(overlay);

    var tabs       = overlay.querySelectorAll(".rbATab");
    var createWrap = document.getElementById("rbACreateFields");
    var submitBtn  = document.getElementById("rbaSubmit");
    var errorDiv   = document.getElementById("rbAError");
    var specSel    = document.getElementById("rbaSpecialty");
    var specOther  = document.getElementById("rbaSpecialtyOtherWrap");
    var curMode    = (initMode === "create") ? "create" : "login";

    var formTitle = document.getElementById("rbAFormTitle");
    var formSub   = document.getElementById("rbAFormSub");
    var forgotLink = document.getElementById("rbaForgotLink");

    function applyMode(mode){
      curMode = mode;
      tabs.forEach(function(t){ t.classList.toggle("active", t.getAttribute("data-mode") === mode); });
      createWrap.style.display = mode === "create" ? "" : "none";
      submitBtn.textContent = mode === "create" ? "Create clinic" : "Sign in";
      if(forgotLink) forgotLink.style.display = mode === "create" ? "none" : "";
      if(formTitle) formTitle.textContent = mode === "create" ? "Set up your clinic" : "Welcome back";
      if(formSub) formSub.textContent = mode === "create" ? "Create your RoomBoard account." : "Sign in to your clinic account.";
      hideErr();
    }
    var statusEl = document.getElementById("rbAStatus");
    function showErr(msg){ errorDiv.textContent = msg; errorDiv.style.display = "block"; if(statusEl) statusEl.textContent = ""; }
    function hideErr(){ errorDiv.style.display = "none"; }
    var busyWatchdog = null;
    function setBusy(b){
      submitBtn.disabled = !!b;
      submitBtn.textContent = b ? (curMode === "create" ? "Creating clinic…" : "Signing in…") : (curMode === "create" ? "Create clinic" : "Sign in");
      if(!b && statusEl) statusEl.textContent = "";
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
    window.setOverlayStatus = function(text){ if(statusEl) statusEl.textContent = text || ""; };

    tabs.forEach(function(t){ t.addEventListener("click", function(){ applyMode(t.getAttribute("data-mode")); }); });
    if(specSel) specSel.addEventListener("change", function(){ specOther.style.display = specSel.value === "Other" ? "" : "none"; });
    if(forgotLink) forgotLink.addEventListener("click", function(e){
      e.preventDefault();
      var el = document.getElementById("rbaEmail");
      var email = el ? (el.value || "").trim() : "";
      if(typeof window.roomboardForgotPassword === "function"){ window.roomboardForgotPassword(email); }
      else if(typeof window.forgotPasswordLink !== "undefined"){ var fpl = document.getElementById("forgotPasswordLink"); if(fpl) fpl.click(); }
    });

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

    var heading, sub;
    if(info.trialing && !info.hasCustomer){
      heading = "Start your " + info.trialDaysLeft + "-day free trial.";
      sub = "Enter a card now — you won’t be charged until your trial ends.";
    } else if(info.trialing && info.trialDaysLeft > 0){
      heading = "Choose a plan to continue.";
      sub = info.trialDaysLeft + " day" + (info.trialDaysLeft === 1 ? "" : "s") + " left in your free trial.";
    } else {
      heading = "Your free trial has ended.";
      sub = "Subscribe to restore access to your clinic board.";
    }

    var manageHtml = info.hasCustomer
      ? '<button class="rbPaywallLink" data-action="portal">Manage billing</button>'
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
      '      <div class="rbPaywallTierPrice"><span class="rbPaywallAmount" data-monthly="$29.99" data-annual="$300">$29.99</span><span class="rbPaywallPer" data-monthly="/ mo" data-annual="/ yr">/ mo</span></div>',
      '      <ul class="rbPaywallFeatures">',
      '        <li>Live room board</li>',
      '        <li>Timers &amp; alerts</li>',
      '        <li>Doctor badges</li>',
      '        <li>Quick notes</li>',
      '      </ul>',
      '      <button class="rbPaywallBtn rbPaywallBtnSecondary" data-plan="base-monthly">Get Base</button>',
      '    </div>',
      '    <div class="rbPaywallTier rbPaywallTierFeatured">',
      '      <div class="rbPaywallTierBadge">Most popular</div>',
      '      <div class="rbPaywallTierName">Advanced</div>',
      '      <div class="rbPaywallTierPrice"><span class="rbPaywallAmount" data-monthly="$49.99" data-annual="$500">$49.99</span><span class="rbPaywallPer" data-monthly="/ mo" data-annual="/ yr">/ mo</span></div>',
      '      <ul class="rbPaywallFeatures">',
      '        <li>Everything in Base</li>',
      '        <li>Desktop capture app</li>',
      '        <li>Stats &amp; history</li>',
      '        <li>Priority support</li>',
      '      </ul>',
      '      <button class="rbPaywallBtn rbPaywallBtnPrimary" data-plan="advanced-monthly">Get Advanced</button>',
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
    var returnUrl = window.location.origin || "";
    fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: plan, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, returnUrl: returnUrl })
    })
    .then(function(r){ return r.json(); })
    .then(function(data){
      if(data.url){ window.location.href = data.url; return; }
      if(btn){ btn.disabled = false; btn.querySelector("span") && (btn.querySelector("span").textContent = btn.querySelector("span").getAttribute("data-orig") || "Get " + plan); }
      var msg = data.error || data.message || "Could not start checkout.";
      alert("Checkout error (" + plan + "): " + msg);
    })
    .catch(function(e){ if(btn){ btn.disabled = false; } alert("Checkout failed: " + (e && e.message || "network error")); });
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
    if(!tokens){
      // If returning from a cancelled Stripe checkout, no tokens means the
      // session is gone — send to auth rather than silently granting access.
      var cancelParams = new URLSearchParams(window.location.search);
      if(cancelParams.get("billing") === "cancel"){
        try{ history.replaceState(null, "", window.location.pathname + "?mode=startup"); }catch(e){}
        enterAuth();
        return;
      }
      onAccess(); return;
    }

    // If returning from a completed Stripe checkout, confirm via the session ID
    // rather than the status endpoint — avoids webhook latency leaving the user
    // blocked immediately after paying.
    var params = new URLSearchParams(window.location.search);
    var sessionId = params.get("session_id");
    if(params.get("billing") === "success" && sessionId){
      // Clean the billing params out of the URL so a refresh doesn't re-confirm.
      try{ history.replaceState(null, "", window.location.pathname + "?mode=startup"); }catch(e){}
      var controller2 = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer2 = setTimeout(function(){ if(controller2) controller2.abort(); onAccess(); }, 12000);
      var done2 = false;
      function finish2(fn){ if(done2) return; done2 = true; clearTimeout(timer2); fn(); }
      fetch("/api/billing/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }),
        signal: controller2 ? controller2.signal : undefined
      })
      .then(function(r){ return r.json(); })
      .then(function(data){
        if(data.hasAccess){
          finish2(function(){ hidePaywall(); onAccess(); });
        } else {
          finish2(function(){
            showPaywall({
              trialing: !!data.trialing,
              trialDaysLeft: data.trialDaysLeft || 0,
              subscribed: !!data.subscribed,
              hasCustomer: !!data.hasCustomer
            });
          });
        }
      })
      .catch(function(){ finish2(onAccess); });
      return;
    }

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
            hasCustomer: !!data.hasCustomer
          });
        });
      }
    })
    .catch(function(){ finish(onAccess); });
  }

  /* ── Board open ────────────────────────────────────────────────────── */

  function openBoard(){
    // If the plan picker is already visible, don't race past it.
    if(document.getElementById("rbPaywall")) return;
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
      // Setup wizard step buttons — navigate to the relevant settings tab.
      var setupBtn = event.target && event.target.closest ? event.target.closest(".setupGoBtn[data-setup-tab]") : null;
      if(setupBtn){
        var tabId = setupBtn.getAttribute("data-setup-tab");
        if(tabId) activateSettingsTab(tabId);
        return;
      }

      var target = event.target && event.target.closest ? event.target.closest(".standaloneOpenBoardBtn, #headerBoardBtn") : null;
      if(!target) return;
      event.preventDefault();
      var span = target.querySelector("span") || target;
      var orig = span.textContent;
      target.disabled = true;
      span.textContent = "Checking access…";
      openBoard();
      // Restore button if billing check leads to paywall (not board open).
      window.setTimeout(function(){
        target.disabled = false;
        span.textContent = orig;
      }, 3000);
    });
  }

  function syncInitialRoute(){
    var route = getRoute();
    if(!route.standalone) return;
    if(hasStoredAuthSession()){
      // mode=setup means the user is mid-wizard (URL set by enterSetup/replaceMode).
      // mode=startup means a fresh app open — go straight to openBoard() so billing
      // decides: board if access, paywall if not. Only stay in setup when the URL
      // explicitly says so.
      if(route.mode === "setup" && !wantsBoard()){
        enterSetup({ keepUrl: true });
      } else {
        openBoard();
      }
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
        if(state.newAccount){
          // New clinic: hide the signup overlay and immediately show the plan
          // picker. Card is required upfront — the user never reaches the board
          // without going through Stripe checkout first.
          hideAuthOverlay();
          showPaywall({ trialing: true, trialDaysLeft: 14, hasCustomer: false });
        } else {
          openBoard();
        }
      } else {
        enterAuth();
      }
    }
  };

  bindOpenBoardButtons();
  (function primeVisualStage(){
    var route = getRoute();
    if(!route.standalone) return;
    if(hasStoredAuthSession() && route.mode === "setup" && !wantsBoard()){
      setVisualStage("setup");
    } else {
      setVisualStage("auth");
    }
  })();
  window.setTimeout(syncInitialRoute, 0);
})();
