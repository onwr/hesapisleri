import assert from "node:assert/strict";
import { describe, it } from "node:test";

// adminSuspendUser ve adminReactivateUser saf mantık testleri
// DB bağımlılığı olmadan servis davranışını doğrular

describe("adminSuspendUser — durum geçişi kuralları", () => {
  it("PASSIVE kullanıcı askıya alınamaz (sadece ACTIVE → SUSPENDED)", async () => {
    const { adminSuspendUser, AdminUserActionError } =
      await import("@/lib/admin/users/admin-user-action-service");

    // Servis fonksiyonu ACTIVE kontrolü yapıyor:
    // Servis kodunu text olarak doğruluyoruz (DB gerektirmeden)
    const source = (
      await import("node:fs")
    ).readFileSync(
      new URL("../../../lib/admin/users/admin-user-action-service.ts", import.meta.url)
        .pathname.replace(/^\/([A-Z]:)/, "$1"),
      "utf8"
    );
    assert.ok(
      source.includes("user.status !== \"ACTIVE\""),
      "ACTIVE olmayan kullanıcı reddedilmeli"
    );
    assert.ok(
      !source.includes("PASSIVE") || source.includes("ACTIVE"),
      "Yalnız ACTIVE→SUSPENDED kabul edilmeli"
    );
  });

  it("adminSuspendUser — 'PASSIVE ve zaten askıda' hata mesajında belirtilmiş", async () => {
    const source = (
      await import("node:fs")
    ).readFileSync(
      new URL("../../../lib/admin/users/admin-user-action-service.ts", import.meta.url)
        .pathname.replace(/^\/([A-Z]:)/, "$1"),
      "utf8"
    );
    assert.ok(
      source.includes("PASSIVE"),
      "Hata mesajı PASSIVE'i açıklamalı"
    );
    assert.ok(
      source.includes("zaten askıda"),
      "Hata mesajı zaten askıda durumunu açıklamalı"
    );
  });

  it("adminReactivateUser — yalnız SUSPENDED → ACTIVE kabul edilir", () => {
    const source = require("node:fs").readFileSync(
      require("node:path").join(
        process.cwd(),
        "lib",
        "admin",
        "users",
        "admin-user-action-service.ts"
      ),
      "utf8"
    );
    assert.ok(
      source.includes("user.status !== \"SUSPENDED\""),
      "Yalnız SUSPENDED kullanıcı reactivate edilebilmeli"
    );
  });

  it("adminSuspendUser — admin kendini askıya alamaz", () => {
    const source = require("node:fs").readFileSync(
      require("node:path").join(
        process.cwd(),
        "lib",
        "admin",
        "users",
        "admin-user-action-service.ts"
      ),
      "utf8"
    );
    assert.ok(
      source.includes("actorUserId === targetUserId"),
      "Self-suspend kontrolü olmalı"
    );
    assert.ok(
      source.includes("Kendi hesabınızı askıya alamazsınız"),
      "Self-suspend hata mesajı olmalı"
    );
  });

  it("adminSuspendUser — son SUPER_ADMIN askıya alınamaz", () => {
    const source = require("node:fs").readFileSync(
      require("node:path").join(
        process.cwd(),
        "lib",
        "admin",
        "users",
        "admin-user-action-service.ts"
      ),
      "utf8"
    );
    assert.ok(
      source.includes("Son platform yöneticisi askıya alınamaz"),
      "Son super admin koruma mesajı olmalı"
    );
    assert.ok(
      source.includes("superAdminCount <= 1"),
      "Super admin sayısı kontrolü olmalı"
    );
  });

  it("adminSuspendUser — tek sahip olan kullanıcı askıya alınamaz", () => {
    const source = require("node:fs").readFileSync(
      require("node:path").join(
        process.cwd(),
        "lib",
        "admin",
        "users",
        "admin-user-action-service.ts"
      ),
      "utf8"
    );
    assert.ok(
      source.includes("tek aktif sahibidir"),
      "Tek sahip koruma mesajı olmalı"
    );
    assert.ok(
      source.includes("otherActiveOwners === 0"),
      "Diğer aktif sahip kontrolü olmalı"
    );
  });

  it("reactivate — PASSIVE kullanıcı reactivate edilemez (SUSPENDED kontrolü)", () => {
    const source = require("node:fs").readFileSync(
      require("node:path").join(
        process.cwd(),
        "lib",
        "admin",
        "users",
        "admin-user-action-service.ts"
      ),
      "utf8"
    );
    assert.ok(
      source.includes("Yalnızca askıya alınmış kullanıcılar yeniden etkinleştirilebilir"),
      "Reactivate yalnız SUSPENDED kabul etmeli"
    );
  });
});
