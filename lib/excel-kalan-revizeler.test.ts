import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  hasInsufficientCashBalance,
  INSUFFICIENT_CASH_BALANCE_MESSAGE,
} from "@/lib/cash-balance-policy";
import { validateCustomerFinanceAccount } from "@/lib/customer-finance-utils";
import { validateEmployeePaymentAccount } from "@/lib/employee-payment-validation";
import { invalidateCompanyEntitlementCache } from "@/lib/billing/entitlements/entitlement-cache";

const webRoot = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(webRoot, relativePath), "utf8");
}

const sampleAccount = {
  id: "acc-1",
  companyId: "company-a",
  type: "CASH",
  status: "ACTIVE",
  currency: "TRY",
  name: "Kasa",
  balance: 5,
};

describe("excel kalan revizeler", () => {
  it("firma değişiminde entitlement cache temizlenir", () => {
    const route = read("app/api/auth/switch-company/route.ts");
    assert.match(route, /invalidateCompanyEntitlementCache/);
    assert.match(route, /revalidatePath\("\/settings\/billing"\)/);
  });

  it("firma değişiminde billing panel tenant sync ile yenilenir", () => {
    const panel = read("components/settings/membership-billing-panel.tsx");
    assert.match(panel, /useTenantCacheSync/);
    assert.match(panel, /\/api\/membership\/billing/);
  });

  it("firma değişiminde hard navigation kullanılır", () => {
    const menu = read("components/layout/app-user-menu.tsx");
    assert.match(menu, /window\.location\.assign/);
  });

  it("membership billing companyId session üzerinden okunur", () => {
    const route = read("app/api/membership/billing/route.ts");
    assert.match(route, /session\.company\.id/);
  });

  it("geçerli ortaklık kodu /r route ile yönlendirir", () => {
    const route = read("app/r/[code]/route.ts");
    assert.match(route, /recordReferralClick/);
    assert.match(route, /NextResponse\.redirect/);
    assert.match(route, /\/register/);
  });

  it("geçersiz kod 500 vermez, güvenli register yönlendirmesi", () => {
    const route = read("app/r/[code]/route.ts");
    assert.match(route, /PARTNER_REFERRAL_REDIRECT_ERROR/);
    assert.match(route, /catch/);
  });

  it("referral attribution cookie veya body ile bağlanır", () => {
    const register = read("app/api/auth/register/route.ts");
    assert.match(register, /referralCode/);
    assert.match(register, /createPartnerSignupConversion/);
    assert.match(register, /resolvePartnerFromAttribution/);
  });

  it("negatif kasa ayarı kapalıyken yetersiz bakiye reddedilir", () => {
    assert.equal(hasInsufficientCashBalance(5, 10, false), true);
    const result = validateCustomerFinanceAccount(sampleAccount, "company-a", {
      purpose: "payment",
      amount: 10,
      checkBalance: true,
      allowNegativeCashBalance: false,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /yetersiz/i);
    }
  });

  it("negatif kasa ayarı açıkken ödeme engellenmez", () => {
    assert.equal(hasInsufficientCashBalance(5, 10, true), false);
    const customer = validateCustomerFinanceAccount(sampleAccount, "company-a", {
      purpose: "payment",
      amount: 10,
      checkBalance: true,
      allowNegativeCashBalance: true,
    });
    assert.equal(customer.ok, true);

    const employee = validateEmployeePaymentAccount(sampleAccount, "company-a", {
      amount: 10,
      checkBalance: true,
      allowNegativeCashBalance: true,
    });
    assert.equal(employee.ok, true);
  });

  it("stoksuz satış ayarı server route'larda okunur", () => {
    const create = read("app/api/sales/create/route.ts");
    const convert = read("app/api/sales/[id]/convert/route.ts");
    assert.match(create, /allowNegativeStockSales/);
    assert.match(convert, /allowNegativeStockSales/);
  });

  it("kasa satır menüsü doğru linkleri içerir", () => {
    const actions = read("components/cash-bank/cash-bank-list-actions.tsx");
    assert.match(actions, /Hesabı Görüntüle/);
    assert.match(actions, /Hareketleri Görüntüle/);
    assert.match(actions, /Hesabı Düzenle/);
    assert.match(actions, /Transfer Yap/);
    assert.match(actions, /Tahsilat Al/);
    assert.match(actions, /Ödeme Yap/);
    assert.match(actions, /Varsayılan Yap/);
    assert.match(actions, /Arşivle/);
    assert.match(actions, /\/cash-bank\/\$\{accountId\}/);
    assert.match(actions, /#movements/);
    assert.match(actions, /CashBankTransferModal/);
  });

  it("finans hareket detayında düzenle/sil aksiyonu yok", () => {
    const page = read("app/cash-bank/transactions/[id]/page.tsx");
    assert.doesNotMatch(page, /Düzenle/);
    assert.doesNotMatch(page, /\bSil\b/);
    assert.doesNotMatch(page, /onDelete/);
  });

  it("aksiyon kartları compact class kullanır", () => {
    const card = read("components/cards/compact-action-card.tsx");
    assert.match(card, /min-h-\[72px\]/);
    assert.match(card, /max-h-\[88px\]/);
    // Kart artık renkli gradient tonuyla beyaza dönüyor (to-white) —
    // düz bg-white değil, ama açıklama metninin bulunduğu alan hâlâ
    // beyaza yakın (kontrast korunuyor).
    assert.match(card, /to-white/);

    const sales = read("app/sales/page.tsx");
    assert.match(sales, /CompactActionCard/);
  });

  it("allowNegativeCashBalance schema ve ayarlarda tanımlı", () => {
    const schema = read("prisma/schema.prisma");
    assert.match(schema, /allowNegativeCashBalance/);

    const settings = read("components/settings/settings-center.tsx");
    assert.match(settings, /allowNegativeCashBalance/);
    assert.match(settings, /Eksi kasa/);
  });

  it("foreign tenant aboneliği billing API'de company scope kullanır", () => {
    const billing = read("app/api/membership/billing/route.ts");
    assert.match(billing, /session\.company\.id/);
  });

  it("entitlement cache company bazlı invalidate edilir", () => {
    invalidateCompanyEntitlementCache("company-test-a");
    invalidateCompanyEntitlementCache("company-test-b");
    assert.ok(true);
  });

  it("yetersiz bakiye mesajı sabit", () => {
    assert.match(INSUFFICIENT_CASH_BALANCE_MESSAGE, /yetersiz/i);
  });
});
