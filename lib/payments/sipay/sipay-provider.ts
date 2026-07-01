import type {
  CheckoutProvider,
  CreateCheckoutInput,
  CreateCheckoutResult,
  CheckStatusResult,
  VerifyReturnResult,
  VerifyWebhookResult,
  RefundInput,
  RefundResult,
} from "../checkout-provider";
import type { SipayPurchaseLinkResponse, SipayCheckStatusResponse, SipayRefundResponse } from "./sipay-types";
import { getSipayEnv, getSipayBaseUrl } from "./sipay-env";
import { sipayPost } from "./sipay-client";
import { getSipayToken, assertBrandedCheckoutSupported, handleSipayTokenUnauthorized } from "./sipay-token-service";
import {
  generateCheckStatusHash,
  generateRefundHash,
  validateReturnHash,
  assertValidWebhookHash,
} from "./sipay-hash";
import { buildSipayPurchaseLinkBody } from "./sipay-purchase-payload";
import {
  sipayPurchaseLinkSuccessSchema,
  sipayPurchaseLinkErrorSchema,
  sipayCheckStatusResponseSchema,
  sipayRefundResponseSchema,
  sipayWebhookPayloadSchema,
  sipayReturnParamsSchema,
} from "./sipay-schemas";
import { SIPAY_ALLOWED_BASE_URLS } from "./sipay-env";
import { SIPAY_ENDPOINTS } from "./sipay-endpoints";
import { SipayError, SipayNetworkError, SipayCheckstatusUnavailableError } from "./sipay-errors";

// Format number to 2-decimal string ("99.90"), never trust client total
function formatDecimal(amountMinor: number): string {
  return (amountMinor / 100).toFixed(2);
}

function assertCheckoutUrlAllowed(url: string): void {
  const allowed = SIPAY_ALLOWED_BASE_URLS.some((base) => url.startsWith(base));
  if (!allowed) {
    throw new SipayError(
      `Sipay döndürdüğü checkout URL allowlist dışında: ${url}`,
      "CHECKOUT_URL_NOT_ALLOWED",
    );
  }
}

// Map Sipay payment_status + status_code to CheckStatusResult.status
// status_code 69 = Pending (transaction not settled)
// payment_status: 1=paid, 0=not_paid, 2=refunded
function mapCheckStatusResult(
  statusCode: number,
  data: { payment_status: number; transaction_status?: string } | undefined,
): CheckStatusResult["status"] {
  if (statusCode === 69) return "NOT_PAID"; // Pending — treat as not yet paid
  if (!data) return "UNKNOWN";
  switch (data.payment_status) {
    case 1: return "PAID";
    case 2: return "REFUNDED";
    case 0: return "NOT_PAID";
    default: return "UNKNOWN";
  }
}

function createTokenRefreshOptions(
  env: ReturnType<typeof getSipayEnv>,
  baseUrl: string,
) {
  return {
    onUnauthorized: async () => {
      const refreshed = await handleSipayTokenUnauthorized({
        baseUrl,
        appId: env.SIPAY_APP_ID,
        appSecret: env.SIPAY_APP_SECRET,
        sipayEnv: env.SIPAY_ENV,
      });
      return refreshed?.token ?? "";
    },
  };
}

