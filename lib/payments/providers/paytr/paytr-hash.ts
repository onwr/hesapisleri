import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getPaytrConfig, type PaytrConfig } from "./paytr-config";

function hmacBase64(payload: string, merchantKey: string) {
  return createHmac("sha256", merchantKey).update(payload).digest("base64");
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function createPaytrIframeToken(
  input: {
    userIp: string;
    merchantOid: string;
    email: string;
    paymentAmountMinor: string;
    userBasket: string;
    noInstallment: string;
    maxInstallment: string;
    currency: string;
    testMode: string;
  },
  config: PaytrConfig = getPaytrConfig()
) {
  const payload = [
    config.merchantId,
    input.userIp,
    input.merchantOid,
    input.email,
    input.paymentAmountMinor,
    input.userBasket,
    input.noInstallment,
    input.maxInstallment,
    input.currency,
    input.testMode,
    config.merchantSalt,
  ].join("");

  return hmacBase64(payload, config.merchantKey);
}

export function createPaytrDirectPaymentToken(
  input: {
    userIp: string;
    merchantOid: string;
    email: string;
    paymentAmount: string;
    paymentType: string;
    installmentCount: string;
    currency: string;
    testMode: string;
    non3d: string;
  },
  config: PaytrConfig = getPaytrConfig()
) {
  const payload = [
    config.merchantId,
    input.userIp,
    input.merchantOid,
    input.email,
    input.paymentAmount,
    input.paymentType,
    input.installmentCount,
    input.currency,
    input.testMode,
    input.non3d,
    config.merchantSalt,
  ].join("");

  return hmacBase64(payload, config.merchantKey);
}

export function createPaytrCallbackHash(
  input: { merchantOid: string; status: string; totalAmount: string },
  config: PaytrConfig = getPaytrConfig()
) {
  return hmacBase64(
    `${input.merchantOid}${config.merchantSalt}${input.status}${input.totalAmount}`,
    config.merchantKey
  );
}

export function verifyPaytrCallbackHash(
  input: {
    merchantOid: string;
    status: string;
    totalAmount: string;
    hash: string;
  },
  config: PaytrConfig = getPaytrConfig()
) {
  const expected = createPaytrCallbackHash(input, config);
  return safeCompare(expected, input.hash);
}

export function createPaytrRecurringToken(
  input: { merchantOid: string; utoken: string; ctoken: string; amount: string },
  config: PaytrConfig = getPaytrConfig()
) {
  return hmacBase64(
    `${config.merchantId}${input.merchantOid}${input.utoken}${input.ctoken}${input.amount}${config.merchantSalt}`,
    config.merchantKey
  );
}

export function createPaytrStatusQueryToken(
  merchantOid: string,
  config: PaytrConfig = getPaytrConfig()
) {
  return hmacBase64(
    `${config.merchantId}${merchantOid}${config.merchantSalt}`,
    config.merchantKey
  );
}

export function createPaytrRefundToken(
  input: { merchantOid: string; returnAmount: string; referenceNo: string },
  config: PaytrConfig = getPaytrConfig()
) {
  return hmacBase64(
    `${config.merchantId}${input.merchantOid}${input.returnAmount}${input.referenceNo}${config.merchantSalt}`,
    config.merchantKey
  );
}

export function createPaytrCardListToken(
  utoken: string,
  config: PaytrConfig = getPaytrConfig()
) {
  return hmacBase64(
    `${config.merchantId}${utoken}${config.merchantSalt}`,
    config.merchantKey
  );
}

export function createPaytrCardDeleteToken(
  input: { utoken: string; ctoken: string },
  config: PaytrConfig = getPaytrConfig()
) {
  return hmacBase64(
    `${config.merchantId}${input.utoken}${input.ctoken}${config.merchantSalt}`,
    config.merchantKey
  );
}
