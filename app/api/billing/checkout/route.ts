import {
  priceIdForPlan,
  resolveSessionContext,
  getPracticeBilling,
  TRIAL_DAYS,
} from "../_lib";
import { ensureStripeCustomer, getStripe } from "../_stripe";
import { optionsResponse, pulseJson, pulseError } from "../../pulse/_lib";

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const ctx = await resolveSessionContext({
      accessToken: body?.accessToken,
      refreshToken: body?.refreshToken,
    });

    const priceId = priceIdForPlan(String(body?.plan || "monthly"));
    const customerId = await ensureStripeCustomer(ctx.practiceId, ctx.email);
    const billing = await getPracticeBilling(ctx.practiceId);

    // Card-up-front trial: the first time a practice subscribes we grant a fresh
    // 14-day trial. A card is still collected at Checkout (payment_method_collection
    // "always"), Stripe holds it through the trial, then auto-charges the chosen
    // plan when the trial ends. Practices that have subscribed before (e.g. they
    // cancelled and are resubscribing) do not get a second free trial.
    const isFirstSubscription = !billing.stripeSubscriptionId;

    const origin = originFromRequest(request, body?.returnUrl);

    const stripe = getStripe();
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      // Require a payment method even though the trial is free, so the card is on
      // file before the trial starts and the auto-charge can succeed.
      payment_method_collection: "always",
      subscription_data: {
        metadata: { practice_id: ctx.practiceId },
        ...(isFirstSubscription
          ? {
              trial_period_days: TRIAL_DAYS,
              trial_settings: {
                end_behavior: { missing_payment_method: "cancel" },
              },
            }
          : {}),
      },
      success_url: `${origin}?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}?billing=cancel`,
    });

    return pulseJson({ url: checkout.url });
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error || "Could not start checkout.");
    const status = /login required|expired|sign in/i.test(message) ? 401 : 400;
    return pulseError(message, status);
  }
}

function originFromRequest(request: Request, returnUrl?: string): string {
  const candidate = String(returnUrl || "").trim();
  if (candidate) return candidate.replace(/\/+$/, "");
  try {
    return new URL(request.url).origin;
  } catch {
    return "https://app.roomboard.local";
  }
}
