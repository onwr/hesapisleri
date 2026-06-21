import "server-only";

import type {
  ChargeSavedCardInput,
  CreateInitialPaymentInput,
  PaymentProviderAdapter,
} from "@/lib/payments/payment-types";
import {
  formatPaytrDecimalAmount,
  formatPaytrMinorAmount,
  parsePaytrMinorAmount,
} from "@/lib/payments/money";
import {
  assertPaytrDirectEnabled,
  getPaytrConfig,
  PAYTR_DIRECT_ACTION_URL,
  PAYTR_IFRAME_BASE_URL,
} from "./paytr-config";
import {
  createPaytrCardDeleteToken,
  createPaytrCardListToken,
  createPaytrDirectPaymentToken,
  createPaytrIframeToken,
  createPaytrRecurringToken,
  createPaytrRefundToken,
  createPaytrStatusQueryToken,
} from "./paytr-hash";
import { verifyPaytrCallback } from "./paytr-callback";
import { postPaytrForm } from "./paytr-client";

function encodeBasket(input: CreateInitialPaymentInput["basket"]) {
  const basket = input.map((item) => [
    item.name,
    formatPaytrDecimalAmount(item.amountMinor),
    item.quantity,
  ]);
  return Buffer.from(JSON.stringify(basket)).toString("base64");
}

