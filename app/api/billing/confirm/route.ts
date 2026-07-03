import type Stripe from "stripe";
import {
  getStripe,
  hasPaymentMethodForBilling,
  syncSubscriptionToPractice,
  updatePracticePaymentMethodFlag,
} from "../_stripe";
import { resolveSessionContext, computeAccess, getPracticeBilling, type PracticeBilling } from "../_lib";
import { optionsResponse, pulseJson, pulseError } from "../../pulse/_lib";

export async function OPTIONS() {
  return optionsResponse();
}

async function accessForBilling(billing: PracticeBilling) {
  const needsCardCheck =
    billing.subscriptionStatus === "trialing" &&
    !!billing.stripeCustomerId &&
    !!billing.stripeSubscriptionId;
  const hasPaymentMethod = needsCardCheck ? await hasPaymentMethodForBilling(billing) : false;
  if (needsCardCheck) {
    await updatePracticePaymentMethodFlag(
      billing.stripeCustomerId,
      billing.practiceId,
      hasPaymentMethod,
    );
  }
  return computeAccess({
    ...billing,
    hasPaymentMethod,
  });
}

// Called when the user returns from Stripe checkout with ?billing=success&session_id=...
// Retrieves the session directly from Stripe, syncs the subscription to the DB,
// and returns access status — bypassing webhook latency.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const sessionId = String(body?.sessionId || "").trim();
    if (!sessionId) return pulseError("Missing sessionId", 400);

    const ctx = await resolveSessionContext({
      accessToken: body?.accessToken,
      refreshToken: body?.refreshToken,
    });

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    if (session.status !== "complete") {
      const billing = await getPracticeBilling(ctx.practiceId);
      const access = await accessForBilling(billing);
      return pulseJson({
        hasAccess: access.hasAccess,
        trialing: access.trialing,
        subscribed: access.subscribed,
        trialDaysLeft: access.trialDaysLeft,
        hasCustomer: !!billing.stripeCustomerId,
        hasSubscription: !!billing.stripeSubscriptionId,
        hasPaymentMethod: access.hasPaymentMethod,
      });
    }

    const sub = session.subscription as Stripe.Subscription | null;
    if (sub && sub.id) {
      await syncSubscriptionToPractice(sub);
    }

    const billing = await getPracticeBilling(ctx.practiceId);
    const access = await accessForBilling(billing);
    return pulseJson({
      hasAccess: access.hasAccess,
      trialing: access.trialing,
      subscribed: access.subscribed,
      trialDaysLeft: access.trialDaysLeft,
      hasCustomer: !!billing.stripeCustomerId,
      hasSubscription: !!billing.stripeSubscriptionId,
      hasPaymentMethod: access.hasPaymentMethod,
    });
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error || "Confirm failed.");
    const status = /login required|expired|sign in/i.test(message) ? 401 : 400;
    return pulseError(message, status);
  }
}
