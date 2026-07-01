import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSipayPurchaseInvoice,
  buildSipayPurchaseLinkBody,
  serializeSipayPurchaseInvoice,
} from "./sipay-purchase-payload";

const ENV = {
  SIPAY_APP_ID: "test-app-id",
  SIPAY_APP_SECRET: "test_app_secret_32bytes_padding0",
  SIPAY_MERCHANT_KEY: "merchant_key_32bytes_padding_0000",
  SIPAY_SALE_WEBHOOK_KEY: "webhook_key_32bytes_padding_00000",
};

const BASE_INPUT = {
  env: ENV,
  invoiceId: "SI-PAYLOAD-001",
  amountMinor: 9990,
  currency: "TRY",
  payerEmail: "billing@example.com",
  payerName: "Test User",
  items: [{ name: "Pro Plan", priceMinor: 9990, quantity: 1 }],
  returnUrl: "https://hesapisleri.com/api/billing/sipay/return",
  cancelUrl: "https://hesapisleri.com/api/billing/sipay/cancel",
};

describe("sipay-purchase-payload", () => {
  it("top-level invoice JSON string ve merchant_key gönderir", () => {
    const body = buildSipayPurchaseLinkBody(BASE_INPUT);

    assert.equal(body.merchant_key, ENV.SIPAY_MERCHANT_KEY);
    assert.equal(body.currency_code, "TRY");
    assert.equal(body.name, "Test");
    assert.equal(body.surname, "User");
    assert.equal((body as { hashKey?: string }).hashKey, undefined);
    assert.equal((body as { body?: string }).body, undefined);
    assert.equal((body as { payload?: string }).payload, undefined);
    assert.equal(typeof body.invoice, "string");
    assert.equal((body as { invoice_id?: string }).invoice_id, undefined);

    const invoice = JSON.parse(body.invoice) as {
      invoice_id: string;
      total: string;
      discount: number;
      coupon: null;
      response_method: string;
      items: Array<{ quantity: number }>;
      bill_email: string;
      sale_web_hook_key: string;
    };

    assert.equal(invoice.invoice_id, "SI-PAYLOAD-001");
    assert.equal(invoice.total, "99.90");
    assert.equal(invoice.discount, 0);
    assert.equal(invoice.coupon, null);
    assert.equal(invoice.response_method, "POST");
    assert.equal(invoice.items[0].quantity, 1);
    assert.equal(invoice.bill_email, "billing@example.com");
    assert.equal(invoice.sale_web_hook_key, ENV.SIPAY_SALE_WEBHOOK_KEY);
    assert.ok(!JSON.stringify(body).includes("qnantity"));
  });

  it("serializeSipayPurchaseInvoice geçerli JSON üretir", () => {
    const invoice = buildSipayPurchaseInvoice(BASE_INPUT);
    const serialized = serializeSipayPurchaseInvoice(invoice);
    assert.equal(JSON.parse(serialized).invoice_id, "SI-PAYLOAD-001");
  });

  it("localhost http callback kabul edilir", () => {
    const body = buildSipayPurchaseLinkBody({
      ...BASE_INPUT,
      invoiceId: "SI-PAYLOAD-LOCAL",
      returnUrl: "http://localhost:3000/api/billing/sipay/return",
      cancelUrl: "http://localhost:3000/api/billing/sipay/cancel",
    });
    const invoice = JSON.parse(body.invoice) as {
      return_url: string;
      cancel_url: string;
    };
    assert.equal(invoice.return_url, "http://localhost:3000/api/billing/sipay/return");
    assert.equal(invoice.cancel_url, "http://localhost:3000/api/billing/sipay/cancel");
  });

  it("insecure http callback reddedilir", () => {
    assert.throws(
      () =>
        buildSipayPurchaseLinkBody({
          ...BASE_INPUT,
          invoiceId: "SI-PAYLOAD-002",
          returnUrl: "http://insecure.example/return",
        }),
      /localhost/,
    );
  });

  it("unsupported currency reddedilir", () => {
    assert.throws(
      () =>
        buildSipayPurchaseLinkBody({
          ...BASE_INPUT,
          invoiceId: "SI-PAYLOAD-003",
          currency: "USD",
        }),
      /Desteklenmeyen para birimi/,
    );
  });

  it("boş soyad güvenli fallback", () => {
    const body = buildSipayPurchaseLinkBody({
      ...BASE_INPUT,
      invoiceId: "SI-PAYLOAD-004",
      payerEmail: "invalid-email",
      payerName: "Tek",
    });

    assert.equal(body.name, "Tek");
    assert.equal(body.surname, "");
    const invoice = JSON.parse(body.invoice) as { bill_email?: string };
    assert.equal(invoice.bill_email, undefined);
  });

  it("sale_web_hook_key yalnız env doluysa invoice içinde", () => {
    const withKey = buildSipayPurchaseLinkBody({
      ...BASE_INPUT,
      invoiceId: "SI-PAYLOAD-005",
    });
    assert.ok(JSON.parse(withKey.invoice).sale_web_hook_key);

    const withoutKey = buildSipayPurchaseLinkBody({
      ...BASE_INPUT,
      env: { ...ENV, SIPAY_SALE_WEBHOOK_KEY: "" },
      invoiceId: "SI-PAYLOAD-006",
    });
    assert.equal(JSON.parse(withoutKey.invoice).sale_web_hook_key, undefined);
  });

  it("item toplamı payment total ile eşleşmezse hata", () => {
    assert.throws(
      () =>
        buildSipayPurchaseLinkBody({
          ...BASE_INPUT,
          invoiceId: "SI-PAYLOAD-007",
          items: [{ name: "Plan", priceMinor: 5000, quantity: 1 }],
        }),
      /eşleşmiyor/,
    );
  });
});
