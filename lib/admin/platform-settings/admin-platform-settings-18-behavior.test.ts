/**
 * Faz 18 — Platform ayarları davranış testleri
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  adminPlatformSettingsUpdateSchema,
  assertNoForbiddenPlatformSettingsKeys,
  buildSafeSettingsDiff,
  CRITICAL_SETTINGS_FIELDS,
  PLATFORM_SETTINGS_DEFAULTS,
  PLATFORM_SETTINGS_ID,
  redactSettingsAuditValue,
  resolvePlatformSettingsAuditActions,
  serializePlatformSettings,
} from "@/lib/admin/platform-settings";
import { getPlatformEnvironmentStatus } from "@/lib/admin/platform-settings/platform-environment-service";
import { AdminPlatformSettingsServiceError } from "@/lib/admin/platform-settings/platform-settings-errors";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

function readRoute(segments: string[]) {
  return readFileSync(join(webRoot, "app", "api", ...segments, "route.ts"), "utf8");
}

describe("settings schema", () => {
  it("strict update version reason confirm", () => {
    assert.equal(
      adminPlatformSettingsUpdateSchema.safeParse({
        version: 1,
        trialDays: 14,
        reason: "test",
        confirm: true,
      }).success,
      true
    );
    assert.equal(
      adminPlatformSettingsUpdateSchema.safeParse({ trialDays: 14, reason: "x", confirm: true })
        .success,
      false
    );
  });

  it("bilinmeyen alan reddedilir", () => {
    assert.equal(
      adminPlatformSettingsUpdateSchema.safeParse({
        version: 1,
        foo: 1,
        reason: "x",
        confirm: true,
      }).success,
      false
    );
  });

  it("body id reddedilir", () => {
    assert.throws(() => assertNoForbiddenPlatformSettingsKeys({ id: "x" }));
  });

  it("version gönderilebilir", () => {
    assert.doesNotThrow(() =>
      assertNoForbiddenPlatformSettingsKeys({ version: 1, trialDays: 14 })
    );
  });

  it("secret field reddedilir", () => {
    assert.throws(() => assertNoForbiddenPlatformSettingsKeys({ apiKey: "abc" }));
    assert.throws(() => assertNoForbiddenPlatformSettingsKeys({ password: "x" }));
  });
});

describe("singleton model", () => {
  it("PLATFORM_SETTINGS_ID default", () => {
    assert.equal(PLATFORM_SETTINGS_ID, "default");
  });

  it("singleton conflict kodu", () => {
    const src = readSrc("lib/admin/platform-settings/platform-settings-loader.ts");
    assert.ok(src.includes("PLATFORM_SETTINGS_SINGLETON_CONFLICT"));
    assert.ok(src.includes("platformSettings.count()"));
  });

  it("version conflict kodu", () => {
    const src = readSrc("lib/admin/platform-settings/settings-mutation-service.ts");
    assert.ok(src.includes("PLATFORM_SETTINGS_VERSION_CONFLICT"));
    assert.ok(src.includes("updateMany"));
    assert.ok(src.includes("version: { increment: 1 }"));
  });
});

describe("historical data protection", () => {
  it("mutation yalnız PlatformSettings günceller", () => {
    const src = readSrc("lib/admin/platform-settings/settings-mutation-service.ts");
    assert.ok(src.includes("platformSettings.updateMany"));
    assert.ok(!src.includes("companySubscription.update"));
    assert.ok(!src.includes("membershipPayment.update"));
    assert.ok(!src.includes("partnerEarning"));
  });

  it("trial değişikliği geçmiş trial güncellemez", () => {
    const src = readSrc("lib/create-company-service.ts");
    assert.ok(!src.includes("companySubscription.updateMany"));
    assert.ok(src.includes("platformDefaults"));
  });

  it("finansal varsayılan geçmiş ödemeleri değiştirmez", () => {
    const src = readSrc("lib/admin/platform-settings/settings-mutation-service.ts");
    assert.ok(!src.includes("membershipPayment"));
    assert.ok(!src.includes("invoice"));
  });
});

describe("registration and maintenance", () => {
  it("register assertRegistrationEnabled kullanır", () => {
    const src = readSrc("app/api/auth/register/route.ts");
    assert.ok(src.includes("assertRegistrationEnabled"));
    assert.ok(src.includes("RegistrationDisabledError"));
  });

  it("bakım modu API kontrolü", () => {
    const moduleSrc = readSrc("lib/module-access.ts");
    const errorSrc = readSrc("lib/admin/platform-settings/platform-settings-errors.ts");
    assert.ok(moduleSrc.includes("assertPlatformAvailable"));
    assert.ok(errorSrc.includes("MAINTENANCE_MODE_ACTIVE"));
  });

  it("requireCompanyUser canonical maintenance helper", () => {
    const src = readSrc("lib/auth/auth-dal.ts");
    assert.ok(src.includes("redirectIfMaintenanceActive"));
    const availability = readSrc("lib/platform-runtime/platform-availability.ts");
    assert.ok(availability.includes("/maintenance"));
  });
});

describe("runtime consumers", () => {
  it("upload cdn platform limitleri", () => {
    const src = readSrc("lib/storage/cdn.ts");
    assert.ok(src.includes("getPlatformUploadLimits"));
  });

  it("yeni firma platform defaults", () => {
    const src = readSrc("lib/create-company-service.ts");
    assert.ok(src.includes("getNewCompanyDefaults"));
    assert.ok(src.includes("defaults.trialDays"));
  });

  it("session max age platform settings", () => {
    const src = readSrc("lib/auth-session-utils.ts");
    assert.ok(src.includes("getSessionMaxAgeDays"));
  });

  it("legal branding platform settings", () => {
    const src = readSrc("lib/legal/platform-legal-info.ts");
    assert.ok(src.includes("getPlatformSettings"));
    assert.ok(src.includes("getPlatformLegalInfo"));
  });
});

describe("audit privacy", () => {
  it("sensitive metadata redaction", () => {
    assert.equal(redactSettingsAuditValue("token", "abc"), "[REDACTED]");
    assert.equal(redactSettingsAuditValue("DATABASE_URL", "postgres://"), "[REDACTED]");
  });

  it("structured audit entity", () => {
    const src = readSrc("lib/admin/platform-settings/platform-settings-audit-service.ts");
    assert.ok(src.includes('entityType: "PlatformSettings"'));
    assert.ok(src.includes("settingsId"));
    assert.ok(src.includes("admin-platform-settings"));
  });

  it("registration toggle audit actions", () => {
    assert.ok(
      resolvePlatformSettingsAuditActions(
        { registrationEnabled: false, maintenanceMode: false },
        { registrationEnabled: true, maintenanceMode: false }
      ).includes("PLATFORM_REGISTRATION_ENABLED")
    );
    assert.ok(
      resolvePlatformSettingsAuditActions(
        { registrationEnabled: true, maintenanceMode: false },
        { registrationEnabled: false, maintenanceMode: false }
      ).includes("PLATFORM_REGISTRATION_DISABLED")
    );
  });

  it("maintenance toggle audit actions", () => {
    assert.ok(
      resolvePlatformSettingsAuditActions(
        { registrationEnabled: true, maintenanceMode: false },
        { registrationEnabled: true, maintenanceMode: true }
      ).includes("PLATFORM_MAINTENANCE_ENABLED")
    );
  });

  it("safe diff", () => {
    const diff = buildSafeSettingsDiff({ trialDays: 14 }, { trialDays: 21 });
    assert.equal((diff.trialDays as { to: number }).to, 21);
  });

  it("history ActivityLog structured", () => {
    const src = readSrc("lib/admin/platform-settings/settings-query-service.ts");
    assert.ok(src.includes("buildStructuredPlatformSettingsActivityWhere"));
    assert.ok(!src.includes("message.parse"));
  });
});

describe("environment privacy", () => {
  it("credential değerleri dönmez", () => {
    const env = getPlatformEnvironmentStatus();
    const serialized = JSON.stringify(env);
    assert.ok(!serialized.includes(process.env.DATABASE_URL ?? "__no_db__"));
    assert.ok(!serialized.includes(process.env.JWT_SECRET ?? "__no_jwt__"));
    assert.ok(!serialized.includes(process.env.PAYTR_MERCHANT_KEY ?? "__no_paytr__"));
    for (const group of Object.values(env)) {
      assert.equal(typeof group.provider, "string");
      assert.equal(typeof group.configured, "boolean");
    }
  });

  it("system health probe yeniden kullanılır", () => {
    const src = readSrc("lib/admin/platform-settings/platform-environment-service.ts");
    assert.ok(src.includes("probeEnvFields"));
  });
});

describe("cache", () => {
  it("hedefli cache invalidation", () => {
    const src = readSrc("lib/admin/platform-settings/platform-settings-cache.ts");
    assert.ok(src.includes("platform-settings"));
    assert.ok(src.includes("admin-overview"));
    assert.ok(src.includes("invalidateHealthCache"));
    assert.ok(!src.includes("revalidatePath('/',"));
  });

  it("loader kısa cache", () => {
    const src = readSrc("lib/admin/platform-settings/platform-settings-loader.ts");
    assert.ok(src.includes("unstable_cache"));
    assert.ok(src.includes('tags: ["platform-settings"]'));
  });
});

describe("auth routes", () => {
  it("super admin API koruması", () => {
    const src = readRoute(["admin", "platform-settings"]);
    assert.ok(src.includes("requireSuperAdminApi"));
    assert.ok(!src.includes("requireTenant"));
  });

  it("generic PATCH DELETE 405", () => {
    const src = readRoute(["admin", "platform-settings"]);
    assert.ok(src.includes("status: 405"));
    assert.ok(src.includes("PATCH"));
    assert.ok(src.includes("DELETE"));
  });

  it("tenant admin platform update yok", () => {
    const src = readSrc("lib/admin/platform-settings/settings-mutation-service.ts");
    assert.ok(!src.includes("OWNER"));
    assert.ok(!src.includes("requireCompanyUser"));
  });
});

describe("UI contract", () => {
  it("form PUT version kullanır", () => {
    const src = readSrc("components/admin/admin-platform-settings-form.tsx");
    assert.ok(src.includes('method: "PUT"'));
    assert.ok(src.includes("/api/admin/platform-settings"));
    assert.ok(src.includes("PLATFORM_SETTINGS_VERSION_CONFLICT"));
    assert.ok(!src.includes("PATCH"));
  });

  it("kritik alanlar tanımlı", () => {
    assert.ok(CRITICAL_SETTINGS_FIELDS.has("registrationEnabled"));
    assert.ok(CRITICAL_SETTINGS_FIELDS.has("maintenanceMode"));
    assert.ok(CRITICAL_SETTINGS_FIELDS.has("trialDays"));
  });
});

describe("serialize settings", () => {
  it("decimal trialAmount number", () => {
    const row = {
      id: "default",
      version: 1,
      brandName: PLATFORM_SETTINGS_DEFAULTS.brandName,
      supportEmail: PLATFORM_SETTINGS_DEFAULTS.supportEmail,
      supportPhone: null,
      websiteUrl: PLATFORM_SETTINGS_DEFAULTS.websiteUrl,
      registrationEnabled: true,
      trialDays: 14,
      trialAmount: { toString: () => "1499" },
      defaultCurrency: "TRY",
      defaultVatRate: 20,
      defaultNotifyLowStock: true,
      defaultNotifyDueInvoices: true,
      defaultNotifyLateCollections: true,
      defaultNotifyDailySummary: false,
      defaultNotifyEmployeePayments: true,
      maxImageBytes: 5_242_880,
      maxTaxCertificateBytes: 5_242_880,
      sessionMaxAgeDays: 7,
      maintenanceMode: false,
      maintenanceMessage: null,
      updatedAt: new Date(),
    };
    const s = serializePlatformSettings(row as never);
    assert.equal(s.trialAmount, 1499);
    assert.equal(s.id, "default");
  });
});

describe("service errors", () => {
  it("AdminPlatformSettingsServiceError code", () => {
    const err = new AdminPlatformSettingsServiceError("x", 409, "PLATFORM_SETTINGS_VERSION_CONFLICT");
    assert.equal(err.code, "PLATFORM_SETTINGS_VERSION_CONFLICT");
    assert.equal(err.status, 409);
  });
});
