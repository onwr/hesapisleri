import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateConversionRate,
  calculatePartnerCommission,
  generateReferralCode,
  hashPartnerIp,
  normalizePartnerEmail,
  partnerApplicationSchema,
  sanitizeReferralCode,
} from "./partner-utils";

describe("partner utils", () => {
  it("normalizePartnerEmail küçük harfe çevirir", () => {
    assert.equal(normalizePartnerEmail("  Test@Mail.COM "), "test@mail.com");
  });

  it("sanitizeReferralCode sadece alfanumerik bırakır", () => {
    assert.equal(sanitizeReferralCode(" onur-123! "), "ONUR123");
  });

  it("generateReferralCode benzersiz suffix üretir", () => {
    const code = generateReferralCode("Onur Yılmaz");
    assert.match(code, /^ONUR[0-9A-F]+$/);
    assert.ok(code.length >= 6);
  });

  it("hashPartnerIp düz IP saklamaz", () => {
    const hash = hashPartnerIp("192.168.1.1");
    assert.notEqual(hash, "192.168.1.1");
    assert.equal(hash.length, 64);
  });

  it("calculatePartnerCommission yüzde hesaplar", () => {
    assert.equal(calculatePartnerCommission(1000, 10), 100);
    assert.equal(calculatePartnerCommission(500, 15), 75);
    assert.equal(calculatePartnerCommission(100, 0), 0);
  });

  it("calculateConversionRate tıklama bazlı oran döner", () => {
    assert.equal(calculateConversionRate(0, 5), 0);
    assert.equal(calculateConversionRate(100, 10), 10);
    assert.equal(calculateConversionRate(3, 1), 33.3);
  });

  it("partnerApplicationSchema zorunlu alanları doğrular", () => {
    const valid = partnerApplicationSchema.safeParse({
      fullName: "Onur Test",
      email: "onur@test.com",
      audienceType: "INFLUENCER",
      termsAccepted: true,
    });
    assert.equal(valid.success, true);

    const invalid = partnerApplicationSchema.safeParse({
      fullName: "A",
      email: "bad",
      audienceType: "OTHER",
      termsAccepted: false,
    });
    assert.equal(invalid.success, false);
  });
});
