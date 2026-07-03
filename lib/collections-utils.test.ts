import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  computeDueFlags,
  computePendingCollectionsSummary,
  filterPendingCollections,
  mapInvoiceToPendingItem,
  mapSaleToPendingItem,
  previewSalePaymentStatus,
  resolveSaleCollectTarget,
  saleHasCollectibleInvoice,
} from "./collections-utils";

describe("collections utils", () => {
  it("remainingAmount > 0 olan fatura map edilir", () => {
    const item = mapInvoiceToPendingItem({
      id: "inv-1",
      invoiceNo: "FAT-001",
      customerId: "cust-1",
      customer: { name: "Acme" },
      createdAt: new Date("2026-06-01"),
      dueDate: new Date("2026-06-15"),
      total: 1000,
      paidAmount: 200,
      paymentStatus: "PARTIAL",
      saleId: "sale-1",
    });

    assert.ok(item);
    assert.equal(item?.remainingAmount, 800);
    assert.equal(item?.collectTarget.type, "INVOICE");
  });

  it("PAID fatura map edilmez", () => {
    const item = mapInvoiceToPendingItem({
      id: "inv-2",
      invoiceNo: "FAT-002",
      customerId: null,
      customer: null,
      createdAt: new Date("2026-06-01"),
      dueDate: null,
      total: 500,
      paidAmount: 500,
      paymentStatus: "PAID",
      saleId: null,
    });

    assert.equal(item, null);
  });

  it("satış map edilir", () => {
    const item = mapSaleToPendingItem({
      id: "sale-1",
      saleNo: "SAT-001",
      customerId: "cust-1",
      customer: { name: "Acme" },
      createdAt: new Date("2026-06-01"),
      total: 300,
      paidAmount: 0,
      paymentStatus: "UNPAID",
    });

    assert.ok(item);
    assert.equal(item?.documentType, "SALE");
    assert.equal(item?.remainingAmount, 300);
  });

  it("faturası olan satış collect target invoice olur", () => {
    const target = resolveSaleCollectTarget({
      id: "sale-1",
      invoice: {
        id: "inv-1",
        status: "APPROVED",
        paymentStatus: "UNPAID",
        total: 1000,
        paidAmount: 0,
      },
    });

    assert.equal(target.type, "INVOICE");
    assert.equal(target.id, "inv-1");
    assert.equal(target.viaInvoice, true);
  });

  it("summary overdue/dueToday/partial sayıları doğru", () => {
    const today = new Date("2026-06-08T12:00:00");
    const summary = computePendingCollectionsSummary([
      {
        id: "1",
        documentType: "INVOICE",
        documentId: "a",
        documentNo: "A",
        customerId: null,
        customerName: "X",
        issueDate: today,
        dueDate: new Date("2026-06-07"),
        totalAmount: 100,
        paidAmount: 0,
        remainingAmount: 100,
        paymentStatus: "UNPAID",
        ...computeDueFlags(new Date("2026-06-07"), today),
        actionUrl: "/",
        collectTarget: { type: "INVOICE", id: "a" },
        linkedInvoiceId: "a",
        linkedSaleId: null,
      },
      {
        id: "2",
        documentType: "SALE",
        documentId: "b",
        documentNo: "B",
        customerId: null,
        customerName: "Y",
        issueDate: today,
        dueDate: today,
        totalAmount: 200,
        paidAmount: 50,
        remainingAmount: 150,
        paymentStatus: "PARTIAL",
        ...computeDueFlags(today, today),
        actionUrl: "/",
        collectTarget: { type: "SALE", id: "b" },
        linkedInvoiceId: null,
        linkedSaleId: "b",
      },
    ]);

    assert.equal(summary.pendingCount, 2);
    assert.equal(summary.pendingTotal, 250);
    assert.equal(summary.overdueCount, 1);
    assert.equal(summary.dueTodayCount, 1);
    assert.equal(summary.partialCount, 1);
  });

  it("filterPendingCollections documentType filtresi", () => {
    const items = filterPendingCollections(
      [
        {
          id: "1",
          documentType: "INVOICE",
          documentId: "a",
          documentNo: "A",
          customerId: null,
          customerName: "X",
          issueDate: new Date(),
          dueDate: null,
          totalAmount: 100,
          paidAmount: 0,
          remainingAmount: 100,
          paymentStatus: "UNPAID",
          isOverdue: false,
          isDueToday: false,
          actionUrl: "/",
          collectTarget: { type: "INVOICE", id: "a" },
          linkedInvoiceId: "a",
          linkedSaleId: null,
        },
        {
          id: "2",
          documentType: "SALE",
          documentId: "b",
          documentNo: "B",
          customerId: null,
          customerName: "Y",
          issueDate: new Date(),
          dueDate: null,
          totalAmount: 200,
          paidAmount: 0,
          remainingAmount: 200,
          paymentStatus: "UNPAID",
          isOverdue: false,
          isDueToday: false,
          actionUrl: "/",
          collectTarget: { type: "SALE", id: "b" },
          linkedInvoiceId: null,
          linkedSaleId: "b",
        },
      ],
      { documentType: "SALE" }
    );

    assert.equal(items.length, 1);
    assert.equal(items[0]?.documentType, "SALE");
  });

  it("previewSalePaymentStatus PARTIAL/PAID", () => {
    assert.equal(
      previewSalePaymentStatus(1000, 0, 500).paymentStatus,
      "PARTIAL"
    );
    assert.equal(
      previewSalePaymentStatus(1000, 500, 500).paymentStatus,
      "PAID"
    );
  });

  it("saleHasCollectibleInvoice draft faturayı reddeder", () => {
    assert.equal(
      saleHasCollectibleInvoice({
        id: "inv",
        status: "DRAFT",
        paymentStatus: "UNPAID",
        total: 100,
        paidAmount: 0,
      }),
      false
    );
  });
});

