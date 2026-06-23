import { createClient } from "@supabase/supabase-js";
import { computeAccess, getServiceClient, requireEnv } from "../_lib";
import { optionsResponse, pulseJson, pulseError } from "../../pulse/_lib";

export async function OPTIONS() {
  return optionsResponse();
}

function userIdFromJwt(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    return String(payload.sub || "").trim() || null;
  } catch {
    return null;
  }
}

// Fast-path billing check: decode JWT locally (no network call) then do a
// single joined query for profiles + practices instead of 3 sequential round-trips.
async function fastBillingCheck(accessToken: string) {
  const userId = userIdFromJwt(accessToken);
  if (!userId) return null;

  const service = getServiceClient();
  const res = await service
    .from("profiles")
    .select(`practice_id, practices!inner(
      id, stripe_customer_id, stripe_subscription_id,
      subscription_status, plan, trial_ends_at, current_period_end
    )`)
    .eq("user_id", userId)
    .maybeSingle();

  if (res.error || !res.data) return null;

  const row = res.data as Record<string, unknown>;
  const pr = (Array.isArray(row.practices) ? row.practices[0] : row.practices) as Record<string, unknown> | null;
  if (!pr) return null;

  return {
    practiceId: String(row.practice_id || ""),
    stripeCustomerId: (pr.stripe_customer_id as string) || null,
    subscriptionStatus: String(pr.subscription_status || "trialing"),
    plan: (pr.plan as string) || null,
    trialEndsAt: pr.trial_ends_at ? new Date(String(pr.trial_ends_at)).toISOString() : null,
    currentPeriodEnd: pr.current_period_end ? new Date(String(pr.current_period_end)).toISOString() : null,
  };
}

// Lightweight endpoint the client calls after login to decide whether to show
// the board or the subscribe wall.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const accessToken = String(body?.accessToken || "").trim();
    const refreshToken = String(body?.refreshToken || "").trim();

    // Try the fast path first (1 network call instead of 3)
    let billing = accessToken ? await fastBillingCheck(accessToken) : null;

    // Fall back to the full session resolution if fast path fails (expired JWT, etc.)
    if (!billing) {
      const { resolveSessionContext, getPracticeBilling } = await import("../_lib");
      const ctx = await resolveSessionContext({ accessToken, refreshToken });
      const full = await getPracticeBilling(ctx.practiceId);
      billing = {
        practiceId: full.practiceId,
        stripeCustomerId: full.stripeCustomerId,
        subscriptionStatus: full.subscriptionStatus,
        plan: full.plan,
        trialEndsAt: full.trialEndsAt,
        currentPeriodEnd: full.currentPeriodEnd,
      };
    }

    const access = computeAccess({
      practiceId: billing.practiceId,
      stripeCustomerId: billing.stripeCustomerId,
      stripeSubscriptionId: null,
      subscriptionStatus: billing.subscriptionStatus,
      plan: billing.plan,
      trialEndsAt: billing.trialEndsAt,
      currentPeriodEnd: billing.currentPeriodEnd,
    });

    return pulseJson({
      practiceId: billing.practiceId,
      status: billing.subscriptionStatus,
      plan: billing.plan,
      hasAccess: access.hasAccess,
      trialing: access.trialing,
      subscribed: access.subscribed,
      trialDaysLeft: access.trialDaysLeft,
      trialEndsAt: billing.trialEndsAt,
      currentPeriodEnd: billing.currentPeriodEnd,
      hasCustomer: !!billing.stripeCustomerId,
    });
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error || "Could not load billing status.");
    const status = /login required|expired|sign in/i.test(message) ? 401 : 400;
    return pulseError(message, status);
  }
}
