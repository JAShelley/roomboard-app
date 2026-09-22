import {
  computeAccess,
  getServiceClient,
  rotatedSessionPayload,
  withAppStoreBilling,
  type PracticeBilling,
} from "../_lib";
import { optionsResponse, pulseJson, pulseError } from "../../pulse/_lib";

export async function OPTIONS() {
  return optionsResponse();
}

// Decode the JWT body WITHOUT trusting it. The signature is checked separately
// by verifyAccessToken(); this only reads the claims so we can reject an
// obviously-dead token before spending a round trip on it.
function claimsFromJwt(token: string): { sub: string; expMs: number } | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const payload = JSON.parse(Buffer.from(part, "base64").toString());
    const sub = String(payload.sub || "").trim();
    if (!sub) return null;
    const exp = Number(payload.exp || 0);
    return { sub, expMs: Number.isFinite(exp) ? exp * 1000 : 0 };
  } catch {
    return null;
  }
}

// Confirm the token is genuinely signed by this Supabase project and still
// valid. The decoded `sub` alone proves nothing — anyone can write a JSON body
// and base64 it — so the fast path must not act on claims until this passes.
async function verifyAccessToken(accessToken: string, expectedSub: string): Promise<boolean> {
  try {
    const result = await getServiceClient().auth.getUser(accessToken);
    if (result.error || !result.data.user) return false;
    return String(result.data.user.id || "") === expectedSub;
  } catch {
    return false;
  }
}

// Fast-path billing check: one joined query for profiles + practices instead of
// 3 sequential round-trips, with token verification running alongside it rather
// than before it, so verifying costs latency only when the query is slower.
async function fastBillingCheck(accessToken: string): Promise<PracticeBilling | null> {
  const claims = claimsFromJwt(accessToken);
  if (!claims) return null;
  // Expired token: fall through to the full path, which can refresh it.
  // 30s of slack absorbs clock skew between this host and Supabase.
  if (!claims.expMs || claims.expMs <= Date.now() - 30_000) return null;

  const service = getServiceClient();
  const [verified, res] = await Promise.all([
    verifyAccessToken(accessToken, claims.sub),
    service
      .from("profiles")
      .select(`practice_id, practices!inner(
        id, stripe_customer_id, stripe_subscription_id,
        subscription_status, plan, trial_ends_at, current_period_end,
        has_payment_method
      )`)
      .eq("user_id", claims.sub)
      .maybeSingle(),
  ]);

  if (!verified) return null;

  const data = res.data as Record<string, unknown> | null;
  if (res.error || !data) return null;

  const row = data;
  const pr = (Array.isArray(row.practices) ? row.practices[0] : row.practices) as Record<string, unknown> | null;
  if (!pr) return null;

  return {
    practiceId: String(row.practice_id || ""),
    stripeCustomerId: (pr.stripe_customer_id as string) || null,
    stripeSubscriptionId: (pr.stripe_subscription_id as string) || null,
    subscriptionStatus: String(pr.subscription_status || "trialing"),
    plan: (pr.plan as string) || null,
    trialEndsAt: pr.trial_ends_at ? new Date(String(pr.trial_ends_at)).toISOString() : null,
    currentPeriodEnd: pr.current_period_end ? new Date(String(pr.current_period_end)).toISOString() : null,
    hasPaymentMethod: pr.has_payment_method === true,
  };
}

async function billingWithPaymentMethodStatus(billing: PracticeBilling): Promise<PracticeBilling> {
  const storedFlag = billing.hasPaymentMethod === true;
  const needsCardCheck =
    billing.subscriptionStatus === "trialing" &&
    !!billing.stripeCustomerId &&
    !!billing.stripeSubscriptionId;
  // Outside a trial the flag doesn't gate anything — report what's stored
  // rather than flattening it to false.
  if (!needsCardCheck) return { ...billing, hasPaymentMethod: storedFlag };

  try {
    const { hasPaymentMethodForBilling, updatePracticePaymentMethodFlag } = await import("../_stripe");
    const hasPaymentMethod = await hasPaymentMethodForBilling(billing);
    // null = Stripe unreachable. Keep the stored answer and write nothing:
    // persisting a false would revoke this clinic's RLS board access.
    if (hasPaymentMethod === null) return { ...billing, hasPaymentMethod: storedFlag };
    await updatePracticePaymentMethodFlag(
      billing.stripeCustomerId,
      billing.practiceId,
      hasPaymentMethod,
    );
    return { ...billing, hasPaymentMethod };
  } catch {
    // Stripe or the flag write blew up. This is a status read; degrade to the
    // stored value instead of failing the request and showing a false paywall.
    return { ...billing, hasPaymentMethod: storedFlag };
  }
}

// Lightweight endpoint the client calls after login to decide whether to show
// the board or the subscribe wall.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const accessToken = String(body?.accessToken || "").trim();
    const refreshToken = String(body?.refreshToken || "").trim();

    // Try the fast path first (no refresh, so the caller's token stays valid)
    let billing: PracticeBilling | null = accessToken ? await fastBillingCheck(accessToken) : null;
    let rotated: { accessToken: string; refreshToken: string } | null = null;

    // Fall back to full session resolution (expired JWT, missing profile row).
    // This one may spend the caller's refresh token, so capture the
    // replacement pair and hand it back below.
    if (!billing) {
      const { resolveSessionContext, getPracticeBilling } = await import("../_lib");
      const ctx = await resolveSessionContext({ accessToken, refreshToken });
      rotated = rotatedSessionPayload(ctx);
      billing = await getPracticeBilling(ctx.practiceId);
    }

    billing = await billingWithPaymentMethodStatus(billing);
    try {
      billing = await withAppStoreBilling(billing);
    } catch {
      // An App Store lookup failure must not decide a Stripe subscriber's fate.
      billing = { ...billing, hasAppStoreAccess: false };
    }
    const access = computeAccess(billing);

    return pulseJson({
      practiceId: billing.practiceId,
      status: billing.subscriptionStatus,
      plan: billing.plan,
      hasAccess: access.hasAccess,
      trialing: access.trialing,
      subscribed: access.subscribed,
      trialDaysLeft: access.trialDaysLeft,
      trialEndsAt: billing.trialEndsAt,
      currentPeriodEnd: billing.currentPeriodEnd || billing.appStoreExpiresAt,
      hasCustomer: !!billing.stripeCustomerId,
      hasSubscription: !!billing.stripeSubscriptionId,
      hasPaymentMethod: access.hasPaymentMethod,
      hasAppStoreAccess: access.hasAppStoreAccess,
      billingEnforced: access.billingEnforced,
      appStoreProductId: billing.appStoreProductId,
      appStoreStatus: billing.appStoreStatus,
      appStoreExpiresAt: billing.appStoreExpiresAt,
      ...(rotated ? { session: rotated } : {}),
    });
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error || "Could not load billing status.");
    const status = /login required|expired|sign in/i.test(message) ? 401 : 400;
    return pulseError(message, status);
  }
}
