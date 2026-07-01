import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { calculateInvoiceTotals } from "@/lib/invoice-form-utils";
import { getInvoiceRemainingAmount } from "@/lib/invoice-payment-utils";
import { resolveMobileFinancePermissions } from "./mobile-finance-permissions";
import { mobileCreateInvoiceSchema } from "./mobile-invoices-service";
import { buildCollectionPayloadHash } from "./invoice-collection-idempotency";

const webRoot = join(__dirname, "../..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("mobile finance permissions", () => {
  it("POS_STAFF cannot read expenses", () => {
    const p = resolveMobileFinancePermissions("POS_STAFF", false);
    assert.equal(p.expenses.read, false);
    assert.equal(p.finance.read, false);
  });

  it("ACCOUNTANT can read invoices and expenses", () => {
    const p = resolveMobileFinancePermissions("ACCOUNTANT", false);
    assert.equal(p.invoices.read, true);
    assert.equal(p.expenses.read, true);
  });

  it("STAFF cannot access invoices per canonical module access", () => {
    const p = resolveMobileFinancePermissions("STAFF", false);
    assert.equal(p.invoices.read, false);
    assert.equal(p.expenses.create, false);
  });
});

describe("mobile invoice service", () => {
  it("rejects client authoritative totals in schema", () => {
    const r = mobileCreateInvoiceSchema.safeParse({
      items: [{ name: "A", quantity: 1, unitPrice: 100, vatRate: 20 }],
      total: 999,
      subtotal: 999,
    });
    assert.equal(r.success, false);
  });

  it("canonical calculateInvoiceTotals used for tax", () => {
    const totals = calculateInvoiceTotals(
      [{ id: "1", name: "X", quantity: 2, unitPrice: 100, vatRate: 20 }],
      0
    );
    assert.ok(totals.total > 0);
    assert.equal(getInvoiceRemainingAmount(totals.total, 0), totals.total);
  });

  it("mobile invoices route uses tenant guard", () => {
    const src = readSrc("app/api/mobile/invoices/route.ts");
    assert.ok(src.includes("requireMobileCompanySession"));
    assert.ok(src.includes("requireMobilePermission"));
  });

  it("invoice detail service strips provider fields", () => {
    const src = readSrc("lib/mobile/mobile-invoices-service.ts");
    assert.ok(!src.includes("xmlUrl"));
    assert.ok(!src.includes("sellerSnapshot"));
    assert.ok(src.includes("INVOICE_NOT_FOUND"));
  });
});

describe("mobile collections idempotency", () => {
  it("uses InvoiceCollectionIdempotency durable store", () => {
    const src = readSrc("lib/mobile/invoice-collection-idempotency.ts");
    assert.ok(src.includes("invoiceCollectionIdempotency"));
    assert.ok(!src.includes("IDEMPOTENCY_ENTITY"));
  });

  it("payload hash differs for different amounts", () => {
    const a = buildCollectionPayloadHash({
      invoiceId: "a",
      accountId: "acc",
      amount: 10,
    });
    const b = buildCollectionPayloadHash({
      invoiceId: "a",
      accountId: "acc",
      amount: 20,
    });
    assert.notEqual(a, b);
  });

  it("atomic transaction uses collectInvoicePaymentInTransaction", () => {
    const src = readSrc("lib/mobile/invoice-collection-idempotency.ts");
    assert.ok(src.includes("collectInvoicePaymentInTransaction"));
    assert.ok(src.includes("runTransactionWithRetry"));
  });
});

describe("mobile finance service", () => {
  it("uses canonical transfer and account services", () => {
    const src = readSrc("lib/mobile/mobile-finance-service.ts");
    assert.ok(src.includes("applyAccountTransfer"));
    assert.ok(src.includes("getAccountDetailData"));
    assert.ok(src.includes("listCompanyAccounts"));
  });

  it("account transfer locks rows in deterministic order", () => {
    const src = readSrc("lib/cash-bank-account-service.ts");
    assert.ok(src.includes("FOR UPDATE"));
    assert.ok(src.includes("lockCompanyAccountsForUpdate"));
    assert.ok(src.includes("runTransactionWithRetry"));
  });

  it("balance gated by permission", () => {
    const src = readSrc("lib/mobile/mobile-finance-service.ts");
    assert.ok(src.includes("viewBalance"));
  });
});

describe("mobile expenses service", () => {
  it("uses canonical expense schemas", () => {
    const src = readSrc("lib/mobile/mobile-expenses-service.ts");
    assert.ok(src.includes("createExpenseSchema"));
    assert.ok(src.includes("cancelExpenseRecord"));
  });

  it("supplier isolation on create", () => {
    const src = readSrc("lib/mobile/mobile-expenses-service.ts");
    assert.ok(src.includes("SUPPLIER_NOT_FOUND"));
  });
});

describe("mobile finance API routes", () => {
  it("collections POST requires write permission", () => {
    const src = readSrc("app/api/mobile/collections/route.ts");
    assert.ok(src.includes('"invoices", "write"'));
  });

  it("expenses cancel uses delete permission", () => {
    const src = readSrc("app/api/mobile/expenses/[id]/cancel/route.ts");
    assert.ok(src.includes('"expenses", "delete"'));
  });
});
