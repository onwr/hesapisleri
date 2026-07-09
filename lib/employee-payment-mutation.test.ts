import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { getEmployeePaymentRowActions } from "./employee-payment-row-actions";

function read(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("employee-payment-mutation-service", () => {
  it("pending güncelleme ve paid iptal servisleri transaction içinde activity log yazar", () => {
    const src = read("lib/employee-payment-mutation-service.ts");
    assert.match(src, /\$transaction/);
    assert.match(src, /entityType: "EMPLOYEE_PAYMENT"/);
    assert.match(src, /reversePaidEmployeePaymentFinance/);
    assert.match(src, /invalidateDashboardCache/);
  });

  it("paid kayıt hard delete reddedilir", () => {
    const src = read("lib/employee-payment-mutation-service.ts");
    assert.match(src, /Yalnızca bekleyen ödeme kayıtları silinebilir/);
  });

  it("API route cancel ve delete destekler", () => {
    const route = read("app/api/employees/[id]/payments/[paymentId]/route.ts");
    assert.match(route, /cancelEmployeePayment/);
    assert.match(route, /updateEmployeePayment/);
    assert.match(route, /deletePendingEmployeePayment/);
    assert.match(route, /export async function DELETE/);
  });

  it("UI üç nokta menüsü duruma göre aksiyon üretir", () => {
    assert.equal(getEmployeePaymentRowActions("PENDING").edit, true);
    assert.equal(getEmployeePaymentRowActions("PAID").cancel, true);
    assert.equal(getEmployeePaymentRowActions("PAID").delete, false);
    assert.equal(getEmployeePaymentRowActions("CANCELLED").edit, false);
  });
});

describe("sipay referral commission", () => {
  it("finalizeSipayPayment başarılı ödemede partner conversion çağırır", () => {
    const src = read("lib/payments/sipay/sipay-checkout-service.ts");
    assert.match(src, /createPartnerPaymentConversion/);
  });
});

describe("referral billing attribution", () => {
  it("billing sayfası cookie/ref ile mevcut şirkete attribution uygular", () => {
    const page = read("app/settings/billing/page.tsx");
    assert.match(page, /applyPartnerReferralToExistingCompany/);
    assert.match(page, /readPartnerAttributionFromCookies/);
  });
});

describe("forgot-password mail config", () => {
  it("forgot-password sayfası mail yapılandırmasını kontrol eder", () => {
    const page = read("app/forgot-password/page.tsx");
    const form = read("components/forgot-password/forgot-password-form.tsx");
    assert.match(page, /isMailConfigured/);
    assert.match(form, /mailConfigured/);
    assert.match(form, /yapılandırılmamış/);
  });
});
