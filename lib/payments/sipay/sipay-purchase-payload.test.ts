import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSipayPurchaseInvoice,
  buildSipayPurchaseLinkBody,
  resolveSipayItemDescription,
  serializeSipayPurchaseInvoice,
} from "./sipay-purchase-payload";

const ENV = {
  SIPAY_APP_ID: "test-app-id",
  SIPAY_APP_SECRET: "test_app_secret_32bytes_padding0",
  SIPAY_MERCHANT_KEY: "merchant_key_32bytes_padding_0000",
  SIPAY_MERCHANT_ID: "mid-001",
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

function parseInvoice(body: { invoice: string }) {
  return JSON.parse(body.invoice) as {
    total: string;
    items: Array<{
      name: string;
      description: string;
      price: string;
      quantity: number;
      type: "DIGITAL" | "PHYSICAL";
    }>;
    bill_email?: string;
    sale_web_hook_key?: string;
    return_url?: string;
    cancel_url?: string;
    invoice_id?: string;
    discount?: number;
    coupon?: null;
    response_method?: string;
  };
}

describe("sipay-purchase-payload", () => {
  it("top-level invoice JSON string ve merchant_key gönderir", () => {
    const body = buildSipayPurchaseLinkBody(BASE_INPUT);

    assert.equal(body.merchant_key, ENV.SIPAY_MERCHANT_KEY);
    assert.equal((body as { merchant_id?: string }).merchant_id, undefined);
    assert.equal(body.currency_code, "TRY");
    assert.equal(body.name, "Test");
    assert.equal(body.surname, "User");
    assert.equal((body as { hashKey?: string }).hashKey, undefined);
    assert.equal(typeof body.invoice, "string");

    const invoice = parseInvoice(body);

    assert.equal(invoice.items[0].quantity, 1);
    assert.equal(invoice.items[0].type, "DIGITAL");
    assert.equal(invoice.total, "99.90");
    assert.equal(invoice.bill_email, "billing@example.com");
    assert.equal(invoice.sale_web_hook_key, ENV.SIPAY_SALE_WEBHOOK_KEY);
    assert.ok(!JSON.stringify(body).includes("qnantity"));
  });

  it("invoice.items[0].description var", () => {
    const body = buildSipayPurchaseLinkBody(BASE_INPUT);
    const invoice = parseInvoice(body);
    assert.equal(typeof invoice.items[0].description, "string");
    assert.ok(invoice.items[0].description.length > 0);
  });

  it("tüm invoice item'larında description var", () => {
    const body = buildSipayPurchaseLinkBody({
      ...BASE_INPUT,
      amountMinor: 19980,
      items: [
        { name: "Plan A", priceMinor: 9990, quantity: 1, description: "Açıklama A" },
        { name: "Plan B", priceMinor: 9990, quantity: 1, description: "Açıklama B" },
      ],
    });
    const invoice = parseInvoice(body);
    assert.equal(invoice.items.length, 2);
    for (const item of invoice.items) {
      assert.ok(item.description);
    }
  });

  it("boş description fallback kullanıyor", () => {
    const description = resolveSipayItemDescription({
      name: "   ",
      priceMinor: 100,
      quantity: 1,
      description: "  ",
      productName: "",
    });
    assert.equal(description, "Hesap İşleri üyelik paketi");

    const body = buildSipayPurchaseLinkBody({
      ...BASE_INPUT,
      items: [{ name: "STANDART", priceMinor: 9990, quantity: 1 }],
    });
    assert.equal(parseInvoice(body).items[0].description, "STANDART");
  });

  it("plan adı ve dönem etiketi description içinde", () => {
    const body = buildSipayPurchaseLinkBody({
      ...BASE_INPUT,
      items: [
        {
          name: "STANDART",
          description: "STANDART - Aylık üyelik ödemesi",
          priceMinor: 9990,
          quantity: 1,
        },
      ],
    });
    const invoice = parseInvoice(body);
    assert.match(invoice.items[0].description, /STANDART/);
    assert.match(invoice.items[0].description, /Aylık üyelik ödemesi/);
  });

  it("Sipay request amount değişmiyor", () => {
    const body = buildSipayPurchaseLinkBody({
      ...BASE_INPUT,
      items: [
        {
          name: "STANDART",
          description: "STANDART - Aylık üyelik ödemesi",
          priceMinor: 9990,
          quantity: 1,
        },
      ],
    });
    const invoice = parseInvoice(body);
    assert.equal(invoice.total, "99.90");
    assert.equal(invoice.items[0].price, "99.90");
  });

  it("invoice içinde app secret sızıntısı yok", () => {
    const body = buildSipayPurchaseLinkBody(BASE_INPUT);
    const invoiceSerialized = body.invoice;
    assert.ok(!invoiceSerialized.includes(ENV.SIPAY_APP_SECRET));
    assert.ok(!invoiceSerialized.includes(ENV.SIPAY_MERCHANT_KEY));
    assert.equal(body.merchant_key, ENV.SIPAY_MERCHANT_KEY);
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
    const invoice = parseInvoice(body);
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
    assert.equal(parseInvoice(body).bill_email, undefined);
  });

  it("sale_web_hook_key yalnız env doluysa invoice içinde", () => {
    const withKey = buildSipayPurchaseLinkBody({
      ...BASE_INPUT,
      invoiceId: "SI-PAYLOAD-005",
    });
    assert.ok(parseInvoice(withKey).sale_web_hook_key);

    const withoutKey = buildSipayPurchaseLinkBody({
      ...BASE_INPUT,
      env: { ...ENV, SIPAY_SALE_WEBHOOK_KEY: "" },
      invoiceId: "SI-PAYLOAD-006",
    });
    assert.equal(parseInvoice(withoutKey).sale_web_hook_key, undefined);
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

  it("geçersiz quantity reddedilir", () => {
    assert.throws(
      () =>
        buildSipayPurchaseLinkBody({
          ...BASE_INPUT,
          items: [{ name: "Plan", priceMinor: 9990, quantity: 0 }],
        }),
      /quantity geçersiz/,
    );
  });

  it("HTML description temizlenir", () => {
    const description = resolveSipayItemDescription({
      name: "Plan",
      priceMinor: 100,
      quantity: 1,
      description: "<b>STANDART</b> - Aylık",
    });
    assert.equal(description, "STANDART - Aylık");
  });
});
