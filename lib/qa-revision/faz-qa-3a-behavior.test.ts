import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { canProcessEmployeePayments } from "@/lib/permission-utils";

const webRoot = join(process.cwd());

function read(relativePath: string) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("QA Faz 3A — UI contract", () => {
  it("ödeme formunda hesap seçici mevcut", () => {
    const detail = read("components/employees/employee-detail-client.tsx");
    assert.match(detail, /Ödeme Yapılacak Hesap/);
    assert.match(detail, /FinanceAccountSelect/);
    assert.match(detail, /showBalance/);
  });

  it("Türkçe doğrulama mesajları", () => {
    const validation = read("lib/employee-payment-validation.ts");
    assert.match(
      validation,
      /Ödeme yapılacak kasa veya banka hesabını seçin/
    );
    assert.match(validation, /Seçilen hesapta yeterli bakiye bulunmuyor/);
  });

  it("avans terminolojisi", () => {
    const detail = read("components/employees/employee-detail-client.tsx");
    const mapping = read("lib/employee-payment-type-mapping.ts");
    const ledger = read("lib/employee-ledger-utils.ts");
    assert.match(detail, /Çalışana Avans/);
    assert.match(detail, /Mahsup Edilecek Avans/);
    assert.match(mapping, /Çalışana Avans/);
    assert.match(ledger, /Çalışanın Şirkete Borcu/);
  });

  it("hesap adı detay ve listede", () => {
    const detail = read("components/employees/employee-detail-client.tsx");
    assert.match(detail, /paymentAccount\.name/);
    assert.match(detail, /\/cash-bank\//);
    assert.match(detail, /paymentFilterAccount/);
  });

  it("yetkisiz rolde ödeme işlemi yok", () => {
    assert.equal(canProcessEmployeePayments("STAFF"), false);
    assert.equal(canProcessEmployeePayments("POS_STAFF"), false);
    const route = read("app/api/employees/[id]/payments/route.ts");
    assert.match(route, /processPayments/);
  });
});
