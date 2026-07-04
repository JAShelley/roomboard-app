import { createClient } from "@supabase/supabase-js";
import { resolvePulseSession, getPracticeIdForUser } from "../pulse/_lib";

export const TRIAL_DAYS = 14;

export function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

// plan name <-> Stripe price id ------------------------------------------
// Plans: "base-monthly" | "base-annual" | "advanced-monthly" | "advanced-annual"
export function priceIdForPlan(plan: string): string {
  // Normalize spaces AND underscores to hyphens so "advanced_monthly",
  // "advanced monthly", and "advanced-monthly" all resolve to the same price.
  const p = String(plan || "").toLowerCase().replace(/[\s_]+/g, "-");
  if (p === "advanced-annual"  || p === "advanced-yearly") return requireEnv("STRIPE_PRICE_ADVANCED_ANNUAL");
  if (p === "advanced-monthly" || p === "advanced")        return requireEnv("STRIPE_PRICE_ADVANCED_MONTHLY");
  if (p === "base-annual"      || p === "annual" || p === "yearly") return requireEnv("STRIPE_PRICE_BASE_ANNUAL");
  return requireEnv("STRIPE_PRICE_BASE_MONTHLY");
}

export function planForPriceId(priceId: string | null | undefined): string | null {
  if (!priceId) return null;
  const e = process.env;
  if (priceId === e.STRIPE_PRICE_ADVANCED_ANNUAL)  return "advanced-annual";
  if (priceId === e.STRIPE_PRICE_ADVANCED_MONTHLY) return "advanced-monthly";
  if (priceId === e.STRIPE_PRICE_BASE_ANNUAL)      return "base-annual";
  if (priceId === e.STRIPE_PRICE_BASE_MONTHLY)     return "base-monthly";
  return null;
}