describe("collections UI wiring", () => {
  const read = (relativePath: string) =>
    fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");

  it("genel Tahsilat Al href /cash-bank/collections", () => {
    const sales = read("app/sales/page.tsx");
    const cashBank = read("components/cash-bank/cash-bank-list-actions.tsx");
    const dashboard = read("components/dashboard/dashboard-content.tsx");

    assert.match(sales, /href[=:]\s*["']\/cash-bank\/collections["']/);
    assert.match(cashBank, /href[=:]\s*["']\/cash-bank\/collections["']/);
    assert.match(dashboard, /href[=:]\s*["']\/cash-bank\/collections["']/);
  });

  it("collections page empty state metni", () => {
    const page = read("components/collections/collections-page-client.tsx");
    assert.match(page, /Bekleyen tahsilat bulunmuyor/);
  });

  it("satır menüsü modal kullanır", () => {
    const salesActions = read("components/sales/sales-row-actions.tsx");
    const invoiceActions = read("components/invoices/invoices-row-actions.tsx");

    assert.match(salesActions, /CollectPaymentDialog/);
    assert.match(salesActions, /openCollectModal/);
    assert.doesNotMatch(salesActions, /href="\/cash-bank"/);

    assert.match(invoiceActions, /CollectPaymentDialog/);
    assert.doesNotMatch(invoiceActions, /Tahsilat al[\s\S]*detailHref/);
  });

  it("sale collect modal ve API accountId", () => {
    const modal = read("components/sales/sale-collect-modal.tsx");
    const select = read("components/cash-bank/collection-account-select.tsx");
    const api = read("app/api/sales/[id]/collect/route.ts");

    assert.match(modal, /accountId/);
    assert.match(modal, /useCollectionAccounts/);
    assert.match(select, /Kasalar/);
    assert.match(select, /Bankalar/);
    assert.match(select, /COLLECTION_ACCOUNT_EMPTY_MESSAGE/);
    assert.doesNotMatch(modal, /Nakit Kasa/);
    assert.match(api, /accountId/);
    assert.match(api, /Tahsilat hesabı seçilmelidir/);
    assert.match(api, /COLLECT_VIA_INVOICE/);
  });

  it("collections route ve servis dosyaları mevcut", () => {
    assert.ok(fs.existsSync(path.join(__dirname, "collections-service.ts")));
    assert.ok(
      fs.existsSync(
        path.join(__dirname, "..", "app/cash-bank/collections/page.tsx")
      )
    );
    assert.ok(
      fs.existsSync(
        path.join(__dirname, "..", "app/api/collections/pending/route.ts")
      )
    );
  });
});

describe("sale collect API guard message", () => {
  it("unpaid invoice mesajı tanımlı", () => {
    const api = fs.readFileSync(
      path.join(__dirname, "..", "app/api/sales/[id]/collect/route.ts"),
      "utf8"
    );

    assert.match(
      api,
      /Bu satış için fatura oluşturulmuş\. Tahsilatı fatura üzerinden alın\./
    );
  });
});
