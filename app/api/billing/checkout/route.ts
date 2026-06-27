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

    const rawPlan = String(body?.plan || "monthly");
    const priceId = priceIdForPlan(rawPlan);
    const customerId = await ensureStripeCustomer(ctx.practiceId, ctx.email);
    const billing = await getPracticeBilling(ctx.practiceId);

    // Card-up-front trial. The first time a practice subscribes we grant a fresh
    // 14-day trial run by Stripe (trial_period_days). A card is still collected
    // at Checkout (payment_method_collection "always"), Stripe holds it through
    // the trial, then auto-charges the chosen plan when the trial ends. Practices
    // that have subscribed before (cancelled and resubscribing) do not get a
    // second free trial, but we still carry any remaining trial days so an early
    // upgrade doesn't charge before the trial would have ended.
    const isFirstSubscription = !billing.stripeSubscriptionId;
    const trialEndMs = billing.trialEndsAt ? Date.parse(billing.trialEndsAt) : 0;
    const trialEndUnix = Math.floor(trialEndMs / 1000);
    const nowUnix = Math.floor(Date.now() / 1000);
    const hasRemainingTrial =
      billing.subscriptionStatus === "trialing" && trialEndUnix > nowUnix + 60;

    const origin = originFromRequest(request, body?.returnUrl);
    const appBase = `${origin}/app/index.html?mode=startup`;

    const stripe = getStripe();

    // Founding offer: the first N clinics on Advanced monthly lock in a reduced
    // rate for life. Gated behind STRIPE_COUPON_FOUNDING — when that env var is
    // unset this block is a no-op and checkout behaves exactly as before. Stripe
    // owns both the cap (coupon max_redemptions) and the lifetime lock (coupon
    // duration=forever), so we never count founders ourselves. Monthly-only by
    // design. Note: discounts and allow_promotion_codes are mutually exclusive
    // on a Checkout Session, so a founding checkout can't also enter a promo code.
    const normalizedPlan = rawPlan.toLowerCase().replace(/\s+/g, "-");
    const isAdvancedMonthly =
      normalizedPlan === "advanced-monthly" || normalizedPlan === "advanced";
    const foundingCouponId = process.env.STRIPE_COUPON_FOUNDING;
    let founderDiscount: Array<{ coupon: string }> | null = null;
    if (foundingCouponId && isAdvancedMonthly) {
      try {
        const coupon = await stripe.coupons.retrieve(foundingCouponId);
        const max = coupon.max_redemptions ?? Number.POSITIVE_INFINITY;
        if (coupon.valid && (coupon.times_redeemed ?? 0) < max) {
          founderDiscount = [{ coupon: foundingCouponId }];
        }
      } catch {
        // Unreadable/exhausted coupon → fall back to normal pricing.
      }
    }

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      ...(founderDiscount
        ? { discounts: founderDiscount }
        : { allow_promotion_codes: true }),
      // Require a payment method even though the trial is free, so the card is on
      // file before the trial starts and the auto-charge can succeed.
      payment_method_collection: "always",
      subscription_data: {
        metadata: {
          practice_id: ctx.practiceId,
          ...(founderDiscount ? { founding_member: "true" } : {}),
        },
        // First-ever subscription → fresh Stripe-run 14-day trial. Otherwise carry
        // any remaining trial days from a prior trial; if none remain, no trial.
        ...(isFirstSubscription
          ? {
              trial_period_days: TRIAL_DAYS,
              trial_settings: {
                end_behavior: { missing_payment_method: "cancel" },
              },
            }
          : hasRemainingTrial
            ? { trial_end: trialEndUnix }
            : {}),
      },
      success_url: `${appBase}&billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBase}&billing=cancel`,
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
  if (candidate) {
    try { return new URL(candidate).origin; } catch {}
  }
  try { return new URL(request.url).origin; } catch {}
  return "https://theroomboard.com";
}
