import { resolveSessionContext } from "../_lib";
import { ensureStripeCustomer, getStripe } from "../_stripe";
import { optionsResponse, pulseJson, pulseError } from "../../pulse/_lib";

export async function OPTIONS() {
  return optionsResponse();
}

// Opens the Stripe Customer Portal so an admin can update card, change plan,
// view invoices, or cancel.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const ctx = await resolveSessionContext({
      accessToken: body?.accessToken,
      refreshToken: body?.refreshToken,
    });

    const customerId = await ensureStripeCustomer(ctx.practiceId, ctx.email);
    const returnUrl = String(body?.returnUrl || "").trim() || new URL(request.url).origin;

    const stripe = getStripe();
    const portalParams: Parameters<typeof stripe.billingPortal.sessions.create>[0] = {
      customer: customerId,
      return_url: returnUrl.replace(/\/+$/, ""),
    };
    const flow = String(body?.flow || "").trim();
    if (flow === "payment_method_update") {
      portalParams.flow_data = { type: "payment_method_update" };
    }
    const portal = await stripe.billingPortal.sessions.create(portalParams);

    return pulseJson({ url: portal.url });
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error || "Could not open the billing portal.");
    const status = /login required|expired|sign in/i.test(message) ? 401 : 400;
    return pulseError(message, status);
  }
}