export function createPaytrAdapter(): PaymentProviderAdapter {
  const config = getPaytrConfig();

  return {
    provider: "PAYTR",

    async createInitialPayment(input) {
      if (config.integrationMode === "iframe") {
        const userBasket = encodeBasket(input.basket);
        const paymentAmountMinor = formatPaytrMinorAmount(input.amountMinor);
        const testMode = input.testMode || config.testMode ? "1" : "0";
        const currency = input.currency === "TRY" ? "TL" : input.currency;
        const noInstallment = "1";
        const maxInstallment = "0";

        const paytrToken = createPaytrIframeToken(
          {
            userIp: input.payerIp,
            merchantOid: input.merchantOid,
            email: input.payerEmail,
            paymentAmountMinor,
            userBasket,
            noInstallment,
            maxInstallment,
            currency,
            testMode,
          },
          config
        );

        const response = await postPaytrForm("/odeme/api/get-token", {
          merchant_id: config.merchantId,
          user_ip: input.payerIp,
          merchant_oid: input.merchantOid,
          email: input.payerEmail,
          payment_amount: paymentAmountMinor,
          paytr_token: paytrToken,
          user_basket: userBasket,
          debug_on: config.testMode ? "1" : "0",
          no_installment: noInstallment,
          max_installment: maxInstallment,
          user_name: input.payerName,
          user_address: "-",
          user_phone: input.payerPhone ?? "0000000000",
          merchant_ok_url: input.okUrl,
          merchant_fail_url: input.failUrl,
          timeout_limit: "30",
          currency,
          test_mode: testMode,
          lang: "tr",
        });

        if (response.status !== "success" || !response.token) {
          throw new Error(
            String(response.reason ?? "PayTR iFrame token alınamadı.")
          );
        }

        const iframeToken = String(response.token);

        return {
          paymentId: "",
          merchantOid: input.merchantOid,
          mode: "iframe",
          iframeToken,
          iframeUrl: `${PAYTR_IFRAME_BASE_URL}/${iframeToken}`,
        };
      }

      assertPaytrDirectEnabled(config);

      const userBasket = encodeBasket(input.basket);
      const paymentAmount = formatPaytrDecimalAmount(input.amountMinor);
      const testMode = input.testMode || config.testMode ? "1" : "0";
      const non3d = "0";
      const installmentCount = "0";
      const paymentType = "card";
      const currency = input.currency === "TRY" ? "TL" : input.currency;

      const token = createPaytrDirectPaymentToken(
        {
          userIp: input.payerIp,
          merchantOid: input.merchantOid,
          email: input.payerEmail,
          paymentAmount,
          paymentType,
          installmentCount,
          currency,
          testMode,
          non3d,
        },
        config
      );

      const fields: Record<string, string> = {
        merchant_id: config.merchantId,
        user_ip: input.payerIp,
        merchant_oid: input.merchantOid,
        email: input.payerEmail,
        payment_type: paymentType,
        payment_amount: paymentAmount,
        installment_count: installmentCount,
        currency,
        paytr_token: token,
        user_basket: userBasket,
        debug_on: config.testMode ? "1" : "0",
        user_name: input.payerName,
        user_address: "-",
        user_phone: input.payerPhone ?? "0000000000",
        merchant_ok_url: input.okUrl,
        merchant_fail_url: input.failUrl,
        timeout_limit: "30",
        test_mode: testMode,
        non_3d: non3d,
        client_lang: "tr",
        card_type: "",
      };

      if (input.saveCard && config.cardStorageEnabled) {
        fields.store_card = "1";
        if (input.externalUserToken) fields.utoken = input.externalUserToken;
      }

      return {
        paymentId: "",
        merchantOid: input.merchantOid,
        mode: "direct",
        actionUrl: PAYTR_DIRECT_ACTION_URL,
        fields,
      };
    },

    verifyCallback({ payload }) {
      return verifyPaytrCallback(payload);
    },

    async chargeSavedCard(input) {
      if (!config.recurringEnabled || !config.non3dEnabled) {
        return {
          merchantOid: input.merchantOid,
          status: "failed",
          providerErrorCode: "PAYTR_RECURRING_NOT_ENABLED",
          providerErrorMessage: "PayTR recurring yetkisi bekleniyor.",
        };
      }

      const amount = formatPaytrDecimalAmount(input.amountMinor);
      const token = createPaytrRecurringToken({
        merchantOid: input.merchantOid,
        utoken: input.externalUserToken,
        ctoken: input.externalCardToken,
        amount,
      }, config);

      try {
        const response = await postPaytrForm("/odeme/api/recurring-payment", {
          merchant_id: config.merchantId,
          merchant_oid: input.merchantOid,
          email: input.payerEmail,
          payment_amount: amount,
          currency: input.currency === "TRY" ? "TL" : input.currency,
          utoken: input.externalUserToken,
          ctoken: input.externalCardToken,
          non_3d: "1",
          recurring_payment: "1",
          installment_count: "0",
          test_mode: input.testMode || config.testMode ? "1" : "0",
          paytr_token: token,
        });

        if (response.status === "success") {
          return { merchantOid: input.merchantOid, status: "wait_callback", providerStatus: "success" };
        }

        return {
          merchantOid: input.merchantOid,
          status: "failed",
          providerStatus: String(response.status ?? "failed"),
          providerErrorCode: String(response.failed_reason_code ?? ""),
          providerErrorMessage: String(response.failed_reason_msg ?? response.reason ?? ""),
        };
      } catch {
        return { merchantOid: input.merchantOid, status: "unknown", providerStatus: "timeout" };
      }
    },

    async queryPayment({ merchantOid }) {
      const response = await postPaytrForm("/odeme/durum-sorgu", {
        merchant_id: config.merchantId,
        merchant_oid: merchantOid,
        paytr_token: createPaytrStatusQueryToken(merchantOid, config),
      }, { retrySafe: true });

      const providerStatus = String(response.status ?? "UNKNOWN");
      const status = providerStatus === "success" ? "PAID" : providerStatus === "failed" ? "FAILED" : "UNKNOWN";

      return {
        merchantOid,
        status,
        providerStatus,
        amountMinor: response.total_amount ? parsePaytrMinorAmount(String(response.total_amount)) : undefined,
        currency: response.currency ? String(response.currency) : undefined,
        raw: response,
      };
    },

    async refundPayment({ merchantOid, referenceNo, amountMinor }) {
      const returnAmount = formatPaytrDecimalAmount(amountMinor);
      try {
        const response = await postPaytrForm("/odeme/iade", {
          merchant_id: config.merchantId,
          merchant_oid: merchantOid,
          return_amount: returnAmount,
          reference_no: referenceNo,
          paytr_token: createPaytrRefundToken({ merchantOid, returnAmount, referenceNo }, config),
        });

        return {
          referenceNo,
          status: response.status === "success" ? "succeeded" : "failed",
          providerStatus: String(response.status ?? "failed"),
          raw: response,
        };
      } catch {
        return { referenceNo, status: "unknown", providerStatus: "timeout" };
      }
    },

    async listPaymentMethods({ externalUserToken }) {
      const response = await postPaytrForm("/odeme/kart-saklama/list", {
        merchant_id: config.merchantId,
        utoken: externalUserToken,
        paytr_token: createPaytrCardListToken(externalUserToken, config),
      }, { retrySafe: true });

      const cards = Array.isArray(response.cards) ? response.cards : [];
      return cards
        .filter((card): card is Record<string, unknown> => Boolean(card))
        .map((card) => ({
          provider: "PAYTR" as const,
          externalUserToken,
          externalCardToken: String(card.ctoken ?? ""),
          maskedPan: card.masked_pan ? String(card.masked_pan) : undefined,
          lastFour: card.last_four ? String(card.last_four) : undefined,
          cardBrand: card.card_brand ? String(card.card_brand) : undefined,
          cardFamily: card.card_family ? String(card.card_family) : undefined,
          bankName: card.bank_name ? String(card.bank_name) : undefined,
        }))
        .filter((card) => card.externalCardToken);
    },

    async deletePaymentMethod({ externalUserToken, externalCardToken }) {
      await postPaytrForm("/odeme/kart-saklama/delete", {
        merchant_id: config.merchantId,
        utoken: externalUserToken,
        ctoken: externalCardToken,
        paytr_token: createPaytrCardDeleteToken({
          utoken: externalUserToken,
          ctoken: externalCardToken,
        }, config),
      });
    },
  };
}
