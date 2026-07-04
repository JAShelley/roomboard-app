import { verify as verifySignature, X509Certificate } from "node:crypto";
import { computeAccess, getPracticeBilling, getServiceClient, resolveSessionContext } from "../../_lib";
import { optionsResponse, pulseError, pulseJson } from "../../../pulse/_lib";

export const runtime = "nodejs";

const allowedProductIds = new Set([
  "Base_monthly_v2",
  "Base_Annual",
  "Advanced_monthly",
  "Advanced_annual",
]);

type AppleTransactionPayload = {
  transactionId?: string | number;
  originalTransactionId?: string | number;
  webOrderLineItemId?: string | number;
  bundleId?: string;
  productId?: string;
  environment?: string;
  storefront?: string;
  type?: string;
  inAppOwnershipType?: string;
  offerType?: string | number;
  offerIdentifier?: string;
  appAccountToken?: string;
  purchaseDate?: string | number;
  expiresDate?: string | number;
  revocationDate?: string | number;
  revocationReason?: string | number;
};

type JwsHeader = {
  alg?: string;
  x5c?: string[];
};

export async function OPTIONS() {
  return optionsResponse();
}

function base64UrlToBuffer(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64");
}

function decodeBase64UrlJson<T>(value: string): T {
  return JSON.parse(base64UrlToBuffer(value).toString("utf8")) as T;
}

function assertAppleCertificateChain(x5c: string[]) {
  if (!Array.isArray(x5c) || x5c.length < 2) {
    throw new Error("Apple transaction is missing its certificate chain.");
  }

  const certificates = x5c.map((cert) => new X509Certificate(Buffer.from(cert, "base64")));
  for (let index = 0; index < certificates.length - 1; index += 1) {
    const child = certificates[index];
    const issuer = certificates[index + 1];
    if (!child.verify(issuer.publicKey)) {
      throw new Error("Apple transaction certificate chain is invalid.");
    }
  }

  const now = Date.now();
  for (const certificate of certificates) {
    if (Date.parse(certificate.validFrom) > now || Date.parse(certificate.validTo) < now) {
      throw new Error("Apple transaction certificate is expired or not yet valid.");
    }
  }

  const chainText = certificates.map((certificate) => `${certificate.subject}\n${certificate.issuer}`).join("\n");
  if (!/Apple/i.test(chainText)) {
    throw new Error("Apple transaction certificate chain is not recognized.");
  }

  return certificates[0];
}

function decodeVerifiedTransactionJws(jws: string): AppleTransactionPayload {
  const parts = String(jws || "").split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) {
    throw new Error("Apple transaction is not a valid signed payload.");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeBase64UrlJson<JwsHeader>(encodedHeader);
  if (header.alg !== "ES256") {
    throw new Error("Apple transaction uses an unsupported signature algorithm.");
  }

  const leafCertificate = assertAppleCertificateChain(header.x5c || []);
  const isValid = verifySignature(
    "sha256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    { key: leafCertificate.publicKey, dsaEncoding: "ieee-p1363" },
    base64UrlToBuffer(encodedSignature),
  );
  if (!isValid) {
    throw new Error("Apple transaction signature could not be verified.");
  }

  return decodeBase64UrlJson<AppleTransactionPayload>(encodedPayload);
}

function isoFromAppleDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  const date = Number.isFinite(numeric) ? new Date(numeric) : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function stringOrNull(value: unknown) {
  const stringValue = String(value ?? "").trim();
  return stringValue || null;
}

function appStoreStatus(payload: AppleTransactionPayload, expiresAt: string | null, revocationDate: string | null) {
  if (revocationDate) return "revoked";
  if (!expiresAt) return "unknown";
  return Date.parse(expiresAt) > Date.now() ? "active" : "expired";
}

function planForProductId(productId: string) {
  const normalized = productId.toLowerCase();
  const tier = normalized.includes("advanced") ? "advanced" : "base";
  const period = normalized.includes("annual") ? "annual" : "monthly";
  return `${tier}-${period}`;
}

function assertBundleId(payload: AppleTransactionPayload) {
  const expectedBundleId = process.env.APP_STORE_BUNDLE_ID || "com.roomboard.mobile";
  if (payload.bundleId && payload.bundleId !== expectedBundleId) {
    throw new Error("Apple transaction belongs to a different app.");
  }
}

