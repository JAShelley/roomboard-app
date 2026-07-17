import { NextResponse } from "next/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

type PulseSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  email: string;
  userId: string;
  apiBase?: string;
};

type BoardColorLabel = {
  id: string;
  title: string;
  color: string;
};

type BoardRoom = {
  id: string;
  name: string;
  patientName: string;
  colorLabelId: string;
  colorHex: string;
  doctor: string;
  tech: string;
  quickNote: string;
  notes: string;
  roomReady: boolean;
  doctorReady: boolean;
  needsCleaning: boolean;
  reason: string;
  timer: BoardTimer;
  cleaningTimer: BoardTimer;
  activeRoomSessionId: string | null;
  dischargeReady: boolean | null;
  checklist?: ChecklistItem[];
};

type ChecklistItem = {
  id: string;
  text: string;
  done: boolean;
};

type BoardTimer = {
  elapsedMs: number;
  baseElapsedMs: number;
  running: boolean;
  startedAt: number | null;
  startedAtIso: string | null;
};

type BoardData = {
  rooms: BoardRoom[];
  doctors: string[];
  quickNotes: string[];
  colorLabels: BoardColorLabel[];
  // Everything in the stored board_state besides rooms (sharedUi etc.). Kept
  // so writes can round-trip it — the web app syncs practice-wide UI settings
  // (including the default patient checklist) through board_state.sharedUi.
  boardStateExtras: Record<string, unknown>;
  // Raw server snapshot used as the optimistic merge base when Pulse changes
  // a room. Keeping this separate from the normalized API response avoids a
  // Pulse send replacing a concurrent RoomBoard edit in another room.
  baseBoardState: Record<string, unknown>;
  settings: {
    displayCols: number;
    displayOnlyActive: boolean;
    displayLayout: "grid" | "list";
    highlightDoctor: string;
    defaultColorLabelId: string;
    doctorInitials: Record<string, string>;
  };
};

type SendPayload = {
  roomId: string;
  patientName: string;
  colorLabelId: string;
  doctor: string;
  tech: string;
  quickNote: string;
  notes: string;
  roomReady: boolean;
  doctorReady: boolean;
};

// CORS is a browser-only control; the native Pulse apps ignore it entirely.
// Its only job here is to stop arbitrary websites from scripting these
// endpoints in a signed-in user's browser. Set PULSE_ALLOWED_ORIGIN in prod to
// your app's origin (e.g. https://app.roomboard.com) to lock it down; when it's
// unset we fall back to "*" so nothing breaks before it's configured.
function getCorsAllowOrigin() {
  return (process.env.PULSE_ALLOWED_ORIGIN || "").trim() || "*";
}

function buildCorsHeaders(): Record<string, string> {
  const allowOrigin = getCorsAllowOrigin();
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Pulse-Refresh-Token",
    "Access-Control-Max-Age": "86400",
  };
  // When we pin to a specific origin, caches must key on Origin.
  if (allowOrigin !== "*") headers.Vary = "Origin";
  return headers;
}

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getSupabaseUrl() {
  return getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
}

