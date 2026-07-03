import Stripe from "stripe";
import {
  getPracticeBilling,
  getServiceClient,
  planForPriceId,
  type PracticeBilling,
  requireEnv,
} from "./_lib";

let stripeClient: Stripe | null = null;

export function getStripe() {
  if (!stripeClient) {
    // apiVersion intentionally omitted so the SDK's pinned default is used.
    stripeClient = new Stripe(requireEnv("STRIPE_SECRET_KEY"));
  }
  return stripeClient;
}

export function getWebhookSecret() {
  return requireEnv("STRIPE_WEBHOOK_SECRET");
}

function expandableId(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (value && typeof value === "object" && "id" in value) {
    return String((value as { id?: unknown }).id || "").trim() || null;
  }
  return null;
}

function hasDefaultPaymentMethod(record: unknown): boolean {
  const source = record as {
    default_payment_method?: unknown;
    default_source?: unknown;
    invoice_settings?: { default_payment_method?: unknown } | null;
  } | null;
  if (!source) return false;
  return !!(
    expandableId(source.default_payment_method) ||
    expandableId(source.default_source) ||
    expandableId(source.invoice_settings?.default_payment_method)
  );
}

function isMissingPaymentMethodColumn(message: string) {
  return /has_payment_method|schema cache|column/i.test(message);
}

export async function hasPaymentMethodForBilling(
  billing: Pick<PracticeBilling, "stripeCustomerId" | "stripeSubscriptionId" | "hasPaymentMethod">,
): Promise<boolean> {
  if (!billing.stripeCustomerId) return false;

  const stripe = getStripe();
  try {
    const customer = await stripe.customers.retrieve(billing.stripeCustomerId);
    if ("deleted" in customer && customer.deleted) return false;
    if (hasDefaultPaymentMethod(customer)) return true;
  } catch {
    return false;
  }

  if (billing.stripeSubscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(billing.stripeSubscriptionId);
      if (hasDefaultPaymentMethod(subscription)) return true;
    } catch {
      return false;
    }
  }

  try {
    const methods = await stripe.paymentMethods.list({
      customer: billing.stripeCustomerId,
      type: "card",
      limit: 1,
    });
    return methods.data.length > 0;
  } catch {
    return false;
  }
}

export async function updatePracticePaymentMethodFlag(
  customerId: string | null | undefined,
  practiceId: string | null | undefined,
  hasPaymentMethod: boolean,
) {
  const service = getServiceClient();
  const payload = { has_payment_method: hasPaymentMethod };
  const patch = (tbl: ReturnType<typeof service.from>) =>
    (tbl.update as (v: Record<string, unknown>) => typeof tbl)(payload);

  if (customerId) {
    const byCustomer = await patch(service.from("practices")).eq("stripe_customer_id", customerId).select("id");
    if (byCustomer.error && !isMissingPaymentMethodColumn(byCustomer.error.message)) {
      throw new Error(byCustomer.error.message);
    }
    if (!byCustomer.error && Array.isArray(byCustomer.data) && byCustomer.data.length > 0) return;
  }

  if (practiceId) {
    const byPractice = await patch(service.from("practices")).eq("id", practiceId);
    if (byPractice.error && !isMissingPaymentMethodColumn(byPractice.error.message)) {
      throw new Error(byPractice.error.message);
    }
  }
}

// Ensure the practice has a Stripe customer; create + persist if missing.
export async function ensureStripeCustomer(practiceId: string, email: string): Promise<string> {
  const billing = await getPracticeBilling(practiceId);
  if (billing.stripeCustomerId) return billing.stripeCustomerId;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: email || undefined,
    metadata: { practice_id: practiceId },
  });

  const service = getServiceClient();
  // Cast to bypass untyped-client `never` inference on new billing columns.
  const tbl = service.from("practices") as ReturnType<typeof service.from>;
  const res = await (tbl.update as (v: Record<string, unknown>) => typeof tbl)(
    { stripe_customer_id: customer.id },
  ).eq("id", practiceId);
  if (res.error) throw new Error(res.error.message);
  return customer.id;
}

// Write the latest subscription state from Stripe back onto the practice.
export async function syncSubscriptionToPractice(subscription: Stripe.Subscription) {
  const service = getServiceClient();
  const priceId = subscription.items?.data?.[0]?.price?.id || null;
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  const periodEndUnix = (subscription as unknown as { current_period_end?: number }).current_period_end;
  const trialEndUnix = (subscription as unknown as { trial_end?: number | null }).trial_end;
  const update: Record<string, unknown> = {
    stripe_subscription_id: subscription.id,
    subscription_status: subscription.status,
    plan: planForPriceId(priceId),
    current_period_end: periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null,
    // Keep the practice's trial_ends_at aligned with Stripe so the in-app trial
    // countdown and charge-date warning match what Stripe will actually do.
    trial_ends_at: trialEndUnix ? new Date(trialEndUnix * 1000).toISOString() : null,
  };

  // Prefer matching by customer id; fall back to the practice_id we stamp
  // into customer/subscription metadata at checkout time.
  const fallbackPracticeId = String(subscription.metadata?.practice_id || "").trim();

  const patch = (tbl: ReturnType<typeof service.from>, payload: Record<string, unknown>) =>
    (tbl.update as (v: Record<string, unknown>) => typeof tbl)(payload);

  let matchedByCustomer = false;
  let matchedPracticeId = fallbackPracticeId;

  if (customerId) {
    const byCustomer = await patch(service.from("practices"), update)
      .eq("stripe_customer_id", customerId)
      .select("id");
    if (byCustomer.error) throw new Error(byCustomer.error.message);
    if (Array.isArray(byCustomer.data) && byCustomer.data.length > 0) {
      matchedByCustomer = true;
      matchedPracticeId = String((byCustomer.data[0] as Record<string, unknown>).id || fallbackPracticeId);
    }
  }
  if (!matchedByCustomer && fallbackPracticeId) {
    const byId = await patch(service.from("practices"), {
      ...update,
      stripe_customer_id: customerId || undefined,
    }).eq("id", fallbackPracticeId);
    if (byId.error) throw new Error(byId.error.message);
  }

  const hasPaymentMethod = await hasPaymentMethodForBilling({
    stripeCustomerId: customerId || null,
    stripeSubscriptionId: subscription.id,
  });
  await updatePracticePaymentMethodFlag(customerId, matchedPracticeId || fallbackPracticeId, hasPaymentMethod);
}
