import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildActivitySubtitle,
  buildSafeActivityMessage,
  buildTransferActivityMessage,
  createActivityLog,
  extractAmountLabelFromMessage,
  getDemoActivityCleanupWhere,
  isDemoActivityMessage,
  isTransferActivityLog,
  mapActivityLogToDashboardItem,
  normalizeAuditDisplayText,
  resolveTransferActivityTitle,
} from "./activity-log-utils";
import { getActivityTag } from "./dashboard-metrics";

describe("activity log utils", () => {
  it("demo mesajları tespit eder", () => {
    assert.equal(isDemoActivityMessage("Kırtasiye alımı 350"), true);
    assert.equal(isDemoActivityMessage("Kırtasiye alımı"), true);
    assert.equal(isDemoActivityMessage("Açıklama: Kırtasiye Alımı"), true);
    assert.equal(
      isDemoActivityMessage("Kalem Seti ürünü oluşturuldu."),
      false
    );
  });

  it("dashboard item gerçek message kullanır", () => {
    const item = mapActivityLogToDashboardItem(
      {
        id: "log-1",
        action: "CREATE",
        module: "products",
        message: "Kalem Seti ürünü oluşturuldu.",
        createdAt: new Date("2026-06-08T10:00:00Z"),
      },
      () => "5 dk önce"
    );

    assert.ok(item);
    assert.equal(item?.title, "Kalem Seti ürünü oluşturuldu.");
    assert.equal(item?.description, "Ürünler · Oluşturma");
    assert.equal(item?.tag, "Ürün");
    assert.equal(item?.time, "5 dk önce");
  });

  it("demo mesaj dashboard item üretmez", () => {
    const item = mapActivityLogToDashboardItem(
      {
        id: "log-2",
        action: "CREATE",
        module: "expenses",
        message: "Kırtasiye alımı 350",
        createdAt: new Date(),
      },
      () => "Az önce"
    );

    assert.equal(item, null);
  });

  it("tutarı mesajdan çıkarır", () => {
    assert.equal(
      extractAmountLabelFromMessage("Satış oluşturuldu: SIP-1 - ₺2.180,64"),
      "₺2.180,64"
    );
    assert.equal(
      extractAmountLabelFromMessage("Gider eklendi: Kırtasiye alımı"),
      null
    );
  });

  it("createActivityLog demo mesajı reddeder", async () => {
    await assert.rejects(
      () =>
        createActivityLog(
          {
            companyId: "company-1",
            module: "expenses",
            action: "CREATE",
            message: "Kırtasiye alımı 350",
          },
          {
            activityLog: {
              create: async () => {
                throw new Error("should not be called");
              },
            },
          } as never
        ),
      /Demo activity messages are not allowed/
    );
  });

  it("cleanup where demo metinleri hedefler", () => {
    const where = getDemoActivityCleanupWhere();
    assert.ok(Array.isArray(where.OR));
    assert.ok(where.OR.length >= 3);
  });

  it("subtitle modül ve aksiyon içerir", () => {
    assert.equal(buildActivitySubtitle("CREATE", "sales"), "Satış · Oluşturma");
    assert.equal(buildActivitySubtitle("UPDATE", "stocks"), "Stok · Güncelleme");
    assert.equal(buildActivitySubtitle("TRANSFER", "cash-bank"), "Kasa/Banka · Transfer");
  });

  it("transfer activity message gerçek hesap ve tutar içerir", () => {
    const message = buildTransferActivityMessage("Merkez Kasa", "Garanti Bankası", 5000);
    assert.match(message, /Merkez Kasa/);
    assert.match(message, /Garanti Bankası/);
    assert.match(message, /₺5\.000,00/);
    assert.equal(isTransferActivityLog({ action: "TRANSFER", module: "cash-bank", message }), true);
  });

  it("transfer dashboard item Transfer etiketi ve gerçek tutarı gösterir", () => {
    const message = buildTransferActivityMessage("Merkez Kasa", "Garanti Bankası", 5000);
    const item = mapActivityLogToDashboardItem(
      {
        id: "log-transfer",
        action: "TRANSFER",
        module: "cash-bank",
        message,
        createdAt: new Date("2026-06-08T10:00:00Z"),
      },
      () => "Az önce"
    );

    assert.ok(item);
    assert.equal(
      item?.title,
      "Hesaplar arası transfer: Merkez Kasa → Garanti Bankası"
    );
    assert.equal(item?.description, "Kasa-Banka · Transfer");
    assert.equal(item?.tag, "Transfer");
    assert.equal(item?.tagColor, "blue");
    assert.equal(item?.amountLabel, "₺5.000,00");
    assert.notEqual(item?.tag, "Tahsilat");
    assert.notEqual(item?.amountLabel, "5000 TL");
  });

  it("eski transfer log formatı dashboardda düzgün eşlenir", () => {
    const legacyMessage =
      "Merkez Kasa hesabından Garanti Bankası hesabına 1250 TRY transfer edildi.";
    const item = mapActivityLogToDashboardItem(
      {
        id: "log-legacy-transfer",
        action: "UPDATE",
        module: "cash-bank",
        message: legacyMessage,
        createdAt: new Date(),
      },
      () => "Az önce"
    );

    assert.ok(item);
    assert.equal(item?.tag, "Transfer");
    assert.equal(
      item?.title,
      "Hesaplar arası transfer: Merkez Kasa → Garanti Bankası"
    );
    assert.equal(item?.amountLabel, "₺1.250,00");
  });

  it("cash-bank COLLECT hâlâ Tahsilat etiketi alır", () => {
    const tag = getActivityTag("cash-bank", "COLLECT");
    assert.equal(tag.label, "Tahsilat");
    assert.equal(tag.color, "purple");
  });

  it("cash-bank genel işlem artık sabit Tahsilat değil", () => {
    const tag = getActivityTag("cash-bank", "UPDATE");
    assert.equal(tag.label, "Kasa/Banka");
    assert.notEqual(tag.label, "Tahsilat");
  });

  it("legacy XSS activity güvenli serialize edilir", () => {
    const payload = '<img src=x onerror=alert(1)>';
    const item = mapActivityLogToDashboardItem(
      {
        id: "log-xss",
        action: "CREATE",
        module: "expenses",
        message: payload,
        createdAt: new Date(),
      },
      () => "Az önce"
    );

    assert.ok(item);
    assert.equal(item?.title, "[Geçersiz kayıt]");
    assert.doesNotMatch(item?.title ?? "", /<|onerror|script/i);
  });

  it("normalizeAuditDisplayText kontrol karakterlerini temizler", () => {
    assert.equal(normalizeAuditDisplayText("Kasa\u0007"), "Kasa");
  });

  it("buildSafeActivityMessage hesap adını normalize eder", () => {
    const message = buildSafeActivityMessage("ACCOUNT_CREATED", {
      accountName: "Merkez Kasa",
    });
    assert.equal(message, "Hesap oluşturuldu: Merkez Kasa");
  });

  it("createActivityLog XSS içeren mesajı reddeder", async () => {
    await assert.rejects(
      () =>
        createActivityLog(
          {
            companyId: "company-1",
            module: "cash-bank",
            action: "CREATE",
            message: '<script>alert(1)</script>',
          },
          {
            activityLog: {
              create: async () => {
                throw new Error("should not be called");
              },
            },
          } as never
        ),
      /invalid content/i
    );
  });
});
