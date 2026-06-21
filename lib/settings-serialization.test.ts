import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Decimal } from "@prisma/client/runtime/library";
import {
  serializeCompany,
  serializeCompanySettings,
} from "./settings-serialization";

describe("settings serialization", () => {
  it("CompanySettings Decimal alanını number'a çevirir", () => {
    const serialized = serializeCompanySettings({
      id: "settings-1",
      companyId: "company-1",
      currency: "TRY",
      defaultVatRate: 20,
      defaultInvoiceType: "E_ARCHIVE",
      invoiceNumberPrefix: "FTR",
      defaultDueDays: 30,
      invoiceNoteTemplate: null,
      defaultCollectionAccountId: null,
      defaultExpenseAccountId: null,
      autoCreateCashAccount: true,
      hideInactiveAccounts: true,
      notifyLowStock: true,
      notifyDueInvoices: true,
      notifyLateCollections: true,
      notifyDailySummary: false,
      notifyEmployeePayments: true,
      membershipStatus: "ACTIVE",
      lastPaymentDate: new Date("2026-01-01T00:00:00.000Z"),
      nextPaymentDate: new Date("2026-02-01T00:00:00.000Z"),
      monthlyFee: new Decimal("1499.50"),
      membershipNote: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    assert.equal(serialized.monthlyFee, 1499.5);
    assert.equal(
      serialized.lastPaymentDate,
      "2026-01-01T00:00:00.000Z"
    );
    assert.equal(typeof serialized.createdAt, "string");
  });

  it("Company tarih alanlarını ISO string yapar", () => {
    const serialized = serializeCompany({
      id: "company-1",
      name: "Demo",
      taxNo: null,
      taxOffice: null,
      phone: null,
      email: null,
      address: null,
      logoUrl: null,
      referringPartnerId: null,
      referralCode: null,
      referredAt: null,
      status: "ACTIVE",
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
      updatedAt: new Date("2026-03-02T10:00:00.000Z"),
    });

    assert.equal(serialized.createdAt, "2026-03-01T10:00:00.000Z");
    assert.equal(serialized.updatedAt, "2026-03-02T10:00:00.000Z");
  });
});