function buildBillingResponse(billing: Awaited<ReturnType<typeof getPracticeBilling>>) {
  const access = computeAccess(billing);
  return {
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
    appStoreProductId: billing.appStoreProductId,
    appStoreStatus: billing.appStoreStatus,
    appStoreExpiresAt: billing.appStoreExpiresAt,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const signedTransactionJws = String(body?.signedTransactionJWS || body?.signedTransactionJws || "").trim();
    const requestedProductId = stringOrNull(body?.productId);
    if (!signedTransactionJws) throw new Error("Missing Apple transaction.");

    const ctx = await resolveSessionContext({
      accessToken: String(body?.accessToken || "").trim(),
      refreshToken: String(body?.refreshToken || "").trim(),
    });

    const payload = decodeVerifiedTransactionJws(signedTransactionJws);
    assertBundleId(payload);

    const productId = stringOrNull(payload.productId);
    if (!productId || !allowedProductIds.has(productId)) {
      throw new Error("Apple transaction product is not a RoomBoard subscription.");
    }
    if (requestedProductId && requestedProductId !== productId) {
      throw new Error("Apple transaction product does not match the selected plan.");
    }

    const transactionId = stringOrNull(payload.transactionId);
    const originalTransactionId = stringOrNull(payload.originalTransactionId);
    if (!transactionId || !originalTransactionId) {
      throw new Error("Apple transaction is missing required identifiers.");
    }

    const appAccountToken = stringOrNull(payload.appAccountToken);
    if (appAccountToken && appAccountToken.toLowerCase() !== ctx.userId.toLowerCase()) {
      throw new Error("Apple transaction belongs to a different RoomBoard user.");
    }

    const purchaseDate = isoFromAppleDate(payload.purchaseDate);
    const expiresAt = isoFromAppleDate(payload.expiresDate);
    const revocationDate = isoFromAppleDate(payload.revocationDate);
    const status = appStoreStatus(payload, expiresAt, revocationDate);
    if (status !== "active") {
      throw new Error("Apple subscription is not active yet.");
    }

    const service = getServiceClient() as any;
    const subscriptionPayload = {
      practice_id: ctx.practiceId,
      user_id: ctx.userId,
      app_account_token: appAccountToken,
      original_transaction_id: originalTransactionId,
      latest_transaction_id: transactionId,
      web_order_line_item_id: stringOrNull(payload.webOrderLineItemId),
      product_id: productId,
      environment: stringOrNull(payload.environment) || "Production",
      storefront: stringOrNull(payload.storefront),
      status,
      expires_at: expiresAt,
      revocation_date: revocationDate,
      auto_renew_status: null,
      signed_transaction_jws: signedTransactionJws,
      raw_transaction: payload,
      raw_status: { source: "ios_storekit_confirm" },
    };

    const subscriptionRes = await service
      .from("app_store_subscriptions")
      .upsert(subscriptionPayload, { onConflict: "original_transaction_id" })
      .select("id")
      .maybeSingle();
    if (subscriptionRes.error) throw new Error(subscriptionRes.error.message);

    const transactionRes = await service
      .from("app_store_transactions")
      .upsert({
        subscription_id: (subscriptionRes.data as { id?: string } | null)?.id || null,
        practice_id: ctx.practiceId,
        user_id: ctx.userId,
        app_account_token: appAccountToken,
        transaction_id: transactionId,
        original_transaction_id: originalTransactionId,
        web_order_line_item_id: stringOrNull(payload.webOrderLineItemId),
        product_id: productId,
        environment: stringOrNull(payload.environment) || "Production",
        transaction_type: stringOrNull(payload.type),
        in_app_ownership_type: stringOrNull(payload.inAppOwnershipType),
        offer_type: stringOrNull(payload.offerType),
        offer_identifier: stringOrNull(payload.offerIdentifier),
        purchase_date: purchaseDate,
        expires_at: expiresAt,
        revocation_date: revocationDate,
        revocation_reason: stringOrNull(payload.revocationReason),
        signed_transaction_jws: signedTransactionJws,
        raw_payload: payload,
      }, { onConflict: "transaction_id" });
    if (transactionRes.error) throw new Error(transactionRes.error.message);

    const practiceRes = await service
      .from("practices")
      .update({ plan: planForProductId(productId), current_period_end: expiresAt })
      .eq("id", ctx.practiceId);
    if (practiceRes.error) throw new Error(practiceRes.error.message);

    const billing = await getPracticeBilling(ctx.practiceId);
    return pulseJson(buildBillingResponse(billing));
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error || "Could not confirm Apple subscription.");
    const status = /login required|expired|sign in/i.test(message) ? 401 : 400;
    return pulseError(message, status);
  }
}
