/**
 * Mobile finance DB entegrasyon testleri — gerçek PostgreSQL.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { MobileFinanceError } from "./mobile-finance-errors";

const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const DB_AVAILABLE = !!TEST_DB_URL;
const SKIP_REASON = DB_AVAILABLE
  ? false
  : "SKIP: mobile finance DB tests require TEST_DATABASE_URL or DATABASE_URL";

describe("mobile finance DB", { skip: SKIP_REASON }, () => {
  let db: PrismaClient;
  let companyAId: string;
  let companyBId: string;
  let ownerAId: string;
  let posStaffId: string;
  let customerAId: string;
  let customerBId: string;
  let accountAId: string;
  let accountBId: string;
  let supplierAId: string;
  let invoiceAId: string;
  let invoiceBId: string;

  before(async () => {
    const { PrismaClient } = await import("@prisma/client");
    db = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
    await db.$connect();

    const { hashPassword } = await import("@/lib/auth");
    const hash = await hashPassword("TestPass123!");

    const ownerA = await db.user.create({
      data: {
        email: `finance-owner-a-${Date.now()}@mobile-test.internal`,
        password: hash,
        name: "Finance Owner A",
        role: "OWNER",
        status: "ACTIVE",
        sessionVersion: 1,
        loginTrackingStatus: "NEVER_LOGGED_IN",
      },
    });
    ownerAId = ownerA.id;

    const posStaff = await db.user.create({
      data: {
        email: `finance-pos-${Date.now()}@mobile-test.internal`,
        password: hash,
        name: "POS Staff",
        role: "POS_STAFF",
        status: "ACTIVE",
        sessionVersion: 1,
        loginTrackingStatus: "NEVER_LOGGED_IN",
      },
    });
    posStaffId = posStaff.id;

    const companyA = await db.company.create({
      data: { name: `TestMobileFinanceA_${Date.now()}`, status: "ACTIVE" },
    });
    companyAId = companyA.id;

    const companyB = await db.company.create({
      data: { name: `TestMobileFinanceB_${Date.now()}`, status: "ACTIVE" },
    });
    companyBId = companyB.id;

    await db.companyUser.createMany({
      data: [
        { userId: ownerAId, companyId: companyAId, role: "OWNER", status: "ACTIVE", isOwner: true },
        { userId: posStaffId, companyId: companyAId, role: "POS_STAFF", status: "ACTIVE", isOwner: false },
        { userId: ownerAId, companyId: companyBId, role: "OWNER", status: "ACTIVE", isOwner: true },
      ],
    });

    const customerA = await db.customer.create({
      data: { companyId: companyAId, name: "Finance Customer A", status: "ACTIVE", balance: 0 },
    });
    customerAId = customerA.id;

    const customerB = await db.customer.create({
      data: { companyId: companyBId, name: "Finance Customer B", status: "ACTIVE" },
    });
    customerBId = customerB.id;

    const accountA = await db.account.create({
      data: {
        companyId: companyAId,
        name: "Kasa A",
        type: "CASH",
        balance: 0,
        currency: "TRY",
        status: "ACTIVE",
      },
    });
    accountAId = accountA.id;

    const accountB = await db.account.create({
      data: {
        companyId: companyBId,
        name: "Kasa B",
        type: "CASH",
        balance: 0,
        currency: "TRY",
        status: "ACTIVE",
      },
    });
    accountBId = accountB.id;

    const supplierA = await db.supplier.create({
      data: { companyId: companyAId, name: "Supplier A", isActive: true },
    });
    supplierAId = supplierA.id;

    const { createMobileInvoice } = await import("./mobile-invoices-service");
    const invA = await createMobileInvoice({
      companyId: companyAId,
      userId: ownerAId,
      role: "OWNER",
      isOwner: true,
      body: {
        customerId: customerAId,
        items: [{ name: "Hizmet A", quantity: 1, unitPrice: 200, vatRate: 20 }],
        paymentStatus: "UNPAID",
        action: "CREATE",
      },
    });
    invoiceAId = invA.invoice.id;

    const invB = await createMobileInvoice({
      companyId: companyBId,
      userId: ownerAId,
      role: "OWNER",
      isOwner: true,
      body: {
        customerId: customerBId,
        items: [{ name: "Hizmet B", quantity: 1, unitPrice: 100, vatRate: 20 }],
        paymentStatus: "UNPAID",
        action: "CREATE",
      },
    });
    invoiceBId = invB.invoice.id;
  });

  after(async () => {
    if (!db) return;
    await db.invoiceCollectionIdempotency.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await db.accountTransaction.deleteMany({
      where: { account: { companyId: { in: [companyAId, companyBId] } } },
    });
    await db.invoice.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await db.expense.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await db.supplier.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await db.customer.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await db.account.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await db.companyUser.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await db.company.deleteMany({ where: { id: { in: [companyAId, companyBId] } } });
    await db.user.deleteMany({ where: { id: { in: [ownerAId, posStaffId] } } });
    await db.$disconnect();
  });

  it("fatura list/detail current company", async () => {
    const { listMobileInvoices, getMobileInvoiceById } = await import("./mobile-invoices-service");
    const list = await listMobileInvoices({
      companyId: companyAId,
      role: "OWNER",
      isOwner: true,
    });
    assert.ok(list.items.some((i) => i.id === invoiceAId));

    const detail = await getMobileInvoiceById({
      companyId: companyAId,
      role: "OWNER",
      isOwner: true,
      invoiceId: invoiceAId,
    });
    assert.equal(detail.invoice.id, invoiceAId);
    assert.ok(detail.invoice.total > 0);
    assert.ok(!("xmlUrl" in (detail.invoice as object)));
  });

  it("foreign invoice detail reddi", async () => {
    const { getMobileInvoiceById } = await import("./mobile-invoices-service");
    await assert.rejects(
      () =>
        getMobileInvoiceById({
          companyId: companyAId,
          role: "OWNER",
          isOwner: true,
          invoiceId: invoiceBId,
        }),
      (e: unknown) => e instanceof MobileFinanceError && e.code === "INVOICE_NOT_FOUND"
    );
  });

  it("foreign customer ile fatura create reddi", async () => {
    const { createMobileInvoice } = await import("./mobile-invoices-service");
    await assert.rejects(
      () =>
        createMobileInvoice({
          companyId: companyAId,
          userId: ownerAId,
          role: "OWNER",
          isOwner: true,
          body: {
            customerId: customerBId,
            items: [{ name: "X", quantity: 1, unitPrice: 10, vatRate: 20 }],
          },
        }),
      (e: unknown) => e instanceof MobileFinanceError && e.code === "CUSTOMER_NOT_FOUND"
    );
  });

  it("client total tampering etkisiz", async () => {
    const { createMobileInvoice } = await import("./mobile-invoices-service");
    await assert.rejects(
      () =>
        createMobileInvoice({
          companyId: companyAId,
          userId: ownerAId,
          role: "OWNER",
          isOwner: true,
          body: {
            customerId: customerAId,
            items: [{ name: "Y", quantity: 1, unitPrice: 50, vatRate: 20 }],
            total: 1,
          },
        }),
      () => true
    );
  });

  it("partial collection PARTIAL status", async () => {
    const { createMobileInvoice, getMobileInvoiceById } = await import("./mobile-invoices-service");
    const { createMobileCollection } = await import("./mobile-collections-service");
    const inv = await createMobileInvoice({
      companyId: companyAId,
      userId: ownerAId,
      role: "OWNER",
      isOwner: true,
      body: {
        customerId: customerAId,
        items: [{ name: "Partial", quantity: 1, unitPrice: 100, vatRate: 20 }],
        paymentStatus: "UNPAID",
        action: "CREATE",
      },
    });
    await createMobileCollection({
      companyId: companyAId,
      userId: ownerAId,
      role: "OWNER",
      isOwner: true,
      body: {
        invoiceId: inv.invoice.id,
        accountId: accountAId,
        amount: 60,
        idempotencyKey: randomUUID(),
      },
    });
    const detail = await getMobileInvoiceById({
      companyId: companyAId,
      role: "OWNER",
      isOwner: true,
      invoiceId: inv.invoice.id,
    });
    assert.equal(detail.invoice.paymentStatus, "PARTIAL");
  });

  it("full collection PAID status", async () => {
    const { createMobileInvoice, getMobileInvoiceById } = await import("./mobile-invoices-service");
    const { createMobileCollection } = await import("./mobile-collections-service");
    const inv = await createMobileInvoice({
      companyId: companyAId,
      userId: ownerAId,
      role: "OWNER",
      isOwner: true,
      body: {
        customerId: customerAId,
        items: [{ name: "Full", quantity: 1, unitPrice: 50, vatRate: 20 }],
        paymentStatus: "UNPAID",
        action: "CREATE",
      },
    });
    const remaining = inv.invoice.remainingAmount;
    await createMobileCollection({
      companyId: companyAId,
      userId: ownerAId,
      role: "OWNER",
      isOwner: true,
      body: {
        invoiceId: inv.invoice.id,
        accountId: accountAId,
        amount: remaining,
        idempotencyKey: randomUUID(),
      },
    });
    const detail = await getMobileInvoiceById({
      companyId: companyAId,
      role: "OWNER",
      isOwner: true,
      invoiceId: inv.invoice.id,
    });
    assert.equal(detail.invoice.paymentStatus, "PAID");
    assert.equal(detail.invoice.remainingAmount, 0);
  });

  it("over-collection reddi", async () => {
    const { createMobileCollection } = await import("./mobile-collections-service");
    const { getMobileInvoiceById } = await import("./mobile-invoices-service");
    const detail = await getMobileInvoiceById({
      companyId: companyAId,
      role: "OWNER",
      isOwner: true,
      invoiceId: invoiceAId,
    });
    await assert.rejects(
      () =>
        createMobileCollection({
          companyId: companyAId,
          userId: ownerAId,
          role: "OWNER",
          isOwner: true,
          body: {
            invoiceId: invoiceAId,
            accountId: accountAId,
            amount: detail.invoice.remainingAmount + 1000,
            idempotencyKey: randomUUID(),
          },
        }),
      (e: unknown) =>
        e instanceof MobileFinanceError && e.code === "COLLECTION_AMOUNT_EXCEEDS_REMAINING"
    );
  });

  it("foreign collection account reddi", async () => {
    const { createMobileCollection } = await import("./mobile-collections-service");
    await assert.rejects(
      () =>
        createMobileCollection({
          companyId: companyAId,
          userId: ownerAId,
          role: "OWNER",
          isOwner: true,
          body: {
            invoiceId: invoiceAId,
            accountId: accountBId,
            amount: 10,
            idempotencyKey: randomUUID(),
          },
        }),
      (e: unknown) =>
        e instanceof MobileFinanceError && e.code === "COLLECTION_ACCOUNT_NOT_FOUND"
    );
  });

  it("same-key replay tek finansal etki", async () => {
    const { createMobileInvoice } = await import("./mobile-invoices-service");
    const { createMobileCollection } = await import("./mobile-collections-service");
    const inv = await createMobileInvoice({
      companyId: companyAId,
      userId: ownerAId,
      role: "OWNER",
      isOwner: true,
      body: {
        customerId: customerAId,
        items: [{ name: "Idem", quantity: 1, unitPrice: 80, vatRate: 20 }],
        paymentStatus: "UNPAID",
        action: "CREATE",
      },
    });
    const key = randomUUID();
    const body = {
      invoiceId: inv.invoice.id,
      accountId: accountAId,
      amount: 40,
      idempotencyKey: key,
    };
    const first = await createMobileCollection({
      companyId: companyAId,
      userId: ownerAId,
      role: "OWNER",
      isOwner: true,
      body,
    });
    const second = await createMobileCollection({
      companyId: companyAId,
      userId: ownerAId,
      role: "OWNER",
      isOwner: true,
      body,
    });
    assert.equal(first.status, "COMPLETED");
    assert.equal(second.status, "COMPLETED");
    assert.equal(second.replayed, true);

    const txCount = await db.accountTransaction.count({
      where: { invoiceId: inv.invoice.id, amount: 40 },
    });
    assert.equal(txCount, 1);
  });

  it("same-key different payload conflict", async () => {
    const { createMobileInvoice } = await import("./mobile-invoices-service");
    const { createMobileCollection } = await import("./mobile-collections-service");
    const inv = await createMobileInvoice({
      companyId: companyAId,
      userId: ownerAId,
      role: "OWNER",
      isOwner: true,
      body: {
        customerId: customerAId,
        items: [{ name: "Conflict", quantity: 1, unitPrice: 60, vatRate: 20 }],
        paymentStatus: "UNPAID",
        action: "CREATE",
      },
    });
    const key = randomUUID();
    await createMobileCollection({
      companyId: companyAId,
      userId: ownerAId,
      role: "OWNER",
      isOwner: true,
      body: {
        invoiceId: inv.invoice.id,
        accountId: accountAId,
        amount: 20,
        idempotencyKey: key,
      },
    });
    await assert.rejects(
      () =>
        createMobileCollection({
          companyId: companyAId,
          userId: ownerAId,
          role: "OWNER",
          isOwner: true,
          body: {
            invoiceId: inv.invoice.id,
            accountId: accountAId,
            amount: 30,
            idempotencyKey: key,
          },
        }),
      (e: unknown) => e instanceof MobileFinanceError && e.code === "IDEMPOTENCY_CONFLICT"
    );
  });

  it("collection status durable store", async () => {
    const { getMobileCollectionStatus } = await import("./mobile-collections-service");
    const key = randomUUID();
    const status = await getMobileCollectionStatus({
      companyId: companyAId,
      role: "OWNER",
      isOwner: true,
      idempotencyKey: key,
    });
    assert.equal(status.status, "NOT_FOUND");
  });

  it("customer balance collection sonrası güncellenir", async () => {
    const { createMobileInvoice } = await import("./mobile-invoices-service");
    const { createMobileCollection } = await import("./mobile-collections-service");
    const cust = await db.customer.create({
      data: { companyId: companyAId, name: "Bal Cust", status: "ACTIVE", balance: 0 },
    });
    const inv = await createMobileInvoice({
      companyId: companyAId,
      userId: ownerAId,
      role: "OWNER",
      isOwner: true,
      body: {
        customerId: cust.id,
        items: [{ name: "Bal", quantity: 1, unitPrice: 100, vatRate: 0 }],
        paymentStatus: "UNPAID",
        action: "CREATE",
      },
    });
    const before = Number((await db.customer.findUnique({ where: { id: cust.id } }))!.balance);
    await createMobileCollection({
      companyId: companyAId,
      userId: ownerAId,
      role: "OWNER",
      isOwner: true,
      body: {
        invoiceId: inv.invoice.id,
        accountId: accountAId,
        amount: 50,
        idempotencyKey: randomUUID(),
      },
    });
    const after = Number((await db.customer.findUnique({ where: { id: cust.id } }))!.balance);
    assert.ok(after < before);
  });

  it("kasa-banka tenant account list", async () => {
    const { listMobileFinanceAccounts } = await import("./mobile-finance-service");
    const list = await listMobileFinanceAccounts({
      companyId: companyAId,
      role: "OWNER",
      isOwner: true,
    });
    assert.ok(list.items.some((a) => a.id === accountAId));
    assert.ok(list.items.every((a) => a.balance !== undefined));
  });

  it("POS_STAFF finance list reddi", async () => {
    const { listMobileFinanceAccounts } = await import("./mobile-finance-service");
    await assert.rejects(
      () =>
        listMobileFinanceAccounts({
          companyId: companyAId,
          role: "POS_STAFF",
          isOwner: false,
        }),
      (e: unknown) => e instanceof MobileFinanceError && e.code === "FORBIDDEN"
    );
  });

  it("foreign account detail reddi", async () => {
    const { getMobileFinanceAccountById } = await import("./mobile-finance-service");
    await assert.rejects(
      () =>
        getMobileFinanceAccountById({
          companyId: companyAId,
          role: "OWNER",
          isOwner: true,
          accountId: accountBId,
        }),
      (e: unknown) =>
        e instanceof MobileFinanceError && e.code === "FINANCE_ACCOUNT_NOT_FOUND"
    );
  });

  it("transfer same account reddi", async () => {
    const { transferMobileFinance } = await import("./mobile-finance-service");
    await assert.rejects(
      () =>
        transferMobileFinance({
          companyId: companyAId,
          userId: ownerAId,
          role: "OWNER",
          isOwner: true,
          body: {
            fromAccountId: accountAId,
            toAccountId: accountAId,
            amount: 10,
          },
        }),
      (e: unknown) =>
        e instanceof MobileFinanceError && e.code === "TRANSFER_SAME_ACCOUNT"
    );
  });

  it("gider create current company", async () => {
    const { createMobileExpense, getMobileExpenseById } = await import("./mobile-expenses-service");
    const created = await createMobileExpense({
      companyId: companyAId,
      userId: ownerAId,
      role: "OWNER",
      isOwner: true,
      body: {
        title: "Test Gider",
        amount: 75,
        date: new Date().toISOString().slice(0, 10),
        paymentStatus: "UNPAID",
        supplierId: supplierAId,
      },
    });
    assert.equal(created.expense.title, "Test Gider");
    const detail = await getMobileExpenseById({
      companyId: companyAId,
      role: "OWNER",
      isOwner: true,
      expenseId: created.expense.id,
    });
    assert.ok(detail.expense);
  });

  it("foreign supplier gider reddi", async () => {
    const { createMobileExpense } = await import("./mobile-expenses-service");
    const foreignSupplier = await db.supplier.create({
      data: { companyId: companyBId, name: "Foreign Sup", isActive: true },
    });
    await assert.rejects(
      () =>
        createMobileExpense({
          companyId: companyAId,
          userId: ownerAId,
          role: "OWNER",
          isOwner: true,
          body: {
            title: "Bad",
            amount: 10,
            date: new Date().toISOString().slice(0, 10),
            paymentStatus: "UNPAID",
            supplierId: foreignSupplier.id,
          },
        }),
      (e: unknown) => e instanceof MobileFinanceError && e.code === "SUPPLIER_NOT_FOUND"
    );
    await db.supplier.delete({ where: { id: foreignSupplier.id } });
  });

  it("paid expense account requirement", async () => {
    const { createMobileExpense } = await import("./mobile-expenses-service");
    await assert.rejects(
      () =>
        createMobileExpense({
          companyId: companyAId,
          userId: ownerAId,
          role: "OWNER",
          isOwner: true,
          body: {
            title: "Paid no acc",
            amount: 10,
            date: new Date().toISOString().slice(0, 10),
            paymentStatus: "PAID",
          },
        }),
      () => true
    );
  });

  it("foreign expense detail reddi", async () => {
    const { createMobileExpense, getMobileExpenseById } = await import("./mobile-expenses-service");
    const exp = await createMobileExpense({
      companyId: companyBId,
      userId: ownerAId,
      role: "OWNER",
      isOwner: true,
      body: {
        title: "B Exp",
        amount: 20,
        date: new Date().toISOString().slice(0, 10),
        paymentStatus: "UNPAID",
      },
    });
    await assert.rejects(
      () =>
        getMobileExpenseById({
          companyId: companyAId,
          role: "OWNER",
          isOwner: true,
          expenseId: exp.expense.id,
        }),
      (e: unknown) => e instanceof MobileFinanceError && e.code === "EXPENSE_NOT_FOUND"
    );
  });

  it("parallel same-key single collection", async () => {
    const { createMobileInvoice } = await import("./mobile-invoices-service");
    const { createMobileCollection } = await import("./mobile-collections-service");
    const inv = await createMobileInvoice({
      companyId: companyAId,
      userId: ownerAId,
      role: "OWNER",
      isOwner: true,
      body: {
        customerId: customerAId,
        items: [{ name: "Parallel Key", quantity: 1, unitPrice: 80, vatRate: 20 }],
        paymentStatus: "UNPAID",
        action: "CREATE",
      },
    });
    const key = randomUUID();
    const payload = {
      companyId: companyAId,
      userId: ownerAId,
      role: "OWNER" as const,
      isOwner: true,
      body: {
        invoiceId: inv.invoice.id,
        accountId: accountAId,
        amount: 35,
        idempotencyKey: key,
      },
    };
    await Promise.all([createMobileCollection(payload), createMobileCollection(payload)]);
    const txCount = await db.accountTransaction.count({
      where: { invoiceId: inv.invoice.id, amount: 35 },
    });
    assert.equal(txCount, 1);
    const idemCount = await db.invoiceCollectionIdempotency.count({
      where: { companyId: companyAId, idempotencyKey: key },
    });
    assert.equal(idemCount, 1);
  });

  it("parallel farklı key over-collection race", async () => {
    const { createMobileInvoice } = await import("./mobile-invoices-service");
    const { createMobileCollection } = await import("./mobile-collections-service");
    const inv = await createMobileInvoice({
      companyId: companyAId,
      userId: ownerAId,
      role: "OWNER",
      isOwner: true,
      body: {
        customerId: customerAId,
        items: [{ name: "Race", quantity: 1, unitPrice: 50, vatRate: 20 }],
        paymentStatus: "UNPAID",
        action: "CREATE",
      },
    });
    const remaining = inv.invoice.remainingAmount;
    const key1 = randomUUID();
    const key2 = randomUUID();
    const half = Math.round((remaining / 2) * 100) / 100;
    const results = await Promise.allSettled([
      createMobileCollection({
        companyId: companyAId,
        userId: ownerAId,
        role: "OWNER",
        isOwner: true,
        body: { invoiceId: inv.invoice.id, accountId: accountAId, amount: half + 1, idempotencyKey: key1 },
      }),
      createMobileCollection({
        companyId: companyAId,
        userId: ownerAId,
        role: "OWNER",
        isOwner: true,
        body: { invoiceId: inv.invoice.id, accountId: accountAId, amount: half + 1, idempotencyKey: key2 },
      }),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const fail = results.filter((r) => r.status === "rejected").length;
    assert.equal(ok + fail, 2);
    assert.equal(ok, 1);
    assert.equal(fail, 1);
    const updated = await db.invoice.findUnique({ where: { id: inv.invoice.id } });
    assert.ok(updated!.paidAmount <= updated!.total);
  });

  it("failed collection sonra aynı key retry", async () => {
    const { createMobileInvoice } = await import("./mobile-invoices-service");
    const { createMobileCollection } = await import("./mobile-collections-service");
    const inv = await createMobileInvoice({
      companyId: companyAId,
      userId: ownerAId,
      role: "OWNER",
      isOwner: true,
      body: {
        customerId: customerAId,
        items: [{ name: "Retry", quantity: 1, unitPrice: 40, vatRate: 20 }],
        paymentStatus: "UNPAID",
        action: "CREATE",
      },
    });
    const key = randomUUID();
    const over = inv.invoice.remainingAmount + 100;
    await assert.rejects(
      () =>
        createMobileCollection({
          companyId: companyAId,
          userId: ownerAId,
          role: "OWNER",
          isOwner: true,
          body: {
            invoiceId: inv.invoice.id,
            accountId: accountAId,
            amount: over,
            idempotencyKey: key,
          },
        }),
      (e: unknown) =>
        e instanceof MobileFinanceError && e.code === "COLLECTION_AMOUNT_EXCEEDS_REMAINING"
    );
    const failed = await db.invoiceCollectionIdempotency.findUnique({
      where: { companyId_idempotencyKey: { companyId: companyAId, idempotencyKey: key } },
    });
    assert.equal(failed?.status, "FAILED");
    const retry = await createMobileCollection({
      companyId: companyAId,
      userId: ownerAId,
      role: "OWNER",
      isOwner: true,
      body: {
        invoiceId: inv.invoice.id,
        accountId: accountAId,
        amount: 10,
        idempotencyKey: key,
      },
    });
    assert.equal(retry.status, "COMPLETED");
  });

  it("transfer atomicity ve bakiye", async () => {
    const accountTo = await db.account.create({
      data: {
        companyId: companyAId,
        name: "Kasa Transfer Hedef",
        type: "CASH",
        balance: 0,
        currency: "TRY",
        status: "ACTIVE",
      },
    });
    const priorFrom = await db.account.findUnique({ where: { id: accountAId } });
    await db.account.update({ where: { id: accountAId }, data: { balance: 1000 } });
    const { transferMobileFinance } = await import("./mobile-finance-service");
    try {
      await transferMobileFinance({
        companyId: companyAId,
        userId: ownerAId,
        role: "OWNER",
        isOwner: true,
        body: { fromAccountId: accountAId, toAccountId: accountTo.id, amount: 250 },
      });
      const from = await db.account.findUnique({ where: { id: accountAId } });
      const to = await db.account.findUnique({ where: { id: accountTo.id } });
      assert.equal(Number(from!.balance), 750);
      assert.equal(Number(to!.balance), 250);
    } finally {
      await db.accountTransaction.deleteMany({ where: { accountId: accountTo.id } });
      await db.account.deleteMany({ where: { id: accountTo.id } });
      await db.account.update({
        where: { id: accountAId },
        data: { balance: priorFrom?.balance ?? 0 },
      });
    }
  });

  it("insufficient balance transfer", async () => {
    const accountTo = await db.account.create({
      data: {
        companyId: companyAId,
        name: "Kasa Transfer B",
        type: "CASH",
        balance: 0,
        currency: "TRY",
        status: "ACTIVE",
      },
    });
    const priorFrom = await db.account.findUnique({ where: { id: accountAId } });
    await db.account.update({ where: { id: accountAId }, data: { balance: 5 } });
    const { transferMobileFinance } = await import("./mobile-finance-service");
    try {
      await assert.rejects(
        () =>
          transferMobileFinance({
            companyId: companyAId,
            userId: ownerAId,
            role: "OWNER",
            isOwner: true,
            body: { fromAccountId: accountAId, toAccountId: accountTo.id, amount: 50 },
          }),
        (e: unknown) => e instanceof MobileFinanceError && e.code === "INSUFFICIENT_BALANCE"
      );
      const from = await db.account.findUnique({ where: { id: accountAId } });
      assert.equal(Number(from!.balance), 5);
    } finally {
      await db.account.deleteMany({ where: { id: accountTo.id } });
      await db.account.update({
        where: { id: accountAId },
        data: { balance: priorFrom?.balance ?? 0 },
      });
    }
  });

  it("parallel transfer tutarlılık", async () => {
    const stamp = randomUUID().slice(0, 8);
    const fromAccount = await db.account.create({
      data: {
        companyId: companyAId,
        name: `Kasa Parallel From ${stamp}`,
        type: "CASH",
        balance: 500,
        currency: "TRY",
        status: "ACTIVE",
      },
    });
    const toAccount = await db.account.create({
      data: {
        companyId: companyAId,
        name: `Kasa Parallel To ${stamp}`,
        type: "CASH",
        balance: 0,
        currency: "TRY",
        status: "ACTIVE",
      },
    });
    const { transferMobileFinance } = await import("./mobile-finance-service");
    const base = {
      companyId: companyAId,
      userId: ownerAId,
      role: "OWNER" as const,
      isOwner: true,
    };
    try {
      const results = await Promise.allSettled([
        transferMobileFinance({
          ...base,
          body: { fromAccountId: fromAccount.id, toAccountId: toAccount.id, amount: 350 },
        }),
        transferMobileFinance({
          ...base,
          body: { fromAccountId: fromAccount.id, toAccountId: toAccount.id, amount: 350 },
        }),
      ]);
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      assert.equal(fulfilled.length, 1);
      assert.equal(rejected.length, 1);
      const failReason = rejected[0];
      assert.equal(failReason.status, "rejected");
      assert.ok(failReason.reason instanceof MobileFinanceError);
      assert.equal(failReason.reason.code, "INSUFFICIENT_BALANCE");

      const from = await db.account.findUnique({ where: { id: fromAccount.id } });
      const to = await db.account.findUnique({ where: { id: toAccount.id } });
      assert.equal(Number(from!.balance), 150);
      assert.equal(Number(to!.balance), 350);
      assert.equal(Number(from!.balance) + Number(to!.balance), 500);

      const txCount = await db.accountTransaction.count({
        where: { accountId: { in: [fromAccount.id, toAccount.id] } },
      });
      assert.equal(txCount, 2);
    } finally {
      await db.accountTransaction.deleteMany({
        where: { accountId: { in: [fromAccount.id, toAccount.id] } },
      });
      await db.account.deleteMany({
        where: { id: { in: [fromAccount.id, toAccount.id] } },
      });
    }
  });

  it("parallel transfer tutarlılık 10x", async () => {
    const { transferMobileFinance } = await import("./mobile-finance-service");
    const base = {
      companyId: companyAId,
      userId: ownerAId,
      role: "OWNER" as const,
      isOwner: true,
    };

    for (let run = 0; run < 10; run += 1) {
      const stamp = `${randomUUID().slice(0, 8)}-${run}`;
      const fromAccount = await db.account.create({
        data: {
          companyId: companyAId,
          name: `Kasa Parallel Repeat From ${stamp}`,
          type: "CASH",
          balance: 500,
          currency: "TRY",
          status: "ACTIVE",
        },
      });
      const toAccount = await db.account.create({
        data: {
          companyId: companyAId,
          name: `Kasa Parallel Repeat To ${stamp}`,
          type: "CASH",
          balance: 0,
          currency: "TRY",
          status: "ACTIVE",
        },
      });

      try {
        const results = await Promise.allSettled([
          transferMobileFinance({
            ...base,
            body: { fromAccountId: fromAccount.id, toAccountId: toAccount.id, amount: 350 },
          }),
          transferMobileFinance({
            ...base,
            body: { fromAccountId: fromAccount.id, toAccountId: toAccount.id, amount: 350 },
          }),
        ]);

        assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
        const from = await db.account.findUnique({ where: { id: fromAccount.id } });
        const to = await db.account.findUnique({ where: { id: toAccount.id } });
        assert.equal(Number(from!.balance), 150);
        assert.equal(Number(to!.balance), 350);
      } finally {
        await db.accountTransaction.deleteMany({
          where: { accountId: { in: [fromAccount.id, toAccount.id] } },
        });
        await db.account.deleteMany({
          where: { id: { in: [fromAccount.id, toAccount.id] } },
        });
      }
    }
  });
});