// Service-role Supabase client (server-only) ------------------------------
let serviceClient: ReturnType<typeof createClient> | null = null;
export function getServiceClient() {
  if (!serviceClient) {
    serviceClient = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return serviceClient;
}

export type PracticeBilling = {
  practiceId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string;
  plan: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  hasPaymentMethod?: boolean;
  appStoreProductId?: string | null;
  appStoreStatus?: string | null;
  appStoreExpiresAt?: string | null;
  appStoreGracePeriodExpiresAt?: string | null;
  hasAppStoreAccess?: boolean;
};

export type SessionContext = {
  practiceId: string;
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
};

// Authenticate a request the same way the Pulse routes do: the client
// passes its Supabase access/refresh tokens in the JSON body.
export async function resolveSessionContext(input: {
  accessToken?: string;
  refreshToken?: string;
}): Promise<SessionContext> {
  const { session, user } = await resolvePulseSession(input);
  const userId = String(user.id || session.userId || "").trim();
  const practiceId = await getPracticeIdForUser(userId);
  return {
    practiceId,
    userId,
    email: String(user.email || session.email || "").trim(),
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
  };
}

export async function getPracticeBilling(practiceId: string): Promise<PracticeBilling> {
  const service = getServiceClient();
  const res = await service
    .from("practices")
    .select("id,stripe_customer_id,stripe_subscription_id,subscription_status,plan,trial_ends_at,current_period_end,has_payment_method")
    .eq("id", practiceId)
    .maybeSingle();
  if (res.error) throw new Error(res.error.message);
  const row = (res.data || {}) as Record<string, unknown>;
  const practiceBilling: PracticeBilling = {
    practiceId,
    stripeCustomerId: (row.stripe_customer_id as string) || null,
    stripeSubscriptionId: (row.stripe_subscription_id as string) || null,
    subscriptionStatus: String(row.subscription_status || "trialing"),
    plan: (row.plan as string) || null,
    trialEndsAt: row.trial_ends_at ? new Date(String(row.trial_ends_at)).toISOString() : null,
    currentPeriodEnd: row.current_period_end ? new Date(String(row.current_period_end)).toISOString() : null,
    hasPaymentMethod: row.has_payment_method === true,
  };
  return withAppStoreBilling(practiceBilling);
}

// Mirror the SQL practice_has_access() logic on the server.
export function computeAccess(billing: PracticeBilling) {
  const status = String(billing.subscriptionStatus || "").toLowerCase();
  const now = Date.now();
  const trialMs = billing.trialEndsAt ? Date.parse(billing.trialEndsAt) : 0;
  const trialing = status === "trialing" && Number.isFinite(trialMs) && trialMs > now;
  const subscribed = status === "active" || status === "past_due";
  const hasCustomer = !!billing.stripeCustomerId;
  const hasSubscription = !!billing.stripeSubscriptionId;
  const hasPaymentMethod = billing.hasPaymentMethod === true;
  const hasAppStoreAccess = billing.hasAppStoreAccess === true;
  const hasAccess = subscribed || (trialing && hasCustomer && hasSubscription && hasPaymentMethod) || hasAppStoreAccess;
  const trialDaysLeft = trialing ? Math.max(0, Math.ceil((trialMs - now) / 86_400_000)) : 0;
  return { hasAccess, trialing, subscribed, trialDaysLeft, hasPaymentMethod, hasAppStoreAccess };
}

function isMissingAppStoreTable(error: unknown) {
  const message = String(error instanceof Error ? error.message : error || "").toLowerCase();
  return (
    message.includes("app_store_subscriptions") &&
    (message.includes("does not exist") ||
      message.includes("schema cache") ||
      message.includes("could not find"))
  );
}

function dateStringOrNull(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function appStoreRowHasAccess(row: Record<string, unknown> | null) {
  if (!row) return false;
  const status = String(row.status || "").toLowerCase();
  if (["expired", "revoked", "refunded"].includes(status)) return false;
  if (row.revocation_date) return false;
  const expiresAtMs = row.expires_at ? Date.parse(String(row.expires_at)) : 0;
  const graceAtMs = row.grace_period_expires_at ? Date.parse(String(row.grace_period_expires_at)) : 0;
  const now = Date.now();
  return (
    (Number.isFinite(expiresAtMs) && expiresAtMs > now) ||
    (Number.isFinite(graceAtMs) && graceAtMs > now)
  );
}

function planForAppStoreProduct(productId: string | null) {
  const normalized = String(productId || "").toLowerCase();
  const tier = normalized.includes("advanced") ? "advanced" : normalized.includes("base") ? "base" : "";
  const period = normalized.includes("annual") || normalized.includes("yearly") ? "annual" : normalized.includes("monthly") ? "monthly" : "";
  if (!tier) return null;
  return period ? `${tier}-${period}` : tier;
}

export async function withAppStoreBilling(billing: PracticeBilling): Promise<PracticeBilling> {
  if (billing.hasAppStoreAccess !== undefined) return billing;

  const service = getServiceClient();
  const res = await service
    .from("app_store_subscriptions")
    .select("product_id,status,expires_at,grace_period_expires_at,revocation_date,updated_at")
    .eq("practice_id", billing.practiceId)
    .order("expires_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(1);

  if (res.error) {
    if (isMissingAppStoreTable(res.error)) return billing;
    throw new Error(res.error.message);
  }

  const rows = Array.isArray(res.data) ? res.data : [];
  const row = (rows[0] || null) as Record<string, unknown> | null;
  return {
    ...billing,
    plan: billing.plan || planForAppStoreProduct(row ? String(row.product_id || "") : null),
    appStoreProductId: row ? String(row.product_id || "") || null : null,
    appStoreStatus: row ? String(row.status || "") || null : null,
    appStoreExpiresAt: dateStringOrNull(row?.expires_at),
    appStoreGracePeriodExpiresAt: dateStringOrNull(row?.grace_period_expires_at),
    hasAppStoreAccess: appStoreRowHasAccess(row),
  };
}

export async function findPracticeIdByCustomer(customerId: string): Promise<string | null> {
  const service = getServiceClient();
  const res = await service.from("practices").select("id").eq("stripe_customer_id", customerId).maybeSingle();
  if (res.error) return null;
  const row = res.data as Record<string, unknown> | null;
  return row ? String(row.id) : null;
}
