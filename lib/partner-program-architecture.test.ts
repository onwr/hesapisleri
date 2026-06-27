import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { calculatePartnerCommission } from "./partner-utils";

const webRoot = join(process.cwd());

function read(relativePath: string) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("partner program architecture", () => {
  it("prisma şemasında partner modelleri tanımlıdır", () => {
    const schema = read("prisma/schema.prisma");
    assert.match(schema, /model PartnerApplication/);
    assert.match(schema, /model PartnerProfile/);
    assert.match(schema, /model PartnerReferralClick/);
    assert.match(schema, /model PartnerConversion/);
    assert.match(schema, /model PartnerEarning/);
    assert.match(schema, /model PartnerPayout/);
    assert.match(schema, /membershipPaymentId/);
    assert.match(schema, /model PartnerEarning[\s\S]*@unique/);
  });

  it("referans tıklaması /r/[code] route ile kaydedilir", () => {
    const route = read("app/r/[code]/route.ts");
    assert.match(route, /recordReferralClick/);
    assert.match(route, /PARTNER_REF_COOKIE/);
  });

  it("kayıt sırasında partner attribution cookie kullanılır", () => {
    const register = read("app/api/auth/register/route.ts");
    assert.match(register, /readPartnerAttributionFromCookies/);
    assert.match(register, /createPartnerSignupConversion/);
  });

  it("kayıt sayfası referans kodu banner gösterir", () => {
    const page = read("app/register/page.tsx");
    const form = read("components/register/register-form.tsx");
    const notice = read("components/register/referral-signup-notice.tsx");
    assert.match(page, /resolvePublicReferralSignupInfo/);
    assert.match(form, /ReferralSignupNotice/);
    assert.match(notice, /referansıyla kayıt/);
  });

  it("üyelik ödemesinde komisyon oluşturulur", () => {
    const conversion = read("lib/partner-conversion-service.ts");
    assert.match(conversion, /createPartnerPaymentConversion/);
    assert.match(conversion, /membershipPaymentId/);
    assert.match(conversion, /existingEarning/);
  });

  it("iade sonrası komisyon ters kaydı oluşturulur", () => {
    const refund = read("lib/payments/payment-refund-service.ts");
    assert.match(refund, /reversalOfEarningId/);
    assert.match(refund, /membershipPaymentId: payment.id/);
  });

  it("partner API tenant izolasyonu requirePartnerApi kullanır", () => {
    const clicks = read("app/api/partner/clicks/route.ts");
    assert.match(clicks, /requirePartnerApi/);
    assert.match(clicks, /listPartnerClicks\(auth\.partner\.id\)/);
  });

  it("admin partner yönetimi /admin/partners altında", () => {
    const nav = read("components/admin/layout/admin-navigation.ts");
    assert.match(nav, /Ortaklık Programı/);
    assert.match(nav, /\/admin\/partners/);
  });

  it("varsayılan ve partner özel komisyon oranı desteklenir", () => {
    const mutation = read("lib/admin/partner-applications/application-mutation-service.ts");
    assert.match(mutation, /defaultCommissionRate/);
    assert.match(mutation, /commissionRate: parsed\.commissionRate/);
    const commission = calculatePartnerCommission(1000, 12.5);
    assert.equal(commission, 125);
  });
});
