import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { percentChange } from "@/lib/finance/percentage-change";

const webRoot = join(process.cwd());

function readSrc(relativePath: string) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("Faz 5E — ödeme geçmişi canonical tutar", () => {
  it("serializePayment amountMinor kaynağını kullanır", () => {
    const src = readSrc("lib/membership-service.ts");
    assert.match(src, /resolveMembershipPaymentAmount/);
    assert.match(src, /pickLatestPaidMembershipPayment/);
  });

  it("billing panel başlık ve tablo aynı amount alanını kullanır", () => {
    const panel = readSrc("components/settings/membership-billing-panel.tsx");
    assert.match(panel, /data\.lastPayment\.amount/);
    assert.match(panel, /payment\.amount/);
  });
});

describe("Faz 5E — fihrist müşteri sayısı", () => {
  it("directory summary CRM aktif müşteri sayısını içerir", () => {
    const src = readSrc("lib/directory-service.ts");
    assert.match(src, /crmActiveCustomers/);
    assert.match(src, /db\.customer\.count\(\{ where: \{ companyId, status: "ACTIVE" \} \}\)/);
  });

  it("fihrist kartı CRM sayısını gösterir", () => {
    const src = readSrc("lib/directory-page-ui-utils.ts");
    assert.match(src, /summary\.crmActiveCustomers/);
  });
});

describe("Faz 5E — gider yüzde değişimi", () => {
  it("expenses buildChangeLabel canonical helper kullanır", () => {
    const src = readSrc("lib/expenses-page-data.ts");
    assert.match(src, /formatPercentageChangeBadge/);
    assert.match(src, /resolvePercentageChange/);
  });

  it("percentChange artık sıfır bazda +100 döndürmez", () => {
    assert.equal(percentChange(100, 0), null);
  });
});

describe("Faz 5E — /fiyatlandirma redirect", () => {
  it("fiyatlar anchorına yönlendirir", () => {
    const src = readSrc("app/fiyatlandirma/page.tsx");
    assert.match(src, /#fiyatlar/);
    assert.match(src, /redirect\(/);
  });

  it("public route olarak tanımlı", () => {
    const src = readSrc("lib/auth/auth-routes.ts");
    assert.match(src, /"\/fiyatlandirma"/);
  });

  it("marketing pricing section id=fiyatlar", () => {
    const src = readSrc("components/marketing/pricing-section.tsx");
    assert.match(src, /id="fiyatlar"/);
  });
});

describe("Faz 5E — satış fatura metrikleri", () => {
  it("fatura kartları seçili dönem invoice satırlarından beslenir", () => {
    const src = readSrc("lib/sales-page-data.ts");
    assert.match(src, /periodInvoiceRows/);
    assert.match(src, /documentGroups\.invoices/);
    assert.match(src, /periodInvoiceCount/);
    assert.match(src, /periodAverage/);
  });
});

describe("Faz 5E — kayıt formu name/autocomplete", () => {
  it("register form alanlarında name ve autocomplete var", () => {
    const src = readSrc("components/register/register-form.tsx");
    assert.match(src, /autoComplete="name"/);
    assert.match(src, /autoComplete="email"/);
    assert.match(src, /autoComplete="new-password"/);
    assert.match(src, /name="name"/);
    assert.match(src, /name="email"/);
  });
});

describe("Faz 5E — kayıt e-postası yopmail iddiası", () => {
  it("production register route gönderilen e-postayı doğrudan kaydeder", () => {
    const src = readSrc("app/api/auth/register/route.ts");
    assert.match(src, /email,/);
    assert.match(src, /email,/);
    assert.doesNotMatch(src, /yopmail/i);
    assert.doesNotMatch(src, /testuser_/i);
    assert.doesNotMatch(src, /Date\.now\(\).*email/i);
  });

  it("E2E fixture yopmail kullanmaz", () => {
    const src = readSrc("e2e/seed-auth-fixture.ts");
    assert.match(src, /@qa\.internal/);
    assert.doesNotMatch(src, /yopmail/i);
  });
});
