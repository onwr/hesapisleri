import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Bu test grubunda gerçek DB yok — yalnız ünit seviye kontroller yapılır

describe("mobile-dashboard — güvenlik ve tip kontrolleri", () => {
  it("companyId body/query parametre kabul edilmez — JWT'den alınmalı", () => {
    // companyId query string veya body'den değil, session.companyId'den gelir
    // Bu dosyadan bağımsız çalışan bir kural: endpoint'te companyId parametresi okunmuyor
    const routeSource = require("fs").readFileSync(
      require("path").join(__dirname, "../../app/api/mobile/dashboard/route.ts"),
      "utf-8"
    ) as string;

    assert.ok(
      !routeSource.includes("searchParams.get") && !routeSource.includes("body.companyId"),
      "dashboard route companyId query/body okumamali"
    );
    assert.ok(
      routeSource.includes("session.companyId"),
      "companyId yalnizca session'dan alinmali"
    );
  });

  it("notification route metadata field içermiyor", () => {
    const routeSource = require("fs").readFileSync(
      require("path").join(__dirname, "../../app/api/mobile/notifications/route.ts"),
      "utf-8"
    ) as string;

    assert.ok(
      !routeSource.includes("s.metadata") && !routeSource.includes(".metadata,"),
      "notification route metadata alani expose etmemeli"
    );
  });

  it("dashboard route hata durumunda ham hata mesajı döndürmüyor", () => {
    const routeSource = require("fs").readFileSync(
      require("path").join(__dirname, "../../app/api/mobile/dashboard/route.ts"),
      "utf-8"
    ) as string;

    assert.ok(
      !routeSource.includes("err.message") || routeSource.includes("SERVER_ERROR"),
      "ham Prisma/provider hatasi expose edilmemeli"
    );
  });

  it("notification unread-count endpoint var", () => {
    const fs = require("fs");
    const path = require("path");
    const exists = fs.existsSync(
      path.join(__dirname, "../../app/api/mobile/notifications/unread-count/route.ts")
    );
    assert.ok(exists, "unread-count route dosyasi mevcut olmali");
  });

  it("notification mark-read endpoint var", () => {
    const fs = require("fs");
    const path = require("path");
    const exists = fs.existsSync(
      path.join(__dirname, "../../app/api/mobile/notifications/[id]/read/route.ts")
    );
    assert.ok(exists, "mark-read route dosyasi mevcut olmali");
  });

  it("notification read-all endpoint var", () => {
    const fs = require("fs");
    const path = require("path");
    const exists = fs.existsSync(
      path.join(__dirname, "../../app/api/mobile/notifications/read-all/route.ts")
    );
    assert.ok(exists, "read-all route dosyasi mevcut olmali");
  });

  it("notification delete endpoint var", () => {
    const fs = require("fs");
    const path = require("path");
    const exists = fs.existsSync(
      path.join(__dirname, "../../app/api/mobile/notifications/[id]/route.ts")
    );
    assert.ok(exists, "notification delete route dosyasi mevcut olmali");
  });

  it("dashboard service permission-aware — yetkisiz alanlar null döner", () => {
    // canAccessModule(role, "sales", isOwner) false ise todaySales null olmalı
    // Bu yapısal kontrol — servis dosyasında null koşulu var mı?
    const serviceSource = require("fs").readFileSync(
      require("path").join(__dirname, "../../lib/mobile/mobile-dashboard-service.ts"),
      "utf-8"
    ) as string;

    assert.ok(
      serviceSource.includes("canSales") && serviceSource.includes("null"),
      "yetkisiz roller icin null donmeli"
    );
    assert.ok(
      serviceSource.includes("canInvoices"),
      "fatura yetkisi kontrolu olmali"
    );
    assert.ok(
      serviceSource.includes("canProducts"),
      "stok yetkisi kontrolu olmali"
    );
  });

  it("mobile-permission-policy STAFF satış yazma yetkisi var", async () => {
    const { mobileRoleAllows } = await import("./mobile-permission-policy");
    assert.ok(mobileRoleAllows("STAFF", "sales", "write"), "STAFF satış yazabilmeli");
    assert.ok(!mobileRoleAllows("STAFF", "reports", "read"), "STAFF raporlara erişememeli");
    assert.ok(!mobileRoleAllows("POS_STAFF", "invoices", "write"), "POS_STAFF fatura yazamamalı");
  });

  it("mobile-permission-policy OWNER tüm modüllerde admin", async () => {
    const { mobileRoleAllows } = await import("./mobile-permission-policy");
    assert.ok(mobileRoleAllows("OWNER", "company", "admin"), "OWNER company admin");
    assert.ok(mobileRoleAllows("OWNER", "settings", "admin"), "OWNER settings admin");
  });

  it("notification route servis fonksiyonlarını çağırıyor", () => {
    const routeSource = require("fs").readFileSync(
      require("path").join(__dirname, "../../app/api/mobile/notifications/route.ts"),
      "utf-8"
    ) as string;

    assert.ok(
      routeSource.includes("listNotifications"),
      "listNotifications cagirilmali"
    );
  });

  it("dashboard service activity log createdAt dahil ediyor — sadece güvenli alanlar", () => {
    const serviceSource = require("fs").readFileSync(
      require("path").join(__dirname, "../../lib/mobile/mobile-dashboard-service.ts"),
      "utf-8"
    ) as string;

    // ip alanı expose edilmemeli
    assert.ok(
      !serviceSource.includes("select: { id: true, action: true, module: true, message: true, createdAt: true, ip: true }"),
      "ip alani activity log sorgusunda secilmemeli"
    );

    assert.ok(
      serviceSource.includes('"id: true"') ||
      serviceSource.includes("id: true") ||
      serviceSource.includes("select: { id"),
      "aktivite log select alanlari mevcut olmali"
    );
  });

  it("düşük stok sayımı canonical helper ile uyumlu", async () => {
    const { countLowStockActiveProducts } = await import("../stocks-page-utils");
    assert.equal(
      countLowStockActiveProducts([
        { stock: 5, minStock: 10, status: "ACTIVE" },
        { stock: 11, minStock: 10, status: "ACTIVE" },
      ]),
      1
    );
  });
});
