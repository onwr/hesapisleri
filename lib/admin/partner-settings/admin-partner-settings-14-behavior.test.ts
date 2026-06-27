/**
 * Faz 14 — Partner ayarları davranış testleri
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { isPlatformSuperAdminUser } from "@/lib/admin-auth";
import {
  adminPartnerSettingsUpdateSchema,
  assertNoForbiddenPartnerSettingsKeys,
  buildSafeSettingsDiff,
  redactSettingsAuditValue,
  resolveSettingsAuditActions,
  serializePartnerSettings,
} from "@/lib/admin/partner-settings";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

function readRoute(segments: string[]) {
  return readFileSync(join(webRoot, "app", "api", ...segments, "route.ts"), "utf8");
}

describe("settings schema", () => {
  it("strict update reason confirm", () => {
    assert.equal(
      adminPartnerSettingsUpdateSchema.safeParse({
        defaultCommissionRate: 10,
        reason: "test",
        confirm: true,
      }).success,
      true
    );
    assert.equal(
      adminPartnerSettingsUpdateSchema.safeParse({ defaultCommissionRate: 10 }).success,
      false
    );
  });

  it("bilinmeyen alan reddedilir", () => {
    assert.equal(
      adminPartnerSettingsUpdateSchema.safeParse({
        foo: 1,
        reason: "x",
        confirm: true,
      }).success,
      false
    );
  });

  it("body id reddedilir", () => {
    assert.throws(() => assertNoForbiddenPartnerSettingsKeys({ id: "x", reason: "y" }));
  });

  it("body status reddedilir", () => {
    assert.throws(() => assertNoForbiddenPartnerSettingsKeys({ status: "ACTIVE" }));
  });
});

describe("validation ranges", () => {
  it("commission validation", () => {
    assert.equal(
      adminPartnerSettingsUpdateSchema.safeParse({
        defaultCommissionRate: 101,
        reason: "x",
        confirm: true,
      }).success,
      false
    );
    assert.equal(
      adminPartnerSettingsUpdateSchema.safeParse({
        defaultCommissionRate: -1,
        reason: "x",
        confirm: true,
      }).success,
      false
    );
  });

  it("payout threshold validation", () => {
    assert.equal(
      adminPartnerSettingsUpdateSchema.safeParse({
        minimumPayoutAmount: -1,
        reason: "x",
        confirm: true,
      }).success,
      false
    );
  });

  it("attribution validation", () => {
    assert.equal(
      adminPartnerSettingsUpdateSchema.safeParse({
        cookieDurationDays: 0,
        reason: "x",
        confirm: true,
      }).success,
      false
    );
  });
});

describe("historical data protection", () => {
  it("mutation yalnız PartnerSettings günceller", () => {
    const src = readSrc("lib/admin/partner-settings/settings-mutation-service.ts");
    assert.ok(src.includes("partnerSettings.update"));
    assert.ok(!src.includes("partnerEarning"));
    assert.ok(!src.includes("partnerPayout"));
    assert.ok(!src.includes("partnerConversion.update"));
  });

  it("geçmiş earning değişmez", () => {
    const src = readSrc("lib/admin/partner-settings/settings-mutation-service.ts");
    assert.ok(!src.includes("partnerEarning.update"));
  });
});

describe("application toggle audit", () => {
  it("PARTNER_APPLICATIONS_ENABLED/DISABLED", () => {
    assert.deepEqual(
      resolveSettingsAuditActions({ isApplicationOpen: false }, { isApplicationOpen: true }),
      ["PARTNER_SETTINGS_UPDATED", "PARTNER_APPLICATIONS_ENABLED"]
    );
    assert.deepEqual(
      resolveSettingsAuditActions({ isApplicationOpen: true }, { isApplicationOpen: false }),
      ["PARTNER_SETTINGS_UPDATED", "PARTNER_APPLICATIONS_DISABLED"]
    );
  });

  it("PROGRAM audit model alanı yok", () => {
    const src = readSrc("lib/admin/partner-settings/admin-partner-settings-audit-service.ts");
    assert.ok(!src.includes("PARTNER_PROGRAM_ENABLED"));
    assert.ok(!src.includes("isProgramOpen"));
  });
});

describe("singleton conflict", () => {
  it("SETTINGS_SINGLETON_CONFLICT", () => {
    const src = readSrc("lib/admin/partner-settings/settings-query-service.ts");
    assert.ok(src.includes("SETTINGS_SINGLETON_CONFLICT"));
    assert.ok(src.includes("partnerSettings.count()"));
  });
});

describe("partner override priority", () => {
  it("override önceliği UI'da", () => {
    const src = readSrc("lib/admin/partner-settings/settings-query-service.ts");
    assert.ok(src.includes("overridePriority"));
    assert.ok(src.includes("PartnerProfile.commissionRate"));
  });

  it("serialize settings", () => {
    const row = {
      id: "default",
      defaultCommissionRate: { toString: () => "10" },
      cookieDurationDays: 30,
      minimumPayoutAmount: { toString: () => "500" },
      autoApproveConversions: false,
      commissionOnRenewals: true,
      isApplicationOpen: true,
      termsText: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const s = serializePartnerSettings(row as never);
    assert.equal(s.defaultCommissionRate, 10);
    assert.equal(s.minimumPayoutAmount, 500);
  });
});

describe("audit privacy", () => {
  it("sensitive metadata redaction", () => {
    assert.equal(redactSettingsAuditValue("iban", "TR123"), "[redacted]");
    assert.equal(redactSettingsAuditValue("token", "abc"), "[redacted]");
  });

  it("structured audit entity", () => {
    const src = readSrc("lib/admin/partner-settings/admin-partner-settings-audit-service.ts");
    assert.ok(src.includes('entityType: "PartnerSettings"'));
    assert.ok(src.includes("settingsId"));
    assert.ok(src.includes("admin-partner-settings"));
  });

  it("safe diff", () => {
    const diff = buildSafeSettingsDiff(
      { defaultCommissionRate: 10 },
      { defaultCommissionRate: 12 }
    );
    assert.equal((diff.defaultCommissionRate as { to: number }).to, 12);
  });
});

describe("UI contract", () => {
  it("form PUT kullanır", () => {
    const src = readSrc("components/admin/admin-partner-settings-form.tsx");
    assert.ok(src.includes('method: "PUT"'));
    assert.ok(src.includes("/api/admin/partners/settings"));
    assert.ok(!src.includes("PATCH"));
  });

  it("create modal client total yok", () => {
    const src = readSrc("components/admin/admin-partner-settings-form.tsx");
    assert.ok(!src.includes("total:"));
  });
});

describe("cache", () => {
  it("cache invalidation", () => {
    const src = readSrc("lib/admin/partner-settings/admin-partner-settings-cache.ts");
    assert.ok(src.includes("admin-partner-settings"));
    assert.ok(src.includes("partner-settings"));
    assert.ok(src.includes("admin-overview"));
  });
});
