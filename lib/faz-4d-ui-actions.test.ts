import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { mapInvoiceRowActions } from "./invoices-page-utils";
import { resolveOrderLifecycleActions } from "./order-lifecycle-utils";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSource(relativePath: string) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("faz 4d invoice list row actions", () => {
  it("DRAFT fatura düzenleme ve silme açık", () => {
    const row = mapInvoiceRowActions({
      id: "inv-1",
      invoiceNo: "FTR-1",
      customerName: "Test",
      issueDate: new Date(),
      dueDate: new Date(),
      amount: 100,
      paidAmount: 0,
      remainingAmount: 100,
      paymentStatus: "UNPAID",
      invoiceStatus: "DRAFT",
      invoiceType: "NORMAL",
      pdfUrl: null,
      saleId: null,
      detailHref: "/invoices/inv-1",
      editHref: "/invoices/inv-1/edit",
      downloadHref: "/api/invoices/inv-1/pdf",
      isOverdue: false,
    });

    assert.equal(row.canDelete, true);
    assert.equal(row.canEdit, true);
    assert.equal(row.lifecycleActions.delete, true);
  });

  it("PAID fatura iptal edilebilir (tahsilat yoksa)", () => {
    const row = mapInvoiceRowActions({
      id: "inv-2",
      invoiceNo: "FTR-2",
      customerName: "Test",
      issueDate: new Date(),
      dueDate: new Date(),
      amount: 100,
      paidAmount: 100,
      remainingAmount: 0,
      paymentStatus: "PAID",
      invoiceStatus: "SENT",
      invoiceType: "NORMAL",
      pdfUrl: null,
      saleId: null,
      detailHref: "/invoices/inv-2",
      editHref: "/invoices/inv-2",
      downloadHref: "/api/invoices/inv-2/pdf",
      isOverdue: false,
    });

    assert.equal(row.canCancel, false);
  });

  it("CANCELLED yalnız görüntüleme", () => {
    const row = mapInvoiceRowActions({
      id: "inv-3",
      invoiceNo: "FTR-3",
      customerName: "Test",
      issueDate: new Date(),
      dueDate: new Date(),
      amount: 100,
      paidAmount: 0,
      remainingAmount: 100,
      paymentStatus: "UNPAID",
      invoiceStatus: "CANCELLED",
      invoiceType: "NORMAL",
      pdfUrl: null,
      saleId: null,
      detailHref: "/invoices/inv-3",
      editHref: "/invoices/inv-3",
      downloadHref: "/api/invoices/inv-3/pdf",
      isOverdue: false,
    });

    assert.equal(row.canCancel, false);
    assert.equal(row.canDelete, false);
    assert.equal(row.canEdit, false);
  });

  it("e-fatura local iptal kapalı", () => {
    const row = mapInvoiceRowActions({
      id: "inv-4",
      invoiceNo: "EF-1",
      customerName: "Test",
      issueDate: new Date(),
      dueDate: new Date(),
      amount: 100,
      paidAmount: 0,
      remainingAmount: 100,
      paymentStatus: "UNPAID",
      invoiceStatus: "SENT",
      invoiceType: "E_INVOICE",
      pdfUrl: null,
      saleId: null,
      detailHref: "/invoices/inv-4",
      editHref: "/invoices/inv-4",
      downloadHref: "/api/invoices/inv-4/pdf",
      isOverdue: false,
      documentSubmission: { status: "SUCCESS", documentType: "E_INVOICE" },
    });

    assert.equal(row.requiresProviderCancel, true);
    assert.equal(row.canCancel, false);
  });
});

describe("faz 4d order archive lifecycle", () => {
  it("marketplace archive ve restore", () => {
    const active = resolveOrderLifecycleActions({
      sourceChannel: "TRENDYOL",
      status: "WAITING",
      isArchived: false,
    });
    assert.equal(active.lifecycleActions.archive, true);
    assert.equal(active.lifecycleActions.delete, false);

    const archived = resolveOrderLifecycleActions({
      sourceChannel: "TRENDYOL",
      status: "WAITING",
      isArchived: true,
    });
    assert.equal(archived.lifecycleActions.restore, true);
    assert.equal(archived.lifecycleActions.archive, false);
  });

  it("manuel sipariş arşiv destekler", () => {
    const actions = resolveOrderLifecycleActions({
      sourceChannel: "MANUAL",
      status: "APPROVED",
      isArchived: false,
    });
    assert.equal(actions.lifecycleActions.archive, true);
    assert.equal(actions.lifecycleActions.cancel, true);
  });
});

describe("faz 4d window.confirm taraması", () => {
  const scopedFiles = [
    "components/invoices/invoices-row-actions.tsx",
    "components/cash-bank/cash-bank-list-actions.tsx",
    "components/cash-bank/account-archive-actions.tsx",
    "components/cash-bank/cash-bank-transaction-row-actions.tsx",
    "components/orders/order-record-actions.tsx",
    "components/orders/orders-row-actions.tsx",
    "components/stocks/transfer-cancel-button.tsx",
    "components/sales/sales-row-actions.tsx",
    "components/sales/quote-cancel-button.tsx",
    "components/expenses/expense-bulk-actions-center.tsx",
    "components/employees/employee-payment-row-actions.tsx",
  ];

  for (const file of scopedFiles) {
    it(`${file} window.confirm içermez`, () => {
      const source = readSource(file);
      assert.doesNotMatch(source, /window\.confirm/);
      assert.doesNotMatch(source, /[^.]confirm\(/);
    });
  }
});