function getSupabaseAnonKey() {
  return getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

function getSupabaseServiceRoleKey() {
  return getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
}

// The Supabase schema isn't codegen'd into a `Database` type here, so we type
// these clients loosely (`any` schema) to keep row access ergonomic. Every
// query is still explicitly scoped by practice_id, so this is a typing choice,
// not a security one.
function createAnonClient(): SupabaseClient<any> {
  return createClient<any>(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let serviceClient: SupabaseClient<any> | null = null;
function createServiceClient(): SupabaseClient<any> {
  if (!serviceClient) {
    serviceClient = createClient<any>(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return serviceClient;
}

export function optionsResponse() {
  return new NextResponse(null, { status: 204, headers: buildCorsHeaders() });
}

export function pulseJson(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers || {});
  for (const [key, value] of Object.entries(buildCorsHeaders())) headers.set(key, value);
  return NextResponse.json(data, { ...init, headers });
}

export function pulseError(message: string, status = 400) {
  return pulseJson({ error: message }, { status });
}

async function fetchSupabaseAuthToken(
  grantType: "password" | "refresh_token",
  payload: Record<string, string>,
) {
  const response = await fetch(
    `${getSupabaseUrl().replace(/\/+$/, "")}/auth/v1/token?grant_type=${grantType}`,
    {
      method: "POST",
      headers: {
        apikey: getSupabaseAnonKey(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    },
  );
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      String(data?.msg || data?.error_description || data?.error || `Auth failed (${response.status})`),
    );
  }
  if (!data?.access_token || !data?.refresh_token || !data?.user?.id) {
    throw new Error("Supabase did not return a complete session.");
  }
  return data;
}

export function mapAuthPayload(
  data: {
    access_token: string;
    refresh_token: string;
    expires_in?: number;
    user?: { email?: string; id?: string };
  },
  fallbackEmail = "",
): PulseSession {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + Math.max(0, Number(data.expires_in || 3600)) * 1000,
    email: String(data.user?.email || fallbackEmail || "").trim(),
    userId: String(data.user?.id || "").trim(),
  };
}

export async function loginPulseUser(email: string, password: string) {
  const data = await fetchSupabaseAuthToken("password", { email, password });
  return mapAuthPayload(data, email);
}

async function refreshPulseSession(refreshToken: string, fallbackEmail = "") {
  const data = await fetchSupabaseAuthToken("refresh_token", { refresh_token: refreshToken });
  return mapAuthPayload(data, fallbackEmail);
}

async function getUserFromAccessToken(accessToken: string): Promise<User | null> {
  const service = createServiceClient();
  const result = await service.auth.getUser(accessToken);
  if (result.error || !result.data.user) return null;
  return result.data.user;
}

export async function resolvePulseSession(input: {
  accessToken?: string;
  refreshToken?: string;
}): Promise<{ session: PulseSession; user: User }> {
  const accessToken = String(input.accessToken || "").trim();
  const refreshToken = String(input.refreshToken || "").trim();

  if (accessToken) {
    const user = await getUserFromAccessToken(accessToken);
    if (user) {
      return {
        session: {
          accessToken,
          refreshToken,
          expiresAt: Date.now() + 15 * 60 * 1000,
          email: String(user.email || "").trim(),
          userId: String(user.id || "").trim(),
        },
        user,
      };
    }
  }

  if (!refreshToken) throw new Error("Login required.");
  const refreshedSession = await refreshPulseSession(refreshToken);
  const refreshedUser = await getUserFromAccessToken(refreshedSession.accessToken);
  if (!refreshedUser) throw new Error("Your RoomBoard session expired. Please sign in again.");
  refreshedSession.email = String(refreshedUser.email || refreshedSession.email || "").trim();
  refreshedSession.userId = String(refreshedUser.id || refreshedSession.userId || "").trim();
  return { session: refreshedSession, user: refreshedUser };
}

// Distinct marker so routes can map this to HTTP 402 (Payment Required) and the
// client can tell "you're not paying" apart from "please sign in".
export const BILLING_REQUIRED = "billing_required";

// Server-side paywall. The Pulse routes run under the service-role key and
// bypass RLS, so the subscription check the browser does in auth-sync.js is NOT
// enough on its own — anyone with a valid login token could otherwise call these
// endpoints directly. Reuse billing/_lib's computeAccess so there is one source
// of truth for what "has access" means.
export async function assertPracticeHasAccess(practiceId: string) {
  const { getPracticeBilling, computeAccess } = await import("../billing/_lib");
  const billing = await getPracticeBilling(practiceId);
  if (!computeAccess(billing).hasAccess) {
    throw new Error(`${BILLING_REQUIRED}: Your RoomBoard subscription is inactive. Update billing to continue.`);
  }
  return billing;
}

export async function getPracticeIdForUser(userId: string) {
  const service = createServiceClient();
  const profileRes = await service
    .from("profiles")
    .select("practice_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (profileRes.error) throw new Error(profileRes.error.message);
  const practiceId = String(profileRes.data?.practice_id || "").trim();
  if (!practiceId) throw new Error("Could not determine your RoomBoard clinic.");
  return practiceId;
}

function normalizeTimer(timer: unknown): BoardTimer {
  const source = timer && typeof timer === "object" ? (timer as Record<string, unknown>) : {};
  const elapsedMs = Math.max(0, Number(source.elapsedMs || 0));
  const baseElapsedMs = Math.max(
    0,
    Number(source.baseElapsedMs != null ? source.baseElapsedMs : elapsedMs),
  );
  return {
    elapsedMs,
    baseElapsedMs,
    running: !!source.running,
    startedAt: source.startedAt == null ? null : Number(source.startedAt),
    startedAtIso: source.startedAtIso ? String(source.startedAtIso) : null,
  };
}

function computeElapsed(timer: BoardTimer | null | undefined) {
  if (!timer) return 0;
  if (timer.running && timer.startedAtIso) {
    const startedAtMs = Date.parse(timer.startedAtIso);
    if (Number.isFinite(startedAtMs)) {
      return Math.max(0, Number(timer.elapsedMs || 0)) + Math.max(0, Date.now() - startedAtMs);
    }
  }
  if (timer.running && timer.startedAt != null) {
    return Math.max(0, Number(timer.elapsedMs || 0)) + Math.max(0, Date.now() - Number(timer.startedAt));
  }
  return Math.max(0, Number(timer.elapsedMs || 0));
}

function mergeRoomEntryWithDefaults(
  roomRow: Record<string, unknown>,
  entryData: Record<string, unknown> | null,
  index: number,
  defaultColorId: string,
  colorLabels: BoardColorLabel[],
): BoardRoom {
  const colorId =
    String(entryData?.colorLabelId || "").trim() ||
    defaultColorId ||
    String(colorLabels[0]?.id || "").trim();
  const merged: BoardRoom = {
    id: String(roomRow.id || ""),
    name: String(roomRow.name || `Room ${index + 1}`),
    patientName: "",
    colorLabelId: colorId,
    colorHex: "",
    doctor: "",
    tech: "",
    quickNote: "",
    notes: "",
    roomReady: false,
    doctorReady: false,
    needsCleaning: false,
    reason: "",
    timer: normalizeTimer(entryData?.timer),
    cleaningTimer: normalizeTimer(entryData?.cleaningTimer),
    activeRoomSessionId: entryData?.activeRoomSessionId ? String(entryData.activeRoomSessionId) : null,
    dischargeReady:
      entryData?.dischargeReady == null ? null : !!entryData.dischargeReady,
  };

  if (entryData && typeof entryData === "object") {
    Object.assign(merged, entryData);
    merged.id = String(roomRow.id || merged.id);
    merged.name = String(roomRow.name || merged.name);
    merged.timer = normalizeTimer(entryData.timer);
    merged.cleaningTimer = normalizeTimer(entryData.cleaningTimer);
  }

  if (!merged.reason) {
    const color = colorLabels.find((item) => item.id === merged.colorLabelId);
    if (color?.title) merged.reason = color.title;
  }

  return merged;
}

export async function fetchPracticeBoardData(practiceId: string): Promise<BoardData> {
  const service = createServiceClient();
  const [roomRowsRes, doctorRowsRes, colorRowsRes, quickNoteRowsRes, settingsRowsRes, boardStateRowsRes] =
    await Promise.all([
      service
        .from("rooms")
        .select("id,name,sort_order,active")
        .eq("practice_id", practiceId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      service
        .from("doctors")
        .select("id,name,initials,active")
        .eq("practice_id", practiceId)
        .order("name", { ascending: true }),
      service
        .from("appointment_types")
        .select("id,title,color_hex,sort_order,active")
        .eq("practice_id", practiceId)
        .order("sort_order", { ascending: true })
        .order("title", { ascending: true }),
      service
        .from("quick_notes")
        .select("id,label,sort_order,active")
        .eq("practice_id", practiceId)
        .order("sort_order", { ascending: true })
        .order("label", { ascending: true }),
      service
        .from("practice_settings")
        .select("board_columns,show_only_active,board_view,highlight_doctor_id,default_appointment_type_id")
        .eq("practice_id", practiceId)
        .limit(1),
      service
        .from("practice_board_state")
        .select("practice_id,board_state,updated_at")
        .eq("practice_id", practiceId)
        .limit(1),
    ]);

  for (const result of [
    roomRowsRes,
    doctorRowsRes,
    colorRowsRes,
    quickNoteRowsRes,
    settingsRowsRes,
    boardStateRowsRes,
  ]) {
    if (result.error) throw new Error(result.error.message);
  }

  const roomRows = roomRowsRes.data || [];
  const doctorRows = doctorRowsRes.data || [];
  const colorRows = colorRowsRes.data || [];
  const quickNoteRows = quickNoteRowsRes.data || [];
  const settingsRow = Array.isArray(settingsRowsRes.data) ? settingsRowsRes.data[0] || null : null;
  const boardStateRow = Array.isArray(boardStateRowsRes.data) ? boardStateRowsRes.data[0] || null : null;
  const boardState =
    boardStateRow?.board_state && typeof boardStateRow.board_state === "object"
      ? (boardStateRow.board_state as Record<string, unknown>)
      : {};
  const boardRooms = Array.isArray(boardState.rooms)
    ? (boardState.rooms as Array<Record<string, unknown>>)
    : [];
  const boardStateExtras: Record<string, unknown> = {};
  for (const key of Object.keys(boardState)) {
    if (key !== "rooms") boardStateExtras[key] = boardState[key];
  }

  const activeDoctors = doctorRows.filter((row) => row && row.active !== false && String(row.name || "").trim());
  const activeColorRows = colorRows.filter((row) => row && row.active !== false && String(row.title || "").trim());
  const activeQuickNotes = quickNoteRows.filter((row) => row && row.active !== false && String(row.label || "").trim());

  const doctorInitials: Record<string, string> = {};
  activeDoctors.forEach((row) => {
    doctorInitials[String(row.name || "")] = String(row.initials || "");
  });

  const colorLabels: BoardColorLabel[] = activeColorRows.map((row) => ({
    id: String(row.id || ""),
    title: String(row.title || ""),
    color: String(row.color_hex || "#6ea8fe"),
  }));

  const boardRoomMap: Record<string, Record<string, unknown>> = {};
  boardRooms.forEach((room) => {
    const roomId = String(room?.id || "").trim();
    if (roomId) boardRoomMap[roomId] = room;
  });

  const defaultColorId =
    String(settingsRow?.default_appointment_type_id || "").trim() ||
    String(colorLabels[0]?.id || "").trim();
  const doctors = ["", ...activeDoctors.map((row) => String(row.name || ""))];
  const quickNotes = ["", ...activeQuickNotes.map((row) => String(row.label || ""))];

  const rooms: BoardRoom[] = roomRows
    .filter((row) => row && row.active !== false)
    .sort((a, b) => {
      const sortDiff = Number(a.sort_order || 0) - Number(b.sort_order || 0);
      if (sortDiff !== 0) return sortDiff;
      return String(a.name || "").localeCompare(String(b.name || ""), undefined, {
        numeric: true,
        sensitivity: "base",
      });
    })
    .map((row, index) =>
      mergeRoomEntryWithDefaults(row as Record<string, unknown>, boardRoomMap[String(row.id || "")] || null, index, defaultColorId, colorLabels),
    );

  const highlightedDoctor = activeDoctors.find((row) => row.id === settingsRow?.highlight_doctor_id);

  return {
    rooms,
    doctors,
    quickNotes,
    colorLabels,
    boardStateExtras,
    baseBoardState: JSON.parse(JSON.stringify(boardState)),
    settings: {
      displayCols: Math.max(1, Number(settingsRow?.board_columns || 4)),
      displayOnlyActive: !!settingsRow?.show_only_active,
      displayLayout: settingsRow?.board_view === "list" ? "list" : "grid",
      highlightDoctor: String(highlightedDoctor?.name || ""),
      defaultColorLabelId: defaultColorId,
      doctorInitials,
    },
  };
}

async function fetchServerNowIso() {
  const service = createServiceClient();
  try {
    const res = await service.rpc("get_server_now_iso");
    if (res.error) throw res.error;
    if (typeof res.data === "string" && Date.parse(res.data)) return new Date(res.data).toISOString();
  } catch (_error) {}
  return new Date().toISOString();
}

function shouldRetryRoomSessionWithoutPracticeId(error: unknown) {
  const message = String(error instanceof Error ? error.message : error || "").toLowerCase();
  return (
    (message.includes("column") && message.includes("practice_id") && message.includes("does not exist")) ||
    (message.includes("schema cache") && message.includes("practice_id")) ||
    message.includes("could not find the 'practice_id' column")
  );
}

async function createRoomSession(practiceId: string, room: BoardRoom) {
  const service = createServiceClient();
  const serverNowIso = await fetchServerNowIso();
  const payload = {
    practice_id: practiceId,
    room_name: room.name || room.id,
    doctor_name: room.doctor || null,
    started_at: serverNowIso,
    ended_at: null,
    duration_ms: null,
  };

  let insertRes = await service
    .from("room_sessions")
    .insert(payload)
    .select("id")
    .single();

  if (insertRes.error) {
    if (!shouldRetryRoomSessionWithoutPracticeId(insertRes.error) || !practiceId) {
      throw new Error(insertRes.error.message);
    }
    insertRes = await service
      .from("room_sessions")
      .insert({
        room_name: payload.room_name,
        doctor_name: payload.doctor_name,
        started_at: payload.started_at,
        ended_at: payload.ended_at,
        duration_ms: payload.duration_ms,
      })
      .select("id")
      .single();
    if (insertRes.error) throw new Error(insertRes.error.message);
  }

  return String(insertRes.data?.id || "").trim() || null;
}

async function upsertBoardState(practiceId: string, boardData: BoardData) {
  const service = createServiceClient();
  const proposedBoardState = {
    // Round-trip the non-room parts of board_state (sharedUi etc.); writing
    // only { rooms } would wipe the practice-wide UI settings the web app
    // syncs through this row.
    ...(boardData.boardStateExtras || {}),
    rooms: JSON.parse(JSON.stringify(Array.isArray(boardData.rooms) ? boardData.rooms : [])),
  };
  const res = await service
    .rpc("merge_practice_board_state", {
      p_practice_id: practiceId,
      p_base_board_state: boardData.baseBoardState || {},
      p_proposed_board_state: proposedBoardState,
    })
    .select("board_state")
    .single();
  if (res.error) throw new Error(res.error.message);
  if (res.data?.board_state && typeof res.data.board_state === "object") {
    boardData.baseBoardState = res.data.board_state as Record<string, unknown>;
  }
}

export async function loadPulseBoard(input: { accessToken?: string; refreshToken?: string }) {
  const { session, user } = await resolvePulseSession(input);
  const practiceId = await getPracticeIdForUser(String(user.id || session.userId || "").trim());
  await assertPracticeHasAccess(practiceId);
  const boardData = await fetchPracticeBoardData(practiceId);
  return { session, practiceId, boardData };
}

function makeChecklistItem(text: string): ChecklistItem {
  return {
    id: `pcl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: String(text || ""),
    done: false,
  };
}

async function resolveDefaultChecklistTemplate(
  practiceId: string,
  boardStateExtras: Record<string, unknown>,
): Promise<{ enabled: boolean; texts: string[] }> {
  const sharedUi =
    boardStateExtras?.sharedUi && typeof boardStateExtras.sharedUi === "object"
      ? (boardStateExtras.sharedUi as Record<string, unknown>)
      : null;
  let enabled: boolean | null = null;
  let template: unknown = null;
  if (sharedUi) {
    if (sharedUi.patientChecklistEnabled != null) enabled = sharedUi.patientChecklistEnabled !== false;
    if (Array.isArray(sharedUi.defaultPatientChecklist)) template = sharedUi.defaultPatientChecklist;
  }
  // Older board_state rows may predate sharedUi carrying the checklist; the
  // settings snapshot table is the durable copy.
  if (enabled == null || template == null) {
    const service = createServiceClient();
    const res = await service
      .from("practice_default_settings")
      .select("settings")
      .eq("practice_id", practiceId)
      .maybeSingle();
    const settings =
      !res.error && res.data?.settings && typeof res.data.settings === "object"
        ? (res.data.settings as Record<string, unknown>)
        : null;
    if (settings) {
      if (enabled == null && settings.patientChecklistEnabled != null) {
        enabled = settings.patientChecklistEnabled !== false;
      }
      if (template == null && Array.isArray(settings.defaultPatientChecklist)) {
        template = settings.defaultPatientChecklist;
      }
    }
  }
  const texts = (Array.isArray(template) ? template : [])
    .map((item) => (typeof item === "string" ? item : String((item as Record<string, unknown>)?.text || "")))
    .map((text) => text.trim())
    .filter(Boolean);
  return { enabled: enabled !== false, texts };
}

// Mirrors syncRoomChecklistWithPatientChange in the web app (board-state.js):
// clear the checklist when the patient is removed, clear + reseed from the
// practice default when one patient replaces another, seed when a patient
// arrives in a room with no items, and no-op on cosmetic renames. Advanced-plan
// feature, so base plans never seed.
async function syncRoomChecklistForPatientChange(
  practiceId: string,
  boardData: BoardData,
  room: BoardRoom,
  previousPatientName: string,
  plan: string | null,
) {
  const prev = String(previousPatientName || "").replace(/\s/g, "").toLowerCase();
  const next = String(room.patientName || "").replace(/\s/g, "").toLowerCase();
  if (prev === next) return;
  if (!next) {
    room.checklist = [];
    return;
  }
  if (prev) room.checklist = []; // different patient: drop the old items
  if (Array.isArray(room.checklist) && room.checklist.length) return; // never clobber existing items
  if (plan && plan.indexOf("base") !== -1) {
    room.checklist = [];
    return;
  }
  const { enabled, texts } = await resolveDefaultChecklistTemplate(practiceId, boardData.boardStateExtras);
  room.checklist = enabled ? texts.map(makeChecklistItem) : [];
}

export async function sendPulseAppointment(
  sessionInput: { accessToken?: string; refreshToken?: string },
  payload: SendPayload,
) {
  const { session, user } = await resolvePulseSession(sessionInput);
  const practiceId = await getPracticeIdForUser(String(user.id || session.userId || "").trim());
  const billing = await assertPracticeHasAccess(practiceId);
  const boardData = await fetchPracticeBoardData(practiceId);
  const room = boardData.rooms.find((entry) => entry.id === String(payload.roomId || "").trim());
  if (!room) throw new Error("That room could not be found in the shared board.");

  const wasEmpty = !String(room.patientName || "").trim();
  const previousPatientName = String(room.patientName || "");
  room.patientName = String(payload.patientName || "").trim();
  room.colorLabelId = String(payload.colorLabelId || "").trim() || room.colorLabelId;
  room.colorHex = "";
  room.doctor = String(payload.doctor || "").trim();
  room.tech = String(payload.tech || "").trim();
  room.quickNote = String(payload.quickNote || "").trim();
  room.notes = String(payload.notes || "").trim();
  room.roomReady = !!payload.roomReady;
  room.doctorReady = !!payload.doctorReady;
  room.needsCleaning = false;
  room.cleaningTimer = normalizeTimer(room.cleaningTimer);
  room.cleaningTimer.running = false;
  room.cleaningTimer.startedAt = null;
  room.cleaningTimer.startedAtIso = null;

  const selectedColor = boardData.colorLabels.find((label) => label.id === room.colorLabelId);
  if (selectedColor?.title) room.reason = selectedColor.title;

  room.timer = normalizeTimer(room.timer);
  if (room.patientName && !room.timer.running && computeElapsed(room.timer) === 0) {
    const serverNowIso = await fetchServerNowIso();
    room.timer.elapsedMs = Math.max(0, Number(room.timer.elapsedMs || 0));
    room.timer.baseElapsedMs = Math.max(0, Number(room.timer.baseElapsedMs || room.timer.elapsedMs || 0));
    room.timer.running = true;
    room.timer.startedAt = null;
    room.timer.startedAtIso = serverNowIso;
  }

  if (wasEmpty && !room.activeRoomSessionId) {
    room.activeRoomSessionId = await createRoomSession(practiceId, room);
  }

  await syncRoomChecklistForPatientChange(practiceId, boardData, room, previousPatientName, billing.plan);
  await upsertBoardState(practiceId, boardData);
  return {
    session,
    practiceId,
    boardData,
    message: `${room.patientName} sent to ${room.name || "room"}.`,
  };
}
