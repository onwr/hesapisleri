import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateSipayInvoiceId, generatePayloadHash } from "./sipay-invoice-id";

describe("generateSipayInvoiceId", () => {
  it("SI- prefix ile başlar", () => {
    const id = generateSipayInvoiceId();
    assert.ok(id.startsWith("SI-"));
  });

  it("ardışık çağrılar farklı ID üretir (benzersizlik)", () => {
    const ids = new Set(Array.from({ length: 20 }, generateSipayInvoiceId));
    assert.equal(ids.size, 20);
  });

  it("yeterli uzunlukta (min 20 karakter)", () => {
    const id = generateSipayInvoiceId();
    assert.ok(id.length >= 20, `ID too short: ${id}`);
  });
});

describe("generatePayloadHash", () => {
  it("aynı payload için aynı hash", () => {
    const payload = { planId: "plan-1", period: "MONTHLY", amountMinor: 9900 };
    assert.equal(generatePayloadHash(payload), generatePayloadHash(payload));
  });

  it("farklı payload için farklı hash", () => {
    const h1 = generatePayloadHash({ amountMinor: 9900 });
    const h2 = generatePayloadHash({ amountMinor: 19900 });
    assert.notEqual(h1, h2);
  });

  it("64 karakter hex string döner (SHA-256)", () => {
    const hash = generatePayloadHash({ x: 1 });
    assert.match(hash, /^[0-9a-f]{64}$/);
  });
});
