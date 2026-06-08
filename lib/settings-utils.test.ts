import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getInvoiceTypeLabel,
  getUserRoleLabel,
  updateCompanySettingsSchema,
  updateInvoiceSettingsSchema,
  validateAccountBelongsToCompany,
} from "./settings-utils";

describe("settings utils", () => {
  it("firma bilgileri şeması geçerli veriyi kabul eder", () => {
    const parsed = updateCompanySettingsSchema.safeParse({
      name: "Demo A.Ş.",
      email: "info@demo.com",
      currency: "TRY",
      defaultVatRate: 20,
    });

    assert.equal(parsed.success, true);
  });

  it("firma adı zorunludur", () => {
    const parsed = updateCompanySettingsSchema.safeParse({
      name: "A",
      currency: "TRY",
      defaultVatRate: 20,
    });

    assert.equal(parsed.success, false);
  });

  it("fatura ayarları varsayılanları doğrular", () => {
    const parsed = updateInvoiceSettingsSchema.parse({
      defaultInvoiceType: "E_ARCHIVE",
      invoiceNumberPrefix: "FTR",
      defaultDueDays: 30,
      defaultVatRate: 20,
    });

    assert.equal(parsed.defaultInvoiceType, "E_ARCHIVE");
    assert.equal(parsed.invoiceNumberPrefix, "FTR");
  });

  it("hesap sadece kendi firmasına ait olmalı", () => {
    const valid = validateAccountBelongsToCompany(
      { id: "acc-1", companyId: "company-1" },
      "company-1"
    );
    const invalid = validateAccountBelongsToCompany(
      { id: "acc-1", companyId: "company-2" },
      "company-1"
    );

    assert.equal(valid.ok, true);
    assert.equal(invalid.ok, false);
  });

  it("rol etiketleri Türkçe döner", () => {
    assert.equal(getUserRoleLabel("OWNER"), "Sahip");
    assert.equal(getUserRoleLabel("ADMIN"), "Yönetici");
    assert.equal(getUserRoleLabel("ACCOUNTANT"), "Muhasebeci");
    assert.equal(getUserRoleLabel("STAFF"), "Personel");
  });

  it("fatura tipi etiketleri doğru döner", () => {
    assert.equal(getInvoiceTypeLabel("E_INVOICE"), "e-Fatura");
    assert.equal(getInvoiceTypeLabel("E_ARCHIVE"), "e-Arşiv");
  });
});
