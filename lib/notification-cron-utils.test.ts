import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDailySummaryNotificationInput,
  buildDueInvoiceDedupeKey,
  buildDueInvoiceNotificationInput,
  buildEmployeePaymentDueDedupeKey,
  buildEmployeePaymentDueNotificationInput,
  buildLateCollectionNotificationInput,
  buildLowStockDedupeKey,
  buildLowStockNotificationInput,
  computeDailySummaryStats,
  countLowStockProducts,
  filterEmployeePaymentsDueOnWindow,
  filterInvoicesDueOnWindow,
  filterOverdueCollections,
  formatDateKey,
  maxDaysOverdue,
} from "./notification-cron-utils";
import { resolveShouldNotifyFromSettings as resolveFromNotificationUtils } from "./notification-utils";

describe("notification cron utils", () => {
  const referenceDate = new Date(2026, 5, 8, 10, 0, 0);

  it("formatDateKey yyyy-mm-dd üretir", () => {
    assert.equal(formatDateKey(referenceDate), "2026-06-08");
  });

  it("countLowStockProducts düşük stoklu aktif ürünleri sayar", () => {
    const count = countLowStockProducts([
      { stock: 5, minStock: 10, status: "ACTIVE" },
      { stock: 0, minStock: 10, status: "ACTIVE" },
      { stock: 3, minStock: 5, status: "ACTIVE" },
      { stock: 2, minStock: 5, status: "INACTIVE" },
    ]);

    assert.equal(count, 2);
  });

  it("filterInvoicesDueOnWindow yarın vadesi dolacak faturaları bulur", () => {
    const tomorrow = new Date(2026, 5, 9);
    const invoices = filterInvoicesDueOnWindow(
      [
        {
          dueDate: tomorrow,
          createdAt: new Date(2026, 5, 1),
        },
        {
          dueDate: new Date(2026, 5, 12),
          createdAt: new Date(2026, 5, 1),
        },
      ],
      "d-1",
      referenceDate,
      30
    );

    assert.equal(invoices.length, 1);
  });

  it("filterOverdueCollections vadesi geçmiş kayıtları döner", () => {
    const overdue = filterOverdueCollections(
      [
        { dueDate: new Date(2026, 5, 1), remaining: 100 },
        { dueDate: new Date(2026, 5, 10), remaining: 50 },
        { dueDate: new Date(2026, 5, 1), remaining: 0 },
      ],
      referenceDate
    );

    assert.equal(overdue.length, 1);
    assert.equal(overdue[0]?.remaining, 100);
  });

  it("maxDaysOverdue en uzun gecikmeyi hesaplar", () => {
    const days = maxDaysOverdue(
      [
        { dueDate: new Date(2026, 5, 1), remaining: 100 },
        { dueDate: new Date(2026, 5, 5), remaining: 50 },
      ],
      referenceDate
    );

    assert.equal(days, 7);
  });

  it("computeDailySummaryStats dünkü özetleri hesaplar", () => {
    const dayStart = new Date(2026, 5, 7, 0, 0, 0, 0);
    const dayEnd = new Date(2026, 5, 7, 23, 59, 59, 999);

    const stats = computeDailySummaryStats({
      sales: [
        { total: 25000, createdAt: new Date(2026, 5, 7, 12, 0, 0) },
        { total: 20000, createdAt: new Date(2026, 5, 7, 15, 0, 0) },
        { total: 5000, createdAt: new Date(2026, 5, 8, 9, 0, 0) },
      ],
      expenses: [{ date: new Date(2026, 5, 7, 10, 0, 0) }],
      invoices: [
        { createdAt: new Date(2026, 5, 7, 11, 0, 0) },
        { createdAt: new Date(2026, 5, 7, 18, 0, 0) },
      ],
      dayStart,
      dayEnd,
    });

    assert.equal(stats.salesCount, 2);
    assert.equal(stats.revenue, 45000);
    assert.equal(stats.expenseCount, 1);
    assert.equal(stats.invoiceCount, 2);
  });

  it("buildLowStockNotificationInput doğru alanları üretir", () => {
    const payload = buildLowStockNotificationInput({
      companyId: "c1",
      count: 5,
      dateKey: "2026-06-08",
    });

    assert.equal(payload.title, "Düşük stok uyarısı");
    assert.equal(payload.message, "5 ürün minimum stok seviyesinin altında.");
    assert.equal(payload.category, "STOCK");
    assert.equal(payload.module, "stocks");
    assert.equal(payload.entityType, "PRODUCT");
    assert.equal(payload.actionUrl, "/stocks");
    assert.equal(payload.priority, "HIGH");
    assert.equal(payload.dedupeKey, "low-stock:c1:2026-06-08");
  });

  it("buildDueInvoiceNotificationInput pencereye göre öncelik belirler", () => {
    const tomorrow = buildDueInvoiceNotificationInput({
      companyId: "c1",
      count: 3,
      window: "d-1",
      dateKey: "2026-06-08",
    });
    const threeDays = buildDueInvoiceNotificationInput({
      companyId: "c1",
      count: 3,
      window: "d-3",
      dateKey: "2026-06-08",
    });

    assert.equal(tomorrow.message, "Yarın vadesi dolacak 3 fatura var.");
    assert.equal(tomorrow.priority, "HIGH");
    assert.equal(threeDays.priority, "NORMAL");
    assert.equal(
      tomorrow.dedupeKey,
      buildDueInvoiceDedupeKey("c1", "d-1", "2026-06-08")
    );
  });

  it("buildLateCollectionNotificationInput kritik finans bildirimi üretir", () => {
    const payload = buildLateCollectionNotificationInput({
      companyId: "c1",
      count: 2,
      overdueDays: 7,
      dateKey: "2026-06-08",
    });

    assert.equal(payload.title, "Geciken tahsilatlar");
    assert.equal(payload.message, "7 gündür tahsil edilmeyen 2 kayıt var.");
    assert.equal(payload.category, "FINANCE");
    assert.equal(payload.module, "sales");
    assert.equal(payload.actionUrl, "/sales");
    assert.equal(payload.priority, "CRITICAL");
  });

  it("buildDailySummaryNotificationInput mesajı formatlar", () => {
    const payload = buildDailySummaryNotificationInput({
      companyId: "c1",
      stats: {
        salesCount: 12,
        revenue: 45000,
        expenseCount: 2,
        invoiceCount: 0,
      },
      dateKey: "2026-06-08",
    });

    assert.equal(payload.title, "Günlük özet");
    assert.equal(payload.message, "Dün: 12 satış, ₺45.000,00 ciro, 2 gider.");
    assert.equal(payload.category, "SYSTEM");
    assert.equal(payload.module, "dashboard");
    assert.equal(payload.actionUrl, "/dashboard");
    assert.equal(payload.priority, "NORMAL");
    assert.equal(payload.dedupeKey, "daily-summary:c1:2026-06-08");
  });

  it("dedupeKey aynı gün için aynı anahtarı üretir", () => {
    const first = buildLowStockDedupeKey("c1", "2026-06-08");
    const second = buildLowStockDedupeKey("c1", "2026-06-08");

    assert.equal(first, second);
    assert.notEqual(
      first,
      buildLowStockDedupeKey("c1", "2026-06-09")
    );
  });

  it("employee payment due notification oluşur", () => {
    const payload = buildEmployeePaymentDueNotificationInput({
      companyId: "c1",
      count: 3,
      window: "d0",
      dateKey: "2026-06-08",
    });

    assert.equal(payload.category, "FINANCE");
    assert.equal(payload.module, "employees");
    assert.equal(payload.entityType, "EMPLOYEE_PAYMENT");
    assert.equal(payload.priority, "HIGH");
    assert.match(payload.message, /Bugün vadesi gelen 3 çalışan ödemesi/);
    assert.equal(
      payload.dedupeKey,
      buildEmployeePaymentDueDedupeKey("c1", "d0", "2026-06-08")
    );
  });

  it("3 gün kala employee payment priority NORMAL", () => {
    const payload = buildEmployeePaymentDueNotificationInput({
      companyId: "c1",
      count: 5,
      window: "d-3",
      dateKey: "2026-06-08",
    });

    assert.equal(payload.priority, "NORMAL");
    assert.match(payload.message, /3 gün içinde/);
  });

  it("filterEmployeePaymentsDueOnWindow bugün ve gecikmiş ödemeleri sayar", () => {
    const today = new Date(2026, 5, 8);
    const matched = filterEmployeePaymentsDueOnWindow(
      [
        { dueDate: new Date(2026, 5, 8), status: "PENDING" },
        { dueDate: new Date(2026, 5, 5), status: "OVERDUE" },
        { dueDate: new Date(2026, 5, 10), status: "PENDING" },
      ],
      "d0",
      today
    );

    assert.equal(matched.length, 2);
  });
});

