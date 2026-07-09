/**
 * Faz 4B — işlem iptal/ters kayıt gerçek DB integration testleri.
 * TEST_DATABASE_URL yoksa kontrollü skip.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

const TEST_DB_URL = process.env.TEST_DATABASE_URL;
const DB_AVAILABLE = !!TEST_DB_URL && TEST_DB_URL.includes("_test");
const SKIP_REASON = DB_AVAILABLE
  ? false
  : "SKIP: lifecycle cancellation DB tests require TEST_DATABASE_URL pointing to a _test database";

describe("faz 4b lifecycle cancellation — gerçek DB", { skip: SKIP_REASON }, () => {
  let db: PrismaClient;
  let companyId: string;
  let otherCompanyId: string;
  let userId: string;
  let userIds: string[] = [];
  let companyIds: string[] = [];

  before(async () => {
    const { PrismaClient } = await import("@prisma/client");
    db = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
    await db.$connect();

    const { hashPassword } = await import("@/lib/auth");
    const hash = await hashPassword("TestPass123!");
    const stamp = `lifecycle-4b-${Date.now()}`;

    const owner = await db.user.create({
      data: {
        email: `${stamp}-owner@qa.internal`,
        password: hash,
        name: "Lifecycle 4B Owner",
        role: "OWNER",
        status: "ACTIVE",
      },
    });
    userId = owner.id;
    userIds.push(owner.id);

    const company = await db.company.create({
      data: { name: `Lifecycle 4B Co ${stamp}`, status: "ACTIVE" },
    });
    companyId = company.id;
    companyIds.push(company.id);

    const otherCompany = await db.company.create({
      data: { name: `Lifecycle 4B Other ${stamp}`, status: "ACTIVE" },
    });
    otherCompanyId = otherCompany.id;
    companyIds.push(otherCompany.id);

    await db.companyUser.create({
      data: {
        userId,
        companyId,
        role: "OWNER",
        isOwner: true,
        status: "ACTIVE",
      },
    });
  });

  after(async () => {
    await db.stockMovement.deleteMany({
      where: { companyId: { in: companyIds } },
    });
    await db.warehouseTransferItem.deleteMany({
      where: { transfer: { companyId: { in: companyIds } } },
    });
    await db.warehouseTransfer.deleteMany({
      where: { companyId: { in: companyIds } },
    });
    await db.warehouseStock.deleteMany({
      where: { companyId: { in: companyIds } },
    });
    await db.saleItem.deleteMany({
      where: { sale: { companyId: { in: companyIds } } },
    });
    await db.accountTransaction.deleteMany({
      where: { account: { companyId: { in: companyIds } } },
    });
    await db.sale.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.invoice.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.expense.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.accountTransferIdempotency.deleteMany({
      where: { companyId: { in: companyIds } },
    });
    await db.product.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.warehouse.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.account.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.activityLog.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.companyUser.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.company.deleteMany({ where: { id: { in: companyIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  });

  async function createAccount(name: string, balance = 1000) {
    return db.account.create({
      data: {
        companyId,
        name,
        type: "CASH",
        balance,
        currency: "TRY",
        status: "ACTIVE",
      },
    });
  }

  it("paid expense cancellation restores balance and creates reversal mirror", async () => {
    const { cancelExpenseRecord } = await import("./expense-service");
    const account = await createAccount("Gider Kasa", 1000);

    const expense = await db.expense.create({
      data: {
        companyId,
        userId,
        title: "Test Gider",
        category: "Diğer",
        amount: 150,
        status: "APPROVED",
        paymentStatus: "PAID",
        accountId: account.id,
        date: new Date(),
      },
    });

    const sourceTx = await db.accountTransaction.create({
      data: {
        accountId: account.id,
        type: "EXPENSE",
        title: "Gider - Test Gider",
        amount: 150,
        date: new Date(),
        expenseId: expense.id,
      },
    });

    await db.account.update({
      where: { id: account.id },
      data: { balance: 850 },
    });

    const first = await cancelExpenseRecord({
      companyId,
      userId,
      expenseId: expense.id,
      reason: "Yanlış kayıt",
    });
    assert.equal(first.ok, true);

    const accountAfter = await db.account.findUnique({ where: { id: account.id } });
    assert.equal(Number(accountAfter!.balance), 1000);

    const sourceStillThere = await db.accountTransaction.findUnique({
      where: { id: sourceTx.id },
    });
    assert.ok(sourceStillThere);
    assert.equal(sourceStillThere!.expenseId, expense.id);

    const mirrors = await db.accountTransaction.findMany({
      where: {
        accountId: account.id,
        type: "INCOME",
        note: { contains: sourceTx.id },
      },
    });
    assert.equal(mirrors.length, 1);
    assert.equal(mirrors[0]!.expenseId, null);

    const cancelled = await db.expense.findUnique({ where: { id: expense.id } });
    assert.equal(cancelled!.status, "CANCELLED");
    assert.equal(cancelled!.paymentStatus, "UNPAID");

    const logs = await db.activityLog.count({
      where: {
        companyId,
        entityId: expense.id,
        action: "CANCEL",
      },
    });
    assert.equal(logs, 1);

    const second = await cancelExpenseRecord({
      companyId,
      userId,
      expenseId: expense.id,
      reason: "Yanlış kayıt",
    });
    assert.equal(second.ok, false);
    if (!second.ok) assert.equal(second.status, 409);

    const mirrorsAfterSecond = await db.accountTransaction.count({
      where: {
        accountId: account.id,
        type: "INCOME",
        note: { contains: sourceTx.id },
      },
    });
    assert.equal(mirrorsAfterSecond, 1);
  });

  it("linked cash movement cannot be directly deleted", async () => {
    const { deleteManualAccountTransaction } = await import(
      "./cash-bank-transaction-mutation-service"
    );
    const account = await createAccount("Bağlı Hareket Kasa", 500);

    const expense = await db.expense.create({
      data: {
        companyId,
        userId,
        title: "Bağlı Gider",
        category: "Diğer",
        amount: 50,
        status: "APPROVED",
        paymentStatus: "PAID",
        accountId: account.id,
        date: new Date(),
      },
    });

    const tx = await db.accountTransaction.create({
      data: {
        accountId: account.id,
        type: "EXPENSE",
        title: "Gider - Bağlı Gider",
        amount: 50,
        date: new Date(),
        expenseId: expense.id,
      },
    });

    const result = await deleteManualAccountTransaction({
      companyId,
      userId,
      transactionId: tx.id,
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /bağlı olduğu işlem/i);
    }
  });

  it("completed transfer reversal updates both account balances idempotently", async () => {
    const { applyAccountTransfer, cancelAccountTransfer } = await import(
      "./cash-bank-account-service"
    );
    const from = await createAccount("Xfer From", 1000);
    const to = await createAccount("Xfer To", 0);
    const key = randomUUID();

    const transfer = await applyAccountTransfer({
      companyId,
      userId,
      data: {
        fromAccountId: from.id,
        toAccountId: to.id,
        amount: 200,
        idempotencyKey: key,
      },
    });
    assert.equal(transfer.ok, true);
    const transferGroupId = (transfer as { data: { transferGroupId: string } }).data
      .transferGroupId;

    const cancel1 = await cancelAccountTransfer({
      companyId,
      userId,
      transferGroupId,
      reason: "Yanlış transfer",
    });
    assert.equal(cancel1.ok, true);

    const fromAfter = await db.account.findUnique({ where: { id: from.id } });
    const toAfter = await db.account.findUnique({ where: { id: to.id } });
    assert.equal(Number(fromAfter!.balance), 1000);
    assert.equal(Number(toAfter!.balance), 0);

    const cancel2 = await cancelAccountTransfer({
      companyId,
      userId,
      transferGroupId,
      reason: "Yanlış transfer",
    });
    assert.equal(cancel2.ok, true);
    assert.equal((cancel2 as { replayed?: boolean }).replayed, true);
  });

  it("draft invoice can be deleted", async () => {
    const { deleteInvoiceRecord } = await import("./invoice-cancel-service");
    const invoice = await db.invoice.create({
      data: {
        companyId,
        invoiceNo: `DRF-${Date.now()}`,
        type: "NORMAL",
        status: "DRAFT",
        paymentStatus: "UNPAID",
        total: 100,
        subtotal: 100,
        taxableAmount: 100,
        totalVat: 0,
        paidAmount: 0,
      },
    });

    const deleted = await deleteInvoiceRecord({
      companyId,
      userId,
      invoiceId: invoice.id,
    });
    assert.equal(deleted.ok, true);

    const exists = await db.invoice.findUnique({ where: { id: invoice.id } });
    assert.equal(exists, null);
  });

  it("paid invoice hard delete rejected via cancel eligibility", async () => {
    const { cancelInvoiceRecord } = await import("./invoice-cancel-service");
    const invoice = await db.invoice.create({
      data: {
        companyId,
        invoiceNo: `PD-${Date.now()}`,
        type: "NORMAL",
        status: "SENT",
        paymentStatus: "PAID",
        total: 200,
        subtotal: 200,
        taxableAmount: 200,
        totalVat: 0,
        paidAmount: 200,
      },
    });

    const result = await cancelInvoiceRecord({
      companyId,
      userId,
      invoiceId: invoice.id,
      reason: "test",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /tahsilat/i);
    }
  });

  it("collection reversal recalculates invoice payment state", async () => {
    const { reverseInvoiceCollection } = await import(
      "./invoice-collection-reversal-service"
    );
    const account = await createAccount("Tahsilat Kasa", 500);
    const invoice = await db.invoice.create({
      data: {
        companyId,
        invoiceNo: `COL-${Date.now()}`,
        type: "NORMAL",
        status: "SENT",
        paymentStatus: "PAID",
        total: 100,
        subtotal: 100,
        taxableAmount: 100,
        totalVat: 0,
        paidAmount: 100,
      },
    });

    const collection = await db.accountTransaction.create({
      data: {
        accountId: account.id,
        type: "INCOME",
        title: `Fatura Tahsilatı - ${invoice.invoiceNo}`,
        amount: 100,
        date: new Date(),
        invoiceId: invoice.id,
      },
    });

    await db.account.update({
      where: { id: account.id },
      data: { balance: 600 },
    });

    const reversed = await reverseInvoiceCollection({
      companyId,
      userId,
      accountTransactionId: collection.id,
      reason: "Yanlış tahsilat",
    });
    assert.equal(reversed.ok, true);

    const updated = await db.invoice.findUnique({ where: { id: invoice.id } });
    assert.equal(Number(updated!.paidAmount), 0);
    assert.equal(updated!.paymentStatus, "UNPAID");
  });

  it("cross-tenant mutation rejected", async () => {
    const { cancelExpenseRecord } = await import("./expense-service");
    const expense = await db.expense.create({
      data: {
        companyId,
        userId,
        title: "Tenant Guard",
        category: "Diğer",
        amount: 10,
        status: "APPROVED",
        paymentStatus: "UNPAID",
        date: new Date(),
      },
    });

    const result = await cancelExpenseRecord({
      companyId: otherCompanyId,
      userId,
      expenseId: expense.id,
      reason: "test",
    });

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 404);
  });

  it("marketplace order archive preserves archivedAt after sync-style update", async () => {
    const { archiveOrder, restoreOrder } = await import("./order-archive-service");
    const sale = await db.sale.create({
      data: {
        companyId,
        saleNo: `ORD-ARCH-${Date.now()}`,
        sourceChannel: "TRENDYOL",
        externalOrderId: `ext-${Date.now()}`,
        orderStatus: "WAITING",
        total: 250,
        subtotal: 250,
      },
    });

    const archived = await archiveOrder({
      companyId,
      userId,
      orderId: sale.id,
    });
    assert.equal(archived.ok, true);

    await db.sale.update({
      where: { id: sale.id },
      data: {
        orderStatus: "APPROVED",
        trackingNumber: "TRK-123",
      },
    });

    const afterSync = await db.sale.findUnique({ where: { id: sale.id } });
    assert.ok(afterSync?.archivedAt);
    assert.equal(afterSync?.orderStatus, "APPROVED");

    const restored = await restoreOrder({
      companyId,
      userId,
      orderId: sale.id,
    });
    assert.equal(restored.ok, true);

    const afterRestore = await db.sale.findUnique({ where: { id: sale.id } });
    assert.equal(afterRestore?.archivedAt, null);
  });

  it("cross-tenant order archive rejected", async () => {
    const { archiveOrder } = await import("./order-archive-service");
    const sale = await db.sale.create({
      data: {
        companyId,
        saleNo: `ORD-TENANT-${Date.now()}`,
        sourceChannel: "MANUAL",
        orderStatus: "WAITING",
        total: 100,
        subtotal: 100,
      },
    });

    const result = await archiveOrder({
      companyId: otherCompanyId,
      userId,
      orderId: sale.id,
    });

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 404);
  });

  it("STOCK sale cancel restores stock and finance; duplicate cancels produce no extra movements", async () => {
    const { cancelSaleById } = await import("./sale-cancel-service");
    const stamp = Date.now();

    const warehouse = await db.warehouse.create({
      data: {
        companyId,
        name: `WH-STOCK-${stamp}`,
        status: "ACTIVE",
        isDefault: true,
      },
    });

    const product = await db.product.create({
      data: {
        companyId,
        name: `Stock Ürün ${stamp}`,
        productType: "STOCK",
        stock: 10,
        sellPrice: 100,
        buyPrice: 50,
      },
    });

    await db.warehouseStock.create({
      data: {
        companyId,
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 10,
      },
    });

    const account = await createAccount(`Satış Kasa ${stamp}`, 500);
    const saleNo = `SL-STOCK-${stamp}`;

    const sale = await db.sale.create({
      data: {
        companyId,
        userId,
        saleNo,
        status: "COMPLETED",
        paymentStatus: "PAID",
        paidAmount: 100,
        total: 100,
        subtotal: 100,
        warehouseId: warehouse.id,
        items: {
          create: {
            productId: product.id,
            warehouseId: warehouse.id,
            name: product.name,
            quantity: 2,
            unitPrice: 50,
            vatRate: 0,
            total: 100,
          },
        },
      },
    });

    await db.warehouseStock.update({
      where: {
        warehouseId_productId: {
          warehouseId: warehouse.id,
          productId: product.id,
        },
      },
      data: { quantity: 8 },
    });
    await db.product.update({
      where: { id: product.id },
      data: { stock: 8 },
    });

    await db.stockMovement.create({
      data: {
        companyId,
        productId: product.id,
        warehouseId: warehouse.id,
        type: "SALE",
        quantity: -2,
        note: `${saleNo} satışı`,
      },
    });

    await db.accountTransaction.create({
      data: {
        accountId: account.id,
        type: "INCOME",
        title: `Satış - ${saleNo}`,
        amount: 100,
        note: saleNo,
        date: new Date(),
      },
    });
    await db.account.update({
      where: { id: account.id },
      data: { balance: 600 },
    });

    const first = await cancelSaleById(sale.id, companyId, userId, {
      reason: "Yanlış satış",
    });
    assert.equal(first.ok, true);

    const stockAfter = await db.warehouseStock.findUnique({
      where: {
        warehouseId_productId: {
          warehouseId: warehouse.id,
          productId: product.id,
        },
      },
    });
    assert.equal(stockAfter!.quantity, 10);

    const productAfter = await db.product.findUnique({ where: { id: product.id } });
    assert.equal(productAfter!.stock, 10);

    const returns = await db.stockMovement.count({
      where: {
        companyId,
        productId: product.id,
        type: "RETURN",
        note: { contains: saleNo },
      },
    });
    assert.equal(returns, 1);

    const accountAfter = await db.account.findUnique({ where: { id: account.id } });
    assert.equal(Number(accountAfter!.balance), 500);

    const saleAfter = await db.sale.findUnique({ where: { id: sale.id } });
    assert.equal(saleAfter!.status, "CANCELLED");

    const second = await cancelSaleById(sale.id, companyId, userId, {
      reason: "Yanlış satış",
    });
    assert.equal(second.ok, false);

    const returnsAfterSecond = await db.stockMovement.count({
      where: {
        companyId,
        productId: product.id,
        type: "RETURN",
        note: { contains: saleNo },
      },
    });
    assert.equal(returnsAfterSecond, 1);
  });

  it("SERVICE sale cancel creates no StockMovement and does not change product stock", async () => {
    const { cancelSaleById } = await import("./sale-cancel-service");
    const stamp = Date.now();

    const product = await db.product.create({
      data: {
        companyId,
        name: `Service Ürün ${stamp}`,
        productType: "SERVICE",
        stock: 0,
        sellPrice: 200,
        buyPrice: 0,
      },
    });

    const account = await createAccount(`Hizmet Kasa ${stamp}`, 300);
    const saleNo = `SL-SVC-${stamp}`;

    const sale = await db.sale.create({
      data: {
        companyId,
        userId,
        saleNo,
        status: "COMPLETED",
        paymentStatus: "PAID",
        paidAmount: 200,
        total: 200,
        subtotal: 200,
        items: {
          create: {
            productId: product.id,
            name: product.name,
            quantity: 1,
            unitPrice: 200,
            vatRate: 0,
            total: 200,
          },
        },
      },
    });

    await db.accountTransaction.create({
      data: {
        accountId: account.id,
        type: "INCOME",
        title: `Satış - ${saleNo}`,
        amount: 200,
        note: saleNo,
        date: new Date(),
      },
    });
    await db.account.update({
      where: { id: account.id },
      data: { balance: 500 },
    });

    const beforeMovements = await db.stockMovement.count({
      where: { companyId, productId: product.id },
    });

    const result = await cancelSaleById(sale.id, companyId, userId, {
      reason: "Hizmet iptali",
    });
    assert.equal(result.ok, true);

    const afterMovements = await db.stockMovement.count({
      where: { companyId, productId: product.id },
    });
    assert.equal(afterMovements, beforeMovements);

    const productAfter = await db.product.findUnique({ where: { id: product.id } });
    assert.equal(productAfter!.stock, 0);

    const accountAfter = await db.account.findUnique({ where: { id: account.id } });
    assert.equal(Number(accountAfter!.balance), 300);
  });

  it("warehouse transfer cancel restores both stocks; insufficient destination blocks without partial write", async () => {
    const { executeWarehouseTransfer, cancelWarehouseTransferAtomic } =
      await import("./warehouse-transfer-service");
    const stamp = Date.now();

    const fromWh = await db.warehouse.create({
      data: {
        companyId,
        name: `From-${stamp}`,
        status: "ACTIVE",
      },
    });
    const toWh = await db.warehouse.create({
      data: {
        companyId,
        name: `To-${stamp}`,
        status: "ACTIVE",
      },
    });
    const product = await db.product.create({
      data: {
        companyId,
        name: `Transfer Ürün ${stamp}`,
        productType: "STOCK",
        stock: 20,
        sellPrice: 10,
        buyPrice: 5,
      },
    });

    await db.warehouseStock.create({
      data: {
        companyId,
        warehouseId: fromWh.id,
        productId: product.id,
        quantity: 20,
      },
    });
    await db.warehouseStock.create({
      data: {
        companyId,
        warehouseId: toWh.id,
        productId: product.id,
        quantity: 0,
      },
    });

    const transfer = await executeWarehouseTransfer({
      companyId,
      userId,
      fromWarehouseId: fromWh.id,
      toWarehouseId: toWh.id,
      items: [{ productId: product.id, quantity: 5 }],
      idempotencyKey: randomUUID(),
    });
    assert.equal(transfer.ok, true);
    if (!transfer.ok) return;

    const transferId = transfer.data.id;

    const fromAfterXfer = await db.warehouseStock.findUnique({
      where: {
        warehouseId_productId: { warehouseId: fromWh.id, productId: product.id },
      },
    });
    const toAfterXfer = await db.warehouseStock.findUnique({
      where: {
        warehouseId_productId: { warehouseId: toWh.id, productId: product.id },
      },
    });
    assert.equal(fromAfterXfer!.quantity, 15);
    assert.equal(toAfterXfer!.quantity, 5);

    // Simulate destination stock depletion before cancel
    await db.warehouseStock.update({
      where: {
        warehouseId_productId: { warehouseId: toWh.id, productId: product.id },
      },
      data: { quantity: 0 },
    });

    const blocked = await cancelWarehouseTransferAtomic(
      companyId,
      userId,
      transferId,
      "Hedef stok yetersiz"
    );
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.match(blocked.message, /yetersiz/i);
    }

    const transferStatus = await db.warehouseTransfer.findUnique({
      where: { id: transferId },
    });
    assert.equal(transferStatus!.status, "COMPLETED");

    const cancelMovements = await db.stockMovement.count({
      where: {
        companyId,
        transferId,
        note: { contains: "iptal" },
      },
    });
    assert.equal(cancelMovements, 0);

    const cancelLogs = await db.activityLog.count({
      where: {
        companyId,
        entityId: transferId,
        action: "CANCEL",
      },
    });
    assert.equal(cancelLogs, 0);

    // Restore destination stock and cancel successfully
    await db.warehouseStock.update({
      where: {
        warehouseId_productId: { warehouseId: toWh.id, productId: product.id },
      },
      data: { quantity: 5 },
    });

    const cancelled = await cancelWarehouseTransferAtomic(
      companyId,
      userId,
      transferId,
      "Transfer iptali"
    );
    assert.equal(cancelled.ok, true);

    const fromRestored = await db.warehouseStock.findUnique({
      where: {
        warehouseId_productId: { warehouseId: fromWh.id, productId: product.id },
      },
    });
    const toRestored = await db.warehouseStock.findUnique({
      where: {
        warehouseId_productId: { warehouseId: toWh.id, productId: product.id },
      },
    });
    assert.equal(fromRestored!.quantity, 20);
    assert.equal(toRestored!.quantity, 0);

    const linkedCancelMovements = await db.stockMovement.findMany({
      where: {
        companyId,
        transferId,
        note: { contains: "iptal" },
      },
    });
    assert.equal(linkedCancelMovements.length, 2);

    const secondCancel = await cancelWarehouseTransferAtomic(
      companyId,
      userId,
      transferId,
      "Tekrar"
    );
    assert.equal(secondCancel.ok, false);
    if (!secondCancel.ok) assert.equal(secondCancel.status, 409);

    const foreign = await cancelWarehouseTransferAtomic(
      otherCompanyId,
      userId,
      transferId,
      "Yabancı tenant"
    );
    assert.equal(foreign.ok, false);
    if (!foreign.ok) assert.equal(foreign.status, 404);
  });

  it("finance cancel rolls back partial AccountTransaction when test hook throws", async () => {
    const { cancelExpenseRecord } = await import("./expense-service");
    const {
      setExpenseCancelTestHook,
      clearAllTransactionTestHooks,
    } = await import("./test-transaction-hooks");

    const account = await createAccount("Rollback Kasa", 1000);
    const expense = await db.expense.create({
      data: {
        companyId,
        userId,
        title: "Rollback Gider",
        category: "Diğer",
        amount: 80,
        status: "APPROVED",
        paymentStatus: "PAID",
        accountId: account.id,
        date: new Date(),
      },
    });

    await db.accountTransaction.create({
      data: {
        accountId: account.id,
        type: "EXPENSE",
        title: "Gider - Rollback Gider",
        amount: 80,
        date: new Date(),
        expenseId: expense.id,
      },
    });
    await db.account.update({
      where: { id: account.id },
      data: { balance: 920 },
    });

    const txBefore = await db.accountTransaction.count({
      where: { accountId: account.id },
    });
    const logsBefore = await db.activityLog.count({
      where: { companyId, entityId: expense.id },
    });

    setExpenseCancelTestHook(() => {
      throw new Error("TEST_INJECTED_FINANCE_ROLLBACK");
    });

    try {
      await assert.rejects(
        () =>
          cancelExpenseRecord({
            companyId,
            userId,
            expenseId: expense.id,
            reason: "Rollback testi",
          }),
        /TEST_INJECTED_FINANCE_ROLLBACK/
      );
    } finally {
      clearAllTransactionTestHooks();
    }

    const expenseAfter = await db.expense.findUnique({ where: { id: expense.id } });
    assert.equal(expenseAfter!.status, "APPROVED");
    assert.equal(expenseAfter!.paymentStatus, "PAID");

    const accountAfter = await db.account.findUnique({ where: { id: account.id } });
    assert.equal(Number(accountAfter!.balance), 920);

    const txAfter = await db.accountTransaction.count({
      where: { accountId: account.id },
    });
    assert.equal(txAfter, txBefore);

    const logsAfter = await db.activityLog.count({
      where: { companyId, entityId: expense.id },
    });
    assert.equal(logsAfter, logsBefore);
  });

  it("stock transfer cancel rolls back partial StockMovement when test hook throws", async () => {
    const { executeWarehouseTransfer, cancelWarehouseTransferAtomic } =
      await import("./warehouse-transfer-service");
    const {
      setWarehouseTransferCancelTestHook,
      clearAllTransactionTestHooks,
    } = await import("./test-transaction-hooks");
    const stamp = Date.now();

    const fromWh = await db.warehouse.create({
      data: { companyId, name: `RB-From-${stamp}`, status: "ACTIVE" },
    });
    const toWh = await db.warehouse.create({
      data: { companyId, name: `RB-To-${stamp}`, status: "ACTIVE" },
    });
    const product = await db.product.create({
      data: {
        companyId,
        name: `RB Transfer ${stamp}`,
        productType: "STOCK",
        stock: 10,
        sellPrice: 10,
        buyPrice: 5,
      },
    });
    await db.warehouseStock.create({
      data: {
        companyId,
        warehouseId: fromWh.id,
        productId: product.id,
        quantity: 10,
      },
    });
    await db.warehouseStock.create({
      data: {
        companyId,
        warehouseId: toWh.id,
        productId: product.id,
        quantity: 0,
      },
    });

    const transfer = await executeWarehouseTransfer({
      companyId,
      userId,
      fromWarehouseId: fromWh.id,
      toWarehouseId: toWh.id,
      items: [{ productId: product.id, quantity: 3 }],
      idempotencyKey: randomUUID(),
    });
    assert.equal(transfer.ok, true);
    if (!transfer.ok) return;

    const transferId = transfer.data.id;
    const movementsBefore = await db.stockMovement.count({
      where: { companyId, transferId },
    });
    const fromBefore = await db.warehouseStock.findUnique({
      where: {
        warehouseId_productId: { warehouseId: fromWh.id, productId: product.id },
      },
    });
    const toBefore = await db.warehouseStock.findUnique({
      where: {
        warehouseId_productId: { warehouseId: toWh.id, productId: product.id },
      },
    });

    setWarehouseTransferCancelTestHook(() => {
      throw new Error("TEST_INJECTED_STOCK_ROLLBACK");
    });

    try {
      await assert.rejects(
        () =>
          cancelWarehouseTransferAtomic(
            companyId,
            userId,
            transferId,
            "Rollback stok"
          ),
        /TEST_INJECTED_STOCK_ROLLBACK/
      );
    } finally {
      clearAllTransactionTestHooks();
    }

    const transferAfter = await db.warehouseTransfer.findUnique({
      where: { id: transferId },
    });
    assert.equal(transferAfter!.status, "COMPLETED");

    const fromAfter = await db.warehouseStock.findUnique({
      where: {
        warehouseId_productId: { warehouseId: fromWh.id, productId: product.id },
      },
    });
    const toAfter = await db.warehouseStock.findUnique({
      where: {
        warehouseId_productId: { warehouseId: toWh.id, productId: product.id },
      },
    });
    assert.equal(fromAfter!.quantity, fromBefore!.quantity);
    assert.equal(toAfter!.quantity, toBefore!.quantity);

    const movementsAfter = await db.stockMovement.count({
      where: { companyId, transferId },
    });
    assert.equal(movementsAfter, movementsBefore);

    const cancelLogs = await db.activityLog.count({
      where: { companyId, entityId: transferId, action: "CANCEL" },
    });
    assert.equal(cancelLogs, 0);
  });
});