export function createSipayProvider(): CheckoutProvider {
  return {
    provider: "SIPAY",

    async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
      const env = getSipayEnv();
      const baseUrl = getSipayBaseUrl(env);

      const { token, is3d } = await getSipayToken({
        baseUrl,
        appId: env.SIPAY_APP_ID,
        appSecret: env.SIPAY_APP_SECRET,
        sipayEnv: env.SIPAY_ENV,
      });
      assertBrandedCheckoutSupported(is3d);

      const body = buildSipayPurchaseLinkBody({
        env,
        invoiceId: input.invoiceId,
        amountMinor: input.amountMinor,
        currency: input.currency,
        payerEmail: input.payerEmail,
        payerName: input.payerName,
        payerPhone: input.payerPhone,
        items: input.items,
        returnUrl: input.returnUrl,
        cancelUrl: input.cancelUrl,
      });

      const raw = await sipayPost<SipayPurchaseLinkResponse>(
        baseUrl,
        SIPAY_ENDPOINTS.PURCHASE_LINK,
        body as unknown as Record<string, unknown>,
        token,
        createTokenRefreshOptions(env, baseUrl),
      );

      const parsed = sipayPurchaseLinkSuccessSchema.safeParse(raw);
      if (parsed.success) {
        if (parsed.data.status_code !== 100) {
          throw new SipayError(
            `Sipay purchase/link failed: ${parsed.data.status_code} — ${parsed.data.success_message ?? "unknown"}`,
            "PURCHASE_FAILED",
          );
        }

        assertCheckoutUrlAllowed(parsed.data.link);

        return {
          invoiceId: input.invoiceId,
          checkoutUrl: parsed.data.link,
        };
      }

      const errorParsed = sipayPurchaseLinkErrorSchema.safeParse(raw);
      if (errorParsed.success) {
        const message =
          errorParsed.data.status_description ??
          errorParsed.data.success_message ??
          "unknown";
        throw new SipayError(
          `Sipay purchase/link failed: ${errorParsed.data.status_code} — ${message}`,
          "PURCHASE_FAILED",
        );
      }

      throw new SipayError(
        `Sipay purchase/link response invalid: ${parsed.error.message}`,
        "PURCHASE_RESPONSE_INVALID",
      );
    },

    async checkStatus(invoiceId: string): Promise<CheckStatusResult> {
      const env = getSipayEnv();
      const baseUrl = getSipayBaseUrl(env);

      const { token } = await getSipayToken({
        baseUrl,
        appId: env.SIPAY_APP_ID,
        appSecret: env.SIPAY_APP_SECRET,
        sipayEnv: env.SIPAY_ENV,
      });

      const hashKey = generateCheckStatusHash({
        invoiceId,
        merchantKey: env.SIPAY_MERCHANT_KEY,
        appSecret: env.SIPAY_APP_SECRET,
      });

      let raw: SipayCheckStatusResponse;
      try {
        raw = await sipayPost<SipayCheckStatusResponse>(
          baseUrl,
          SIPAY_ENDPOINTS.CHECKSTATUS,
          { invoice_id: invoiceId, merchant_key: env.SIPAY_MERCHANT_KEY, hashKey },
          token,
          createTokenRefreshOptions(env, baseUrl),
        );
      } catch (error) {
        if (error instanceof SipayNetworkError) {
          throw new SipayCheckstatusUnavailableError(error.message);
        }
        throw error;
      }

      const parsed = sipayCheckStatusResponseSchema.safeParse(raw);
      if (!parsed.success) {
        throw new SipayError(
          `Sipay checkstatus response invalid: ${parsed.error.message}`,
          "CHECKSTATUS_RESPONSE_INVALID",
        );
      }

      const res = parsed.data;

      // status_code 100 alone is NOT sufficient — must check transaction status too
      const status = mapCheckStatusResult(res.status_code, res.data);

      const d = res.data;
      const amountFromProvider = d?.transaction_amount ?? d?.product_price;

      return {
        invoiceId,
        status,
        amountMinor: amountFromProvider != null ? Math.round(amountFromProvider * 100) : undefined,
        currency: d?.currency,
        providerPaymentId: d?.transaction_id ?? d?.order_id ?? d?.order_no,
        providerErrorCode: status !== "PAID" ? (d?.error_code ?? String(res.status_code)) : undefined,
        providerErrorMessage: status !== "PAID" ? (d?.error_description ?? res.status_description) : undefined,
      };
    },

    verifyReturn(params: Record<string, string>): VerifyReturnResult {
      const env = getSipayEnv();
      const parsed = sipayReturnParamsSchema.safeParse(params);
      if (!parsed.success) {
        return { invoiceId: params.invoice_id ?? "", valid: false };
      }

      const { invoice_id, hash_key } = parsed.data;

      if (!hash_key) {
        // hash_key olmadan doğrulama yapılamaz — geçersiz say
        return { invoiceId: invoice_id, valid: false };
      }

      const valid = validateReturnHash({
        hashKey: hash_key,
        invoiceId: invoice_id,
        merchantKey: env.SIPAY_MERCHANT_KEY,
        appSecret: env.SIPAY_APP_SECRET,
      });

      return { invoiceId: invoice_id, valid, status: parsed.data.status };
    },

    verifyWebhook(payload: Record<string, string>): VerifyWebhookResult {
      const env = getSipayEnv();
      const parsed = sipayWebhookPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        throw new SipayError(
          `Sipay webhook payload invalid: ${parsed.error.message}`,
          "WEBHOOK_PAYLOAD_INVALID",
        );
      }

      const d = parsed.data;
      if (!env.SIPAY_SALE_WEBHOOK_KEY) {
        throw new SipayError(
          "Sipay webhook key yapılandırılmamış",
          "WEBHOOK_NOT_CONFIGURED",
        );
      }

      const orderNo = d.order_no ?? d.order_id ?? "";
      assertValidWebhookHash({
        hashKey: d.hash_key,
        invoiceId: d.invoice_id,
        orderNo,
        status: d.status,
        webhookKey: env.SIPAY_SALE_WEBHOOK_KEY,
      });

      const statusMap: Record<string, VerifyWebhookResult["status"]> = {
        "1": "PAID",
        "0": "FAILED",
        "2": "REFUNDED",
      };

      return {
        invoiceId: d.invoice_id,
        status: statusMap[d.status] ?? "FAILED",
        providerPaymentId: d.transaction_id,
      };
    },

    async refund(input: RefundInput): Promise<RefundResult> {
      const env = getSipayEnv();
      const baseUrl = getSipayBaseUrl(env);

      const { token } = await getSipayToken({
        baseUrl,
        appId: env.SIPAY_APP_ID,
        appSecret: env.SIPAY_APP_SECRET,
        sipayEnv: env.SIPAY_ENV,
      });

      const amount = formatDecimal(input.amountMinor);
      const hashKey = generateRefundHash({
        amount,
        invoiceId: input.invoiceId,
        merchantKey: env.SIPAY_MERCHANT_KEY,
        appSecret: env.SIPAY_APP_SECRET,
      });

      const raw = await sipayPost<SipayRefundResponse>(
        baseUrl,
        SIPAY_ENDPOINTS.REFUND,
        {
          invoice_id: input.invoiceId,
          amount,
          reference_no: input.referenceNo,
          hashKey,
        },
        token,
        createTokenRefreshOptions(env, baseUrl),
      );

      const parsed = sipayRefundResponseSchema.safeParse(raw);
      if (!parsed.success) {
        throw new SipayError(
          `Sipay refund response invalid: ${parsed.error.message}`,
          "REFUND_RESPONSE_INVALID",
        );
      }

      const res = parsed.data;
      if (res.status_code !== 100) {
        return {
          referenceNo: input.referenceNo,
          status: "FAILED",
          providerStatus: `${res.status_code}: ${res.status_description}`,
        };
      }

      return {
        referenceNo: res.data?.reference_no ?? input.referenceNo,
        status: "SUCCEEDED",
        providerStatus: res.status_description,
      };
    },
  };
}