describe("notification cron toggle rules", () => {
  it("notifyLowStock false ise düşük stok bildirimi engellenir", () => {
    assert.equal(
      resolveFromNotificationUtils(
        {
          notifyLowStock: false,
          notifyDueInvoices: true,
          notifyLateCollections: true,
          notifyDailySummary: true,
          notifyEmployeePayments: true,
        },
        { isProactive: true, category: "STOCK" }
      ),
      false
    );
  });

  it("notifyDueInvoices false ise vade bildirimi engellenir", () => {
    assert.equal(
      resolveFromNotificationUtils(
        {
          notifyLowStock: true,
          notifyDueInvoices: false,
          notifyLateCollections: true,
          notifyDailySummary: true,
          notifyEmployeePayments: true,
        },
        {
          isProactive: true,
          category: "INVOICES",
          dedupeKey: "due-invoice:c1:d-1:2026-06-08",
        }
      ),
      false
    );
  });

  it("notifyLateCollections false ise geciken tahsilat engellenir", () => {
    assert.equal(
      resolveFromNotificationUtils(
        {
          notifyLowStock: true,
          notifyDueInvoices: true,
          notifyLateCollections: false,
          notifyDailySummary: true,
          notifyEmployeePayments: true,
        },
        {
          isProactive: true,
          category: "FINANCE",
          dedupeKey: "late-collection:c1:2026-06-08",
        }
      ),
      false
    );
  });

  it("notifyEmployeePayments false ise çalışan ödeme bildirimi engellenir", () => {
    assert.equal(
      resolveFromNotificationUtils(
        {
          notifyLowStock: true,
          notifyDueInvoices: true,
          notifyLateCollections: true,
          notifyDailySummary: true,
          notifyEmployeePayments: false,
        },
        {
          isProactive: true,
          dedupeKey: "employee-payment-due:c1:d0:2026-06-08",
        }
      ),
      false
    );
  });
});
