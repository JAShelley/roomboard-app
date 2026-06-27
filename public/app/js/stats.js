(function(){
  "use strict";

  // In-app Room & Cleaning Analytics dashboard.
  // The markup + scoped CSS live in js/stats-dashboard.js (window.__STATS_DASHBOARD__) and are
  // rendered into a Shadow DOM so the dashboard's styles stay fully isolated from the settings
  // drawer. Data is loaded through the app's existing Supabase client + practice scope.

  var STORAGE_KEY = "roomboardStatsPrefsV1";
  var STATS_PAGE_SIZE = 1000;
  var ALL_TREND_DAYS = [0, 1, 2, 3, 4, 5, 6];
  var WEEKDAY_TREND_DAYS = [1, 2, 3, 4, 5];
  var WEEKEND_TREND_DAYS = [0, 6];
  var TREND_DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  var root = null;          // shadow root hosting the dashboard
  var built = false;
  var wired = false;
  var lastRows = null;
  var rawLogRows = [];
  var currentLogRows = [];
  var selectedLogIds = {};
  var statsRequestToken = 0;
  var logsRequestToken = 0;
  var readyTimer = null;

  function $(id){ return root ? root.getElementById(id) : null; }
  function $all(selector){ return root ? Array.prototype.slice.call(root.querySelectorAll(selector)) : []; }

  // ===== Environment hooks (app supabase client + plan + practice scope) =====
  function getSupabase(){ return window.__roomboardSupabase || null; }
  function getPracticeId(){ return window.__roomboardPracticeId || null; }
  function isBasePlan(){
    var plan = typeof window.roomboardGetCurrentPlan === "function" ? window.roomboardGetCurrentPlan() : null;
    return !!(plan && String(plan).indexOf("base") !== -1);
  }

  function setStatus(msg){
    var el = $("statusLine");
    if(el) el.textContent = msg || "";
  }
  function setRoomLogsStatus(msg){
    var el = $("roomLogsStatus");
    if(el) el.textContent = msg || "";
  }

  function requireReady(forLogs){
    if(isBasePlan()){
      var gated = "Stats are available on the Advanced plan. Upgrade in Settings → Clinic.";
      setStatus(gated);
      if(forLogs) setRoomLogsStatus(gated);
      return false;
    }
    if(!getSupabase() || !getPracticeId()){
      var signedOut = "Sign in to your clinic to load analytics.";
      setStatus(signedOut);
      if(forLogs) setRoomLogsStatus(signedOut);
      return false;
    }
    return true;
  }

  // ===== Selection / status helpers =====
  function getSelectedLogIds(){
    return Object.keys(selectedLogIds).filter(function(id){ return !!selectedLogIds[id]; });
  }

  function updateLogSelectionUI(){
    var selectedCount = getSelectedLogIds().length;
    var deleteBtn = $("deleteSelectedLogsBtn");
    if(deleteBtn){
      deleteBtn.disabled = !selectedCount;
      deleteBtn.textContent = selectedCount ? ("Delete selected (" + selectedCount + ")") : "Delete selected";
    }
  }

  function escapeHtml(str){
    str = String(str == null ? "" : str);
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getErrorMessage(err){
    if(!err) return "Unknown error";
    if(typeof err === "string") return err;
    var parts = [];
    if(err.code) parts.push("code " + err.code);
    if(err.message) parts.push(err.message);
    if(err.details) parts.push(err.details);
    if(err.hint) parts.push("Hint: " + err.hint);
    return parts.length ? parts.join(" | ") : String(err);
  }

  // ===== Formatting helpers =====
  function msToHMS(ms){
    ms = Number(ms || 0);
    if(!isFinite(ms) || ms < 0) ms = 0;
    var total = Math.floor(ms / 1000);
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    function pad(n){ n = String(n); return n.length < 2 ? ("0" + n) : n; }
    return pad(h) + ":" + pad(m) + ":" + pad(s);
  }

  function median(arr){
    if(!arr || !arr.length) return 0;
    var copy = arr.slice().sort(function(a, b){ return a - b; });
    var mid = Math.floor(copy.length / 2);
    if(copy.length % 2) return copy[mid];
    return (copy[mid - 1] + copy[mid]) / 2;
  }

  function percentile(arr, p){
    if(!arr || !arr.length) return 0;
    var copy = arr.slice().sort(function(a, b){ return a - b; });
    if(copy.length === 1) return copy[0];
    var idx = (copy.length - 1) * p;
    var lo = Math.floor(idx);
    var hi = Math.ceil(idx);
    if(lo === hi) return copy[lo];
    return copy[lo] + (copy[hi] - copy[lo]) * (idx - lo);
  }

  function csvEscape(v){
    v = (v == null) ? "" : String(v);
    if(/[",\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
    return v;
  }

  function formatDateTime(iso){
    if(!iso) return "—";
    var d = new Date(iso);
    if(isNaN(d.getTime())) return String(iso);
    return d.toLocaleString([], { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function formatDateOnly(iso){
    if(!iso) return "—";
    var d = new Date(iso);
    if(isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
  }

  function formatCount(value){
    value = Number(value || 0);
    if(!isFinite(value)) value = 0;
    var rounded = Math.round(value * 10) / 10;
    return Math.abs(rounded - Math.round(rounded)) < 0.001 ? String(Math.round(rounded)) : rounded.toFixed(1);
  }

  function formatPercent(value){
    value = Number(value || 0);
    if(!isFinite(value)) value = 0;
    return formatCount(value) + "%";
  }

  function formatMinutes(value){
    value = Number(value || 0);
    if(!isFinite(value) || value < 0) value = 0;
    return formatCount(value) + " min";
  }

  function formatDurationCompact(ms){
    ms = Number(ms || 0);
    if(!isFinite(ms) || ms < 0) ms = 0;
    var minutes = Math.round(ms / 60000);
    if(minutes < 60) return minutes + " min";
    var hours = Math.floor(minutes / 60);
    var remainder = minutes % 60;
    return hours + "h" + (remainder ? " " + remainder + "m" : "");
  }

  function clamp(value, min, max){
    value = Number(value || 0);
    if(!isFinite(value)) value = min;
    return Math.max(min, Math.min(max, value));
  }

  function parsePositiveNumberInput(id, fallback, min, max){
    var el = $(id);
    var raw = el ? Number(el.value) : NaN;
    var value = isFinite(raw) && raw > 0 ? raw : fallback;
    if(el && (!isFinite(raw) || raw <= 0)) el.value = String(fallback);
    return clamp(value, min, max);
  }

  function getOperationalSettings(){
    return {
      clinicHoursPerDay: parsePositiveNumberInput("statsClinicHours", 10, 1, 24),
      targetRoomMinutes: parsePositiveNumberInput("statsTargetRoomMinutes", 45, 1, 480),
      targetCleanMinutes: parsePositiveNumberInput("statsTargetCleanMinutes", 10, 1, 240)
    };
  }

  function formatHourLabel(hour){
    hour = Number(hour || 0);
    if(!isFinite(hour) || hour < 0) hour = 0;
    var suffix = hour >= 12 ? "PM" : "AM";
    var display = hour % 12;
    if(display === 0) display = 12;
    return display + ":00 " + suffix;
  }

  function toDateInputValue(d){
    if(!(d instanceof Date) || isNaN(d.getTime())) return "";
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function parseDateInput(value, fallback){
    var d = value ? new Date(value + "T00:00:00") : null;
    if(!d || isNaN(d.getTime())) return fallback ? new Date(fallback.getTime()) : new Date();
    return d;
  }

  function parseOptionalMinutesInput(id){
    var el = $(id);
    if(!el) return null;
    var raw = (el.value || "").trim();
    if(!raw) return null;
    var value = Number(raw);
    if(!isFinite(value) || value < 0) return null;
    return value;
  }

  function formatThresholdMinutes(value){
    value = Number(value || 0);
    var rounded = Math.round(value * 10) / 10;
    return Math.abs(rounded - Math.round(rounded)) < 0.001 ? String(Math.round(rounded)) : rounded.toFixed(1);
  }

  function getAverageExclusionRules(){
    var below = parseOptionalMinutesInput("statsAverageExcludeBelow");
    var above = parseOptionalMinutesInput("statsAverageExcludeAbove");
    if(below != null && above != null && below > above){
      var swap = below;
      below = above;
      above = swap;
      $("statsAverageExcludeBelow").value = formatThresholdMinutes(below);
      $("statsAverageExcludeAbove").value = formatThresholdMinutes(above);
    }
    return {
      active: below != null || above != null,
      belowMinutes: below,
      aboveMinutes: above,
      belowMs: below == null ? null : below * 60000,
      aboveMs: above == null ? null : above * 60000
    };
  }

  function durationCountsForAverage(durationMs, rules){
    durationMs = Number(durationMs || 0);
    if(!isFinite(durationMs) || durationMs < 0) return false;
    rules = rules || {};
    if(rules.belowMs != null && durationMs < rules.belowMs) return false;
    if(rules.aboveMs != null && durationMs > rules.aboveMs) return false;
    return true;
  }

  function filterDurationsForAverage(durations, rules){
    return (durations || []).filter(function(duration){
      return durationCountsForAverage(duration, rules);
    });
  }

  function averageDuration(durations, rules){
    var included = filterDurationsForAverage(durations, rules);
    var total = included.reduce(function(sum, value){ return sum + value; }, 0);
    return included.length ? total / included.length : 0;
  }

  function countAverageExcluded(durations, rules){
    if(!rules || !rules.active) return 0;
    return (durations || []).filter(function(duration){
      return !durationCountsForAverage(duration, rules);
    }).length;
  }

  function filterRowsByDurationRules(rows, rules){
    if(!rules || !rules.active) return (rows || []).slice();
    return (rows || []).filter(function(row){
      return durationCountsForAverage(Number(row.duration_ms || 0), rules);
    });
  }

  function summarizeAverageRules(rules){
    if(!rules || !rules.active) return "No exclusions";
    var parts = [];
    if(rules.belowMinutes != null) parts.push("Below " + formatThresholdMinutes(rules.belowMinutes) + " min");
    if(rules.aboveMinutes != null) parts.push("Above " + formatThresholdMinutes(rules.aboveMinutes) + " min");
    return parts.join(", ");
  }

  // ===== Preferences =====
  function readStoredPreferences(){
    try{
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch(e){
      return {};
    }
  }

  function savePreferences(){
    if(!built) return;
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        statsStart: $("statsStart").value || "",
        statsEnd: $("statsEnd").value || "",
        statsGroupBy: $("statsGroupBy").value || "day",
        statsDoctorFilter: $("statsDoctorFilter").value || "",
        statsGraphMode: $("statsGraphMode").value || "appointments",
        statsTrendMetric: $("statsTrendMetric").value || "avg_duration",
        statsTrendDays: getSelectedTrendDays().join(","),
        statsAverageExcludeBelow: $("statsAverageExcludeBelow").value || "",
        statsAverageExcludeAbove: $("statsAverageExcludeAbove").value || "",
        statsClinicHours: $("statsClinicHours").value || "10",
        statsTargetRoomMinutes: $("statsTargetRoomMinutes").value || "45",
        statsTargetCleanMinutes: $("statsTargetCleanMinutes").value || "10",
        statsPreset: $("statsQuickRanges").dataset.activePreset || "",
        activeTab: getActiveAnalyticsTab(),
        roomLogsType: $("roomLogsType").value || "room",
        roomLogsStart: $("roomLogsStart").value || "",
        roomLogsEnd: $("roomLogsEnd").value || "",
        roomLogsLimit: $("roomLogsLimit").value || "100",
        roomLogsSearch: $("roomLogsSearch").value || "",
        roomLogsSort: $("roomLogsSort").value || "newest",
        roomLogsOutliers: $("roomLogsOutliers").value || "all"
      }));
    } catch(e){}
  }

  function defaultStatsDates(){
    var end = new Date();
    var start = new Date(end.getTime() - 6 * 24 * 3600 * 1000);
    $("statsStart").value = toDateInputValue(start);
    $("statsEnd").value = toDateInputValue(end);
  }

  function defaultRoomLogDates(){
    var end = new Date();
    var start = new Date(end.getTime() - 29 * 24 * 3600 * 1000);
    $("roomLogsStart").value = toDateInputValue(start);
    $("roomLogsEnd").value = toDateInputValue(end);
    $("roomLogsLimit").value = "100";
  }

  function restorePreferences(){
    var prefs = readStoredPreferences();
    if(prefs.statsStart) $("statsStart").value = prefs.statsStart;
    if(prefs.statsEnd) $("statsEnd").value = prefs.statsEnd;
    if(prefs.statsGroupBy) $("statsGroupBy").value = prefs.statsGroupBy;
    if(prefs.statsGraphMode) $("statsGraphMode").value = prefs.statsGraphMode;
    if(prefs.statsTrendMetric) $("statsTrendMetric").value = prefs.statsTrendMetric;
    if(prefs.statsAverageExcludeBelow != null) $("statsAverageExcludeBelow").value = prefs.statsAverageExcludeBelow;
    if(prefs.statsAverageExcludeAbove != null) $("statsAverageExcludeAbove").value = prefs.statsAverageExcludeAbove;
    if(prefs.statsClinicHours != null) $("statsClinicHours").value = prefs.statsClinicHours;
    if(prefs.statsTargetRoomMinutes != null) $("statsTargetRoomMinutes").value = prefs.statsTargetRoomMinutes;
    if(prefs.statsTargetCleanMinutes != null) $("statsTargetCleanMinutes").value = prefs.statsTargetCleanMinutes;
    setTrendDaySelection(prefs.statsTrendDays || ALL_TREND_DAYS.join(","), false);
    $("statsDoctorFilter").dataset.pendingValue = prefs.statsDoctorFilter || "";
    setActiveAnalyticsTab(prefs.activeTab || "dashboard", false);

    if(prefs.roomLogsType) $("roomLogsType").value = prefs.roomLogsType;
    if(prefs.roomLogsStart) $("roomLogsStart").value = prefs.roomLogsStart;
    if(prefs.roomLogsEnd) $("roomLogsEnd").value = prefs.roomLogsEnd;
    if(prefs.roomLogsLimit) $("roomLogsLimit").value = prefs.roomLogsLimit;
    if(prefs.roomLogsSearch) $("roomLogsSearch").value = prefs.roomLogsSearch;
    if(prefs.roomLogsSort) $("roomLogsSort").value = prefs.roomLogsSort;
    if(prefs.roomLogsOutliers) $("roomLogsOutliers").value = prefs.roomLogsOutliers;

    setActivePreset(prefs.statsPreset || "");
  }

  // ===== Analytics tab switching (inside the dashboard) =====
  function getActiveAnalyticsTab(){
    var active = root ? root.querySelector(".tabButton.active") : null;
    return active ? (active.getAttribute("data-tab") || "dashboard") : "dashboard";
  }

  function setActiveAnalyticsTab(tabName, shouldSave){
    var validTabs = { dashboard: true, trends: true, breakdowns: true, logs: true };
    tabName = validTabs[tabName] ? tabName : "dashboard";
    $all("#analyticsTabs .tabButton").forEach(function(btn){
      var active = btn.getAttribute("data-tab") === tabName;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    $all("[data-tab-panel]").forEach(function(panel){
      panel.classList.toggle("active", panel.getAttribute("data-tab-panel") === tabName);
    });
    if(shouldSave) savePreferences();
  }

  function setActivePreset(presetKey){
    var container = $("statsQuickRanges");
    if(!container) return;
    container.dataset.activePreset = presetKey || "";
    $all("#statsQuickRanges .pillBtn").forEach(function(btn){
      btn.classList.toggle("active", btn.getAttribute("data-range") === presetKey);
    });
  }

  function applyStatsPreset(presetKey){
    var today = new Date();
    var start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var end = new Date(start.getTime());
    if(presetKey === "7d"){
      start = new Date(end.getTime() - 6 * 24 * 3600 * 1000);
    } else if(presetKey === "30d"){
      start = new Date(end.getTime() - 29 * 24 * 3600 * 1000);
    } else if(presetKey === "90d"){
      start = new Date(end.getTime() - 89 * 24 * 3600 * 1000);
    } else if(presetKey === "mtd"){
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    }
    $("statsStart").value = toDateInputValue(start);
    $("statsEnd").value = toDateInputValue(end);
    setActivePreset(presetKey);
    savePreferences();
  }

  function clearActivePreset(){
    setActivePreset("");
    savePreferences();
  }

  // ===== Trend day filters =====
  function normalizeTrendDays(days){
    var source = days;
    if(typeof source === "string"){
      source = source.split(",");
    }
    if(!Array.isArray(source)) source = ALL_TREND_DAYS.slice();
    var seen = {};
    var normalized = [];
    source.forEach(function(day){
      var value = Number(day);
      if(Number.isInteger(value) && value >= 0 && value <= 6 && !seen[value]){
        seen[value] = true;
        normalized.push(value);
      }
    });
    if(!normalized.length) normalized = ALL_TREND_DAYS.slice();
    normalized.sort(function(a, b){ return a - b; });
    return normalized;
  }

  function trendDaysEqual(a, b){
    a = normalizeTrendDays(a);
    b = normalizeTrendDays(b);
    if(a.length !== b.length) return false;
    for(var i = 0; i < a.length; i++){
      if(a[i] !== b[i]) return false;
    }
    return true;
  }

  function getSelectedTrendDays(){
    var selected = [];
    $all("#trendDayFilters .dayToggle.active").forEach(function(btn){
      selected.push(btn.getAttribute("data-weekday"));
    });
    return normalizeTrendDays(selected);
  }

  function getTrendDayPresetKey(days){
    if(trendDaysEqual(days, ALL_TREND_DAYS)) return "all";
    if(trendDaysEqual(days, WEEKDAY_TREND_DAYS)) return "weekdays";
    if(trendDaysEqual(days, WEEKEND_TREND_DAYS)) return "weekend";
    return "";
  }

  function updateTrendDayPresetState(days){
    var presetKey = getTrendDayPresetKey(days);
    $all("#trendDayPresets .pillBtn").forEach(function(btn){
      btn.classList.toggle("active", btn.getAttribute("data-days") === presetKey);
    });
  }

  function setTrendDaySelection(days, shouldSave){
    var selected = normalizeTrendDays(days);
    var selectedMap = {};
    selected.forEach(function(day){ selectedMap[day] = true; });
    $all("#trendDayFilters .dayToggle").forEach(function(btn){
      var day = Number(btn.getAttribute("data-weekday"));
      var active = !!selectedMap[day];
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
    updateTrendDayPresetState(selected);
    if(shouldSave) savePreferences();
  }

  function applyTrendDayPreset(presetKey){
    if(presetKey === "weekdays") setTrendDaySelection(WEEKDAY_TREND_DAYS, true);
    else if(presetKey === "weekend") setTrendDaySelection(WEEKEND_TREND_DAYS, true);
    else setTrendDaySelection(ALL_TREND_DAYS, true);
    rerenderStatsIfLoaded();
  }

  function toggleTrendDay(day){
    var selected = getSelectedTrendDays();
    day = Number(day);
    var next = selected.filter(function(value){ return value !== day; });
    if(next.length === selected.length) next.push(day);
    if(!next.length) next = [day];
    setTrendDaySelection(next, true);
    rerenderStatsIfLoaded();
  }

  function getTrendDayLookup(days){
    var lookup = {};
    normalizeTrendDays(days).forEach(function(day){ lookup[day] = true; });
    return lookup;
  }

  function filterRowsByTrendDays(rows, days){
    var lookup = getTrendDayLookup(days);
    return (rows || []).filter(function(row){
      var d = new Date(row.started_at);
      return !isNaN(d.getTime()) && !!lookup[d.getDay()];
    });
  }

  function summarizeTrendDays(days){
    days = normalizeTrendDays(days);
    if(trendDaysEqual(days, ALL_TREND_DAYS)) return "All days";
    if(trendDaysEqual(days, WEEKDAY_TREND_DAYS)) return "Weekdays";
    if(trendDaysEqual(days, WEEKEND_TREND_DAYS)) return "Weekend";
    return days.map(function(day){ return TREND_DAY_LABELS[day]; }).join(", ");
  }

  // ===== Ranges =====
  function normalizeRangeInput(startId, endId, fallbackDays){
    var endFallback = new Date();
    var startFallback = new Date(endFallback.getTime() - fallbackDays * 24 * 3600 * 1000);
    var start = parseDateInput($(startId).value, startFallback);
    var end = parseDateInput($(endId).value, endFallback);
    if(start.getTime() > end.getTime()){
      var swap = start;
      start = end;
      end = swap;
      $(startId).value = toDateInputValue(start);
      $(endId).value = toDateInputValue(end);
    }
    return { start: start, end: end };
  }

  function getStatsRange(){
    var normalized = normalizeRangeInput("statsStart", "statsEnd", 6);
    return {
      start: normalized.start,
      end: normalized.end,
      startIso: normalized.start.toISOString(),
      endIso: new Date(normalized.end.getTime() + 24 * 3600 * 1000).toISOString()
    };
  }

  function getRoomLogsRange(){
    var normalized = normalizeRangeInput("roomLogsStart", "roomLogsEnd", 29);
    return {
      start: normalized.start,
      endExclusive: new Date(normalized.end.getTime() + 24 * 3600 * 1000),
      limit: Math.max(25, Math.min(500, Number($("roomLogsLimit").value || 100)))
    };
  }

  function getSelectedLogType(){
    return $("roomLogsType").value === "cleaning" ? "cleaning" : "room";
  }

  function getLogTypeConfig(){
    if(getSelectedLogType() === "cleaning"){
      return {
        type: "cleaning",
        table: "cleaning_sessions",
        selectColumns: "id, room_name, duration_ms, started_at, ended_at",
        labelPlural: "cleaning session(s)",
        labelSingular: "cleaning session",
        emptyMessage: "No closed cleaning sessions found for this range."
      };
    }
    return {
      type: "room",
      table: "room_sessions",
      selectColumns: "id, room_name, doctor_name, duration_ms, started_at, ended_at",
      labelPlural: "room session(s)",
      labelSingular: "room session",
      emptyMessage: "No closed room sessions found for this range."
    };
  }

  function getSelectedGroupBy(){ return $("statsGroupBy").value || "day"; }
  function getSelectedDoctor(){ return ($("statsDoctorFilter").value || "").trim(); }
  function getSelectedGraphMode(){ return ($("statsGraphMode").value || "appointments").trim(); }
  function getSelectedTrendMetric(){ return ($("statsTrendMetric").value || "avg_duration").trim(); }

  function getSeriesColor(index){
    var palette = ["#38bdf8", "#5eead4", "#fbbf24", "#fb7185", "#a78bfa", "#34d399", "#f97316", "#60a5fa"];
    return palette[index % palette.length];
  }

  function populateDoctorFilter(roomRows){
    var select = $("statsDoctorFilter");
    if(!select) return;
    var current = (select.dataset.pendingValue || getSelectedDoctor() || "").trim();
    var doctors = {};
    for(var i = 0; i < (roomRows || []).length; i++){
      var name = (roomRows[i].doctor_name || "").trim();
      if(name) doctors[name] = true;
    }
    var names = Object.keys(doctors).sort(function(a, b){ return a.localeCompare(b); });
    select.innerHTML = '<option value="">All doctors</option><option value="__comparison__">Comparison</option>';
    for(var j = 0; j < names.length; j++){
      var option = document.createElement("option");
      option.value = names[j];
      option.textContent = names[j];
      select.appendChild(option);
    }
    if(current === "__comparison__") select.value = current;
    else if(current && doctors[current]) select.value = current;
    else select.value = "";
    delete select.dataset.pendingValue;
  }

  function updateTrendMeta(graphMode, metricMode){
    var doctorField = $("statsDoctorFilter");
    var title = $("trendTitle");
    var datasetLabel = graphMode === "cleaning" ? "Cleaning" : "Appointment";
    var metricLabel = "average duration";
    if(metricMode === "median_duration") metricLabel = "median duration";
    else if(metricMode === "count") metricLabel = "session count";
    else if(metricMode === "total_hours") metricLabel = "total hours";

    if(title){
      title.textContent = datasetLabel + " trend by selected period (" + metricLabel + ")";
    }
    if(doctorField){
      doctorField.disabled = (graphMode === "cleaning");
    }
  }

  function getRangeDayCount(days){
    var range = getStatsRange();
    var endExclusive = new Date(range.end.getTime() + 24 * 3600 * 1000);
    var hasDayFilter = Array.isArray(days) || typeof days === "string";
    var lookup = hasDayFilter ? getTrendDayLookup(days) : null;
    var count = 0;
    var cursor = new Date(range.start.getTime());
    while(cursor.getTime() < endExclusive.getTime()){
      if(!lookup || lookup[cursor.getDay()]) count++;
      cursor = new Date(cursor.getTime() + 24 * 3600 * 1000);
    }
    return hasDayFilter ? count : Math.max(1, count);
  }

  function getWeekNumber(date){
    var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    var dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  function getLocalPeriodKey(date, groupBy){
    var d = new Date(date);
    if(isNaN(d.getTime())) return "";
    if(groupBy === "month"){
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    }
    if(groupBy === "week"){
      var weekStart = new Date(d);
      var day = weekStart.getDay();
      var diff = day === 0 ? -6 : (1 - day);
      weekStart.setDate(weekStart.getDate() + diff);
      return weekStart.getFullYear() + "-W" + String(getWeekNumber(weekStart)).padStart(2, "0");
    }
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function labelPeriodKey(key, groupBy){
    if(!key) return "Unknown";
    if(groupBy === "month"){
      var parts = key.split("-");
      var d = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
      return d.toLocaleDateString([], { month: "short", year: "numeric" });
    }
    if(groupBy === "week"){
      var m = key.match(/^(\d{4})-W(\d{2})$/);
      return m ? ("Week " + m[2] + ", " + m[1]) : key;
    }
    var dayDate = new Date(key + "T00:00:00");
    return isNaN(dayDate.getTime()) ? key : dayDate.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  }

  function getAllPeriodKeys(groupBy, days){
    var range = getStatsRange();
    var keys = {};
    var cursor = new Date(range.start.getTime());
    var endExclusive = new Date(range.end.getTime() + 24 * 3600 * 1000);
    var lookup = getTrendDayLookup(days || ALL_TREND_DAYS);
    while(cursor.getTime() < endExclusive.getTime()){
      if(lookup[cursor.getDay()]){
        keys[getLocalPeriodKey(cursor, groupBy)] = true;
      }
      cursor = new Date(cursor.getTime() + 24 * 3600 * 1000);
    }
    return Object.keys(keys).sort();
  }

  function createBucket(){
    return { count: 0, total: 0, durations: [], averageCount: 0, averageTotal: 0 };
  }

  function accumulateBuckets(rows, groupBy, averageRules){
    var map = {};
    for(var i = 0; i < rows.length; i++){
      var key = getLocalPeriodKey(rows[i].started_at, groupBy);
      if(!key) continue;
      if(!map[key]) map[key] = createBucket();
      var duration = Number(rows[i].duration_ms || 0);
      if(isFinite(duration) && duration >= 0){
        map[key].count++;
        map[key].total += duration;
        map[key].durations.push(duration);
        if(durationCountsForAverage(duration, averageRules)){
          map[key].averageCount++;
          map[key].averageTotal += duration;
        }
      }
    }
    return map;
  }

  function getAverageDurationFromBucket(bucket){
    if(!bucket || !bucket.averageCount) return 0;
    return (bucket.averageTotal || 0) / bucket.averageCount;
  }

  function getMetricValueFromBucket(bucket, metricMode){
    if(!bucket) return 0;
    if(metricMode === "count") return bucket.count || 0;
    if(metricMode === "total_hours") return (bucket.total || 0) / 3600000;
    if(metricMode === "median_duration") return bucket.count ? median(bucket.durations || []) : 0;
    return getAverageDurationFromBucket(bucket);
  }

  function formatMetricValue(value, metricMode){
    if(metricMode === "count") return formatCount(value);
    if(metricMode === "total_hours") return formatCount(value) + " hrs";
    return msToHMS(value);
  }

  function buildSeriesFromBucketMap(bucketMap, orderedKeys, groupBy, metricMode, name, color){
    orderedKeys = orderedKeys || Object.keys(bucketMap || {}).sort();
    return {
      name: name,
      color: color,
      points: orderedKeys.map(function(key){
        var bucket = bucketMap[key] || createBucket();
        return {
          label: labelPeriodKey(key, groupBy),
          metricValue: getMetricValueFromBucket(bucket, metricMode),
          count: bucket.count || 0,
          avgDurationMs: getAverageDurationFromBucket(bucket),
          medianDurationMs: bucket.count ? median(bucket.durations || []) : 0,
          totalDurationMs: bucket.total || 0
        };
      })
    };
  }

  function renderTrendChart(seriesList, options){
    var el = $("trendChart");
    var legend = $("trendLegend");
    var tooltip = $("trendTooltip");
    options = options || {};
    var emptyMessage = options.emptyMessage || "No session data available for this range.";
    var valueFormatter = options.valueFormatter || function(value){ return String(value); };
    var tooltipLabel = options.tooltipLabel || "Metric";
    var metricMode = options.metricMode || "";

    if(!seriesList || !seriesList.length || !seriesList.some(function(series){
      return (series.points || []).some(function(point){ return Number(point.metricValue || 0) > 0; });
    })){
      el.innerHTML = '<div class="emptyState">' + escapeHtml(emptyMessage) + '</div>';
      if(legend) legend.innerHTML = "";
      if(tooltip){
        tooltip.className = "chartTooltip";
        tooltip.textContent = "";
      }
      return;
    }

    var width = 920;
    var height = 320;
    var padLeft = 66;
    var padRight = 28;
    var padTop = 26;
    var padBottom = 62;
    var chartHeight = height - padTop - padBottom;
    var innerWidth = width - padLeft - padRight;
    var maxRawValue = 1;
    var labelCount = 0;
    var isDurationMetric = metricMode === "avg_duration" || metricMode === "median_duration";
    var tickCount = isDurationMetric ? 3 : 4;

    seriesList.forEach(function(series){
      var points = series.points || [];
      labelCount = Math.max(labelCount, points.length);
      points.forEach(function(point){
        maxRawValue = Math.max(maxRawValue, Number(point.metricValue || 0));
      });
    });

    function niceLinearMax(value){
      value = Number(value || 1);
      if(value <= 1) return 1;
      var power = Math.pow(10, Math.floor(Math.log10(value)));
      var fraction = value / power;
      var niceFraction = fraction <= 1 ? 1 : (fraction <= 2 ? 2 : (fraction <= 5 ? 5 : 10));
      return niceFraction * power;
    }

    function niceChartMax(value){
      value = Math.max(1, Number(value || 1));
      if(isDurationMetric){
        var minute = 60000;
        var step = value <= 30 * minute ? 5 * minute : (value <= 2 * 3600000 ? 15 * minute : 30 * minute);
        var durationTickSpan = step * tickCount;
        return Math.max(durationTickSpan, Math.ceil(value / durationTickSpan) * durationTickSpan);
      }
      if(metricMode === "count"){
        var countMax = niceLinearMax(value);
        return Math.max(tickCount, Math.ceil(countMax / tickCount) * tickCount);
      }
      if(metricMode === "total_hours") return Math.max(1, niceLinearMax(value));
      return niceLinearMax(value);
    }

    var maxValue = niceChartMax(maxRawValue * 1.08);

    function yFor(value){
      return padTop + (chartHeight - ((value / maxValue) * chartHeight));
    }

    function xFor(points, idx){
      return points.length === 1 ? (padLeft + innerWidth / 2) : (padLeft + (innerWidth * idx / Math.max(1, points.length - 1)));
    }

    var labels = "";
    var dots = "";
    var paths = "";
    var areas = "";
    var defs = "";
    var labelSource = (seriesList[0] && seriesList[0].points) ? seriesList[0].points : [];
    var labelEvery = Math.max(1, Math.ceil(labelSource.length / 8));
    var baselineY = padTop + chartHeight;

    seriesList.forEach(function(series, seriesIndex){
      var points = series.points || [];
      var linePath = "";
      var areaPath = "";
      points.forEach(function(point, idx){
        var x = xFor(points, idx);
        var y = yFor(Number(point.metricValue || 0));
        linePath += (idx ? " L " : "M ") + x + " " + y;
        if(!idx) areaPath = "M " + x + " " + baselineY + " L " + x + " " + y;
        else areaPath += " L " + x + " " + y;
        dots += '<circle class="chartPoint" data-series="' + escapeHtml(series.name || "") + '" data-label="' + escapeHtml(point.label || "") + '" data-metric="' + escapeHtml(valueFormatter(point.metricValue || 0)) + '" data-count="' + escapeHtml(String(point.count || 0)) + '" data-average="' + escapeHtml(msToHMS(point.avgDurationMs || 0)) + '" data-median="' + escapeHtml(msToHMS(point.medianDurationMs || 0)) + '" data-total="' + escapeHtml(formatCount((point.totalDurationMs || 0) / 3600000) + " hrs") + '" cx="' + x + '" cy="' + y + '" r="4.8" fill="' + escapeHtml(series.color) + '" stroke="#07111f" stroke-width="2.2" style="cursor:pointer"></circle>';
      });
      var gradientId = "trendGradient" + seriesIndex;
      defs += '<linearGradient id="' + gradientId + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + escapeHtml(series.color) + '" stop-opacity=".26"></stop><stop offset="100%" stop-color="' + escapeHtml(series.color) + '" stop-opacity="0"></stop></linearGradient>';
      if(points.length > 1){
        var lastX = xFor(points, points.length - 1);
        areaPath += " L " + lastX + " " + baselineY + " Z";
        areas += '<path d="' + areaPath + '" fill="url(#' + gradientId + ')"></path>';
      }
      paths += '<path class="chartPath" d="' + linePath + '" fill="none" stroke="' + escapeHtml(series.color) + '" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"></path>';
    });

    labelSource.forEach(function(point, idx){
      if(idx !== 0 && idx !== labelSource.length - 1 && idx % labelEvery !== 0) return;
      var x = xFor(labelSource, idx);
      var labelY = height - 22;
      var anchor = labelSource.length > 8 ? "end" : "middle";
      var transform = labelSource.length > 8 ? (' transform="rotate(-26 ' + x + ' ' + labelY + ')"') : "";
      labels += '<text class="chartAxisText" x="' + x + '" y="' + labelY + '" text-anchor="' + anchor + '"' + transform + '>' + escapeHtml(point.label || "") + '</text>';
    });

    var grid = "";
    for(var g = 0; g <= tickCount; g++){
      var value = maxValue * (1 - (g / tickCount));
      var y = padTop + (chartHeight * g / tickCount);
      grid += '<line class="chartGridLine" x1="' + padLeft + '" y1="' + y + '" x2="' + (width - padRight) + '" y2="' + y + '"></line>';
      grid += '<text class="chartAxisText" x="' + (padLeft - 12) + '" y="' + (y + 4) + '" text-anchor="end">' + escapeHtml(valueFormatter(value)) + '</text>';
    }
    grid += '<line class="chartAxisLine" x1="' + padLeft + '" y1="' + baselineY + '" x2="' + (width - padRight) + '" y2="' + baselineY + '"></line>';
    grid += '<line class="chartAxisLine" x1="' + padLeft + '" y1="' + padTop + '" x2="' + padLeft + '" y2="' + baselineY + '"></line>';

    el.innerHTML =
      '<svg viewBox="0 0 ' + width + ' ' + height + '" width="100%" height="320" role="img" aria-label="Trend chart">'
      + '<defs>' + defs + '</defs>'
      + grid
      + areas
      + paths
      + dots
      + labels
      + '</svg>';

    if(legend){
      legend.innerHTML = seriesList.map(function(series){
        return '<span class="legendKey"><span class="legendSwatch" style="background:' + escapeHtml(series.color) + '; color:' + escapeHtml(series.color) + ';"></span>' + escapeHtml(series.name) + '</span>';
      }).join("");
    }

    var wrap = el.parentNode;
    var pointEls = el.querySelectorAll(".chartPoint");
    Array.prototype.forEach.call(pointEls, function(point){
      point.addEventListener("mousemove", function(evt){
        if(!tooltip || !wrap) return;
        var wrapRect = wrap.getBoundingClientRect();
        tooltip.innerHTML =
          '<strong style="display:block; margin-bottom:4px;">' + escapeHtml(point.getAttribute("data-series") || "") + '</strong>'
          + '<div style="margin-bottom:4px;">' + escapeHtml(point.getAttribute("data-label") || "") + '</div>'
          + '<div>' + escapeHtml(tooltipLabel) + ': ' + escapeHtml(point.getAttribute("data-metric") || "0") + '</div>'
          + '<div>Count: ' + escapeHtml(point.getAttribute("data-count") || "0") + '</div>'
          + '<div>Avg: ' + escapeHtml(point.getAttribute("data-average") || "00:00:00") + '</div>'
          + '<div>Median: ' + escapeHtml(point.getAttribute("data-median") || "00:00:00") + '</div>'
          + '<div>Total: ' + escapeHtml(point.getAttribute("data-total") || "0 hrs") + '</div>';
        var left = evt.clientX - wrapRect.left + 14;
        var top = evt.clientY - wrapRect.top - 22;
        var tooltipWidth = tooltip.offsetWidth || 210;
        var tooltipHeight = tooltip.offsetHeight || 130;
        left = Math.max(8, Math.min(left, wrapRect.width - tooltipWidth - 8));
        top = Math.max(8, Math.min(top, wrapRect.height - tooltipHeight - 8));
        tooltip.style.left = left + "px";
        tooltip.style.top = top + "px";
        tooltip.className = "chartTooltip show";
      });
      point.addEventListener("mouseleave", function(){
        if(!tooltip) return;
        tooltip.className = "chartTooltip";
      });
    });
  }

  function renderBreakdownTables(roomRows, cleaningRows, filteredRoomRows, selectedDoctor, isComparison, averageRules){
    var doctorBody = $("doctorBreakdownBody");
    var roomBody = $("roomBreakdownBody");
    var analysisStatus = $("analysisStatus");
    var doctorSource = isComparison ? roomRows : filteredRoomRows;
    var doctorMap = {};
    var roomMap = {};
    var totalVisits = doctorSource.length;

    doctorSource.forEach(function(row){
      var doctor = (row.doctor_name || "Unassigned").trim() || "Unassigned";
      if(!doctorMap[doctor]){
        doctorMap[doctor] = { count: 0, total: 0, durations: [], averageCount: 0, averageTotal: 0 };
      }
      var duration = Number(row.duration_ms || 0);
      if(isFinite(duration) && duration >= 0){
        doctorMap[doctor].count++;
        doctorMap[doctor].total += duration;
        doctorMap[doctor].durations.push(duration);
        if(durationCountsForAverage(duration, averageRules)){
          doctorMap[doctor].averageCount++;
          doctorMap[doctor].averageTotal += duration;
        }
      }
    });

    filteredRoomRows.forEach(function(row){
      var room = (row.room_name || "(unnamed room)").trim() || "(unnamed room)";
      if(!roomMap[room]){
        roomMap[room] = { visits: 0, total: 0, cleanings: 0, lastUsed: "", averageCount: 0, averageTotal: 0 };
      }
      var duration = Number(row.duration_ms || 0);
      if(isFinite(duration) && duration >= 0){
        roomMap[room].visits++;
        roomMap[room].total += duration;
        if(durationCountsForAverage(duration, averageRules)){
          roomMap[room].averageCount++;
          roomMap[room].averageTotal += duration;
        }
      }
      if(row.started_at && (!roomMap[room].lastUsed || new Date(row.started_at).getTime() > new Date(roomMap[room].lastUsed).getTime())){
        roomMap[room].lastUsed = row.started_at;
      }
    });

    cleaningRows.forEach(function(row){
      var room = (row.room_name || "(unnamed room)").trim() || "(unnamed room)";
      if(!roomMap[room]){
        roomMap[room] = { visits: 0, total: 0, cleanings: 0, lastUsed: "", averageCount: 0, averageTotal: 0 };
      }
      roomMap[room].cleanings++;
      if(row.started_at && (!roomMap[room].lastUsed || new Date(row.started_at).getTime() > new Date(roomMap[room].lastUsed).getTime())){
        roomMap[room].lastUsed = row.started_at;
      }
    });

    var doctorRows = Object.keys(doctorMap).sort(function(a, b){
      return doctorMap[b].count - doctorMap[a].count || a.localeCompare(b);
    });
    if(!doctorRows.length){
      doctorBody.innerHTML = '<tr><td colspan="6" class="muted">No doctor data available for the current filters.</td></tr>';
    } else {
      doctorBody.innerHTML = doctorRows.map(function(name){
        var item = doctorMap[name];
        var avg = item.averageCount ? item.averageTotal / item.averageCount : 0;
        var med = item.count ? median(item.durations) : 0;
        var share = totalVisits ? (item.count / totalVisits) * 100 : 0;
        return '<tr>'
          + '<td data-label="Doctor">' + escapeHtml(name) + '</td>'
          + '<td class="numeric" data-label="Visits">' + escapeHtml(String(item.count)) + '</td>'
          + '<td class="numeric" data-label="Avg">' + escapeHtml(msToHMS(avg)) + '</td>'
          + '<td class="numeric" data-label="Median">' + escapeHtml(msToHMS(med)) + '</td>'
          + '<td class="numeric" data-label="Hours">' + escapeHtml(formatCount(item.total / 3600000)) + '</td>'
          + '<td class="numeric" data-label="Share">' + escapeHtml(formatPercent(share)) + '</td>'
          + '</tr>';
      }).join("");
    }

    var roomRowsSorted = Object.keys(roomMap).sort(function(a, b){
      return roomMap[b].visits - roomMap[a].visits || a.localeCompare(b);
    });
    if(!roomRowsSorted.length){
      roomBody.innerHTML = '<tr><td colspan="6" class="muted">No room data available for the current filters.</td></tr>';
    } else {
      roomBody.innerHTML = roomRowsSorted.map(function(name){
        var item = roomMap[name];
        var avg = item.averageCount ? item.averageTotal / item.averageCount : 0;
        return '<tr>'
          + '<td data-label="Room">' + escapeHtml(name) + '</td>'
          + '<td class="numeric" data-label="Visits">' + escapeHtml(String(item.visits)) + '</td>'
          + '<td class="numeric" data-label="Avg">' + escapeHtml(msToHMS(avg)) + '</td>'
          + '<td class="numeric" data-label="Cleanings">' + escapeHtml(String(item.cleanings)) + '</td>'
          + '<td class="numeric" data-label="Hours">' + escapeHtml(formatCount(item.total / 3600000)) + '</td>'
          + '<td class="numeric" data-label="Last used">' + escapeHtml(formatDateOnly(item.lastUsed)) + '</td>'
          + '</tr>';
      }).join("");
    }

    if(analysisStatus){
      analysisStatus.textContent = selectedDoctor && !isComparison
        ? ('Showing operational detail for "' + selectedDoctor + '".')
        : (isComparison ? "Showing side-by-side doctor comparison across the selected range." : "Showing all doctors and rooms for the selected range.");
    }
  }

  function getUtilizationClass(value){
    value = Number(value || 0);
    if(value >= 85) return "warn";
    if(value >= 55) return "success";
    return "";
  }

  function buildRoomOperationalRows(roomRows, cleaningRows, averageRules, settings, rangeDays){
    var map = {};
    rangeDays = Math.max(1, Number(rangeDays || 1));
    settings = settings || getOperationalSettings();
    var roomCapacityHours = Math.max(0.1, rangeDays * settings.clinicHoursPerDay);
    var targetRoomMs = settings.targetRoomMinutes * 60000;

    function ensureRoom(name){
      name = (name || "(unnamed room)").trim() || "(unnamed room)";
      if(!map[name]){
        map[name] = {
          room: name,
          visits: 0,
          roomTotal: 0,
          roomDurations: [],
          averageCount: 0,
          averageTotal: 0,
          cleanings: 0,
          cleanTotal: 0,
          cleanDurations: [],
          longVisits: 0,
          lastUsed: ""
        };
      }
      return map[name];
    }

    (roomRows || []).forEach(function(row){
      var item = ensureRoom(row.room_name);
      var duration = Number(row.duration_ms || 0);
      if(isFinite(duration) && duration >= 0){
        item.visits++;
        item.roomTotal += duration;
        item.roomDurations.push(duration);
        if(durationCountsForAverage(duration, averageRules)){
          item.averageCount++;
          item.averageTotal += duration;
        }
        if(duration > targetRoomMs) item.longVisits++;
      }
      if(row.started_at && (!item.lastUsed || new Date(row.started_at).getTime() > new Date(item.lastUsed).getTime())){
        item.lastUsed = row.started_at;
      }
    });

    (cleaningRows || []).forEach(function(row){
      var item = ensureRoom(row.room_name);
      var duration = Number(row.duration_ms || 0);
      item.cleanings++;
      if(isFinite(duration) && duration >= 0){
        item.cleanTotal += duration;
        item.cleanDurations.push(duration);
      }
      if(row.started_at && (!item.lastUsed || new Date(row.started_at).getTime() > new Date(item.lastUsed).getTime())){
        item.lastUsed = row.started_at;
      }
    });

    return Object.keys(map).map(function(name){
      var item = map[name];
      var avgRoom = item.averageCount ? item.averageTotal / item.averageCount : 0;
      var avgClean = item.cleanDurations.length ? (item.cleanTotal / item.cleanDurations.length) : 0;
      return {
        room: item.room,
        visits: item.visits,
        cleanings: item.cleanings,
        roomHours: item.roomTotal / 3600000,
        utilization: (item.roomTotal / 3600000) / roomCapacityHours * 100,
        avgRoom: avgRoom,
        medianRoom: item.roomDurations.length ? median(item.roomDurations) : 0,
        p90Room: item.roomDurations.length ? percentile(item.roomDurations, 0.9) : 0,
        avgClean: avgClean,
        cleanCoverage: item.visits ? (item.cleanings / item.visits) * 100 : 0,
        longRate: item.visits ? (item.longVisits / item.visits) * 100 : 0,
        lastUsed: item.lastUsed
      };
    }).sort(function(a, b){
      return b.utilization - a.utilization || b.visits - a.visits || a.room.localeCompare(b.room);
    });
  }

  function renderBarList(id, rows, emptyMessage){
    var el = $(id);
    if(!el) return;
    rows = rows || [];
    if(!rows.length){
      el.innerHTML = '<div class="emptyState">' + escapeHtml(emptyMessage || "No data available for this range.") + '</div>';
      return;
    }
    el.innerHTML = rows.map(function(row){
      var fillClass = row.fillClass ? (" " + row.fillClass) : "";
      var width = clamp(row.percent || 0, 0, 100);
      return '<div class="barRow">'
        + '<div class="barMeta"><strong>' + escapeHtml(row.label || "") + '</strong><span>' + escapeHtml(row.value || "") + '</span></div>'
        + '<div class="barTrack"><span class="barFill' + fillClass + '" style="width:' + escapeHtml(String(width)) + '%"></span></div>'
        + '<div class="barMeta"><span>' + escapeHtml(row.note || "") + '</span><span>' + escapeHtml(row.detail || "") + '</span></div>'
        + '</div>';
    }).join("");
  }

  function renderInsightList(insights){
    var el = $("opsInsightList");
    if(!el) return;
    insights = insights || [];
    if(!insights.length){
      el.innerHTML = '<div class="emptyState">No operational signals available for this range.</div>';
      return;
    }
    el.innerHTML = insights.map(function(item){
      return '<div class="insightItem ' + escapeHtml(item.severity || "") + '">'
        + '<strong>' + escapeHtml(item.title || "") + '</strong>'
        + '<span>' + escapeHtml(item.detail || "") + '</span>'
        + '</div>';
    }).join("");
  }

  function renderHourlyDemand(roomRows){
    var byHour = {};
    (roomRows || []).forEach(function(row){
      var started = new Date(row.started_at);
      if(isNaN(started.getTime())) return;
      var hour = started.getHours();
      byHour[hour] = (byHour[hour] || 0) + 1;
    });
    var hours = Object.keys(byHour).map(Number).sort(function(a, b){ return a - b; });
    var maxCount = hours.reduce(function(max, hour){ return Math.max(max, byHour[hour] || 0); }, 0);
    renderBarList("hourlyFlowChart", hours.map(function(hour){
      var count = byHour[hour] || 0;
      return {
        label: formatHourLabel(hour),
        value: count + " starts",
        percent: maxCount ? (count / maxCount) * 100 : 0,
        fillClass: count === maxCount ? "warn" : "",
        note: "Patient-room starts",
        detail: maxCount ? formatPercent((count / maxCount) * 100) + " of peak" : ""
      };
    }), "No hourly demand available for this range.");
  }

  function renderRoomFlowTable(roomRows){
    var body = $("roomFlowBody");
    if(!body) return;
    if(!roomRows.length){
      body.innerHTML = '<tr><td colspan="7" class="muted">No room flow data available for the current filters.</td></tr>';
      return;
    }
    body.innerHTML = roomRows.slice(0, 14).map(function(row){
      return '<tr>'
        + '<td data-label="Room">' + escapeHtml(row.room) + '</td>'
        + '<td class="numeric" data-label="Util">' + escapeHtml(formatPercent(row.utilization)) + '</td>'
        + '<td class="numeric" data-label="Visits">' + escapeHtml(String(row.visits)) + '</td>'
        + '<td class="numeric" data-label="Avg room">' + escapeHtml(formatDurationCompact(row.avgRoom)) + '</td>'
        + '<td class="numeric" data-label="Avg clean">' + escapeHtml(row.cleanings ? formatDurationCompact(row.avgClean) : "—") + '</td>'
        + '<td class="numeric" data-label="Clean cov">' + escapeHtml(formatPercent(row.cleanCoverage)) + '</td>'
        + '<td class="numeric" data-label="Long rate">' + escapeHtml(formatPercent(row.longRate)) + '</td>'
        + '</tr>';
    }).join("");
  }

  function renderOperationsDashboard(roomRows, cleaningRows, averageRules, summary){
    roomRows = roomRows || [];
    cleaningRows = cleaningRows || [];
    summary = summary || {};
    var settings = getOperationalSettings();
    var rangeDays = Math.max(1, getRangeDayCount());
    var activeRooms = Math.max(0, Number(summary.activeRooms || 0));
    var visits = roomRows.length;
    var roomHours = Number(summary.roomHours || 0);
    var cleaningHours = Number(summary.cleaningHours || 0);
    var availableRoomHours = activeRooms * rangeDays * settings.clinicHoursPerDay;
    var utilizationRate = availableRoomHours ? (roomHours / availableRoomHours) * 100 : 0;
    var throughputPerDay = visits / rangeDays;
    var visitsPerRoomDay = activeRooms ? visits / (activeRooms * rangeDays) : 0;
    var cleaningCoverage = visits ? (cleaningRows.length / visits) * 100 : 0;
    var targetCycleMinutes = settings.targetRoomMinutes + settings.targetCleanMinutes;
    var targetCapacity = targetCycleMinutes > 0 ? (availableRoomHours * 60) / targetCycleMinutes : 0;
    var capacityPace = targetCapacity ? (visits / targetCapacity) * 100 : 0;

    $("throughputPerDay").textContent = formatCount(throughputPerDay);
    $("visitsPerRoomDay").textContent = formatCount(visitsPerRoomDay);
    $("utilizationRate").textContent = formatPercent(utilizationRate);
    $("cleaningCoverage").textContent = formatPercent(cleaningCoverage);
    $("cleaningHoursTotal").textContent = formatCount(cleaningHours);
    $("targetCapacityPace").textContent = formatPercent(capacityPace);

    var roomOperationalRows = buildRoomOperationalRows(roomRows, cleaningRows, averageRules, settings, rangeDays);
    renderBarList("roomUtilizationBoard", roomOperationalRows.slice(0, 12).map(function(row){
      return {
        label: row.room,
        value: formatPercent(row.utilization),
        percent: row.utilization,
        fillClass: getUtilizationClass(row.utilization),
        note: row.visits + " visits, " + formatCount(row.roomHours) + " hrs",
        detail: row.cleanings + " cleanings"
      };
    }), "No room utilization available for this range.");
    renderHourlyDemand(roomRows);
    renderRoomFlowTable(roomOperationalRows);

    var insights = [];
    function addInsight(severity, title, detail){
      insights.push({ severity: severity, title: title, detail: detail });
    }

    if(!visits){
      addInsight("", "No appointment sessions in range", "Adjust the date range or confirm the board has closed room sessions.");
    } else {
      if(utilizationRate >= 90){
        addInsight("danger", "Rooms are running hot", "Utilization is " + formatPercent(utilizationRate) + " against " + formatCount(settings.clinicHoursPerDay) + " clinic hours/day.");
      } else if(utilizationRate >= 75){
        addInsight("warn", "Room utilization is high", "Utilization is " + formatPercent(utilizationRate) + "; watch late-day backups and cleaning handoffs.");
      } else if(utilizationRate < 35){
        addInsight("", "Capacity available", "Utilization is " + formatPercent(utilizationRate) + ", leaving room to consolidate schedules or absorb add-ons.");
      } else {
        addInsight("success", "Room utilization looks balanced", "Utilization is " + formatPercent(utilizationRate) + " for the selected range.");
      }

      if(cleaningCoverage < 75){
        addInsight("warn", "Cleaning documentation gap", "Only " + formatPercent(cleaningCoverage) + " as many cleanings as visits were logged.");
      } else {
        addInsight("success", "Cleaning coverage is trackable", "Cleaning logs cover " + formatPercent(cleaningCoverage) + " of visit volume.");
      }

      if(summary.cleanAvgMs > settings.targetCleanMinutes * 60000 * 1.3){
        addInsight("warn", "Turnaround is above target", "Average cleaning time is " + formatDurationCompact(summary.cleanAvgMs) + " vs a " + formatMinutes(settings.targetCleanMinutes) + " target.");
      }

      if(summary.roomP90Ms > settings.targetRoomMinutes * 60000 * 1.6){
        addInsight("warn", "Long-room tail is elevated", "P90 room time is " + formatDurationCompact(summary.roomP90Ms) + " vs a " + formatMinutes(settings.targetRoomMinutes) + " target.");
      }

      if(summary.outlierRate > 10){
        addInsight("warn", "Session outliers need review", formatPercent(summary.outlierRate) + " of room sessions are unusually short or long.");
      }

      if(capacityPace > 105){
        addInsight("danger", "Above assumed capacity", "Visit volume is " + formatPercent(capacityPace) + " of target capacity; assumptions may need adjustment.");
      } else if(capacityPace >= 80){
        addInsight("warn", "Near target capacity", "Visit volume is " + formatPercent(capacityPace) + " of target capacity.");
      } else if(targetCapacity){
        addInsight("success", "Target capacity has headroom", "About " + formatCount(Math.max(0, targetCapacity - visits)) + " visits remain under current assumptions.");
      }
    }

    renderInsightList(insights.slice(0, 7));
  }

  function renderOverviewTrend(roomRows){
    var el = $("overviewTrend");
    if(!el) return;
    var range = getStatsRange();
    var days = [];
    var cursor = new Date(range.start.getTime());
    var endExclusive = new Date(range.end.getTime() + 24 * 3600 * 1000);
    while(cursor.getTime() < endExclusive.getTime() && days.length < 400){
      days.push({ key: cursor.getFullYear() + "-" + (cursor.getMonth() + 1) + "-" + cursor.getDate(), date: new Date(cursor.getTime()), count: 0 });
      cursor = new Date(cursor.getTime() + 24 * 3600 * 1000);
    }
    var idx = {};
    days.forEach(function(d){ idx[d.key] = d; });
    (roomRows || []).forEach(function(r){
      var dt = new Date(r.started_at);
      if(isNaN(dt.getTime())) return;
      var k = dt.getFullYear() + "-" + (dt.getMonth() + 1) + "-" + dt.getDate();
      if(idx[k]) idx[k].count++;
    });
    if(!days.length || !days.some(function(d){ return d.count > 0; })){
      el.className = "overviewTrendBody muted";
      el.textContent = "No visits in this range.";
      return;
    }
    el.className = "overviewTrendBody";
    var W = 920, H = 120, padL = 8, padR = 8, padT = 12, padB = 20;
    var innerW = W - padL - padR, innerH = H - padT - padB;
    var maxC = days.reduce(function(m, d){ return Math.max(m, d.count); }, 0) || 1;
    function xFor(i){ return days.length === 1 ? (padL + innerW / 2) : (padL + innerW * i / (days.length - 1)); }
    function yFor(c){ return padT + innerH - (c / maxC) * innerH; }
    var line = "", areaPath = "M " + xFor(0) + " " + (padT + innerH);
    days.forEach(function(d, i){
      line += (i ? " L " : "M ") + xFor(i) + " " + yFor(d.count);
      areaPath += " L " + xFor(i) + " " + yFor(d.count);
    });
    areaPath += " L " + xFor(days.length - 1) + " " + (padT + innerH) + " Z";
    var first = days[0].date.toLocaleDateString([], { month: "short", day: "numeric" });
    var last = days[days.length - 1].date.toLocaleDateString([], { month: "short", day: "numeric" });
    var baseY = padT + innerH;
    el.innerHTML =
      '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="120" role="img" aria-label="Visits per day">'
      + '<defs><linearGradient id="ovTrendGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#38bdf8" stop-opacity=".30"></stop><stop offset="100%" stop-color="#38bdf8" stop-opacity="0"></stop></linearGradient></defs>'
      + '<line class="chartGridLine" x1="' + padL + '" y1="' + baseY + '" x2="' + (W - padR) + '" y2="' + baseY + '"></line>'
      + '<path d="' + areaPath + '" fill="url(#ovTrendGrad)"></path>'
      + '<path d="' + line + '" fill="none" stroke="#38bdf8" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></path>'
      + '<text class="chartAxisText" x="' + padL + '" y="' + (H - 4) + '" text-anchor="start">' + escapeHtml(first) + '</text>'
      + '<text class="chartAxisText" x="' + (W - padR) + '" y="' + (H - 4) + '" text-anchor="end">' + escapeHtml(last) + '</text>'
      + '<text class="chartAxisText" x="' + (W - padR) + '" y="' + (padT + 2) + '" text-anchor="end">peak ' + escapeHtml(String(maxC)) + '</text>'
      + '</svg>';
  }

  function renderStats(roomRows, cleaningRows){
    roomRows = roomRows || [];
    cleaningRows = cleaningRows || [];
    populateDoctorFilter(roomRows);

    var graphMode = getSelectedGraphMode();
    var metricMode = getSelectedTrendMetric();
    updateTrendMeta(graphMode, metricMode);
    var averageRules = getAverageExclusionRules();

    var selectedDoctor = getSelectedDoctor();
    var isComparison = (selectedDoctor === "__comparison__");
    var filteredRoomRows = roomRows.filter(function(row){
      var doctorName = (row.doctor_name || "").trim();
      return !selectedDoctor || isComparison || doctorName === selectedDoctor;
    });
    var statsRoomRows = filterRowsByDurationRules(filteredRoomRows, averageRules);
    var statsAllRoomRows = filterRowsByDurationRules(roomRows, averageRules);
    var statsCleaningRows = filterRowsByDurationRules(cleaningRows, averageRules);

    renderOverviewTrend(statsAllRoomRows);

    var rawTrendRoomDur = filteredRoomRows.map(function(r){ return Number(r.duration_ms || 0); }).filter(function(v){ return isFinite(v) && v >= 0; });
    var roomDur = statsRoomRows.map(function(r){ return Number(r.duration_ms || 0); }).filter(function(v){ return isFinite(v) && v >= 0; });
    var dashboardRoomDur = statsAllRoomRows.map(function(r){ return Number(r.duration_ms || 0); }).filter(function(v){ return isFinite(v) && v >= 0; });

    var roomAverageExcluded = countAverageExcluded(rawTrendRoomDur, averageRules);
    var dashboardRoomTotal = dashboardRoomDur.reduce(function(sum, v){ return sum + v; }, 0);
    var dashboardRoomAvg = averageDuration(dashboardRoomDur, averageRules);
    var dashboardRoomMed = dashboardRoomDur.length ? median(dashboardRoomDur) : 0;
    var dashboardRoomP90 = dashboardRoomDur.length ? percentile(dashboardRoomDur, 0.9) : 0;

    var rawCleanDur = cleaningRows.map(function(r){ return Number(r.duration_ms || 0); }).filter(function(v){ return isFinite(v) && v >= 0; });
    var cleanDur = statsCleaningRows.map(function(r){ return Number(r.duration_ms || 0); }).filter(function(v){ return isFinite(v) && v >= 0; });
    var cleanTotal = cleanDur.reduce(function(sum, v){ return sum + v; }, 0);
    var cleanAvg = averageDuration(cleanDur, averageRules);
    var cleanAverageExcluded = countAverageExcluded(rawCleanDur, averageRules);

    var uniqueRooms = {};
    var dashboardUniqueRooms = {};
    var byHour = {};
    var byWeekday = {};
    var byDoctorCounts = {};
    var weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    var shortOutliers = 0;
    var longOutliers = 0;
    var dashboardShortOutliers = 0;
    var dashboardLongOutliers = 0;

    statsAllRoomRows.forEach(function(row){
      var roomNameSeen = (row.room_name || "").trim();
      var durationMs = Number(row.duration_ms || 0);
      if(roomNameSeen) dashboardUniqueRooms[roomNameSeen] = true;
      if(isFinite(durationMs) && durationMs >= 0){
        if(durationMs > 0 && durationMs < 5 * 60000) dashboardShortOutliers++;
        else if(durationMs > 180 * 60000) dashboardLongOutliers++;
      }
    });

    statsRoomRows.forEach(function(row){
      var roomNameSeen = (row.room_name || "").trim();
      var doctorNameSeen = (row.doctor_name || "Unassigned").trim() || "Unassigned";
      var durationMs = Number(row.duration_ms || 0);
      if(roomNameSeen) uniqueRooms[roomNameSeen] = true;
      byDoctorCounts[doctorNameSeen] = (byDoctorCounts[doctorNameSeen] || 0) + 1;
      if(isFinite(durationMs) && durationMs >= 0){
        if(durationMs > 0 && durationMs < 5 * 60000) shortOutliers++;
        else if(durationMs > 180 * 60000) longOutliers++;
      }
      var started = new Date(row.started_at);
      if(!isNaN(started.getTime())){
        var hour = started.getHours();
        byHour[hour] = (byHour[hour] || 0) + 1;
        var weekday = weekdayNames[started.getDay()];
        byWeekday[weekday] = (byWeekday[weekday] || 0) + 1;
      }
    });

    var staffedRooms = Object.keys(uniqueRooms).length;
    var dashboardStaffedRooms = Object.keys(dashboardUniqueRooms).length;
    var peakHour = null;
    var peakHourCount = -1;
    Object.keys(byHour).forEach(function(hourKey){
      if(byHour[hourKey] > peakHourCount){
        peakHourCount = byHour[hourKey];
        peakHour = Number(hourKey);
      }
    });

    var busiestWeekday = "";
    var busiestWeekdayCount = -1;
    Object.keys(byWeekday).forEach(function(dayKey){
      if(byWeekday[dayKey] > busiestWeekdayCount){
        busiestWeekdayCount = byWeekday[dayKey];
        busiestWeekday = dayKey;
      }
    });

    var topDoctor = "";
    var topDoctorCount = -1;
    Object.keys(byDoctorCounts).forEach(function(name){
      if(byDoctorCounts[name] > topDoctorCount){
        topDoctorCount = byDoctorCounts[name];
        topDoctor = name;
      }
    });

    $("visitCount").textContent = String(statsAllRoomRows.length);
    $("avgRoomTime").textContent = msToHMS(dashboardRoomAvg);
    $("medianRoomTime").textContent = msToHMS(dashboardRoomMed);
    $("p90RoomTime").textContent = msToHMS(dashboardRoomP90);
    $("cleanCount").textContent = String(statsCleaningRows.length);
    $("avgCleanTime").textContent = msToHMS(cleanAvg);
    $("roomHoursTotal").textContent = formatCount(dashboardRoomTotal / 3600000);
    $("uniqueRoomsCount").textContent = String(dashboardStaffedRooms);

    var groupBy = getSelectedGroupBy();
    var selectedTrendDays = getSelectedTrendDays();
    var orderedKeys = getAllPeriodKeys(groupBy, selectedTrendDays);
    var trendRoomRows = filterRowsByTrendDays(statsRoomRows, selectedTrendDays);
    var trendAllRoomRows = filterRowsByTrendDays(statsAllRoomRows, selectedTrendDays);
    var trendCleaningRows = filterRowsByTrendDays(statsCleaningRows, selectedTrendDays);
    var seriesList = [];

    if(graphMode === "cleaning"){
      seriesList.push(buildSeriesFromBucketMap(
        accumulateBuckets(trendCleaningRows, groupBy, averageRules),
        orderedKeys, groupBy, metricMode, "Cleaning", "#5eead4"
      ));
    } else if(isComparison){
      var byDoctorSeries = {};
      trendAllRoomRows.forEach(function(row){
        var doctorName = (row.doctor_name || "").trim();
        if(!doctorName) return;
        if(!byDoctorSeries[doctorName]) byDoctorSeries[doctorName] = [];
        byDoctorSeries[doctorName].push(row);
      });
      Object.keys(byDoctorSeries).sort(function(a, b){ return a.localeCompare(b); }).forEach(function(name, idx){
        seriesList.push(buildSeriesFromBucketMap(
          accumulateBuckets(byDoctorSeries[name], groupBy, averageRules),
          orderedKeys, groupBy, metricMode, name, getSeriesColor(idx)
        ));
      });
    } else {
      seriesList.push(buildSeriesFromBucketMap(
        accumulateBuckets(trendRoomRows, groupBy, averageRules),
        orderedKeys, groupBy, metricMode, selectedDoctor || "All doctors", "#38bdf8"
      ));
    }

    renderTrendChart(seriesList, {
      metricMode: metricMode,
      tooltipLabel: (metricMode === "count")
        ? "Sessions"
        : (metricMode === "total_hours" ? "Total hours" : (metricMode === "median_duration" ? "Median duration" : "Average duration")),
      valueFormatter: function(value){ return formatMetricValue(value, metricMode); },
      emptyMessage: averageRules.active
        ? "No session durations match the duration exclusion settings for this graph."
        : (graphMode === "cleaning"
          ? "No cleaning data available for this range."
          : (isComparison ? "No appointment data available to compare for this range." : "No appointment data available for this range."))
    });

    var outlierCount = shortOutliers + longOutliers;
    var outlierRate = statsRoomRows.length ? ((outlierCount / statsRoomRows.length) * 100) : 0;
    var dashboardOutlierCount = dashboardShortOutliers + dashboardLongOutliers;
    var dashboardOutlierRate = statsAllRoomRows.length ? ((dashboardOutlierCount / statsAllRoomRows.length) * 100) : 0;
    renderOperationsDashboard(statsAllRoomRows, statsCleaningRows, averageRules, {
      activeRooms: dashboardStaffedRooms,
      roomHours: dashboardRoomTotal / 3600000,
      cleaningHours: cleanTotal / 3600000,
      cleanAvgMs: cleanAvg,
      roomP90Ms: dashboardRoomP90,
      outlierRate: dashboardOutlierRate
    });

    $("statsHighlights").innerHTML =
      '<div class="highlightItem"><strong>Busiest weekday</strong><span>' + escapeHtml(busiestWeekday || "—") + (busiestWeekdayCount > -1 ? (' (' + busiestWeekdayCount + ')') : "") + '</span></div>' +
      '<div class="highlightItem"><strong>Peak start hour</strong><span>' + escapeHtml(peakHour == null ? "—" : formatHourLabel(peakHour)) + (peakHourCount > -1 ? (' (' + peakHourCount + ')') : "") + '</span></div>' +
      '<div class="highlightItem"><strong>Top doctor</strong><span>' + escapeHtml(topDoctor || "—") + (topDoctorCount > -1 ? (' (' + topDoctorCount + ' visits)') : "") + '</span></div>' +
      '<div class="highlightItem"><strong>Outlier rate</strong><span>' + escapeHtml(formatPercent(outlierRate)) + '</span></div>' +
      '<div class="highlightItem"><strong>Duration rule</strong><span>' + escapeHtml(summarizeAverageRules(averageRules)) + '</span></div>' +
      '<div class="highlightItem"><strong>Excluded</strong><span>' + escapeHtml(String(roomAverageExcluded)) + ' room, ' + escapeHtml(String(cleanAverageExcluded)) + ' cleaning</span></div>' +
      '<div class="highlightItem"><strong>Graph view</strong><span>' + escapeHtml(graphMode === "cleaning" ? "Cleaning" : (isComparison ? "Doctor comparison" : (selectedDoctor || "All doctors"))) + '</span></div>' +
      '<div class="highlightItem"><strong>Trend days</strong><span>' + escapeHtml(summarizeTrendDays(selectedTrendDays)) + '</span></div>' +
      '<div class="highlightItem"><strong>Range coverage</strong><span>' + escapeHtml(String(getRangeDayCount())) + ' day(s), ' + escapeHtml(String(getRangeDayCount(selectedTrendDays))) + ' graphed</span></div>';

    renderBreakdownTables(statsAllRoomRows, statsCleaningRows, statsRoomRows, selectedDoctor, isComparison, averageRules);
  }

  // ===== Data loading =====
  async function fetchStatsRows(tableName, selectColumns, range){
    var supabase = getSupabase();
    var practiceId = getPracticeId();
    var rows = [];
    var offset = 0;
    while(true){
      var res = await supabase
        .from(tableName)
        .select(selectColumns)
        .eq("practice_id", practiceId)
        .gte("started_at", range.startIso)
        .lt("started_at", range.endIso)
        .not("ended_at", "is", null)
        .order("started_at", { ascending: true })
        .range(offset, offset + STATS_PAGE_SIZE - 1);
      if(res.error) throw res.error;
      var page = res.data || [];
      rows = rows.concat(page);
      if(page.length < STATS_PAGE_SIZE) break;
      offset += STATS_PAGE_SIZE;
    }
    return rows;
  }

  async function refreshStats(){
    if(!requireReady(false)) return;
    var token = ++statsRequestToken;
    setStatus("Loading stats…");
    var refreshBtn = $("refreshStatsBtn");
    if(refreshBtn) refreshBtn.disabled = true;
    var range = getStatsRange();
    try{
      var results = await Promise.all([
        fetchStatsRows("room_sessions", "room_name, doctor_name, duration_ms, started_at, ended_at", range),
        fetchStatsRows("cleaning_sessions", "room_name, duration_ms, started_at, ended_at", range)
      ]);
      if(token !== statsRequestToken) return;

      lastRows = { room: results[0] || [], cleaning: results[1] || [] };
      renderStats(lastRows.room, lastRows.cleaning);
      setStatus("Stats updated. Loaded " + lastRows.room.length + " visits and " + lastRows.cleaning.length + " cleanings.");
    } catch(e){
      console.error(e);
      setStatus("Failed to load stats: " + getErrorMessage(e));
    } finally {
      if(refreshBtn) refreshBtn.disabled = false;
    }
  }

  // ===== Logs =====
  function isShortOutlier(durationMs){ return durationMs > 0 && durationMs < 5 * 60000; }
  function isLongOutlier(durationMs){ return durationMs > 180 * 60000; }

  function getLogSearchTerm(){ return ($("roomLogsSearch").value || "").trim().toLowerCase(); }
  function getLogSortMode(){ return ($("roomLogsSort").value || "newest").trim(); }
  function getLogOutlierMode(){ return ($("roomLogsOutliers").value || "all").trim(); }

  function applyLogFilters(rows){
    var search = getLogSearchTerm();
    var sortMode = getLogSortMode();
    var outlierMode = getLogOutlierMode();
    var filtered = (rows || []).filter(function(row){
      var durationMs = Number(row.duration_ms || 0);
      var shortOutlier = isShortOutlier(durationMs);
      var longOutlier = isLongOutlier(durationMs);
      if(outlierMode === "short" && !shortOutlier) return false;
      if(outlierMode === "long" && !longOutlier) return false;
      if(outlierMode === "outliers" && !(shortOutlier || longOutlier)) return false;
      if(!search) return true;
      var haystack = [
        row.room_name || "",
        row.doctor_name || "",
        row.started_at || "",
        row.ended_at || "",
        formatDateTime(row.started_at),
        formatDateTime(row.ended_at)
      ].join(" ").toLowerCase();
      return haystack.indexOf(search) !== -1;
    });

    filtered.sort(function(a, b){
      var aStart = new Date(a.started_at || 0).getTime();
      var bStart = new Date(b.started_at || 0).getTime();
      var aDuration = Number(a.duration_ms || 0);
      var bDuration = Number(b.duration_ms || 0);
      if(sortMode === "oldest") return aStart - bStart;
      if(sortMode === "longest") return bDuration - aDuration || bStart - aStart;
      if(sortMode === "shortest") return aDuration - bDuration || bStart - aStart;
      if(sortMode === "room_az") return String(a.room_name || "").localeCompare(String(b.room_name || "")) || bStart - aStart;
      return bStart - aStart;
    });

    return filtered;
  }

  function renderRoomLogsSummary(rawRows, visibleRows){
    rawRows = rawRows || [];
    visibleRows = visibleRows || [];
    var shortCount = 0;
    var longCount = 0;
    visibleRows.forEach(function(row){
      var durationMs = Number(row.duration_ms || 0);
      if(isShortOutlier(durationMs)) shortCount++;
      if(isLongOutlier(durationMs)) longCount++;
    });
    $("roomLogsSummary").innerHTML =
      '<span class="summaryPill">Loaded <strong>' + escapeHtml(String(rawRows.length)) + '</strong></span>' +
      '<span class="summaryPill">Visible <strong>' + escapeHtml(String(visibleRows.length)) + '</strong></span>' +
      '<span class="summaryPill">Selected <strong>' + escapeHtml(String(getSelectedLogIds().filter(function(id){
        return visibleRows.some(function(row){ return row.id === id; });
      }).length)) + '</strong></span>' +
      '<span class="summaryPill">Short outliers <strong>' + escapeHtml(String(shortCount)) + '</strong></span>' +
      '<span class="summaryPill">Long outliers <strong>' + escapeHtml(String(longCount)) + '</strong></span>';
  }

  function renderRoomLogs(rows){
    rawLogRows = (rows || []).slice();
    currentLogRows = applyLogFilters(rawLogRows);
    var cfg = getLogTypeConfig();
    var list = $("roomLogsList");
    list.innerHTML = "";
    updateLogSelectionUI();
    renderRoomLogsSummary(rawLogRows, currentLogRows);

    if(!rawLogRows.length){
      list.innerHTML = '<div class="emptyState">' + escapeHtml(cfg.emptyMessage) + '</div>';
      return;
    }
    if(!currentLogRows.length){
      list.innerHTML = '<div class="emptyState">No logs match the current search and outlier filters.</div>';
      return;
    }

    currentLogRows.forEach(function(row){
      var el = document.createElement("div");
      el.className = "logItem" + (selectedLogIds[row.id] ? " selected" : "");
      var durationMs = Number(row.duration_ms || 0);
      var badges = '<span class="logBadge">' + escapeHtml(msToHMS(durationMs)) + '</span>';
      if((row.doctor_name || "").trim()) badges += '<span class="logBadge success">' + escapeHtml(row.doctor_name) + '</span>';
      if(isShortOutlier(durationMs)) badges += '<span class="logBadge warn">Short outlier</span>';
      else if(isLongOutlier(durationMs)) badges += '<span class="logBadge danger">Long outlier</span>';

      el.innerHTML =
        '<div class="logSelect">'
          + '<input class="logCheck" type="checkbox" ' + (selectedLogIds[row.id] ? 'checked' : '') + ' aria-label="Select session for ' + escapeHtml(row.room_name || "unnamed room") + '"/>'
          + '<div class="logMain">'
            + '<div class="logTitle">'
              + '<span class="logName">' + escapeHtml(row.room_name || "(unnamed room)") + '</span>'
              + badges
            + '</div>'
            + '<div class="logMeta">'
              + '<span>Started ' + escapeHtml(formatDateTime(row.started_at)) + '</span>'
              + '<span>Ended ' + escapeHtml(formatDateTime(row.ended_at)) + '</span>'
              + '<span>ID ' + escapeHtml(String(row.id || "—").slice(0, 8)) + '</span>'
            + '</div>'
          + '</div>'
        + '</div>'
        + '<div class="logActions"><button class="danger" type="button">Delete</button></div>';

      el.querySelector(".logCheck").addEventListener("change", function(evt){
        selectedLogIds[row.id] = !!evt.target.checked;
        el.className = "logItem" + (selectedLogIds[row.id] ? " selected" : "");
        updateLogSelectionUI();
        renderRoomLogsSummary(rawLogRows, currentLogRows);
      });
      el.querySelector("button").addEventListener("click", function(){
        deleteRoomLog(row);
      });
      list.appendChild(el);
    });
    updateLogSelectionUI();
    renderRoomLogsSummary(rawLogRows, currentLogRows);
  }

  async function refreshRoomLogs(){
    if(!requireReady(true)) return;
    var token = ++logsRequestToken;
    var cfg = getLogTypeConfig();
    setRoomLogsStatus("Loading logs…");
    var refreshBtn = $("refreshRoomLogsBtn");
    if(refreshBtn) refreshBtn.disabled = true;
    var range = getRoomLogsRange();
    try{
      var res = await getSupabase()
        .from(cfg.table)
        .select(cfg.selectColumns)
        .eq("practice_id", getPracticeId())
        .gte("started_at", range.start.toISOString())
        .lt("started_at", range.endExclusive.toISOString())
        .not("ended_at", "is", null)
        .order("started_at", { ascending: false })
        .limit(range.limit);
      if(token !== logsRequestToken) return;
      if(res.error) throw res.error;
      selectedLogIds = {};
      renderRoomLogs(res.data || []);
      setRoomLogsStatus("Showing " + currentLogRows.length + " of " + rawLogRows.length + " logged " + cfg.labelPlural + ".");
    } catch(e){
      console.error(e);
      selectedLogIds = {};
      renderRoomLogs([]);
      setRoomLogsStatus("Failed to load logs: " + getErrorMessage(e));
    } finally {
      if(refreshBtn) refreshBtn.disabled = false;
    }
  }

  async function deleteRoomLog(row){
    if(!row || !row.id) return;
    var cfg = getLogTypeConfig();
    if(!window.confirm('Delete logged ' + cfg.labelSingular + ' for "' + (row.room_name || "this room") + '"?')) return;
    setRoomLogsStatus("Deleting log…");
    try{
      if(!requireReady(true)) return;
      var res = await getSupabase().from(cfg.table).delete().eq("id", row.id).eq("practice_id", getPracticeId());
      if(res.error) throw res.error;
      delete selectedLogIds[row.id];
      setRoomLogsStatus("Log deleted.");
      await refreshRoomLogs();
      if(lastRows) refreshStats();
    } catch(e){
      console.error(e);
      setRoomLogsStatus("Failed to delete log: " + getErrorMessage(e));
    }
  }

  function toggleSelectAllLogs(){
    if(!currentLogRows.length) return;
    var ids = currentLogRows.map(function(row){ return row.id; }).filter(Boolean);
    var allSelected = ids.length && ids.every(function(id){ return !!selectedLogIds[id]; });
    ids.forEach(function(id){
      selectedLogIds[id] = !allSelected;
    });
    renderRoomLogs(rawLogRows);
    setRoomLogsStatus((!allSelected ? "Selected " : "Cleared ") + ids.length + " log(s).");
  }

  async function deleteSelectedLogs(){
    var ids = getSelectedLogIds();
    if(!ids.length) return;
    var cfg = getLogTypeConfig();
    if(!window.confirm("Delete " + ids.length + " selected " + cfg.labelPlural + "?")) return;
    setRoomLogsStatus("Deleting selected logs…");
    try{
      if(!requireReady(true)) return;
      var res = await getSupabase().from(cfg.table).delete().in("id", ids).eq("practice_id", getPracticeId());
      if(res.error) throw res.error;
      selectedLogIds = {};
      setRoomLogsStatus("Deleted " + ids.length + " log(s).");
      await refreshRoomLogs();
      if(lastRows) refreshStats();
    } catch(e){
      console.error(e);
      setRoomLogsStatus("Failed to delete selected logs: " + getErrorMessage(e));
    }
  }

  // ===== CSV export =====
  function exportRowsToCsv(rows, filename, header){
    if(!rows || !rows.length){
      return false;
    }
    var csv = header.join(",") + "\n";
    rows.forEach(function(row){
      csv += header.map(function(key){ return csvEscape(row[key]); }).join(",") + "\n";
    });
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  }

  function exportStatsCsv(){
    if(!lastRows){
      setStatus("Nothing to export yet. Refresh stats first.");
      return;
    }
    var rows = [];
    lastRows.room.forEach(function(row){
      rows.push({
        kind: "room_session",
        started_at: row.started_at,
        ended_at: row.ended_at,
        duration_ms: row.duration_ms,
        room_name: row.room_name,
        doctor_name: row.doctor_name || ""
      });
    });
    lastRows.cleaning.forEach(function(row){
      rows.push({
        kind: "cleaning_session",
        started_at: row.started_at,
        ended_at: row.ended_at,
        duration_ms: row.duration_ms,
        room_name: row.room_name,
        doctor_name: ""
      });
    });
    if(exportRowsToCsv(rows, "roomboard-stats.csv", ["kind", "started_at", "ended_at", "duration_ms", "room_name", "doctor_name"])){
      setStatus("CSV exported.");
    }
  }

  function exportVisibleLogsCsv(){
    var cfg = getLogTypeConfig();
    if(!currentLogRows.length){
      setRoomLogsStatus("No visible logs to export.");
      return;
    }
    var rows = currentLogRows.map(function(row){
      return {
        id: row.id,
        type: cfg.type,
        room_name: row.room_name || "",
        doctor_name: row.doctor_name || "",
        started_at: row.started_at || "",
        ended_at: row.ended_at || "",
        duration_ms: row.duration_ms || 0
      };
    });
    if(exportRowsToCsv(rows, "roomboard-visible-logs.csv", ["id", "type", "room_name", "doctor_name", "started_at", "ended_at", "duration_ms"])){
      setRoomLogsStatus("Visible logs exported.");
    }
  }

  function rerenderStatsIfLoaded(){
    if(lastRows) renderStats(lastRows.room, lastRows.cleaning);
  }

  function rerenderLogsIfLoaded(){
    if(rawLogRows.length || currentLogRows.length){
      renderRoomLogs(rawLogRows);
      var cfg = getLogTypeConfig();
      setRoomLogsStatus("Showing " + currentLogRows.length + " of " + rawLogRows.length + " logged " + cfg.labelPlural + ".");
    }
  }

  function refreshStatsIfReady(){
    savePreferences();
    if(requireReady(false)) refreshStats();
  }

  function refreshLogsIfReady(){
    savePreferences();
    if(requireReady(true)) refreshRoomLogs();
  }

  // ===== Event wiring (runs once, after the shadow DOM is built) =====
  function wireEvents(){
    if(wired) return;
    wired = true;

    $all("#analyticsTabs .tabButton").forEach(function(btn){
      btn.addEventListener("click", function(){
        setActiveAnalyticsTab(btn.getAttribute("data-tab") || "dashboard", true);
      });
    });
    $all("[data-goto-tab]").forEach(function(btn){
      btn.addEventListener("click", function(){
        setActiveAnalyticsTab(btn.getAttribute("data-goto-tab") || "dashboard", true);
      });
    });

    $("refreshStatsBtn").addEventListener("click", refreshStats);
    $("exportStatsCsvBtn").addEventListener("click", exportStatsCsv);
    $("statsStart").addEventListener("change", function(){ clearActivePreset(); refreshStatsIfReady(); });
    $("statsEnd").addEventListener("change", function(){ clearActivePreset(); refreshStatsIfReady(); });
    $("statsGroupBy").addEventListener("change", function(){ savePreferences(); rerenderStatsIfLoaded(); });
    $("statsDoctorFilter").addEventListener("change", function(){ savePreferences(); rerenderStatsIfLoaded(); });
    $("statsGraphMode").addEventListener("change", function(){ savePreferences(); rerenderStatsIfLoaded(); });
    $("statsTrendMetric").addEventListener("change", function(){ savePreferences(); rerenderStatsIfLoaded(); });
    ["statsAverageExcludeBelow", "statsAverageExcludeAbove"].forEach(function(id){
      $(id).addEventListener("input", function(){ savePreferences(); rerenderStatsIfLoaded(); });
    });
    ["statsClinicHours", "statsTargetRoomMinutes", "statsTargetCleanMinutes"].forEach(function(id){
      $(id).addEventListener("input", function(){ savePreferences(); rerenderStatsIfLoaded(); });
    });
    $all("#trendDayPresets .pillBtn").forEach(function(btn){
      btn.addEventListener("click", function(){ applyTrendDayPreset(btn.getAttribute("data-days") || "all"); });
    });
    $all("#trendDayFilters .dayToggle").forEach(function(btn){
      btn.addEventListener("click", function(){ toggleTrendDay(btn.getAttribute("data-weekday")); });
    });
    $all("#statsQuickRanges .pillBtn").forEach(function(btn){
      btn.addEventListener("click", function(){
        applyStatsPreset(btn.getAttribute("data-range") || "");
        refreshStatsIfReady();
      });
    });

    $("selectAllLogsBtn").addEventListener("click", toggleSelectAllLogs);
    $("deleteSelectedLogsBtn").addEventListener("click", deleteSelectedLogs);
    $("exportVisibleLogsBtn").addEventListener("click", exportVisibleLogsCsv);
    $("refreshRoomLogsBtn").addEventListener("click", refreshRoomLogs);
    $("roomLogsType").addEventListener("change", refreshLogsIfReady);
    $("roomLogsStart").addEventListener("change", refreshLogsIfReady);
    $("roomLogsEnd").addEventListener("change", refreshLogsIfReady);
    $("roomLogsLimit").addEventListener("change", refreshLogsIfReady);
    $("roomLogsSearch").addEventListener("input", function(){ savePreferences(); rerenderLogsIfLoaded(); });
    $("roomLogsSort").addEventListener("change", function(){ savePreferences(); rerenderLogsIfLoaded(); });
    $("roomLogsOutliers").addEventListener("change", function(){ savePreferences(); rerenderLogsIfLoaded(); });
  }

  // ===== Bootstrap =====
  function build(){
    if(built) return true;
    var host = document.getElementById("statsViewerRoot");
    var data = window.__STATS_DASHBOARD__;
    if(!host || !data) return false;
    root = host.shadowRoot || host.attachShadow({ mode: "open" });
    root.innerHTML = "<style>" + data.css + "</style>" + data.html;
    built = true;
    defaultStatsDates();
    defaultRoomLogDates();
    restorePreferences();
    updateLogSelectionUI();
    wireEvents();
    return true;
  }

  function isStatsTabActive(){
    var t = document.getElementById("tabStats");
    return !!(t && t.classList.contains("active"));
  }

  function scheduleReadyCheck(){
    if(readyTimer) return;
    readyTimer = setInterval(function(){
      if(getSupabase() && getPracticeId() && !isBasePlan()){
        clearInterval(readyTimer);
        readyTimer = null;
        if(isStatsTabActive()) maybeLoad(false);
      }
    }, 1200);
  }

  function maybeLoad(force){
    if(!build()) return;
    var host = document.getElementById("statsViewerRoot");
    if(isBasePlan()){
      if(host) host.style.display = "none";
      return;
    }
    if(host) host.style.display = "";
    if(!getSupabase() || !getPracticeId()){
      setStatus("Sign in to your clinic to load analytics.");
      scheduleReadyCheck();
      return;
    }
    if(force || !lastRows){
      refreshStats();
      refreshRoomLogs();
    }
  }

  function watchTab(){
    var t = document.getElementById("tabStats");
    if(!t) return;
    try{
      var obs = new MutationObserver(function(){
        if(isStatsTabActive()) maybeLoad(false);
      });
      obs.observe(t, { attributes: true, attributeFilter: ["class"] });
    } catch(e){}
    if(isStatsTabActive()) maybeLoad(false);
  }

  function init(){
    build();
    watchTab();
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Back-compat: allow other modules to trigger a (re)load.
  window.roomboardLoadStats = function(){ maybeLoad(true); };

})();
