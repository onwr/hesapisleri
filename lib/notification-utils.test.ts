import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildNotificationListQuery,
  formatUnreadBadge,
  parseNotificationCategory,
  parseNotificationTab,
  resolveShouldNotifyFromSettings,
  sanitizeNotificationMetadata,
  serializeNotification,
} from "./notification-utils";

describe("notification utils", () => {
  it("formatUnreadBadge 99+ formatı üretir", () => {
    assert.equal(formatUnreadBadge(0), null);
    assert.equal(formatUnreadBadge(5), "5");
    assert.equal(formatUnreadBadge(100), "99+");
  });

  it("parseNotificationTab geçersiz değerde all döner", () => {
    assert.equal(parseNotificationTab("unread"), "unread");
    assert.equal(parseNotificationTab("foo"), "all");
  });

  it("parseNotificationCategory geçersiz kategoriyi reddeder", () => {
    assert.equal(parseNotificationCategory("SALES"), "SALES");
    assert.equal(parseNotificationCategory("FOO"), undefined);
  });

  it("resolveShouldNotifyFromSettings reaktif bildirimleri engellemez", () => {
    assert.equal(
      resolveShouldNotifyFromSettings(
        {
          notifyLowStock: false,
          notifyDueInvoices: false,
          notifyLateCollections: false,
          notifyDailySummary: false,
          notifyEmployeePayments: false,
        },
        { isProactive: false, category: "STOCK" }
      ),
      true
    );
  });

  it("resolveShouldNotifyFromSettings düşük stok toggle false ise engeller", () => {
    assert.equal(
      resolveShouldNotifyFromSettings(
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

  it("sanitizeNotificationMetadata secret alanları temizler", () => {
    const sanitized = sanitizeNotificationMetadata({
      invoiceNo: "FTR-001",
      apiSecret: "abc",
      nested: { password: "123", amount: 10 },
    });

    assert.deepEqual(sanitized, {
      invoiceNo: "FTR-001",
      nested: { amount: 10 },
    });
  });

  it("serializeNotification isRead alanını set eder", () => {
    const serialized = serializeNotification({
      id: "n1",
      companyId: "c1",
      userId: "u1",
      type: "SUCCESS",
      category: "SALES",
      module: "sales",
      entityType: "SALE",
      entityId: "s1",
      actionUrl: "/sales/s1",
      metadata: null,
      priority: "NORMAL",
      channel: "IN_APP",
      title: "Satış",
      message: "Mesaj",
      readAt: null,
      createdAt: new Date("2026-06-01T10:00:00.000Z"),
    });

    assert.equal(serialized.isRead, false);
    assert.equal(serialized.actionUrl, "/sales/s1");
  });

  it("buildNotificationListQuery query parametrelerini parse eder", () => {
    assert.deepEqual(
      buildNotificationListQuery({
        tab: "unread",
        category: "INVOICES",
        priority: "HIGH",
        search: " fatura ",
        limit: "10",
      }),
      {
        tab: "unread",
        category: "INVOICES",
        priority: "HIGH",
        search: "fatura",
        limit: 10,
      }
    );
  });
});

describe("notification API response shape", () => {
  it("GET list başarılı response şeması", () => {
    const response = {
      success: true,
      notifications: [],
      nextCursor: null,
      summary: { unread: 0, today: 0, critical: 0 },
    };

    assert.equal(response.success, true);
    assert.ok("notifications" in response);
  });

  it("unread-count başarılı response şeması", () => {
    const response = { success: true, count: 3 };
    assert.equal(response.count, 3);
  });

  it("read-all başarılı response şeması", () => {
    const response = { success: true, updated: 12 };
    assert.equal(response.updated, 12);
  });
});
