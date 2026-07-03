(function () {
  const api = globalThis.chrome || globalThis.browser;
  if (!api?.storage?.local) return;
  if (window.__vetBoardWebptCaptureLoaded) return;
  window.__vetBoardWebptCaptureLoaded = true;

  const STORAGE_KEY = "pendingAppointment";
  const CAPTURE_ARMED_KEY = "vetboardCaptureArmed";
  const AUTH_KEY = "vetboardSupabaseAuth";
  const AUTH_STATUS_KEY = "vetboardSupabaseAuthStatus";
  const API_BASE_KEY = "vetboardApiBaseUrl";
  const SUPABASE_URL = "https://bqqjtgbfvtscwhbhscps.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcWp0Z2JmdnRzY3doYmhzY3BzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTIxNDEsImV4cCI6MjA5MDMyODE0MX0.hi_ruvxOBNbUIdQ-BYhjhuy6KM5oigqib-zIWL8dsts";
  const OVERLAY_ID = "vetboard-webpt-overlay";
  const TOAST_ID = "vetboard-webpt-toast";
  const BADGE_ID = "vetboard-webpt-badge";
  const AUTH_PANEL_ID = "vetboard-webpt-auth-panel";
  const MODAL_ID = "vetboard-webpt-modal";
  const BACKDROP_ID = "vetboard-webpt-backdrop";
  const HOVER_CLASS = "vetboard-webpt-hover";
  const CALENDAR_SURFACE_SELECTORS = [
    ".fc",
    ".fc-view",
    ".fc-view-container",
    ".fc-time-grid",
    ".fc-timegrid",
    ".fc-daygrid",
    ".fc-scroller",
    "[class*='FullCalendar']",
    "[class*='fullcalendar']",
    "[id='calendar']",
    "[id*='calendar-container']",
    "[id*='scheduler']"
  ];
  const DETAIL_PANEL_SELECTORS = [
    "[role='tooltip']",
    "[role='dialog']",
    ".ui-tooltip",
    ".qtip",
    ".tooltip",
    ".popover",
    ".tooltipster-base",
    "[class*='tooltip']",
    "[class*='Tooltip']",
    "[class*='popover']",
    "[class*='Popover']"
  ];

  // WebPT uses FullCalendar — target those event elements first, then fall back generically
  const CARD_SELECTORS = [
    "a.fc-event",
    ".fc-event",
    ".fc-time-grid-event",
    ".fc-v-event",
    ".fc-daygrid-event",
    ".fc-timegrid-event",
    "[class*='fc-event']",
    "[data-appointment-id]",
    "[data-event-id]",
    "[data-visit-id]",
    "[data-testid*='appointment']",
    "[data-testid*='event']",
    "[class*='appointment']",
    "[class*='calendar-event']",
    "[class*='CalendarEvent']",
    "[class*='event-card']",
    "[class*='schedule-event']"
  ];

  const TIME_RANGE_RE = /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*[-–]\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i;
  const SINGLE_TIME_RE = /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i;
  const DOCTOR_RE = /\b(?:dr\.?|doctor|pt|dpt|ot|otr|cota|pta|slp|ccc-slp|therapist|clinician|aide)\b/i;
  const DOCTOR_NAME_RE = /\b(?:dr\.?|doctor|p\.?t\.?|dpt|o\.?t\.?r?|cota|pta|slp|ccc-slp)\b/i;
  // Fast-path page detection for this platform's real scheduler domains.
  const HOST_HINT_RE = /(?:^|\.)webpt\.com$/i;
  const NON_DOCTOR_COLUMN_RE = /\b(?:tech|walk back|surgery|drop ?off)\b/i;
  const SURGERY_COLUMN_RE = /\b(?:surgery|sx)\b/i;
  const TECH_COLUMN_RE = /\b(?:tech|walk back)\b/i;
  const DROP_OFF_COLUMN_RE = /\b(?:drop ?off)\b/i;

  // WebPT card text format: "*PatientName" OwnerLast (Species (Breed)) - CaseNum - Reason
  // The asterisk indicates a VIP/flagged patient
  const EZYVET_CARD_RE = /^[“"‘']?\s*\*?\s*([^”"’'(]+?)[”"’']?\s+([^(]+?)\s*\((.+)\)\s*-\s*(\d+)\s*-\s*(.+)$/;
  const EZYVET_QUOTED_NAME_RE = /[“"]\s*\*?\s*([^”"]+)[”"]/;
  const EZYVET_CASE_NUM_RE = /\b(\d{6,8})\b/;
  const EZYVET_SPECIES_RE = /\b(?:canine|dog|feline|cat|equine|horse|bovine|cow|avian|bird|exotic|rabbit|reptile|porcine|swine|caprine|goat|ovine|sheep)\b/i;
  const EZYVET_DETAIL_LABEL_MAP = {
    // Standard
    "type": "type",
    "appointment type": "type",
    "visit type": "type",
    "description": "description",
    "reason": "reason",
    "appointment reason": "reason",
    "status": "status",
    "appointment provider": "provider",
    "provider": "provider",
    "doctor": "provider",
    "appointment doctor": "provider",
    "patient": "patient",
    "animal notes": "ignore",
    "notes": "ignore",
    "demeanor": "ignore",
    "master problems": "ignore",
    "problems": "ignore",
    // WebPT-specific
    "case owner": "provider",
    "clinician": "provider",
    "attending clinician": "provider",
    "attending": "provider",
    "presenting problem": "presentingProblem",
    "presenting problem(s)": "presentingProblem",
    "presenting problems": "presentingProblem",
    "chief complaint": "presentingProblem",
    "complaint": "presentingProblem",
    "visit reason": "presentingProblem",
    "reason for visit": "presentingProblem",
    "reason for appointment": "presentingProblem",
    "appointment reason": "presentingProblem",
    "other": "presentingProblem",
    "memo": "description",
    "appointment memo": "description",
    "appointment note": "description",
    "service": "type",
    "services": "type",
    "service code": "type",
    "service codes": "type",
    "billable service": "type",
    "billable services": "type",
    "procedure": "type",
    "procedure(s)": "type",
    "procedures": "type",
    "appointment provider": "provider",
    "additional provider": "provider",
    "therapist": "provider",
    "practitioner": "provider",
    "staff": "provider",
    "resource": "column",
    "operatory": "column",
    "chair": "column",
    "room": "column",
    "location": "column",
    "duration": "appointmentTime",
    "length": "appointmentTime",
    "owner": "owner",
    "client": "patient",
    "guardian": "owner",
    "responsible party": "owner",
    "date": "appointmentDate",
    "time": "appointmentTime",
    "sex": "sex",
    "species": "species",
    "breed": "breed",
    "colour": "color",
    "color": "color",
    "age": "age",
    "weight": "weight",
    "appointment address": "ignore",
    "address(physical)": "ignore",
    "address physical": "ignore",
    "phone numbers": "ignore",
    "phone": "ignore",
    "time since in hospital": "ignore",
    "first date seen for patient": "ignore",
    "first date seen for case": "ignore",
    "last date seen for case": "ignore",
    "created by": "ignore",
    "referring clinic": "ignore",
    "health status": "ignore",
    "history": "ignore",
    "er history form": "ignore",
    "standard of care": "ignore",
    "soc event": "ignore",
    "visit exams": "ignore",
    "er physical exam": "ignore",
    "physical examination findings": "ignore",
    "medication(s)": "ignore",
    "medications": "ignore",
    "client communications exams": "ignore",
    "shared": "ignore"
  };
  const EZYVET_DETAIL_STOP_RE = /^(?:animal notes|notes|demeanor|master problems|problems|health status|history|er history form|standard of care|soc event|visit exams|er physical exam|physical examination findings|medication s|medications|client communications exams|shared|rabies|wellness exam|dhpp|leptospirosis|heartworm test|semi annual exam|bordetella|influenza|lyme|fecal|weight kg|temp f|h r|r r|comments)\b/;

  const TYPE_MATCH_STOPWORDS = {
    appt: true, appointment: true, consult: false, consultation: true,
    column: true, doctor: true, exam: false, follow: true, new: true,
    patient: true, provider: true, pt: true, recheck: false, room: true,
    schedule: true, slot: true, the: true, type: true, visit: true, with: true
  };

  // WebPT appointment type → RoomBoard label mapping
  const EZYVET_TYPE_LABEL_MAP = [
    { ezyvet: ["initial examination", "initial exam", "initial evaluation", "initial eval", "ie", "eval", "new patient"], vetboard: ["initial eval", "evaluation", "new patient"] },
    { ezyvet: ["re-examination", "re-exam", "re-evaluation", "re-eval", "progress note", "progress visit"], vetboard: ["re-eval", "progress"] },
    { ezyvet: ["follow up", "follow-up", "daily visit", "daily note", "treatment", "tx"], vetboard: ["treatment", "follow-up", "daily"] },
    { ezyvet: ["consultation", "consult"], vetboard: ["consult"] },
    { ezyvet: ["orthosis fabrication", "orthosis", "orthotic", "splint", "brace"], vetboard: ["orthosis", "splint"] },
    { ezyvet: ["discharge", "dc visit", "final visit"], vetboard: ["discharge"] },
    { ezyvet: ["telehealth", "virtual", "video visit"], vetboard: ["telehealth", "virtual"] },
    { ezyvet: ["dry needling", "needling"], vetboard: ["dry needling"] },
    { ezyvet: ["manual therapy", "massage"], vetboard: ["manual therapy"] },
    { ezyvet: ["aquatic", "pool"], vetboard: ["aquatic"] },
    { ezyvet: ["work conditioning", "work hardening", "fce"], vetboard: ["work conditioning", "fce"] },
    { ezyvet: ["urgent", "same day", "work in", "work-in"], vetboard: ["urgent", "work-in"] }
  ];

  let hoveredCard = null;
  let rafId = 0;
  let lastMoveEvent = null;
  let enabled = false;
  let captureArmed = false;
  let sawCandidateWhileArmed = false;
  let noMatchWarningTimer = 0;
  let pendingAppointment = null;
  let authState = null;
  let authNeedsLogin = false;
  let authErrorMessage = "";
  let authFormState = { email: "", password: "", apiBase: "" };
  let authPanelOpen = false;
  let boardStateCache = null;
  let currentPracticeId = null;
  let formState = null;
  let modalMessage = "";
  let roomStatusRefreshTimer = null;
  let validationState = { patientName: false, colorLabelId: false };
  let calendarGridTopCache = { value: 0, measuredAt: 0 };
  let ezyvetHoverPollTimer = null;

  bootstrap();

  async function bootstrap() {
    if (!looksLikeEzyvetPage()) return;

    enabled = true;
    injectStyles();
    ensureOverlay();
    ensureBadge();
    ensureAuthPanel();
    ensureModalShell();

    try {
      const stored = await storageGet([AUTH_KEY, AUTH_STATUS_KEY, API_BASE_KEY]);
      authState = stored[AUTH_KEY] || null;
      authNeedsLogin = !!(stored[AUTH_STATUS_KEY] && stored[AUTH_STATUS_KEY].needsLogin);
      authErrorMessage = String(stored[AUTH_STATUS_KEY] && stored[AUTH_STATUS_KEY].message || "").trim();
      authFormState.apiBase = normalizeApiBaseUrl(stored[API_BASE_KEY] || authState?.apiBase || "");
      if (!authFormState.email && stored[AUTH_STATUS_KEY] && stored[AUTH_STATUS_KEY].email) {
        authFormState.email = String(stored[AUTH_STATUS_KEY].email || "").trim();
      }
      if (!authFormState.email && authState && authState.email) {
        authFormState.email = String(authState.email || "").trim();
      }
    } catch (_) {}

    pendingAppointment = null;
    captureArmed = false;
    updateBadgeUi();

    try {
      await storageRemove(STORAGE_KEY);
      await storageSet({ [CAPTURE_ARMED_KEY]: false });
    } catch (_) {}

    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("scroll", refreshOverlay, true);
    window.addEventListener("resize", refreshOverlay);
    document.addEventListener("click", onDocumentClick, true);
  }

  // WebPT-specific page detection: fast-path on hostname, then fall back to heuristics
  function looksLikeEzyvetPage() {
    if (isEzyvetHost() || HOST_HINT_RE.test(String(location.hostname || ""))) return true;

    const url = `${location.hostname} ${location.pathname} ${location.search}`;
    if (/(schedule|calendar|appointment|appt|booking)/i.test(url)) return true;

    // Count time markers on the page — a calendar will have many
    const bodyText = normalizeSpaces(document.body?.innerText || "");
    const timeMatches = bodyText.match(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi) || [];
    if (timeMatches.length >= 6) return true;

    // Count FullCalendar or known appointment elements
    const candidateCount = CARD_SELECTORS.reduce((count, selector) => {
      try { return count + document.querySelectorAll(selector).length; } catch (_) { return count; }
    }, 0);
    return candidateCount >= 3;
  }

  function isEzyvetHost() {
    return String(location.hostname || "").toLowerCase().includes("ezyvet.com");
  }

  function onMouseMove(event) {
    if (!enabled || !captureArmed) return;
    lastMoveEvent = event;
    if (rafId) return;
    rafId = window.requestAnimationFrame(() => {
      rafId = 0;
      if (isEzyvetHost()) {
        refreshEzyvetHoverSelection();
        return;
      }
      const candidate = findAppointmentCardFromEvent(lastMoveEvent);
      if (candidate === hoveredCard) { refreshOverlay(); return; }
      setHoveredCard(candidate);
    });
  }

  async function onDocumentClick(event) {
    if (!enabled) return;
    if (isModalTarget(event.target) || isBadgeTarget(event.target) || isAuthPanelTarget(event.target)) return;
    if (authPanelOpen) closeAuthPanel();
    if (!captureArmed) return;

    if (isEzyvetHost()) {
      await captureVisibleEzyvetSummary(event);
      return;
    }

    const card = findAppointmentCardFromEvent(event);
    if (!card) return;

    // Prevent the default link navigation (FC events are <a> tags) but do NOT
    // call stopPropagation/stopImmediatePropagation here — we need WebPT's own
    // click handlers to fire so they can populate the right-side detail panel.
    event.preventDefault();

    // Capture what we can immediately from the card text and any visible hover summary.
    const immediateData = parseAppointmentFromCard(card);
    const hoverData = parseEzyvetDetailPanel(card) || {};

    // Wait briefly so WebPT's handlers run and open the detail panel, then
    // read any extra info from it before showing our modal.
    await new Promise((resolve) => setTimeout(resolve, 250));

    const detailData = mergeEzyvetDetails(hoverData, parseEzyvetDetailPanel(card) || {});

    // Merge: detail panel wins over card text where available
    const patientName = normalizeSpaces(
      cleanEzyvetPatientName(detailData.patient) ||
      immediateData.patientName
    );
    const reason = normalizeSpaces(
      detailData.reason || detailData.description || detailData.type ||
      immediateData.reason
    );
    const doctor = normalizeSpaces(
      detailData.provider || immediateData.doctor
    );
    const typeText = normalizeSpaces(detailData.type || immediateData.typeText);

    if (!patientName) {
      showToast("Could not read that appointment.");
      return;
    }

    pendingAppointment = {
      patientName,
      reason,
      doctor,
      appointmentTime: detailData.appointmentTime || immediateData.appointmentTime,
      columnHeader: immediateData.columnHeader,
      rawText: [immediateData.rawText, detailData.rawText].filter(Boolean).join(" | "),
      typeText,
      providerText: normalizeSpaces(detailData.provider || immediateData.providerText),
      descriptionText: normalizeSpaces(detailData.reason || detailData.description || immediateData.descriptionText),
      ownerName: normalizeSpaces(detailData.owner || immediateData.ownerName),
      caseNumber: immediateData.caseNumber,
      sourceSystem: "webpt",
      sourceUrl: location.href,
      capturedAt: new Date().toISOString()
    };

    formState = null;
    validationState = { patientName: false, colorLabelId: false };
    modalMessage = "";
    await setCaptureArmed(false);
    await storageSet({ [STORAGE_KEY]: pendingAppointment });
    updateBadgeUi();
    showToast(`Captured ${pendingAppointment.patientName}${pendingAppointment.reason ? " - " + pendingAppointment.reason : ""}`);
    await openQuickSendModal();
  }

  async function captureVisibleEzyvetSummary(event) {
    const summary = parseVisibleEzyvetSummary();
    if (!summary?.patientName) {
      showToast("Hover an appointment until the WebPT appointment details appears, then click.");
      refreshEzyvetHoverSelection();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();

    pendingAppointment = {
      sourceSystem: "webpt",
      patientName: summary.patientName,
      reason: summary.reason,
      doctor: summary.doctor,
      appointmentTime: summary.appointmentTime,
      columnHeader: "",
      rawText: summary.rawText,
      typeText: summary.typeText,
      providerText: summary.providerText,
      descriptionText: summary.descriptionText,
      notesText: summary.notesText,
      ownerName: summary.ownerName,
      caseNumber: summary.caseNumber,
      sourceUrl: location.href,
      capturedAt: new Date().toISOString()
    };

    formState = null;
    validationState = { patientName: false, colorLabelId: false };
    modalMessage = "";
    await setCaptureArmed(false);
    await storageSet({ [STORAGE_KEY]: pendingAppointment });
    updateBadgeUi();
    showToast(`Captured ${pendingAppointment.patientName}${pendingAppointment.reason ? " - " + pendingAppointment.reason : ""}`);
    await openQuickSendModal();
  }

  function parseVisibleEzyvetSummary() {
    const panel = findVisibleEzyvetSummaryPanel();
    if (!panel) return null;
    const details = parseEzyvetPanelElement(panel);
    const patientName = formatEzyvetPatientDisplayName(details.patient, details.owner);
    if (!patientName) return null;
    const patientId = extractEzyvetPatientId(details.patient);
    const externalPresentingProblem = findNearbyEzyvetPresentingProblem(panel);
    const presentingProblem = normalizeSpaces(externalPresentingProblem || details.presentingProblem || details.reason);
    return {
      patientName,
      reason: presentingProblem,
      doctor: normalizeSpaces(details.provider),
      appointmentTime: normalizeSpaces(details.appointmentTime),
      rawText: details.rawText,
      typeText: normalizeSpaces(details.type),
      providerText: normalizeSpaces(details.provider),
      descriptionText: presentingProblem,
      notesText: presentingProblem,
      ownerName: normalizeSpaces(details.owner),
      caseNumber: patientId
    };
  }

  function refreshEzyvetHoverSelection() {
    if (!captureArmed || !isEzyvetHost() || isModalOpen()) return;
    const panel = findVisibleEzyvetSummaryPanel();
    if (panel === hoveredCard) {
      refreshOverlay();
      return;
    }
    setHoveredCard(panel);
  }

  function findVisibleEzyvetSummaryPanel() {
    let bestNode = null;
    let bestScore = -Infinity;

    for (const node of Array.from(document.querySelectorAll("body *"))) {
      if (!(node instanceof HTMLElement)) continue;
      if (node === document.body || node === document.documentElement) continue;
      if (node.closest?.(`#${MODAL_ID}, #${BADGE_ID}, #${AUTH_PANEL_ID}, #${OVERLAY_ID}, #${TOAST_ID}`)) continue;

      const rect = node.getBoundingClientRect();
      if (rect.width < 220 || rect.height < 90) continue;
      if (rect.width > Math.min(window.innerWidth - 24, 1300)) continue;
      if (rect.height > Math.min(window.innerHeight - 24, 1200)) continue;
      if (rect.top < -10 || rect.left < -10) continue;

      const style = window.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) continue;

      const text = normalizeSpaces(node.innerText || node.textContent || "");
      if (!text || text.length > 16000) continue;
      if (/^loading\.?\.?\.?$/i.test(text)) continue;

      const hasPatient = /\bpatient\b/i.test(text);
      const hasOwner = /\bowner\b/i.test(text);
      const hasType = /\btype\b/i.test(text);
      const hasCaseOwner = /case owner/i.test(text);
      const hasReason = /\breason\b/i.test(text);
      const hasStatus = /\bstatus\b/i.test(text);
      const hasSummaryShape = hasPatient && hasOwner && hasType && (hasReason || hasCaseOwner || hasStatus);
      if (!hasSummaryShape) continue;

      const details = parseEzyvetPanelElement(node);
      if (!cleanEzyvetPatientName(details.patient)) continue;

      const looksLikeTooltip = matchesAnySelector(node, DETAIL_PANEL_SELECTORS) ||
        /tooltip|popover|hover|appointment|summary/i.test(String(node.className || ""));
      let score = 0;
      if (looksLikeTooltip) score += 400;
      if (hasCaseOwner) score += 220;
      if (hasReason) score += 220;
      if (hasStatus) score += 120;
      if (details.appointmentTime) score += 120;
      score -= Math.max(0, rect.width * rect.height) / 10000;

      if (score > bestScore) {
        bestScore = score;
        bestNode = node;
      }
    }

    return bestNode;
  }

  function findNearbyEzyvetPresentingProblem(panel) {
    const panelRect = panel?.getBoundingClientRect?.();
    if (!panelRect) return "";

    let bestText = "";
    let bestScore = -Infinity;

    for (const node of Array.from(document.querySelectorAll("body *"))) {
      if (!(node instanceof HTMLElement)) continue;
      if (node === panel || panel.contains(node) || node.contains(panel)) continue;
      if (node.closest?.(`#${MODAL_ID}, #${BADGE_ID}, #${AUTH_PANEL_ID}, #${OVERLAY_ID}, #${TOAST_ID}`)) continue;

      const rect = node.getBoundingClientRect();
      if (rect.width < 120 || rect.height < 20) continue;
      if (rect.top < panelRect.bottom - 8 || rect.top > panelRect.bottom + 220) continue;
      if (rect.right < panelRect.left - 40 || rect.left > panelRect.right + 40) continue;

      const style = window.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) continue;

      const text = normalizeSpaces(node.innerText || node.textContent || "");
      if (!/presenting problem/i.test(text)) continue;

      const extracted = extractEzyvetPresentingProblemText(text) || extractNearbySiblingProblemText(node);
      if (!extracted) continue;

      const verticalDistance = Math.max(0, rect.top - panelRect.bottom);
      const horizontalDistance = Math.abs(rect.left - panelRect.left);
      const score = 1000 - (verticalDistance * 4) - (horizontalDistance * 0.5) - (Math.max(0, text.length - 400) * 0.25);
      if (score > bestScore) {
        bestScore = score;
        bestText = extracted;
      }
    }

    return bestText;
  }

  function extractEzyvetPresentingProblemText(text) {
    const normalized = normalizeSpaces(text);
    if (!normalized) return "";
    const match = normalized.match(/presenting problem(?:\(s\)|s)?\s*:?\s*(.+)$/i);
    if (!match) return "";
    return cleanEzyvetProblemText(match[1]);
  }

  function extractNearbySiblingProblemText(node) {
    const parent = node?.parentElement;
    if (!parent) return "";
    const siblings = Array.from(parent.children || []);
    const index = siblings.indexOf(node);
    const chunks = [];

    for (let offset = 1; offset <= 4; offset += 1) {
      const sibling = siblings[index + offset];
      if (!(sibling instanceof HTMLElement)) continue;
      const text = normalizeSpaces(sibling.innerText || sibling.textContent || "");
      if (!text) continue;
      if (isEzyvetDetailStopLine(normalizeLooseCompare(text))) break;
      chunks.push(text);
      const combined = cleanEzyvetProblemText(chunks.join(" "));
      if (combined) return combined;
    }

    return "";
  }

  function findAppointmentCard(startNode) {
    let node = getElementFromNode(startNode);
    if (!node) return null;

    // Fast path: walk up looking for a FullCalendar event element first.
    // FC events are deeply nested (title div → main div → <a class="fc-event">)
    // so we need to reach the <a> wrapper before anything else matches.
    let probe = node;
    while (probe && probe !== document.body) {
      if (isFCEventNode(probe) && isLikelyAppointmentCard(probe)) return probe;
      probe = probe.parentElement;
    }

    // Second pass: known data-attribute selectors
    probe = node;
    while (probe && probe !== document.body) {
      if (matchesKnownCardSelector(probe) && !isFCEventNode(probe) && isLikelyAppointmentCard(probe)) return probe;
      probe = probe.parentElement;
    }

    // Final fallback: generic heuristic (time-range text, cursor:pointer, etc.)
    probe = node;
    while (probe && probe !== document.body) {
      if (isLikelyAppointmentCard(probe)) return probe;
      probe = probe.parentElement;
    }

    return null;
  }

  function findAppointmentCardFromEvent(event) {
    if (isEzyvetHost()) {
      return findEzyvetAppointmentCardFromPoint(event);
    }
    const x = Number(event?.clientX);
    const y = Number(event?.clientY);
    if (Number.isFinite(x) && Number.isFinite(y) && typeof document.elementsFromPoint === "function") {
      const stack = document.elementsFromPoint(x, y);
      for (const element of stack) {
        const card = findAppointmentCard(element);
        if (card) return card;
      }
    }
    return findAppointmentCard(event?.target);
  }

  function findEzyvetAppointmentCardFromPoint(event) {
    const x = Number(event?.clientX);
    const y = Number(event?.clientY);
    const candidates = [];

    const addCandidatesFrom = (element) => {
      let node = getElementFromNode(element);
      while (node && node !== document.body && node !== document.documentElement) {
        if (isEzyvetAppointmentCandidate(node, x, y)) candidates.push(node);
        node = node.parentElement;
      }
    };

    if (Number.isFinite(x) && Number.isFinite(y) && typeof document.elementsFromPoint === "function") {
      for (const element of document.elementsFromPoint(x, y)) addCandidatesFrom(element);
    }

    addCandidatesFrom(event?.target);

    if (!candidates.length && Number.isFinite(x) && Number.isFinite(y)) {
      for (const node of Array.from(document.querySelectorAll("body *"))) {
        if (isEzyvetAppointmentCandidate(node, x, y)) candidates.push(node);
      }
    }

    return chooseBestEzyvetAppointmentCandidate(candidates);
  }

  function isEzyvetAppointmentCandidate(node, x, y) {
    if (!(node instanceof HTMLElement)) return false;
    if ([OVERLAY_ID, TOAST_ID, BADGE_ID, AUTH_PANEL_ID, MODAL_ID, BACKDROP_ID].includes(node.id)) return false;
    if (node.closest?.(`#${MODAL_ID}, #${AUTH_PANEL_ID}, #${BADGE_ID}, #${OVERLAY_ID}, #${TOAST_ID}`)) return false;

    const rect = node.getBoundingClientRect();
    if (rect.top < -10 || rect.left < -10) return false;
    if (Number.isFinite(x) && Number.isFinite(y) && !pointIsInsideRect(x, y, rect)) return false;
    const gridTop = getEzyvetCalendarGridTop();
    if (gridTop && rect.bottom < gridTop - 10) return false;
    if (gridTop && Number.isFinite(y) && y < gridTop - 10) return false;
    if (rect.width < 70 || rect.height < 14) return false;
    if (rect.width > Math.min(900, window.innerWidth * 0.65)) return false;
    if (rect.height > 180) return false;

    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;

    const text = getAppointmentNodeText(node);
    if (!hasStrictEzyvetAppointmentText(text)) return false;
    if ((text.match(EZYVET_CASE_NUM_RE) || []).length > 3) return false;

    return true;
  }

  function chooseBestEzyvetAppointmentCandidate(candidates) {
    let bestNode = null;
    let bestScore = -Infinity;
    const seen = new Set();
    for (const node of candidates) {
      if (!(node instanceof HTMLElement) || seen.has(node)) continue;
      seen.add(node);
      const rect = node.getBoundingClientRect();
      const text = getAppointmentNodeText(node);
      const area = Math.max(1, rect.width * rect.height);
      const caseCount = (text.match(EZYVET_CASE_NUM_RE) || []).length;
      let score = 1000 - (area / 1000);
      if (isFCEventNode(node) || matchesKnownCardSelector(node)) score += 200;
      if (EZYVET_SPECIES_RE.test(text)) score += 160;
      if (caseCount === 1) score += 140;
      if (rect.height >= 22 && rect.height <= 110) score += 80;
      if (rect.width >= 160 && rect.width <= 680) score += 60;
      if (isChromeElement(node)) score -= 500;
      if (score > bestScore) {
        bestScore = score;
        bestNode = node;
      }
    }
    return bestNode;
  }

  function pointIsInsideRect(x, y, rect) {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  function getEzyvetCalendarGridTop() {
    const now = Date.now();
    if (calendarGridTopCache.value && now - calendarGridTopCache.measuredAt < 750) return calendarGridTopCache.value;

    let top = Infinity;
    for (const node of Array.from(document.querySelectorAll("body *"))) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.closest?.(`#${MODAL_ID}, #${AUTH_PANEL_ID}, #${BADGE_ID}, #${OVERLAY_ID}, #${TOAST_ID}`)) continue;
      const text = normalizeSpaces(node.innerText || node.textContent || "");
      if (!/^([1-9]|1[0-2])(?::00)?\s*(am|pm)$/i.test(text)) continue;
      const rect = node.getBoundingClientRect();
      if (rect.width < 12 || rect.width > 90 || rect.height < 8 || rect.height > 36) continue;
      if (rect.top < 120 || rect.left < 160 || rect.left > Math.max(520, window.innerWidth * 0.45)) continue;
      const style = window.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) continue;
      top = Math.min(top, rect.top);
    }

    calendarGridTopCache = {
      value: Number.isFinite(top) ? top : 0,
      measuredAt: now
    };
    return calendarGridTopCache.value;
  }

  function getElementFromNode(node) {
    if (node instanceof Element) return node;
    if (node && node.parentElement) return node.parentElement;
    return null;
  }

  function matchesKnownCardSelector(node) {
    return matchesAnySelector(node, CARD_SELECTORS);
  }

  function matchesAnySelector(node, selectors) {
    return selectors.some((selector) => {
      try { return node.matches(selector); } catch (_) { return false; }
    });
  }

  function isInsideCalendarSurface(node) {
    return node instanceof Element && !!node.closest?.(CALENDAR_SURFACE_SELECTORS.join(","));
  }

  function isChromeElement(node) {
    if (!(node instanceof HTMLElement)) return false;
    if (isInsideCalendarSurface(node)) return false;
    const role = String(node.getAttribute("role") || "").toLowerCase();
    if (/^(tab|tablist|navigation|menu|menubar|banner)$/.test(role)) return true;
    const tag = String(node.tagName || "").toLowerCase();
    if (tag === "nav" || tag === "header") return true;
    const chromeText = `${node.id || ""} ${node.className || ""}`;
    return /(^|[\s_-])(?:nav|navbar|topbar|header|menu|toolbar|tab|tabs|breadcrumb)(?=[\s_-]|$)/i.test(chromeText);
  }

  // Returns true for any FullCalendar event node (WebPT's calendar engine)
  function isFCEventNode(node) {
    if (!(node instanceof HTMLElement)) return false;
    try {
      return node.matches(
        "a.fc-event, .fc-event, .fc-timegrid-event, .fc-v-event, " +
        ".fc-daygrid-event, .fc-h-event, [class*='fc-timegrid-event'], [class*='fc-v-event']"
      );
    } catch (_) { return false; }
  }

  function isLikelyAppointmentCard(node) {
    if (!(node instanceof HTMLElement)) return false;
    if ([OVERLAY_ID, TOAST_ID, BADGE_ID, AUTH_PANEL_ID, MODAL_ID, BACKDROP_ID].includes(node.id)) return false;
    if (node.closest?.(`#${MODAL_ID}`)) return false;
    if (node.closest?.(`#${AUTH_PANEL_ID}`)) return false;

    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return false;

    const rect = node.getBoundingClientRect();
    if (rect.top < -10 || rect.left < -10) return false;

    // ── FullCalendar events ─────────────────────────────────────────────────
    // FC events (used by WebPT) never embed time text in the card body — the
    // time is conveyed by the element's Y position in the grid. Skip the
    // hasTime requirement and trust the class match alone.
    if (isFCEventNode(node)) {
      if (rect.width < 8 || rect.height < 4) return false;
      if (rect.width > window.innerWidth * 0.98) return false;
      const text = normalizeSpaces(
        node.innerText ||
        node.getAttribute("aria-label") ||
        node.getAttribute("title") || ""
      );
      return text.length > 2;
    }

    const knownSelector = matchesKnownCardSelector(node);
    if (rect.width < (knownSelector ? 28 : 40) || rect.height < (knownSelector ? 16 : 20)) return false;
    if (rect.width > window.innerWidth * 0.95 || rect.height > window.innerHeight * 0.95) return false;

    const lines = getMeaningfulLines(node.innerText || "");
    if (!lines.length) return false;

    const rawText = lines.join(" ");
    if (isChromeElement(node) && !hasStrictEzyvetAppointmentText(rawText)) return false;

    // ── WebPT card text pattern ────────────────────────────────────────────
    // WebPT cards: "*PatientName" OwnerLast (Species) - CaseNum - Reason
    // No time-range text inside the card — skip hasTime. But be strict about
    // size so we don't match (a) tiny action icons or (b) the large red column
    // background div whose innerText aggregates all child appointment text.
    const looksLikeEzyvetCard = hasStrictEzyvetAppointmentText(rawText);
    if (looksLikeEzyvetCard) {
      // Too tall → it's a column container, not a single appointment bar
      if (rect.height > 140) return false;
      // Too short → it's an icon button inside a card, not the card itself
      if (rect.height < 18 || rect.width < 80) return false;
      // Too much text → multiple appointments aggregated from child elements
      if (rawText.length > 350) return false;
      // Multiple case numbers → container holding several appointments
      const caseCount = (rawText.match(/\b\d{6,8}\b/g) || []).length;
      if (caseCount > 2) return false;
      return true;
    }

    // ── Generic fallback (also catches other scheduler vendors) ─────────────
    if (lines.length < 2 && !knownSelector) return false;
    if (rawText.length > 400) return false;
    const nonTimeLines = lines.filter((line) => !TIME_RANGE_RE.test(line) && !/^all-day$/i.test(line));
    if (!nonTimeLines.length) return false;

    const hasTime = lines.some((line) => TIME_RANGE_RE.test(line) || /^all-day$/i.test(line));
    const looksCardLike =
      /^(absolute|relative|sticky)$/.test(style.position) ||
      style.cursor === "pointer" ||
      rect.height <= 260;
    return hasTime && looksCardLike;
  }

  function getAppointmentNodeText(node) {
    if (!(node instanceof HTMLElement)) return "";
    const chunks = [];
    const push = (value) => {
      const text = normalizeSpaces(value);
      if (text && !chunks.includes(text)) chunks.push(text);
    };
    push(node.innerText);
    push(node.textContent);
    push(node.getAttribute("aria-label"));
    push(node.getAttribute("title"));
    push(node.getAttribute("data-tooltip"));
    return chunks.join(" ");
  }

  function hasStrictEzyvetAppointmentText(text) {
    const normalized = normalizeSpaces(text);
    if (!normalized) return false;
    const parsed = parseEzyvetCardText(normalized);
    if (parsed?.patientName && parsed?.caseNumber && parsed?.reason) return true;
    if (/^\d{5,8}\s*-\s*[“"]/.test(normalized)) return false;
    const quotedBeforeCase = /[“"]\s*\*?[^”"]{1,80}[”"][\s\S]{0,180}\b\d{5,8}\b\s*-\s*\S/.test(normalized);
    if (!quotedBeforeCase) return false;
    if (EZYVET_SPECIES_RE.test(normalized)) return true;
    return /[“"]\s*\*?[^”"]{1,80}[”"]\s+[A-Za-z][A-Za-z' -]{1,80}\s*-\s*\d{5,8}\s*-\s*\S/.test(normalized);
  }

  // ── WebPT appointment parsing ──────────────────────────────────────────────

  // Synchronous parse from the card element itself (no detail panel wait needed).
  // Called immediately on click before the 250ms detail panel delay.
  function parseAppointmentFromCard(card) {
    const lines = getAppointmentLines(card);
    const cleaned = [];
    for (const line of lines) { if (!cleaned.includes(line)) cleaned.push(line); }

    const attributeText = getAppointmentAttributeText(card);
    const cardLineText = cleaned.join(" ");
    const ezyvetParsed =
      parseEzyvetCardText(cardLineText) ||
      parseEzyvetCardText(attributeText);

    const rawTextParts = [cardLineText, attributeText].filter(Boolean);
    const rawText = rawTextParts.join(" | ");

    const appointmentTime = guessAppointmentTime(cleaned);
    const nonTimeLines = cleaned.filter((line) => !TIME_RANGE_RE.test(line) && !/^all-day$/i.test(line));
    const columnHeader = guessColumnHeader(card);

    const patientName = normalizeSpaces(
      ezyvetParsed?.patientName || guessPatientName(nonTimeLines)
    );
    const reason = normalizeSpaces(ezyvetParsed?.reason || guessReason(nonTimeLines, patientName));
    const doctor = normalizeSpaces(
      extractProviderName(attributeText) ||
      guessDoctorFromLines(nonTimeLines) ||
      guessDoctorFromColumn(card)
    );

    return {
      patientName,
      reason,
      doctor,
      appointmentTime,
      columnHeader,
      rawText,
      typeText: "",
      providerText: "",
      descriptionText: reason,
      ownerName: ezyvetParsed?.ownerName || "",
      caseNumber: ezyvetParsed?.caseNumber || ""
    };
  }

  function parseAppointment(card) {
    const lines = getAppointmentLines(card);
    const cleaned = [];
    for (const line of lines) {
      if (!cleaned.includes(line)) cleaned.push(line);
    }

    // Try WebPT-specific detail panel first (the right-side info pane)
    const hoverDetails = parseEzyvetDetailPanel(card) || parseVisitHighlights(card);
    const attributeText = getAppointmentAttributeText(card);

    const rawTextParts = [
      cleaned.join(" | "),
      attributeText,
      hoverDetails.rawText,
      hoverDetails.type,
      hoverDetails.reason,
      hoverDetails.description,
      hoverDetails.provider,
      hoverDetails.status
    ].filter(Boolean);
    const rawText = rawTextParts.join(" | ");

    // Try to parse WebPT's card text format first
    const cardLineText = cleaned.join(" ");
    const ezyvetParsed = parseEzyvetCardText(cardLineText) || parseEzyvetCardText(attributeText);

    const appointmentTime = hoverDetails.appointmentTime || guessAppointmentTime(cleaned);
    const nonTimeLines = cleaned.filter((line) => !TIME_RANGE_RE.test(line) && !/^all-day$/i.test(line));
    const guessedColumnHeader = guessColumnHeader(card);
    const columnHeader = guessedColumnHeader;

    // Patient name: prefer detail panel → WebPT card parse → generic guess
    const patientName = normalizeSpaces(
      formatEzyvetPatientDisplayName(hoverDetails.patient, hoverDetails.owner || ezyvetParsed?.ownerName) ||
      (ezyvetParsed?.patientName ? formatEzyvetPatientDisplayName(ezyvetParsed.patientName, ezyvetParsed.ownerName) : "") ||
      ezyvetParsed?.patientName ||
      guessPatientName(nonTimeLines)
    );

    // Reason: prefer detail panel → WebPT card parse → generic guess
    const rawReason = hoverDetails.reason || hoverDetails.description || hoverDetails.type || ezyvetParsed?.reason || "";
    const reasonLines = [
      hoverDetails.type,
      hoverDetails.description,
      rawReason,
      ...nonTimeLines
    ].filter(Boolean);
    const reason = normalizeSpaces(rawReason || guessReason(reasonLines, patientName));

    // Doctor: WebPT calls this "case owner" in the detail panel
    const doctor = normalizeSpaces(
      hoverDetails.provider ||
      ezyvetParsed?.caseOwner ||
      extractProviderName(attributeText) ||
      guessDoctorFromLines(nonTimeLines) ||
      guessDoctorFromColumn(card)
    );

    return {
      patientName,
      reason,
      doctor,
      appointmentTime,
      columnHeader,
      rawText,
      typeText: normalizeSpaces(hoverDetails.type),
      providerText: normalizeSpaces(hoverDetails.provider),
      descriptionText: normalizeSpaces(hoverDetails.reason || hoverDetails.description),
      ownerName: hoverDetails.owner || ezyvetParsed?.ownerName || "",
      caseNumber: ezyvetParsed?.caseNumber || ""
    };
  }

  function mergeEzyvetDetails(primary, fallback) {
    const merged = Object.assign({}, fallback || {});
    for (const [key, value] of Object.entries(primary || {})) {
      const normalized = normalizeSpaces(value);
      if (normalized) merged[key] = value;
    }
    if (primary?.rawText && fallback?.rawText && primary.rawText !== fallback.rawText) {
      merged.rawText = [primary.rawText, fallback.rawText].filter(Boolean).join(" | ");
    }
    return merged;
  }

  // Parse WebPT card text: "*PatientName" OwnerLast (Species) - CaseNum - Reason
  function parseEzyvetCardText(text) {
    const str = normalizeSpaces(text);
    if (!str) return null;

    const match = str.match(EZYVET_CARD_RE);
    if (match) {
      return {
        patientName: normalizeSpaces(match[1].replace(/^\*/, "").trim()),
        ownerName: normalizeSpaces(match[2]),
        species: normalizeSpaces(match[3]),
        caseNumber: normalizeSpaces(match[4]),
        reason: normalizeSpaces(match[5])
      };
    }

    // Fallback: just extract quoted name and case number
    const quotedMatch = str.match(EZYVET_QUOTED_NAME_RE);
    const caseMatch = str.match(EZYVET_CASE_NUM_RE);
    const dashParts = str.split(/\s*-\s*/);
    if (quotedMatch || caseMatch) {
      return {
        patientName: quotedMatch ? normalizeSpaces(quotedMatch[1].replace(/^\*/, "").trim()) : "",
        ownerName: "",
        caseNumber: caseMatch ? caseMatch[1] : "",
        reason: dashParts.length >= 3 ? normalizeSpaces(dashParts[dashParts.length - 1]) : ""
      };
    }

    return null;
  }

  // Strip WebPT patient name artifacts like "(527357)" or breed suffixes
  function cleanEzyvetPatientName(value) {
    const text = normalizeSpaces(value);
    if (!text) return "";
    const stopped = text.split(/\b(?:animal notes|notes|demeanor|sex|species|breed|colo(?:u)?r|age|weight|master problems|appointment address|owner|type|date|time|case owner|status|reason)\b/i)[0];
    // Remove patient IDs in parens: "Bella (527357)" or "SADIE (UTK_323569)" -> "Bella"/"SADIE"
    return normalizeSpaces(stopped.replace(/\s*\([^)]*\).*$/, "").replace(/^\*/, "").trim());
  }

  function formatEzyvetPatientDisplayName(patientValue, ownerValue) {
    const patientName = cleanEzyvetPatientName(patientValue);
    if (!patientName) return "";

    const ownerLastName = extractEzyvetOwnerLastName(ownerValue);
    const patientId = extractEzyvetPatientId(patientValue);
    return [patientName, ownerLastName, patientId ? `(${patientId})` : ""].filter(Boolean).join(" ");
  }

  function extractEzyvetPatientId(value) {
    const text = normalizeSpaces(value);
    const match = text.match(/\(([^)]+)\)/);
    return match ? normalizeSpaces(match[1]) : "";
  }

  function extractEzyvetOwnerLastName(value) {
    let text = normalizeSpaces(value);
    if (!text) return "";
    text = text.split(/\b(?:notes|address|phone numbers|phone|first date|patient|type|date|time|case owner|status|reason)\b/i)[0];
    text = text.replace(/\s*\([^)]*\).*$/, "").trim();
    if (!text) return "";
    const commaIndex = text.indexOf(",");
    if (commaIndex >= 0) return normalizeSpaces(text.slice(0, commaIndex));
    const parts = text.split(/\s+/).filter(Boolean);
    return normalizeSpaces(parts[parts.length - 1] || "");
  }

  function cleanEzyvetProblemText(value) {
    const text = normalizeSpaces(value);
    if (!text) return "";
    const stopMatch = text.match(/\b(?:health status|history|er history form|standard of care|soc event|visit exams|er physical exam|physical examination findings|medication(?:\(s\)|s)?|client communications exams|shared|rabies|wellness exam|dhpp|leptospirosis|heartworm test|semi annual exam|bordetella|influenza|lyme|fecal|weight\s*\(?kg\)?|temp\s*\(?f\)?|h\.?\s*r\.?|r\.?\s*r\.?|comments)\b/i);
    return normalizeSpaces(stopMatch ? text.slice(0, stopMatch.index) : text);
  }

  // Parse the WebPT right-side appointment detail panel
  // WebPT labels: PATIENT, OWNER, TYPE, DATE, TIME, CASE OWNER, STATUS, PRESENTING PROBLEM(S)
  function parseEzyvetDetailPanel(card) {
    const panel = findEzyvetDetailPanel(card);
    if (!panel) return parseVisitHighlights(card);

    return parseEzyvetPanelElement(panel);
  }

  function parseEzyvetPanelElement(panel) {
    const lines = getMeaningfulLines(panel.innerText || panel.textContent || "");
    if (!lines.length) return {};

    const details = collectLabeledDetails(lines, EZYVET_DETAIL_LABEL_MAP);
    const reason = cleanEzyvetProblemText(joinDetailValues(details.reason));
    const presentingProblem = cleanEzyvetProblemText(joinDetailValues(details.presentingProblem));
    const description = reason || presentingProblem || cleanEzyvetProblemText(joinDetailValues(details.description));
    const providerText = joinDetailValues(details.provider);

    const inferredPatient = inferPatientFromPanelLines(lines);
    return {
      type: normalizeSpaces((details.type || []).join(" ")),
      reason: reason || presentingProblem,
      presentingProblem,
      description,
      status: normalizeSpaces((details.status || []).join(" ")),
      provider: extractProviderName(providerText) || providerText,
      patient: normalizeSpaces((details.patient || []).join(" ")) || inferredPatient,
      owner: normalizeSpaces((details.owner || []).join(" ")),
      appointmentDate: normalizeSpaces((details.appointmentDate || []).join(" ")),
      appointmentTime: normalizeSpaces((details.appointmentTime || []).join(" ")),
      column: normalizeSpaces((details.column || []).join(" ")),
      rawText: lines.join(" | ")
    };
  }

  function inferPatientFromPanelLines(lines) {
    for (const line of lines.slice(0, 8)) {
      const text = normalizeSpaces(line);
      if (!text) continue;
      if (/^(?:appointment|event|details|overview|appt|forms|contact info|rel. appts|med. alerts|lab case)$/i.test(text)) continue;
      if (/^(?:date|time|duration|length|status|location|provider|clinician|therapist|service|procedure|note|memo)/i.test(text)) continue;
      if (SINGLE_TIME_RE.test(text) || TIME_RANGE_RE.test(text)) continue;
      if (text.length > 90) continue;
      if (/(?:save|cancel|delete|done|close|edit|copy|duplicate|suggested times)/i.test(text)) continue;
      return cleanEzyvetPatientName(text);
    }
    return "";
  }

  // Locate WebPT's right-side detail panel (appears on click/hover)
  function findEzyvetDetailPanel(card) {
    const cardRect = card?.getBoundingClientRect?.();
    if (!cardRect) return null;

    let bestNode = null;
    let bestScore = -Infinity;
    const candidates = Array.from(document.querySelectorAll("body *"));

    for (const node of candidates) {
      if (!(node instanceof HTMLElement)) continue;
      if (node === document.body || node === document.documentElement) continue;
      if (node === card || card.contains(node)) continue;
      if (node.closest?.(`#${MODAL_ID}, #${BADGE_ID}, #${AUTH_PANEL_ID}, #${OVERLAY_ID}, #${TOAST_ID}`)) continue;

      const rect = node.getBoundingClientRect();
      if (rect.width < 200 || rect.height < 100) continue;
      if (rect.width > Math.min(window.innerWidth - 24, 1200)) continue;
      if (rect.height > Math.min(window.innerHeight - 24, 1100)) continue;
      if (rect.top < -10 || rect.left < -10) continue;

      const text = normalizeSpaces(node.innerText || "");
      if (!text) continue;
      if (text.length > 12000) continue;

      // WebPT detail panel signals
      const hasCaseOwner = /case owner/i.test(text);
      const hasType = /\b(?:type|service|services|procedure|procedures|billable services?|appointment details?)\b/i.test(text);
      const hasPatient = /\b(?:patient|client|contact info)\b/i.test(text);
      const hasReason = /\b(?:reason|chief complaint|visit reason|reason for visit|other|memo|appointment note)\b/i.test(text);
      const hasPresenting = /presenting problem/i.test(text);
      const hasOwner = /\b(?:owner|guardian|responsible party)\b/i.test(text);
      const hasStatus = /\bstatus\b/i.test(text);
      const hasProvider = /\b(?:provider|clinician|therapist|practitioner|doctor|appointment provider|additional provider)\b/i.test(text);
      const hasScheduleFields = /\b(?:date|time|duration|length|location|operatory|chair|room)\b/i.test(text);
      const hasVisitHighlights = /visit highlights/i.test(text);
      const looksLikeTooltip = matchesAnySelector(node, DETAIL_PANEL_SELECTORS) ||
        /tooltip|popover|hover|appointment/i.test(String(node.className || ""));

      const signalCount = [hasCaseOwner, hasType, hasPatient, hasReason, hasPresenting, hasOwner, hasStatus, hasProvider, hasScheduleFields, hasVisitHighlights].filter(Boolean).length;
      if (signalCount < 2) continue;

      const distanceX = Math.abs(rect.left - cardRect.right);
      const distanceY = Math.abs(rect.top - cardRect.top);
      const overlapsCardY = rect.bottom >= cardRect.top - 24 && rect.top <= cardRect.bottom + 120;
      const score = (looksLikeTooltip ? 420 : 0) + (hasCaseOwner ? 300 : 0) + (hasReason ? 280 : 0) +
        (hasPresenting ? 180 : 0) + (hasVisitHighlights ? 200 : 0) +
        (hasType ? 140 : 0) + (hasPatient ? 140 : 0) + (hasOwner ? 90 : 0) + (hasStatus ? 80 : 0) +
        (hasProvider ? 120 : 0) + (hasScheduleFields ? 90 : 0) +
        (overlapsCardY ? 160 : 0) -
        distanceX - (distanceY * 0.5);

      if (score > bestScore) {
        bestScore = score;
        bestNode = node;
      }
    }

    return bestNode;
  }

  // ── Generic parsing helpers (from pulse) ────────────────────────────────────

  function parseVisitHighlights(card) {
    const panel = findVisitHighlightsPanel(card);
    if (!panel) return {};

    const lines = getMeaningfulLines(panel.innerText || panel.textContent || "");
    if (!lines.length) return {};

    const labelMap = {
      "type": "type",
      "appointment type": "type",
      "visit type": "type",
      "description": "description",
      "reason": "description",
      "appointment reason": "description",
      "status": "status",
      "appointment provider": "provider",
      "provider": "provider",
      "doctor": "provider",
      "appointment doctor": "provider",
      "case owner": "provider",
      "clinician": "provider",
      "attending": "provider",
      "patient": "patient",
      "presenting problem": "description",
      "presenting problem(s)": "description",
      "chief complaint": "description",
      "owner": "owner"
    };

    const details = collectLabeledDetails(lines, labelMap);

    return {
      type: normalizeSpaces((details.type || []).join(" ")),
      description: normalizeSpaces([joinDetailValues(details.reason), joinDetailValues(details.description)].filter(Boolean)[0] || ""),
      status: normalizeSpaces((details.status || []).join(" ")),
      provider: extractProviderName((details.provider || []).join(" ")) || normalizeSpaces((details.provider || []).join(" ")),
      patient: normalizeSpaces((details.patient || []).join(" ")),
      owner: normalizeSpaces((details.owner || []).join(" "))
    };
  }

  function collectLabeledDetails(lines, labelMap) {
    const details = {};
    let currentKey = "";

    for (const line of lines) {
      const normalized = normalizeLooseCompare(line);
      if (!normalized || normalized === "visit highlights") continue;
      if (isEzyvetDetailStopLine(normalized)) {
        currentKey = "";
        continue;
      }

      const packedMatches = parsePackedLabeledLine(line, labelMap);
      if (packedMatches.length) {
        currentKey = "";
        for (const match of packedMatches) {
          if (!match.key) continue;
          if (match.key === "ignore") {
            currentKey = "";
            continue;
          }
          if (match.value) addDetailValue(details, match.key, match.value);
          currentKey = match.key;
        }
        continue;
      }

      const matchedKey = getLabeledDetailKey(labelMap, line);
      if (matchedKey) {
        currentKey = matchedKey === "ignore" ? "" : matchedKey;
        if (currentKey && !details[currentKey]) details[currentKey] = [];
        continue;
      }

      const inlineMatch = parseInlineLabeledLine(line, labelMap);
      if (inlineMatch) {
        if (inlineMatch.key !== "ignore") {
          addDetailValue(details, inlineMatch.key, inlineMatch.value);
          currentKey = inlineMatch.key;
        } else {
          currentKey = "";
        }
        continue;
      }

      if (!currentKey || currentKey === "ignore") continue;
      addDetailValue(details, currentKey, line);
    }

    return details;
  }

  function parsePackedLabeledLine(line, labelMap) {
    const text = normalizeSpaces(line);
    if (!text) return [];

    const labelPatterns = Object.keys(labelMap)
      .sort((a, b) => b.length - a.length)
      .map((label) => label.trim().split(/\s+/).map(escapeRegExp).join("\\s+"));
    if (!labelPatterns.length) return [];

    const pattern = new RegExp(`(^|\\s)(${labelPatterns.join("|")})\\s*:?\\s*`, "ig");
    const matches = [];
    let match;
    while ((match = pattern.exec(text))) {
      if (match.index > 0 && match[2] === match[2].toLowerCase()) {
        if (pattern.lastIndex === match.index) pattern.lastIndex += 1;
        continue;
      }
      const labelStart = match.index + match[1].length;
      const key = getLabeledDetailKey(labelMap, match[2]);
      matches.push({ labelStart, valueStart: pattern.lastIndex, key });
      if (pattern.lastIndex === match.index) pattern.lastIndex += 1;
    }

    if (!matches.length) return [];
    return matches
      .map((item, index) => {
        const end = index + 1 < matches.length ? matches[index + 1].labelStart : text.length;
        return { key: item.key, value: cleanDetailValue(text.slice(item.valueStart, end)) };
      })
      .filter((item) => item.key);
  }

  function parseInlineLabeledLine(line, labelMap) {
    const text = normalizeSpaces(line);
    if (!text) return null;
    const colonMatch = text.match(/^([^:]{2,40}):\s*(.+)$/);
    if (colonMatch) {
      const key = getLabeledDetailKey(labelMap, colonMatch[1]);
      const value = cleanDetailValue(colonMatch[2]);
      if (key && value) return { key, value };
    }
    const normalized = normalizeLooseCompare(text);
    for (const rawLabel of Object.keys(labelMap)) {
      if (!normalized.startsWith(normalizeLooseCompare(rawLabel) + " ")) continue;
      const value = cleanDetailValue(text.slice(rawLabel.length));
      if (value) return { key: getLabeledDetailKey(labelMap, rawLabel), value };
    }
    return null;
  }

  function getLabeledDetailKey(labelMap, label) {
    const text = normalizeSpaces(label).toLowerCase();
    const loose = normalizeLooseCompare(label);
    return labelMap[loose] || labelMap[text] || "";
  }

  function addDetailValue(details, key, value) {
    const cleaned = cleanDetailValue(value);
    if (!key || key === "ignore" || !cleaned) return;
    if (!details[key]) details[key] = [];
    if (!details[key].includes(cleaned)) details[key].push(cleaned);
  }

  function joinDetailValues(values) {
    return normalizeSpaces((values || []).map(cleanDetailValue).filter(Boolean).join(" "));
  }

  function cleanDetailValue(value) {
    return normalizeSpaces(String(value || "").replace(/^[\s:：\-–—]+|[\s:：\-–—]+$/g, ""));
  }

  function isEzyvetDetailStopLine(normalized) {
    return EZYVET_DETAIL_STOP_RE.test(normalized);
  }

  function findVisitHighlightsPanel(card) {
    const cardRect = card?.getBoundingClientRect?.();
    if (!cardRect) return null;

    let bestNode = null;
    let bestScore = -Infinity;
    const candidates = Array.from(document.querySelectorAll("body *"));

    for (const node of candidates) {
      if (!(node instanceof HTMLElement)) continue;
      if (node === card || card.contains(node)) continue;
      if (node.closest?.(`#${MODAL_ID}, #${BADGE_ID}, #${AUTH_PANEL_ID}, #${OVERLAY_ID}, #${TOAST_ID}`)) continue;

      const rect = node.getBoundingClientRect();
      if (rect.width < 220 || rect.height < 120) continue;
      if (rect.top < -10 || rect.left < -10) continue;

      const text = normalizeSpaces(node.innerText || "");
      if (!text) continue;
      const hasVisitHighlights = /visit highlights/i.test(text);
      const hasProvider = /appointment provider|case owner/i.test(text);
      const hasType = /\btype\b/i.test(text);
      if (!hasVisitHighlights && !(hasProvider && hasType)) continue;

      const distanceX = Math.abs(rect.left - cardRect.right);
      const distanceY = Math.abs(rect.top - cardRect.top);
      const score = (hasVisitHighlights ? 500 : 0) + (hasProvider ? 160 : 0) + (hasType ? 120 : 0) - distanceX - (distanceY * 0.5);
      if (score > bestScore) {
        bestScore = score;
        bestNode = node;
      }
    }

    return bestNode;
  }

  function guessPatientName(lines) {
    for (const line of lines) {
      if (!line) continue;
      if (DOCTOR_RE.test(line)) continue;
      if (TIME_RANGE_RE.test(line) || SINGLE_TIME_RE.test(line)) continue;
      if (/^[=\-–•]+$/.test(line)) continue;
      if (line.length > 40 && line.split(/\s+/).length > 5) continue;
      // Try to extract quoted name (WebPT format)
      const quotedMatch = line.match(EZYVET_QUOTED_NAME_RE);
      if (quotedMatch) return normalizeSpaces(quotedMatch[1].replace(/^\*/, "").trim());
      return normalizeSpaces(line);
    }
    return normalizeSpaces(lines[0] || "");
  }

  function guessReason(lines, patientName) {
    const filtered = [];
    for (const line of lines) {
      if (!line) continue;
      if (normalizeForCompare(line) === normalizeForCompare(patientName)) continue;
      if (DOCTOR_RE.test(line)) continue;
      if (TIME_RANGE_RE.test(line) || SINGLE_TIME_RE.test(line)) continue;
      if (/^[=\-–•]+$/.test(line)) continue;
      filtered.push(normalizeSpaces(line));
    }
    return filtered.join(", ");
  }

  function guessAppointmentTime(lines) {
    for (const line of lines) {
      const normalized = normalizeSpaces(line);
      if (!normalized) continue;
      if (/^all-day$/i.test(normalized)) return "All-day";
      if (TIME_RANGE_RE.test(normalized)) return normalized.match(TIME_RANGE_RE)?.[0] || normalized;
    }
    return "";
  }

  function guessDoctorFromLines(lines) {
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const line = normalizeSpaces(lines[index]);
      if (!line) continue;
      const extracted = extractProviderName(line);
      if (extracted) return extracted;
      if (!DOCTOR_NAME_RE.test(line)) continue;
      return line;
    }
    return "";
  }

  function extractProviderName(value) {
    let text = normalizeSpaces(value);
    if (!text) return "";
    text = text
      .replace(/^(?:appointment\s+provider|appointment\s+doctor|case\s+owner|provider|doctor|clinician)\s*:?\s*/i, "")
      .replace(/\b(?:appointment\s+provider|appointment\s+doctor|case\s+owner)\b\s*:?\s*/ig, " ")
      .replace(/\b(?:provider|doctor|clinician)\b\s*:?\s*/ig, " ")
      .replace(/\s+/g, " ").trim();
    if (!text) return "";
    const matches = text.match(/\b(?:dr\.?\s+[a-z][a-z' -]+|[a-z][a-z' -]+,\s*d\.?\s*v\.?\s*m\.?|[a-z][a-z' -]+\s+dvm)\b/ig);
    if (matches && matches.length) return normalizeSpaces(matches[0]);
    if (DOCTOR_NAME_RE.test(text)) return normalizeSpaces(text);
    return "";
  }

  function guessDoctorFromColumn(card) {
    const directDoctorHeader = findBestDoctorColumnHeader(card);
    if (directDoctorHeader) return directDoctorHeader;
    const columnHeader = guessColumnHeader(card);
    if (looksLikeDoctorColumnHeader(columnHeader)) return columnHeader;
    return "";
  }

  function findBestDoctorColumnHeader(card) {
    const cardRect = card?.getBoundingClientRect?.();
    if (!cardRect) return "";

    const centerX = cardRect.left + (cardRect.width / 2);
    let bestLabel = "";
    let bestScore = -Infinity;

    for (const node of Array.from(document.querySelectorAll("body *"))) {
      if (!(node instanceof HTMLElement)) continue;
      if (node === card || card.contains(node)) continue;
      if (node.closest?.(`#${MODAL_ID}, #${BADGE_ID}, #${AUTH_PANEL_ID}, #${OVERLAY_ID}, #${TOAST_ID}`)) continue;

      const rect = node.getBoundingClientRect();
      if (rect.width < 80 || rect.height < 20 || rect.height > 90) continue;
      if (rect.bottom > cardRect.top + 12) continue;
      if (rect.top < -10 || rect.left < -10) continue;

      const text = normalizeSpaces(node.innerText || "");
      if (!text || text.length > 80) continue;
      if (!looksLikeDoctorColumnHeader(text)) continue;

      const horizontalCenter = rect.left + (rect.width / 2);
      const horizontalDistance = Math.abs(horizontalCenter - centerX);
      const verticalDistance = Math.max(0, cardRect.top - rect.bottom);
      const overlapsCenter = centerX >= rect.left - 12 && centerX <= rect.right + 12;
      const score = (overlapsCenter ? 200 : 0) - (horizontalDistance * 2.5) - (verticalDistance * 0.35);

      if (score > bestScore) { bestScore = score; bestLabel = text; }
    }

    return normalizeSpaces(bestLabel);
  }

  function guessColumnHeader(card) {
    const doctorHeader = findBestDoctorColumnHeader(card);
    if (doctorHeader) return doctorHeader;

    const cardRect = card?.getBoundingClientRect?.();
    if (!cardRect) return "";

    const centerX = cardRect.left + (cardRect.width / 2);
    let bestLabel = "";
    let bestScore = -Infinity;

    for (const node of Array.from(document.querySelectorAll("body *"))) {
      if (!(node instanceof HTMLElement)) continue;
      if (node === card || card.contains(node)) continue;
      if (node.closest?.(`#${MODAL_ID}, #${BADGE_ID}, #${AUTH_PANEL_ID}, #${OVERLAY_ID}, #${TOAST_ID}`)) continue;

      const rect = node.getBoundingClientRect();
      if (rect.width < 80 || rect.height < 20 || rect.height > 90) continue;
      if (rect.bottom > cardRect.top + 12) continue;
      if (rect.top < -10 || rect.left < -10) continue;

      const text = normalizeSpaces(node.innerText || "");
      if (!text || text.length > 80) continue;
      if (!looksLikeColumnHeaderLabel(text)) continue;

      const horizontalCenter = rect.left + (rect.width / 2);
      const horizontalDistance = Math.abs(horizontalCenter - centerX);
      const verticalDistance = Math.max(0, cardRect.top - rect.bottom);
      const overlapsCenter = centerX >= rect.left - 12 && centerX <= rect.right + 12;
      const score = (overlapsCenter ? 220 : 0) - (horizontalDistance * 2.2) - (verticalDistance * 0.35);

      if (score > bestScore) { bestScore = score; bestLabel = text; }
    }

    return normalizeSpaces(bestLabel);
  }

  function looksLikeDoctorColumnHeader(text) {
    const label = normalizeSpaces(text);
    if (!label) return false;
    if (NON_DOCTOR_COLUMN_RE.test(label)) return false;
    if (/\d/.test(label)) return false;
    return DOCTOR_NAME_RE.test(label);
  }

  function looksLikeColumnHeaderLabel(text) {
    const label = normalizeSpaces(text);
    if (!label) return false;
    if (label.length > 60) return false;
    if (/\d/.test(label)) return false;
    if (looksLikeDoctorColumnHeader(label)) return true;
    if (TECH_COLUMN_RE.test(label)) return true;
    if (SURGERY_COLUMN_RE.test(label)) return true;
    if (DROP_OFF_COLUMN_RE.test(label)) return true;
    return false;
  }

  function getAppointmentLines(node) {
    if (!(node instanceof HTMLElement)) return [];
    const visibleText = getAppointmentNodeText(node);
    const visibleLines = getMeaningfulLines(visibleText);
    if (visibleLines.length) return visibleLines;
    return getMeaningfulLines(getAppointmentAttributeText(node));
  }

  function getAppointmentAttributeText(node) {
    if (!(node instanceof HTMLElement)) return "";

    const chunks = [];
    const pushChunk = (value) => {
      const normalized = normalizeSpaces(value);
      if (!normalized) return;
      if (!chunks.includes(normalized)) chunks.push(normalized);
    };

    const candidates = [node, ...Array.from(node.querySelectorAll("*")).slice(0, 60)];
    for (const element of candidates) {
      if (!(element instanceof HTMLElement)) continue;
      pushChunk(element.getAttribute("aria-label"));
      pushChunk(element.getAttribute("title"));
      pushChunk(element.getAttribute("data-tooltip"));
      for (const [key, value] of Object.entries(element.dataset || {})) {
        if (typeof value !== "string" || !value.trim()) continue;
        if (!/(appointment|appt|patient|reason|doctor|provider|time|start|visit|event|name|case|owner)/i.test(key)) continue;
        pushChunk(value);
      }
    }

    return chunks.join("\n");
  }

  function getMeaningfulLines(text) {
    return String(text || "")
      .split(/\n+/)
      .map((line) => normalizeSpaces(line))
      .filter((line) => line && line.length > 1);
  }

  // ── Color label matching (WebPT-aware) ─────────────────────────────────────

  function findBestColorLabelId(boardData, appointment) {
    const colors = Array.isArray(boardData.colorLabels) ? boardData.colorLabels : [];
    const typeText = normalizeSpaces(appointment?.typeText || "");
    const reason = normalizeSpaces(appointment?.reason || "");
    const rawText = normalizeSpaces(appointment?.rawText || "");
    const looseType = normalizeLooseCompare(typeText);
    const looseSearch = normalizeLooseCompare([typeText, reason, rawText].filter(Boolean).join(" "));
    if (!looseSearch) return colors[0]?.id || "";

    // 1. WebPT type map — highest priority
    const ezyvetMatch = findEzyvetTypeLabel(colors, appointment);
    if (ezyvetMatch) return ezyvetMatch.id;

    // 2. Exact label match
    const exact = colors.find((label) => normalizeLooseCompare(label.title) === looseType);
    if (exact) return exact.id;

    // 3. Alias fallback
    const aliasMatch = findAliasColorLabel(colors, looseSearch);
    if (aliasMatch) return aliasMatch.id;

    // 4. Scored match
    const scored = findBestScoredColorLabel(colors, looseSearch);
    if (scored) return scored.id;

    return colors[0]?.id || "";
  }

  function findEzyvetTypeLabel(colors, appointment) {
    const sources = {
      type: normalizeLooseCompare(appointment?.typeText || ""),
      reason: normalizeLooseCompare(appointment?.reason || ""),
      desc: normalizeLooseCompare(appointment?.descriptionText || ""),
      raw: normalizeLooseCompare(appointment?.rawText || "")
    };
    const searchText = [sources.type, sources.reason, sources.desc].filter(Boolean).join(" ");
    if (!searchText) return null;

    for (const mapping of EZYVET_TYPE_LABEL_MAP) {
      if (!mapping.ezyvet.some((term) => searchText.includes(normalizeLooseCompare(term)))) continue;
      const match = findColorLabelByMatchTerms(colors, mapping.vetboard);
      if (match) return match;
    }
    return null;
  }

  function findAliasColorLabel(colors, looseSearchText) {
    const aliasGroups = [
      { aliases: ["initial examination", "initial exam", "initial evaluation", "initial eval", "ie", "eval", "new patient"], labels: ["initial eval", "evaluation", "new patient"] },
      { aliases: ["re-examination", "re-exam", "re-evaluation", "re-eval", "progress note", "progress visit"], labels: ["re-eval", "progress"] },
      { aliases: ["follow up", "follow-up", "daily visit", "daily note", "treatment", "tx"], labels: ["treatment", "follow-up", "daily"] },
      { aliases: ["consultation", "consult"], labels: ["consult"] },
      { aliases: ["orthosis fabrication", "orthosis", "orthotic", "splint", "brace"], labels: ["orthosis", "splint"] },
      { aliases: ["discharge", "dc visit", "final visit"], labels: ["discharge"] },
      { aliases: ["telehealth", "virtual", "video visit"], labels: ["telehealth", "virtual"] },
      { aliases: ["dry needling", "needling"], labels: ["dry needling"] },
      { aliases: ["manual therapy", "massage"], labels: ["manual therapy"] },
      { aliases: ["aquatic", "pool"], labels: ["aquatic"] },
      { aliases: ["work conditioning", "work hardening", "fce"], labels: ["work conditioning", "fce"] },
      { aliases: ["urgent", "same day", "work in", "work-in"], labels: ["urgent", "work-in"] }
    ];

    for (const group of aliasGroups) {
      if (!group.aliases.some((alias) => looseSearchText.includes(normalizeLooseCompare(alias)))) continue;
      const match = findColorLabelByMatchTerms(colors, group.labels);
      if (match) return match;
    }
    return null;
  }

  function findColorLabelByMatchTerms(colors, matchTerms) {
    for (const term of matchTerms) {
      const normalizedTerm = normalizeLooseCompare(term);
      const match = colors.find((label) => normalizeLooseCompare(label.title).includes(normalizedTerm));
      if (match) return match;
    }
    return null;
  }

  function findBestScoredColorLabel(colors, searchText) {
    const normalizedSearch = normalizeLooseCompare(searchText);
    const searchTokens = getSignificantLooseTokens(normalizedSearch);
    if (!normalizedSearch || !searchTokens.length) return null;

    let bestLabel = null;
    let bestScore = 0;

    for (const label of colors) {
      const labelText = normalizeLooseCompare(label?.title || "");
      const labelTokens = getSignificantLooseTokens(labelText);
      if (!labelText || !labelTokens.length) continue;

      let score = 0;
      if (labelText === normalizedSearch) score = 1000;
      else if (labelText.includes(normalizedSearch)) score = 900;
      else if (normalizedSearch.includes(labelText)) score = 850;

      const overlapCount = countTokenOverlap(labelTokens, searchTokens);
      if (overlapCount) {
        score += overlapCount * 120;
        if (overlapCount === labelTokens.length) score += 180;
      }

      if (score > bestScore) { bestScore = score; bestLabel = label; }
    }

    return bestScore >= 240 ? bestLabel : null;
  }

  function getSignificantLooseTokens(value) {
    return normalizeLooseCompare(value)
      .split(" ")
      .filter((token) => token && token.length > 1 && !TYPE_MATCH_STOPWORDS[token]);
  }

  function countTokenOverlap(values, candidates) {
    if (!Array.isArray(values) || !Array.isArray(candidates) || !values.length || !candidates.length) return 0;
    const candidateSet = new Set(candidates);
    let matches = 0;
    for (const value of values) { if (candidateSet.has(value)) matches += 1; }
    return matches;
  }

  function findBestDoctorMatch(boardData, appointment) {
    const doctors = Array.isArray(boardData.doctors) ? boardData.doctors : [];
    const guesses = [
      appointment?.doctor,
      appointment?.providerText,
      extractProviderName(appointment?.rawText || ""),
      appointment?.columnHeader
    ].map((v) => normalizeSpaces(v)).filter(Boolean);
    if (!guesses.length) return "";

    let bestDoctor = "";
    let bestScore = 0;
    for (const guess of guesses) {
      const guessKey = normalizeDoctorForMatch(guess);
      const guessLast = getDoctorLastToken(guessKey);
      if (!guessKey) continue;

      for (const doctor of doctors) {
        const doctorName = normalizeSpaces(doctor);
        const doctorKey = normalizeDoctorForMatch(doctorName);
        if (!doctorKey) continue;

        let score = 0;
        if (doctorKey === guessKey) score = 100;
        else if (doctorKey.includes(guessKey) || guessKey.includes(doctorKey)) score = 90;
        else if (guessLast && doctorKey.split(" ").includes(guessLast)) score = 75;

        if (score > bestScore) { bestScore = score; bestDoctor = doctorName; }
      }
    }
    return bestDoctor;
  }

  function normalizeDoctorForMatch(value) {
    return normalizeSpaces(value)
      .toLowerCase()
      .replace(/\b(?:dr\.?|doctor|d\.?\s*v\.?\s*m\.?|dvm)\b/g, " ")
      .replace(/[(),.]/g, " ")
      .replace(/\s+/g, " ").trim();
  }

  function getDoctorLastToken(value) {
    const parts = normalizeSpaces(value).split(" ").filter(Boolean);
    return parts[parts.length - 1] || "";
  }

  // ── Form state ───────────────────────────────────────────────────────────────

  function buildInitialFormState(boardData, appointment) {
    const rooms = Array.isArray(boardData.rooms) ? boardData.rooms : [];
    const preferredRoom = rooms.find((room) => !room.patientName && !room.needsCleaning) ||
      rooms.find((room) => !room.needsCleaning) || rooms[0];
    return mergeRoomDefaultsIntoForm(preferredRoom || {}, appointment, boardData, { roomId: preferredRoom?.id || "" });
  }

  function mergeRoomDefaultsIntoForm(room, appointment, boardData, previousForm) {
    const reasonMatch = findBestColorLabelId(boardData, appointment);
    const doctorMatch = findBestDoctorMatch(boardData, appointment);
    const defaultColorId = normalizeSpaces(boardData?.settings?.defaultColorLabelId || "");
    const hasPreviousColor = !!previousForm && Object.prototype.hasOwnProperty.call(previousForm, "colorLabelId");
    const previousDoctorChosen = !!normalizeSpaces(previousForm?.doctor || "");

    return {
      roomId: room.id || previousForm?.roomId || "",
      patientName: previousForm?.patientName || appointment.patientName || room.patientName || "",
      colorLabelId: hasPreviousColor ? (previousForm.colorLabelId || "") : (reasonMatch || defaultColorId || room.colorLabelId || ""),
      doctor: previousDoctorChosen ? previousForm.doctor : (doctorMatch || room.doctor || ""),
      tech: room.tech || "",
      quickNote: room.quickNote || "",
      notes: previousForm?.notes || buildAppointmentNotes(appointment, room.notes || ""),
      roomReady: previousForm?.roomReady != null ? previousForm.roomReady : !!room.roomReady,
      doctorReady: previousForm?.doctorReady != null ? previousForm.doctorReady : !!room.doctorReady
    };
  }

  function buildAppointmentNotes(appointment, fallbackNotes) {
    const notesText = normalizeSpaces(appointment?.notesText || "");
    if (notesText) return notesText;

    const parts = [];
    const reason = normalizeSpaces(appointment?.reason || "");
    const appointmentTime = normalizeSpaces(appointment?.appointmentTime || "");
    const ownerName = normalizeSpaces(appointment?.ownerName || "");
    const caseNumber = normalizeSpaces(appointment?.caseNumber || "");

    if (reason) parts.push(reason);
    if (ownerName) parts.push(`Owner: ${ownerName}`);
    if (caseNumber) parts.push(`Case #${caseNumber}`);
    if (appointmentTime) parts.push(`Appt time: ${appointmentTime}`);

    if (parts.length) return parts.join("\n");
    return fallbackNotes || "";
  }

  // ── Badge, overlay, toast ────────────────────────────────────────────────────

  function ensureOverlay() {
    if (document.getElementById(OVERLAY_ID)) return;
    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.innerHTML = "<span>Click appointment</span>";
    document.documentElement.appendChild(overlay);
  }

  function ensureBadge() {
    if (document.getElementById(BADGE_ID)) return;
    const badge = document.createElement("button");
    badge.id = BADGE_ID;
    badge.type = "button";
    badge.textContent = "VB";
    badge.addEventListener("click", async function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      closeAuthPanel();
      await handleBadgeClick();
    });
    badge.addEventListener("contextmenu", function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      toggleAuthPanel();
    });
    document.documentElement.appendChild(badge);
  }

  function ensureAuthPanel() {
    if (document.getElementById(AUTH_PANEL_ID)) return;
    const panel = document.createElement("section");
    panel.id = AUTH_PANEL_ID;
    panel.setAttribute("aria-label", "RoomBoard login");
    document.documentElement.appendChild(panel);
    renderAuthPanel();
  }

  async function handleBadgeClick() {
    if (pendingAppointment?.patientName) {
      await discardPendingCapture("Capture canceled.");
      return;
    }
    if (authNeedsLogin) {
      authPanelOpen = true;
      renderAuthPanel();
      showToast(authErrorMessage || "Please sign in again.");
      return;
    }
    await refreshRoomsFromBadge();
    const nextState = !captureArmed;
    await setCaptureArmed(nextState);
    showToast(nextState ? "Patient selection armed." : "Patient selection canceled.");
  }

  async function refreshRoomsFromBadge() {
    if (!authState) return;
    try {
      await ensureValidAuthSession();
      await loadBoardState(true);
      if (isModalOpen()) renderModal();
    } catch (error) {
      modalMessage = getErrorMessage(error);
      if (isModalOpen()) renderModal();
    }
  }

  async function setCaptureArmed(nextState) {
    captureArmed = !!nextState;
    if (captureArmed && isEzyvetHost()) startEzyvetHoverPolling();
    if (!captureArmed) {
      stopEzyvetHoverPolling();
      setHoveredCard(null);
    }
    window.clearTimeout(noMatchWarningTimer);
    if (captureArmed && !isEzyvetHost()) {
      sawCandidateWhileArmed = false;
      noMatchWarningTimer = window.setTimeout(() => {
        if (captureArmed && !sawCandidateWhileArmed) {
          showToast("Not finding appointment cards on this page yet — this layout may need support's attention.");
        }
      }, 9000);
    }
    updateBadgeUi();
    await storageSet({ [CAPTURE_ARMED_KEY]: captureArmed });
  }

  function startEzyvetHoverPolling() {
    if (ezyvetHoverPollTimer) return;
    ezyvetHoverPollTimer = window.setInterval(refreshEzyvetHoverSelection, 250);
    refreshEzyvetHoverSelection();
  }

  function stopEzyvetHoverPolling() {
    if (!ezyvetHoverPollTimer) return;
    window.clearInterval(ezyvetHoverPollTimer);
    ezyvetHoverPollTimer = null;
  }

  function updateBadgeUi() {
    const badge = document.getElementById(BADGE_ID);
    if (!badge) return;

    badge.textContent = authNeedsLogin ? "!" : "VB";
    badge.classList.toggle("is-auth-error", authNeedsLogin);
    badge.classList.toggle("is-armed", captureArmed);
    badge.classList.toggle("is-busy", !!pendingAppointment);

    let label = "RoomBoard WebPT capture idle. Click to arm. Right-click to log in.";
    if (authNeedsLogin) {
      label = authErrorMessage || "RoomBoard needs you to sign in again. Right-click for login.";
    } else if (captureArmed) {
      label = isEzyvetHost()
        ? "Armed — hover an appointment until the WebPT appointment details appears, then click."
        : "Armed — click an appointment card. Press VB again to cancel.";
    } else if (pendingAppointment?.patientName) {
      label = "Patient captured. Finish sending or press VB to cancel.";
    }

    badge.setAttribute("aria-label", label);
    badge.title = label;
  }

  function setHoveredCard(card) {
    if (hoveredCard) hoveredCard.classList.remove(HOVER_CLASS);
    hoveredCard = card;
    if (hoveredCard && captureArmed) hoveredCard.classList.add(HOVER_CLASS);
    if (hoveredCard && !sawCandidateWhileArmed) {
      sawCandidateWhileArmed = true;
      window.clearTimeout(noMatchWarningTimer);
    }
    refreshOverlay();
  }

  function refreshOverlay() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    if (!captureArmed || !hoveredCard || !document.contains(hoveredCard) || isModalOpen()) {
      overlay.style.display = "none";
      return;
    }
    const rect = hoveredCard.getBoundingClientRect();
    const label = overlay.querySelector("span");
    if (label) {
      label.textContent = isEzyvetHost() ? "Click to capture" : "Click appointment";
    }
    overlay.style.display = "block";
    overlay.style.left = `${Math.max(6, rect.left - 3)}px`;
    overlay.style.top = `${Math.max(6, rect.top - 3)}px`;
    overlay.style.width = `${Math.max(40, rect.width + 6)}px`;
    overlay.style.height = `${Math.max(16, rect.height + 6)}px`;
  }

  function showToast(message) {
    let toast = document.getElementById(TOAST_ID);
    if (!toast) {
      toast = document.createElement("div");
      toast.id = TOAST_ID;
      document.documentElement.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 1900);
  }

  // ── Auth panel ───────────────────────────────────────────────────────────────

  function toggleAuthPanel() {
    authPanelOpen = !authPanelOpen;
    renderAuthPanel();
  }

  function closeAuthPanel() {
    if (!authPanelOpen) return;
    authPanelOpen = false;
    renderAuthPanel();
  }

  function renderAuthPanel() {
    const panel = document.getElementById(AUTH_PANEL_ID);
    if (!panel) return;
    panel.classList.toggle("is-open", authPanelOpen);
    panel.style.display = authPanelOpen ? "block" : "none";
    if (!authPanelOpen) return;

    panel.innerHTML = authState
      ? `<div class="vbPanelCard">
          <div class="vbPanelHeader">
            <div><div class="vbEyebrow">RoomBoard Login</div><h3>Connected</h3></div>
            <button class="vbBtn" data-auth-action="close" type="button">Close</button>
          </div>
          <div class="vbAuthState">Signed in as ${escapeHtml(authState.email || "RoomBoard user")}.</div>
          <div class="vbActions">
            <button class="vbBtn" data-auth-action="logout" type="button">Logout</button>
          </div>
        </div>`
      : `<div class="vbPanelCard">
          <div class="vbPanelHeader">
            <div><div class="vbEyebrow">RoomBoard Login</div><h3>Sign in</h3></div>
            <button class="vbBtn" data-auth-action="close" type="button">Close</button>
          </div>
          ${authNeedsLogin ? `<div class="vbAuthWarning">${escapeHtml(authErrorMessage || "Your RoomBoard session expired. Please sign in again.")}</div>` : ""}
          <div class="vbGrid vbAuthGrid">
            <label class="vbField">
              <span>Email</span>
              <input id="vbAuthEmail" autocomplete="username" placeholder="name@clinic.com" type="text" value="${escapeHtml(authFormState.email)}" />
            </label>
            <label class="vbField">
              <span>Password</span>
              <input id="vbAuthPassword" autocomplete="current-password" placeholder="password" type="password" value="${escapeHtml(authFormState.password)}" />
            </label>
          </div>
          <div class="vbActions">
            <button class="vbBtn vbPrimary" data-auth-action="login" type="button">Login to RoomBoard</button>
          </div>
        </div>`;

    panel.querySelectorAll("[data-auth-action]").forEach((button) => {
      button.addEventListener("click", async (event) => {
        const action = event.currentTarget.getAttribute("data-auth-action");
        if (action === "close") { closeAuthPanel(); return; }
        if (action === "login") { await handleLogin(); return; }
        if (action === "logout") { await handleLogout(); }
      });
    });

    const authEmail = panel.querySelector("#vbAuthEmail");
    const authPassword = panel.querySelector("#vbAuthPassword");
    if (authEmail) authEmail.addEventListener("input", () => { authFormState.email = authEmail.value; });
    if (authPassword) authPassword.addEventListener("input", () => { authFormState.password = authPassword.value; });
  }

  // ── Modal ────────────────────────────────────────────────────────────────────

  function ensureModalShell() {
    if (document.getElementById(BACKDROP_ID) && document.getElementById(MODAL_ID)) return;

    const backdrop = document.createElement("div");
    backdrop.id = BACKDROP_ID;
    backdrop.addEventListener("click", function () { discardPendingCapture("Capture canceled."); });

    const modal = document.createElement("section");
    modal.id = MODAL_ID;
    modal.setAttribute("aria-label", "Send appointment to RoomBoard");

    document.documentElement.appendChild(backdrop);
    document.documentElement.appendChild(modal);
  }

  async function openQuickSendModal() {
    if (!pendingAppointment?.patientName) return;
    document.documentElement.classList.add("vetboard-send-open");
    const backdrop = document.getElementById(BACKDROP_ID);
    const modal = document.getElementById(MODAL_ID);
    closeAuthPanel();
    if (backdrop) backdrop.style.display = "none";
    if (modal) modal.style.display = "block";
    renderModal();

    if (authState) {
      try {
        await ensureValidAuthSession();
        await loadBoardState(false);
      } catch (error) {
        modalMessage = getErrorMessage(error);
      }
      renderModal();
    }

    startRoomStatusRefresh();
    updateBadgeUi();
  }

  function closeQuickSendModal() {
    document.documentElement.classList.remove("vetboard-send-open");
    const backdrop = document.getElementById(BACKDROP_ID);
    const modal = document.getElementById(MODAL_ID);
    if (backdrop) backdrop.style.display = "none";
    if (modal) modal.style.display = "none";
    stopRoomStatusRefresh();
    refreshOverlay();
  }

  async function discardPendingCapture(message) {
    pendingAppointment = null;
    formState = null;
    validationState = { patientName: false, colorLabelId: false };
    modalMessage = "";
    closeQuickSendModal();
    updateBadgeUi();
    try { await storageRemove(STORAGE_KEY); } catch (_) {}
    await setCaptureArmed(false);
    if (message) showToast(message);
  }

  function renderModal() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal || !pendingAppointment) return;

    if (authState && boardStateCache?.data && !formState) {
      formState = buildInitialFormState(boardStateCache.data, pendingAppointment);
    }

    modal.innerHTML = `
      <div class="vbModalCard">
        <div class="vbModalHeader">
          <div>
            <div class="vbEyebrow">RoomBoard Quick Send</div>
            <h2>Send to board</h2>
          </div>
          <button class="vbBtn" data-action="close-modal" type="button">Close</button>
        </div>
        ${renderCaptureSummary()}
        <div class="vbCard">
          <div class="vbCardHeader">
            <h3>Quick Add fields</h3>
            <button class="vbBtn" data-action="refresh-board" type="button" ${authState ? "" : "disabled"}>Refresh rooms</button>
          </div>
          ${renderFormSection()}
        </div>
        <div class="vbFooter">
          <div class="vbFooterNote">${escapeHtml(modalMessage || "Click Send to RoomBoard to push this appointment.")}</div>
          <div class="vbActions">
            <button class="vbBtn" data-action="close-modal" type="button">Cancel</button>
            <button class="vbBtn vbPrimary" data-action="send-board" type="button" ${authState && boardStateCache?.data ? "" : "disabled"}>Send to RoomBoard</button>
          </div>
        </div>
      </div>
    `;

    bindModalHandlers(modal);
  }

  function renderCaptureSummary() {
    if (!pendingAppointment) return "";
    const parts = [];
    if (pendingAppointment.appointmentTime) parts.push(`<div class="vbSummaryCard"><div class="vbLabel">Time</div><div class="vbSummaryValue">${escapeHtml(pendingAppointment.appointmentTime)}</div></div>`);
    if (pendingAppointment.ownerName) parts.push(`<div class="vbSummaryCard"><div class="vbLabel">Owner</div><div class="vbSummaryValue">${escapeHtml(pendingAppointment.ownerName)}</div></div>`);
    if (pendingAppointment.caseNumber) parts.push(`<div class="vbSummaryCard"><div class="vbLabel">Case #</div><div class="vbSummaryValue">${escapeHtml(pendingAppointment.caseNumber)}</div></div>`);
    if (!parts.length) return "";
    return `<div class="vbSummaryRow">${parts.join("")}</div>`;
  }

  function renderFormSection() {
    if (!authState) {
      return `<div class="vbEmpty">Right-click the VB badge to log in and load rooms.</div>`;
    }
    if (!boardStateCache?.data) {
      return `<div class="vbEmpty">No board data loaded yet. Click Refresh rooms after login.</div>`;
    }

    const data = boardStateCache.data;
    const rooms = Array.isArray(data.rooms) ? data.rooms : [];
    const colorLabels = Array.isArray(data.colorLabels) ? data.colorLabels : [];
    const doctors = Array.isArray(data.doctors) ? data.doctors : [];
    const quickNotes = Array.isArray(data.quickNotes) ? data.quickNotes : [];

    if (!formState) formState = buildInitialFormState(data, pendingAppointment);
    validationState.patientName = !normalizeSpaces(formState?.patientName || "");
    validationState.colorLabelId = !normalizeSpaces(formState?.colorLabelId || "");

    return `
      <div class="vbGrid">
        <label class="vbField vbFieldFull">
          <span>Room</span>
          <select id="vbRoomId">${rooms.map((room) => {
            const label = formatRoomOptionLabel(room);
            return `<option value="${escapeHtml(room.id)}" ${room.id === formState.roomId ? "selected" : ""}>${escapeHtml(label)}</option>`;
          }).join("")}</select>
        </label>
        <label class="vbField vbFieldFull ${validationState.patientName ? "is-error" : ""}">
          <span>Patient name</span>
          <input id="vbPatientName" type="text" value="${escapeHtml(formState.patientName)}" aria-invalid="${validationState.patientName ? "true" : "false"}" />
        </label>
        <label class="vbField ${validationState.colorLabelId ? "is-error" : ""}">
          <span>Type</span>
          <select id="vbColorLabelId" aria-invalid="${validationState.colorLabelId ? "true" : "false"}">
            <option value="" ${formState.colorLabelId ? "" : "selected"}>Select type</option>
            ${colorLabels.map((label) => `<option value="${escapeHtml(label.id)}" ${label.id === formState.colorLabelId ? "selected" : ""}>${escapeHtml(label.title || "")}</option>`).join("")}
          </select>
        </label>
        <label class="vbField">
          <span>Doctor</span>
          <select id="vbDoctor">${doctors.map((doctor) => `<option value="${escapeHtml(doctor || "")}" ${doctor === formState.doctor ? "selected" : ""}>${escapeHtml(doctor || "(none)")}</option>`).join("")}</select>
        </label>
        <label class="vbField">
          <span>Tech</span>
          <input id="vbTech" type="text" value="${escapeHtml(formState.tech)}" placeholder="e.g., Alex" />
        </label>
        <label class="vbField">
          <span>Quick note</span>
          <select id="vbQuickNote">${quickNotes.map((note) => `<option value="${escapeHtml(note || "")}" ${note === formState.quickNote ? "selected" : ""}>${escapeHtml(note || "(none)")}</option>`).join("")}</select>
        </label>
        <label class="vbField vbFieldFull">
          <span>Status notes</span>
          <textarea id="vbNotes" placeholder="Quick notes…">${escapeHtml(formState.notes)}</textarea>
        </label>
      </div>
      <div class="vbToggleRow">
        <label class="vbCheckbox"><input id="vbDoctorReady" type="checkbox" ${formState.doctorReady ? "checked" : ""} /> Doctor ready</label>
      </div>
    `;
  }

  function bindModalHandlers(modal) {
    modal.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", async (event) => {
        const action = event.currentTarget.getAttribute("data-action");
        if (action === "close-modal") { await discardPendingCapture("Capture canceled."); return; }
        if (action === "refresh-board") { await handleRefreshBoard(); return; }
        if (action === "send-board") { await handleSendToBoard(); }
      });
    });

    const bindSync = (id, prop, type) => {
      const field = modal.querySelector(`#${id}`);
      if (!field) return;
      const eventName = type === "select" ? "change" : "input";
      field.addEventListener(eventName, () => {
        if (!formState) return;
        if (type === "checkbox") { formState[prop] = !!field.checked; }
        else { formState[prop] = field.value; }
        if (prop in validationState) {
          validationState[prop] = !normalizeSpaces(formState[prop] || "");
          const fieldWrap = field.closest(".vbField");
          if (fieldWrap) fieldWrap.classList.toggle("is-error", validationState[prop]);
          field.setAttribute("aria-invalid", validationState[prop] ? "true" : "false");
        }
      });
    };

    const roomSelect = modal.querySelector("#vbRoomId");
    if (roomSelect) {
      roomSelect.addEventListener("change", () => {
        if (!boardStateCache?.data || !pendingAppointment) return;
        const room = findRoomById(boardStateCache.data, roomSelect.value);
        if (!room) return;
        formState = mergeRoomDefaultsIntoForm(room, pendingAppointment, boardStateCache.data, formState);
        renderModal();
      });
    }

    bindSync("vbPatientName", "patientName", "text");
    bindSync("vbColorLabelId", "colorLabelId", "select");
    bindSync("vbDoctor", "doctor", "select");
    bindSync("vbTech", "tech", "text");
    bindSync("vbQuickNote", "quickNote", "select");
    bindSync("vbNotes", "notes", "text");
    bindSync("vbDoctorReady", "doctorReady", "checkbox");
  }

  function formatRoomOptionLabel(room) {
    const roomName = room?.name || "Room";
    if (room?.needsCleaning) return `${roomName} - NEEDS CLEANING`;
    if (normalizeSpaces(room?.patientName || "")) return `${roomName} - FULL (${normalizeSpaces(room.patientName)})`;
    return `${roomName} - OPEN`;
  }

  function findRoomById(boardData, roomId) {
    const rooms = Array.isArray(boardData.rooms) ? boardData.rooms : [];
    return rooms.find((room) => room.id === roomId) || null;
  }

  // ── Auth ─────────────────────────────────────────────────────────────────────

  async function handleLogin() {
    const panel = document.getElementById(AUTH_PANEL_ID);
    const email = normalizeSpaces(panel?.querySelector("#vbAuthEmail")?.value || authFormState.email || "");
    const password = String(panel?.querySelector("#vbAuthPassword")?.value || authFormState.password || "");
    authFormState.email = email;
    authFormState.password = password;
    if (!email || !password) { showToast("Enter your email and password."); renderAuthPanel(); return; }

    try {
      showToast("Logging in…");
      authState = await loginToSupabase(email, password);
      authFormState.password = "";
      await storageSet({ [AUTH_KEY]: authState });
      await clearAuthReloginFlag();
      boardStateCache = null;
      currentPracticeId = null;
      await loadBoardState(true);
      modalMessage = "Logged in. Rooms loaded.";
      renderAuthPanel();
      if (isModalOpen()) renderModal();
      startRoomStatusRefresh();
      showToast("Logged in. Rooms loaded.");
    } catch (error) {
      modalMessage = getErrorMessage(error);
      authState = null;
      await storageRemove(AUTH_KEY);
      renderAuthPanel();
      if (isModalOpen()) renderModal();
      showToast(modalMessage);
    }
  }

  async function handleLogout() {
    authState = null;
    authNeedsLogin = false;
    authErrorMessage = "";
    authFormState.password = "";
    boardStateCache = null;
    currentPracticeId = null;
    formState = null;
    modalMessage = "Logged out.";
    await storageRemove(AUTH_KEY);
    await storageRemove(AUTH_STATUS_KEY);
    updateBadgeUi();
    renderAuthPanel();
    if (isModalOpen()) renderModal();
    showToast("Logged out.");
  }

  async function handleRefreshBoard() {
    try {
      modalMessage = "Loading rooms…";
      renderModal();
      await loadBoardState(true);
      modalMessage = "Board refreshed.";
    } catch (error) {
      modalMessage = getErrorMessage(error);
    }
    renderModal();
  }

  function startRoomStatusRefresh() {
    if (roomStatusRefreshTimer) clearInterval(roomStatusRefreshTimer);
    roomStatusRefreshTimer = setInterval(async function () {
      if (!isModalOpen() || !authState) return;
      try { await loadBoardState(true); renderModal(); } catch (_) {}
    }, 10000);
  }

  function stopRoomStatusRefresh() {
    if (!roomStatusRefreshTimer) return;
    clearInterval(roomStatusRefreshTimer);
    roomStatusRefreshTimer = null;
  }

  async function handleSendToBoard() {
    if (!pendingAppointment?.patientName) { modalMessage = "No appointment captured."; renderModal(); return; }
    if (!authState) { modalMessage = "Login required before sending to RoomBoard."; renderModal(); return; }

    syncFormStateFromDom();
    validationState = {
      patientName: !normalizeSpaces(formState?.patientName || ""),
      colorLabelId: !normalizeSpaces(formState?.colorLabelId || "")
    };
    if (validationState.patientName || validationState.colorLabelId) {
      modalMessage = "Select both the appointment name and type before sending.";
      renderModal();
      return;
    }
    if (!formState?.roomId) { modalMessage = "Pick a room first."; renderModal(); return; }

    try {
      modalMessage = "Sending to RoomBoard…";
      renderModal();

      await ensureValidAuthSession();
      const boardData = await loadBoardState(true);
      const room = findRoomById(boardData, formState.roomId);
      if (!room) throw new Error("That room could not be found in the shared board.");

      const wasEmpty = !normalizeSpaces(room.patientName || "");
      const previousPatientName = room.patientName || "";
      room.patientName = normalizeSpaces(formState.patientName || pendingAppointment.patientName || "");
      room.colorLabelId = formState.colorLabelId || room.colorLabelId || "";
      room.colorHex = "";
      room.doctor = formState.doctor || "";
      room.tech = normalizeSpaces(formState.tech || "");
      room.quickNote = formState.quickNote || "";
      room.notes = normalizeSpaces(formState.notes || "");
      room.roomReady = !!formState.roomReady;
      room.doctorReady = !!formState.doctorReady;
      room.needsCleaning = false;
      room.cleaningTimer = normalizeTimer(room.cleaningTimer);
      room.cleaningTimer.running = false;
      room.cleaningTimer.startedAt = null;
      room.cleaningTimer.startedAtIso = null;

      const selectedColor = (boardData.colorLabels || []).find((label) => label.id === room.colorLabelId);
      if (selectedColor?.title) room.reason = selectedColor.title;

      room.timer = normalizeTimer(room.timer);
      if (room.patientName && !room.timer.running && computeElapsed(room.timer) === 0) {
        const serverNowIso = await fetchServerNowIso();
        room.timer.elapsedMs = Math.max(0, Number(room.timer.elapsedMs || 0));
        room.timer.baseElapsedMs = Math.max(0, Number(room.timer.baseElapsedMs != null ? room.timer.baseElapsedMs : room.timer.elapsedMs));
        room.timer.running = true;
        room.timer.startedAt = null;
        room.timer.startedAtIso = serverNowIso;
      }

      if (wasEmpty && !room.activeRoomSessionId) {
        room.activeRoomSessionId = await createRoomSession(room);
      }

      await syncRoomChecklistForPatientChange(boardData, room, previousPatientName);
      await upsertBoardState(boardData);
      boardStateCache = { data: boardData };
      modalMessage = `${room.patientName} sent to ${room.name || "room"}.`;
      showToast(modalMessage);
      pendingAppointment = null;
      formState = null;
      validationState = { patientName: false, colorLabelId: false };
      await storageRemove(STORAGE_KEY);
      await setCaptureArmed(false);
      updateBadgeUi();
      closeQuickSendModal();
    } catch (error) {
      modalMessage = getErrorMessage(error);
      renderModal();
    }
  }

  function syncFormStateFromDom() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal || !formState) return;
    formState.roomId = modal.querySelector("#vbRoomId")?.value ?? formState.roomId;
    formState.patientName = modal.querySelector("#vbPatientName")?.value ?? "";
    formState.colorLabelId = modal.querySelector("#vbColorLabelId")?.value ?? "";
    formState.doctor = modal.querySelector("#vbDoctor")?.value ?? "";
    formState.tech = modal.querySelector("#vbTech")?.value ?? "";
    formState.quickNote = modal.querySelector("#vbQuickNote")?.value ?? "";
    formState.notes = modal.querySelector("#vbNotes")?.value ?? "";
    formState.doctorReady = !!modal.querySelector("#vbDoctorReady")?.checked;
  }

  // ── Supabase / API ───────────────────────────────────────────────────────────

  async function loginToSupabase(email, password) {
    const data = await fetchJson(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!data?.access_token) throw new Error("RoomBoard login did not return a session.");
    return mapAuthPayload(data, email);
  }

  async function ensureValidAuthSession() {
    if (!authState?.accessToken) {
      throw new Error(authNeedsLogin ? (authErrorMessage || "Your RoomBoard session expired. Please sign in again.") : "Login required.");
    }
    const expiresAt = Number(authState.expiresAt || 0);
    if (expiresAt && expiresAt > Date.now() + 60 * 1000) return authState;

    if (!authState.refreshToken) {
      await markAuthReloginRequired("Your RoomBoard session expired. Please sign in again.");
      throw new Error(authErrorMessage || "Your RoomBoard session expired. Please sign in again.");
    }

    try {
      const data = await fetchJson(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: authState.refreshToken })
      });
      if (!data?.access_token) throw new Error("RoomBoard refresh did not return a session.");
      authState = Object.assign({}, authState, mapAuthPayload(data, authState.email || ""));
      await storageSet({ [AUTH_KEY]: authState });
      await clearAuthReloginFlag();
      return authState;
    } catch (error) {
      const message = getErrorMessage(error);
      if (isLikelyAuthErrorMessage(message)) {
        await markAuthReloginRequired("Your RoomBoard session expired. Please sign in again.");
        throw new Error(authErrorMessage || message);
      }
      throw error;
    }
  }

  function mapAuthPayload(data, fallbackEmail) {
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + Math.max(0, Number(data.expires_in || 3600)) * 1000,
      email: data.user?.email || fallbackEmail || "",
      userId: data.user?.id || ""
    };
  }

  async function clearAuthReloginFlag() {
    authNeedsLogin = false;
    authErrorMessage = "";
    updateBadgeUi();
    try { await storageRemove(AUTH_STATUS_KEY); } catch (_) {}
  }

  async function markAuthReloginRequired(message) {
    authNeedsLogin = true;
    authErrorMessage = normalizeSpaces(message) || "Your RoomBoard session expired. Please sign in again.";
    authFormState.email = String((authState && authState.email) || authFormState.email || "").trim();
    authFormState.password = "";
    authState = null;
    boardStateCache = null;
    currentPracticeId = null;
    updateBadgeUi();
    try { await storageRemove(AUTH_KEY); } catch (_) {}
    try {
      await storageSet({ [AUTH_STATUS_KEY]: { needsLogin: true, message: authErrorMessage, email: authFormState.email || "" } });
    } catch (_) {}
    renderAuthPanel();
    if (isModalOpen()) { modalMessage = authErrorMessage; renderModal(); }
  }

  function isLikelyAuthErrorMessage(message) {
    const text = normalizeSpaces(message).toLowerCase();
    if (!text) return false;
    return text.includes("invalid token") || text.includes("jwt") || text.includes("token is expired") ||
      text.includes("session expired") || text.includes("refresh token") || text.includes("invalid grant") ||
      text.includes("login required") || text.includes("unauthorized");
  }

  async function loadBoardState(forceRefresh) {
    if (boardStateCache?.data && !forceRefresh) return boardStateCache.data;
    await ensureValidAuthSession();
    const practiceId = await fetchPracticeId(false);
    const boardData = await fetchPracticeBoardData(practiceId);
    currentPracticeId = practiceId;
    boardStateCache = { data: boardData, updated_at: new Date().toISOString() };
    if (!formState && pendingAppointment) formState = buildInitialFormState(boardData, pendingAppointment);
    return boardData;
  }

    function makeChecklistItem(text) {
    return {
      id: `pcl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: String(text || ""),
      done: false
    };
  }

  async function resolveDefaultChecklistTemplate(boardData) {
    const sharedUi = boardData?.boardStateExtras?.sharedUi && typeof boardData.boardStateExtras.sharedUi === "object"
      ? boardData.boardStateExtras.sharedUi
      : null;
    let enabled = null;
    let template = null;
    if (sharedUi) {
      if (sharedUi.patientChecklistEnabled != null) enabled = sharedUi.patientChecklistEnabled !== false;
      if (Array.isArray(sharedUi.defaultPatientChecklist)) template = sharedUi.defaultPatientChecklist;
    }
    // Older board_state rows may predate sharedUi carrying the checklist; the
    // settings snapshot table is the durable copy.
    if (enabled == null || template == null) {
      try {
        await ensureValidAuthSession();
        const practiceId = await fetchPracticeId(false);
        const rows = await fetchJson(`${SUPABASE_URL}/rest/v1/practice_default_settings?select=settings&practice_id=eq.${encodeURIComponent(practiceId)}&limit=1`, {
          method: "GET",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${authState.accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json"
          }
        });
        const settings = Array.isArray(rows) && rows[0]?.settings && typeof rows[0].settings === "object" ? rows[0].settings : null;
        if (settings) {
          if (enabled == null && settings.patientChecklistEnabled != null) enabled = settings.patientChecklistEnabled !== false;
          if (template == null && Array.isArray(settings.defaultPatientChecklist)) template = settings.defaultPatientChecklist;
        }
      } catch (_error) {}
    }
    const texts = (Array.isArray(template) ? template : [])
      .map((item) => (typeof item === "string" ? item : String(item?.text || "")))
      .map((text) => text.trim())
      .filter(Boolean);
    return { enabled: enabled !== false, texts };
  }

  // Mirrors syncRoomChecklistWithPatientChange in the RoomBoard web app
  // (board-state.js): clear the checklist when the patient is removed, clear +
  // reseed from the practice default when one patient replaces another, seed
  // when a patient arrives in a room with no items, and no-op on cosmetic
  // renames. The addon has no billing info, but base plans can't configure a
  // default template (the settings editor is gated), so their template is
  // empty and seeding is a no-op.
  async function syncRoomChecklistForPatientChange(boardData, room, previousPatientName) {
    const prev = String(previousPatientName || "").replace(/\s/g, "").toLowerCase();
    const next = String(room.patientName || "").replace(/\s/g, "").toLowerCase();
    if (prev === next) return;
    if (!next) {
      room.checklist = [];
      return;
    }
    if (prev) room.checklist = []; // different patient: drop the old items
    if (Array.isArray(room.checklist) && room.checklist.length) return; // never clobber existing items
    const { enabled, texts } = await resolveDefaultChecklistTemplate(boardData);
    room.checklist = enabled ? texts.map(makeChecklistItem) : [];
  }

  async function upsertBoardState(boardData) {
    await ensureValidAuthSession();
    const practiceId = await fetchPracticeId(false);
    // Writing only { rooms } would wipe sharedUi (practice-wide settings the
    // web app syncs through this row), so round-trip the extras.
    const payload = {
      practice_id: practiceId,
      board_state: {
        ...(boardData?.boardStateExtras || {}),
        rooms: deepClone(Array.isArray(boardData?.rooms) ? boardData.rooms : [])
      }
    };
    await fetchJson(`${SUPABASE_URL}/rest/v1/practice_board_state?on_conflict=practice_id`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${authState.accessToken}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify(payload)
    });
  }

  async function fetchPracticeId(forceRefresh) {
    if (currentPracticeId && !forceRefresh) return currentPracticeId;
    const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${authState.accessToken}`, "Content-Type": "application/json" };

    try {
      const practiceId = await fetchJson(`${SUPABASE_URL}/rest/v1/rpc/get_my_practice_id`, { method: "POST", headers, body: "{}" });
      if (typeof practiceId === "string" && practiceId) { currentPracticeId = practiceId; return currentPracticeId; }
    } catch (_) {}

    if (!authState?.userId) throw new Error("Could not determine your RoomBoard clinic.");

    const rows = await fetchJson(
      `${SUPABASE_URL}/rest/v1/profiles?select=practice_id&user_id=eq.${encodeURIComponent(authState.userId)}&limit=1`,
      { method: "GET", headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${authState.accessToken}`, Accept: "application/json" } }
    );
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row?.practice_id) throw new Error("Could not determine your RoomBoard clinic.");
    currentPracticeId = row.practice_id;
    return currentPracticeId;
  }

  async function fetchPracticeBoardData(practiceId) {
    const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${authState.accessToken}`, Accept: "application/json" };
    const id = encodeURIComponent(practiceId);
    const [roomRows, doctorRows, colorRows, quickNoteRows, settingsRows, boardStateRows] = await Promise.all([
      fetchJson(`${SUPABASE_URL}/rest/v1/rooms?select=id,name,sort_order,active&practice_id=eq.${id}&order=sort_order.asc,name.asc`, { method: "GET", headers }),
      fetchJson(`${SUPABASE_URL}/rest/v1/doctors?select=id,name,initials,active&practice_id=eq.${id}&order=name.asc`, { method: "GET", headers }),
      fetchJson(`${SUPABASE_URL}/rest/v1/appointment_types?select=id,title,color_hex,sort_order,active&practice_id=eq.${id}&order=sort_order.asc,title.asc`, { method: "GET", headers }),
      fetchJson(`${SUPABASE_URL}/rest/v1/quick_notes?select=id,label,sort_order,active&practice_id=eq.${id}&order=sort_order.asc,label.asc`, { method: "GET", headers }),
      fetchJson(`${SUPABASE_URL}/rest/v1/practice_settings?select=board_columns,show_only_active,board_view,highlight_doctor_id,default_appointment_type_id&practice_id=eq.${id}&limit=1`, { method: "GET", headers }),
      fetchJson(`${SUPABASE_URL}/rest/v1/practice_board_state?select=practice_id,board_state,updated_at&practice_id=eq.${id}&limit=1`, { method: "GET", headers })
    ]);
    return buildBoardStateFromPracticeRows({ roomRows, doctorRows, colorRows, quickNoteRows, settingsRows, boardStateRows });
  }

  function buildBoardStateFromPracticeRows(payload) {
    const roomRows = Array.isArray(payload.roomRows) ? payload.roomRows : [];
    const doctorRows = Array.isArray(payload.doctorRows) ? payload.doctorRows : [];
    const colorRows = Array.isArray(payload.colorRows) ? payload.colorRows : [];
    const quickNoteRows = Array.isArray(payload.quickNoteRows) ? payload.quickNoteRows : [];
    const settingsRow = Array.isArray(payload.settingsRows) ? payload.settingsRows[0] : (payload.settingsRows || null);
    const boardStateRow = Array.isArray(payload.boardStateRows) ? payload.boardStateRows[0] : (payload.boardStateRows || null);
    const boardState = boardStateRow?.board_state && typeof boardStateRow.board_state === "object" ? boardStateRow.board_state : {};
    const boardRooms = Array.isArray(boardState.rooms) ? boardState.rooms : [];
    // Keep the non-room parts of board_state (sharedUi etc.) so sends can
    // round-trip them — the RoomBoard web app syncs practice-wide settings
    // (including the default patient checklist) through board_state.sharedUi.
    const boardStateExtras = {};
    Object.keys(boardState).forEach((key) => {
      if (key !== "rooms") boardStateExtras[key] = boardState[key];
    });

    const activeDoctors = doctorRows.filter((row) => row && row.active !== false && normalizeSpaces(row.name));
    const activeColorRows = colorRows.filter((row) => row && row.active !== false && normalizeSpaces(row.title));
    const activeQuickNotes = quickNoteRows.filter((row) => row && row.active !== false && normalizeSpaces(row.label));

    const doctorInitials = {};
    activeDoctors.forEach((row) => { doctorInitials[row.name] = row.initials || ""; });

    const colorLabels = activeColorRows.map((row) => ({ id: row.id, title: row.title, color: row.color_hex || "#6ea8fe" }));
    const boardRoomMap = Object.create(null);
    boardRooms.forEach((room) => { if (room?.id) boardRoomMap[room.id] = room; });

    const defaultColorId = settingsRow?.default_appointment_type_id || colorLabels[0]?.id || "";
    const doctors = ["", ...activeDoctors.map((row) => row.name)];
    const quickNotes = ["", ...activeQuickNotes.map((row) => row.label)];

    const rooms = roomRows
      .filter((row) => row && row.active !== false)
      .sort((a, b) => {
        const sortDiff = Number(a.sort_order || 0) - Number(b.sort_order || 0);
        if (sortDiff !== 0) return sortDiff;
        return String(a.name || "").localeCompare(String(b.name || ""), undefined, { numeric: true, sensitivity: "base" });
      })
      .map((row, index) => mergeRoomEntryWithDefaults(row, boardRoomMap[row.id], index, defaultColorId, colorLabels));

    const highlightedDoctor = activeDoctors.find((row) => row.id === settingsRow?.highlight_doctor_id);

    return {
      rooms, doctors, quickNotes, colorLabels, boardStateExtras,
      settings: {
        displayCols: Math.max(1, Number(settingsRow?.board_columns || 4)),
        displayOnlyActive: !!settingsRow?.show_only_active,
        displayLayout: settingsRow?.board_view === "list" ? "list" : "grid",
        highlightDoctor: highlightedDoctor?.name || "",
        defaultColorLabelId: defaultColorId,
        doctorInitials
      }
    };
  }

  function mergeRoomEntryWithDefaults(roomRow, entryData, index, defaultColorId, colorLabels) {
    const colorId = entryData?.colorLabelId || defaultColorId || colorLabels[0]?.id || "";
    const merged = {
      id: roomRow.id, name: roomRow.name || `Room ${index + 1}`,
      patientName: "", colorLabelId: colorId, colorHex: "", doctor: "", tech: "",
      quickNote: "", notes: "", roomReady: false, doctorReady: false, needsCleaning: false, reason: "",
      timer: normalizeTimer(entryData?.timer), cleaningTimer: normalizeTimer(entryData?.cleaningTimer),
      activeRoomSessionId: entryData?.activeRoomSessionId || null,
      dischargeReady: entryData?.dischargeReady == null ? null : !!entryData.dischargeReady
    };
    if (entryData && typeof entryData === "object") {
      Object.assign(merged, entryData);
      merged.id = roomRow.id;
      merged.name = roomRow.name || merged.name;
      merged.timer = normalizeTimer(entryData.timer);
      merged.cleaningTimer = normalizeTimer(entryData.cleaningTimer);
    }
    if (!merged.reason) {
      const color = colorLabels.find((item) => item.id === merged.colorLabelId);
      if (color?.title) merged.reason = color.title;
    }
    return merged;
  }

  function normalizeTimer(timer) {
    const base = timer && typeof timer === "object" ? timer : {};
    const elapsedMs = Math.max(0, Number(base.elapsedMs || 0));
    const baseElapsedMs = Math.max(0, Number(base.baseElapsedMs != null ? base.baseElapsedMs : elapsedMs));
    return { elapsedMs, baseElapsedMs, running: !!base.running, startedAt: base.startedAt || null, startedAtIso: base.startedAtIso || null };
  }

  function computeElapsed(timer) {
    if (!timer) return 0;
    const elapsedMs = Math.max(0, Number(timer.elapsedMs || 0));
    if (timer.running && timer.startedAtIso) {
      const startedAtMs = Date.parse(timer.startedAtIso);
      if (Number.isFinite(startedAtMs)) return elapsedMs + Math.max(0, Date.now() - startedAtMs);
    }
    if (timer.running && timer.startedAt) return elapsedMs + Math.max(0, Date.now() - Number(timer.startedAt));
    return elapsedMs;
  }

  async function createRoomSession(room) {
    await ensureValidAuthSession();
    const practiceId = await fetchPracticeId(false);
    const serverNowIso = await fetchServerNowIso();
    const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${authState.accessToken}`, "Content-Type": "application/json", Prefer: "return=representation" };
    const payload = { room_name: room.name || room.id, doctor_name: room.doctor || null, started_at: serverNowIso, ended_at: null, duration_ms: null };
    if (practiceId) payload.practice_id = practiceId;

    try {
      const data = await fetchJson(`${SUPABASE_URL}/rest/v1/room_sessions`, { method: "POST", headers, body: JSON.stringify(payload) });
      return Array.isArray(data) ? data[0]?.id || null : data?.id || null;
    } catch (error) {
      const message = normalizeSpaces(getErrorMessage(error)).toLowerCase();
      const isPracticeIdColumn = message.includes("column") && message.includes("practice_id");
      if (!isPracticeIdColumn || !practiceId) throw error;
      const fallback = { room_name: payload.room_name, doctor_name: payload.doctor_name, started_at: payload.started_at, ended_at: null, duration_ms: null };
      const data = await fetchJson(`${SUPABASE_URL}/rest/v1/room_sessions`, { method: "POST", headers, body: JSON.stringify(fallback) });
      return Array.isArray(data) ? data[0]?.id || null : data?.id || null;
    }
  }

  async function fetchServerNowIso() {
    try {
      await ensureValidAuthSession();
      const data = await fetchJson(`${SUPABASE_URL}/rest/v1/rpc/get_server_now_iso`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${authState.accessToken}`, "Content-Type": "application/json" },
        body: "{}"
      });
      const keys = ["server_now", "serverNow", "now", "ts", "timestamp", "get_server_now_iso"];
      if (data && typeof data === "object") {
        for (const key of keys) { if (data[key]) { const p = Date.parse(data[key]); if (Number.isFinite(p)) return new Date(p).toISOString(); } }
      }
      if (typeof data === "string") { const p = Date.parse(data.trim()); if (Number.isFinite(p)) return new Date(p).toISOString(); }
    } catch (_) {}
    return new Date().toISOString();
  }

  async function fetchJson(url, options) {
    options = options || {};
    const response = await fetch(url, options);
    const text = await response.text();
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch (_) { parsed = text; }
    if (!response.ok) {
      const message = getErrorMessage(parsed) || `Request failed (${response.status})`;
      const hasAuthHeader = !!(options.headers && (options.headers.Authorization || options.headers.authorization));
      const canRetryAuth = hasAuthHeader && !options.__skipAuthRetry && !/\/auth\/v1\/token\b/i.test(String(url || ""));
      if (canRetryAuth && shouldTreatAsAuthFailure(response, parsed) && authState && authState.refreshToken) {
        try {
          authState.expiresAt = 0;
          await ensureValidAuthSession();
          const retryOptions = Object.assign({}, options, { headers: Object.assign({}, options.headers), __skipAuthRetry: true });
          if (retryOptions.headers.Authorization) retryOptions.headers.Authorization = `Bearer ${authState.accessToken}`;
          if (retryOptions.headers.authorization) retryOptions.headers.authorization = `Bearer ${authState.accessToken}`;
          return await fetchJson(url, retryOptions);
        } catch (refreshError) { throw new Error(getErrorMessage(refreshError) || message); }
      }
      if (canRetryAuth && shouldTreatAsAuthFailure(response, parsed)) {
        await markAuthReloginRequired(message);
        throw new Error(authErrorMessage || message);
      }
      throw new Error(message);
    }
    return parsed;
  }

  function shouldTreatAsAuthFailure(response, parsed) {
    const status = Number(response && response.status || 0);
    if (status === 401 || status === 403) return true;
    return isLikelyAuthErrorMessage(getErrorMessage(parsed));
  }

  function getErrorMessage(error) {
    if (!error) return "Unknown error";
    if (typeof error === "string") return error;
    if (error.message) return error.message;
    if (Array.isArray(error) && error[0]?.message) return error[0].message;
    if (error.msg) return error.msg;
    if (error.error_description) return error.error_description;
    try { return JSON.stringify(error); } catch (_) { return String(error); }
  }

  // ── Utilities ────────────────────────────────────────────────────────────────

  function normalizeSpaces(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function normalizeForCompare(value) { return normalizeSpaces(value).toLowerCase(); }
  function normalizeLooseCompare(value) {
    return normalizeForCompare(value).replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  }
  function escapeRegExp(value) { return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function deepClone(value) { return JSON.parse(JSON.stringify(value)); }

  function normalizeApiBaseUrl(value) { return String(value || "").trim().replace(/\/+$/, ""); }
  function getConfiguredApiBaseUrl() { return normalizeApiBaseUrl((authState && authState.apiBase) || authFormState.apiBase || ""); }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function isModalTarget(target) { return target instanceof Element && !!target.closest?.(`#${MODAL_ID}, #${BACKDROP_ID}`); }
  function isBadgeTarget(target) { return target instanceof Element && !!target.closest?.(`#${BADGE_ID}`); }
  function isAuthPanelTarget(target) { return target instanceof Element && !!target.closest?.(`#${AUTH_PANEL_ID}`); }
  function isModalOpen() { return document.documentElement.classList.contains("vetboard-send-open"); }

  function storageGet(keys) { return callStorage("get", keys); }
  function storageSet(value) { return callStorage("set", value); }
  function storageRemove(key) { return callStorage("remove", key); }

  function callStorage(method, value) {
    return new Promise((resolve, reject) => {
      let settled = false;
      try {
        const maybePromise = api.storage.local[method](value, (result) => {
          if (settled) return;
          settled = true;
          const error = api.runtime?.lastError;
          if (error) reject(new Error(error.message));
          else resolve(result);
        });
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise.then((result) => { if (settled) return; settled = true; resolve(result); })
            .catch((error) => { if (settled) return; settled = true; reject(error); });
        }
      } catch (error) {
        if (settled) return;
        settled = true;
        reject(error);
      }
    });
  }

  // ── Styles ───────────────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById("vetboard-webpt-styles")) return;
    const style = document.createElement("style");
    style.id = "vetboard-webpt-styles";
    style.textContent = `
      .${HOVER_CLASS} {
        outline: 2px solid rgba(16, 185, 129, 0.95) !important;
        outline-offset: 0 !important;
        box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.18) !important;
      }
      #${OVERLAY_ID} {
        position: fixed; z-index: 2147483646; display: none; pointer-events: none;
        border: 2px solid rgba(16, 185, 129, 0.98); border-radius: 6px;
        box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.18);
      }
      #${OVERLAY_ID} > span {
        position: absolute; top: -28px; left: 0; padding: 5px 10px; border-radius: 999px;
        background: rgba(6, 78, 59, 0.96); color: #ecfdf5;
        font: 600 12px/1.2 Arial, sans-serif; white-space: nowrap;
      }
      #${TOAST_ID} {
        position: fixed; right: 18px; bottom: 18px; z-index: 2147483647;
        transform: translateY(12px); opacity: 0;
        transition: opacity 140ms ease, transform 140ms ease;
        padding: 10px 14px; border-radius: 12px;
        background: rgba(15, 23, 42, 0.96); color: #f8fafc;
        font: 600 13px/1.35 Arial, sans-serif;
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.35); pointer-events: none;
      }
      #${TOAST_ID}.is-visible { opacity: 1; transform: translateY(0); }
      #${BADGE_ID} {
        position: fixed; left: 18px; bottom: 18px; z-index: 2147483647;
        width: 44px; height: 44px; border: none; border-radius: 999px;
        background: linear-gradient(180deg, #0f766e, #065f46);
        color: #ecfdf5; font: 800 14px/1 Arial, sans-serif; letter-spacing: 0.04em;
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.24); cursor: pointer;
      }
      #${BADGE_ID}.is-armed {
        background: linear-gradient(180deg, #34d399, #059669);
        box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.20), 0 18px 40px rgba(15, 23, 42, 0.28);
      }
      #${BADGE_ID}.is-busy { background: linear-gradient(180deg, #10b981, #047857); }
      #${BADGE_ID}.is-auth-error {
        background: linear-gradient(180deg, #ef4444, #b91c1c); color: #fff7f7;
        box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.18), 0 18px 40px rgba(15, 23, 42, 0.30);
      }
      #${BADGE_ID}:focus-visible { outline: 3px solid rgba(167, 243, 208, 0.85); outline-offset: 3px; }
      #${AUTH_PANEL_ID} {
        position: fixed; left: 18px; bottom: 72px; z-index: 2147483647;
        width: min(320px, calc(100vw - 24px)); display: none;
      }
      .vbPanelCard {
        background: #f8fafc; color: #0f172a; border-radius: 18px;
        box-shadow: 0 26px 70px rgba(15, 23, 42, 0.24);
        border: 1px solid rgba(148, 163, 184, 0.24); padding: 16px; display: grid; gap: 12px;
      }
      .vbAuthWarning {
        padding: 10px 12px; border-radius: 12px; background: #fef2f2;
        border: 1px solid #fecaca; color: #991b1b; font: 600 12px/1.45 Arial, sans-serif;
      }
      .vbPanelHeader { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      #${BACKDROP_ID} { position: fixed; inset: 0; z-index: 2147483645; display: none; pointer-events: none; }
      #${MODAL_ID} {
        position: fixed; top: 16px; right: 16px; bottom: 16px;
        width: min(460px, calc(100vw - 24px)); max-height: calc(100vh - 32px);
        overflow: auto; z-index: 2147483646; display: none; font-family: Arial, sans-serif;
      }
      .vbModalCard {
        background: #f8fafc; color: #0f172a; border-radius: 22px;
        box-shadow: 0 30px 80px rgba(15, 23, 42, 0.28);
        height: 100%; box-sizing: border-box; padding: 20px; display: grid; gap: 16px; align-content: start;
      }
      .vbModalHeader, .vbCardHeader, .vbSummaryRow, .vbFooter, .vbActions, .vbToggleRow {
        display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap;
      }
      .vbEyebrow { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #0f766e; font-weight: 700; }
      .vbModalHeader h2, .vbCardHeader h3 { margin: 4px 0 0; }
      .vbFooterNote, .vbAuthState, .vbEmpty, .vbLabel { color: #475569; }
      .vbSummaryRow { align-items: stretch; }
      .vbSummaryCard, .vbCard { border: 1px solid rgba(148, 163, 184, 0.28); background: white; border-radius: 16px; padding: 16px; }
      .vbSummaryCard { flex: 1 1 120px; }
      .vbSummaryValue { margin-top: 6px; font-weight: 700; color: #0f172a; font-size: 13px; }
      .vbGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .vbField { display: grid; gap: 6px; font-size: 13px; color: #0f172a; font-weight: 600; }
      .vbFieldFull { grid-column: 1 / -1; }
      .vbField input, .vbField select, .vbField textarea {
        width: 100%; border: 1px solid rgba(148, 163, 184, 0.45); border-radius: 12px;
        background: #fff; color: #0f172a; padding: 11px 12px; font: inherit; box-sizing: border-box;
      }
      .vbField.is-error input, .vbField.is-error select, .vbField.is-error textarea {
        border-color: #dc2626; box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.18); background: rgba(220, 38, 38, 0.04);
      }
      .vbField textarea { min-height: 90px; resize: vertical; }
      .vbBtn {
        border: 1px solid rgba(148, 163, 184, 0.4); background: #fff; color: #0f172a;
        border-radius: 999px; padding: 10px 14px; font: 600 13px/1 Arial, sans-serif; cursor: pointer;
      }
      .vbBtn:disabled { opacity: 0.45; cursor: not-allowed; }
      .vbPrimary { background: #0f766e; color: #ecfeff; border-color: #0f766e; }
      .vbCheckbox { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: #0f172a; }
      .vbEmpty { padding: 16px 0 4px; }
      .vbFooter { align-items: flex-end; margin-top: auto; }
      .vbFooterNote { flex: 1 1 240px; }
      @media (max-width: 640px) {
        #${MODAL_ID} { top: 8px; right: 8px; bottom: 8px; width: calc(100vw - 16px); }
        .vbGrid { grid-template-columns: 1fr; }
      }
    `;
    document.documentElement.appendChild(style);
  }
})();
