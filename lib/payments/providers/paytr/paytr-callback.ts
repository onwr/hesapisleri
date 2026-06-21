import "server-only";

import { parsePaytrMinorAmount } from "@/lib/payments/money";
import type { VerifiedPaymentCallback } from "@/lib/payments/payment-types";
import { verifyPaytrCallbackHash } from "./paytr-hash";
import type { PaytrRawCallbackPayload } from "./paytr-types";

function required(payload: PaytrRawCallbackPayload, key: string) {
  const value = payload[key];
  if (!value) throw new Error(`PayTR callback alanı eksik: ${key}`);
  return value;
}

export function verifyPaytrCallback(
  payload: PaytrRawCallbackPayload
): VerifiedPaymentCallback {
  const merchantOid = required(payload, "merchant_oid");
  const status = required(payload, "status");
  const totalAmount = required(payload, "total_amount");
  const hash = required(payload, "hash");

  const signatureValid = verifyPaytrCallbackHash({
    merchantOid,
    status,
    totalAmount,
    hash,
  });

  if (!signatureValid) {
    throw new Error("PayTR callback imzası geçersiz.");
  }

  return {
    merchantOid,
    status: status === "success" ? "success" : "failed",
    totalAmountMinor: parsePaytrMinorAmount(totalAmount),
    currency: (payload.currency ?? "TL") === "TL" ? "TRY" : payload.currency ?? "TRY",
    providerStatus: status,
    failedReasonCode: payload.failed_reason_code,
    failedReasonMessage: payload.failed_reason_msg,
    providerPaymentId: payload.payment_id,
    testMode: payload.test_mode === "1",
    externalUserToken: payload.utoken,
    externalCardToken: payload.ctoken,
    cardMetadata: {
      maskedPan: payload.masked_pan,
      lastFour: payload.last_four,
      cardBrand: payload.card_brand,
      cardFamily: payload.card_family,
      bankName: payload.bank_name,
    },
    rawPayload: payload,
  };
}

export function buildPaytrWebhookEventKey(payload: PaytrRawCallbackPayload) {
  return [
    payload.merchant_oid ?? "unknown",
    payload.status ?? "unknown",
    payload.total_amount ?? "0",
    payload.hash ?? "nohash",
  ].join(":");
}
