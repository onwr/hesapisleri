/**
 * Faz 14.1 — minimum payout threshold + legacy settings temizliği
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { isPlatformSuperAdminUser } from "@/lib/admin-auth";
import {
  assertNoForbiddenPayoutCreateKeys,
  validatePayoutMinimumThreshold,
} from "@/lib/admin/partner-payouts";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

function readRoute(segments: string[]) {
  return readFileSync(join(webRoot, "app", "api", ...segments, "route.ts"), "utf8");
}

describe("minimum payout threshold", () => {
  it("threshold üstü payout create", () => {
    const r = validatePayoutMinimumThreshold(500, "TRY", 100);
    assert.equal(r.ok, true);
    const src = readSrc("lib/admin/partner-payouts/payout-mutation-service.ts");
    assert.ok(src.includes("validatePayoutMinimumThreshold"));
    assert.ok(src.includes("loadPartnerSettingsForPayoutEnforcement"));
  });

  it("threshold altı payout reddi", () => {
    const r = validatePayoutMinimumThreshold(50, "TRY", 100);
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.code, "PAYOUT_BELOW_MINIMUM_THRESHOLD");
    }
    const src = readSrc("lib/admin/partner-payouts/payout-mutation-service.ts");
    assert.ok(src.includes("thresholdCheck.code"));
    assert.ok(src.includes("validatePayoutMinimumThreshold"));
  });

  it("threshold 0 davranışı", () => {
    const r = validatePayoutMinimumThreshold(1, "TRY", 0);
    assert.equal(r.ok, true);
  });

  it("TRY dışı currency politikası — eşik uygulanmaz", () => {
    const r = validatePayoutMinimumThreshold(1, "USD", 500);
    assert.equal(r.ok, true);
    const modal = readSrc("components/admin/admin-partner-payout-create-modal.tsx");
    assert.ok(modal.includes('selectedCurrency === "TRY"'));
    assert.ok(modal.includes("yalnızca TRY"));
  });
});

describe("client total/threshold reddi", () => {
  it("client total reddedilir", () => {
    assert.throws(() =>
      assertNoForbiddenPayoutCreateKeys({
        total: 100,
        earningIds: ["e1"],
        paymentMethod: "MANUAL",
        reason: "x",
        confirm: true,
      })
    );
  });

  it("client minimumPayoutAmount reddedilir", () => {
    assert.throws(() =>
      assertNoForbiddenPayoutCreateKeys({
        minimumPayoutAmount: 100,
        earningIds: ["e1"],
        paymentMethod: "MANUAL",
        reason: "x",
        confirm: true,
      })
    );
  });

  it("client threshold reddedilir", () => {
    assert.throws(() =>
      assertNoForbiddenPayoutCreateKeys({
        threshold: 100,
        earningIds: ["e1"],
        paymentMethod: "MANUAL",
        reason: "x",
        confirm: true,
      })
    );
  });
});

describe("settings singleton conflict", () => {
  it("payout create SETTINGS_SINGLETON_CONFLICT", () => {
    const src = readSrc("lib/admin/partner-payouts/payout-mutation-service.ts");
    assert.ok(src.includes("SETTINGS_SINGLETON_CONFLICT"));
    assert.ok(src.includes("loadPartnerSettingsForPayoutEnforcement"));
  });
});

describe("geçmiş payout/earning değişmez", () => {
  it("create yalnız yeni payout ve earning bağlantısı", () => {
    const src = readSrc("lib/admin/partner-payouts/payout-mutation-service.ts");
    assert.ok(src.includes("partnerPayout.create"));
    assert.ok(src.includes("partnerEarning.updateMany"));
    assert.ok(!src.includes("partnerEarning.update({"));
    assert.ok(!src.includes("partnerPayout.updateMany"));
  });

  it("threshold kontrolü geçmiş kayıtları güncellemez", () => {
    const src = readSrc("lib/admin/partner-payouts/payout-mutation-service.ts");
    const createBlock = src.slice(
      src.indexOf("export async function createPartnerPayoutAdmin"),
      src.indexOf("export async function approvePartnerPayoutAdmin")
    );
    assert.ok(!createBlock.includes("partnerSettings.update"));
    assert.ok(!createBlock.includes("partnerPayout.update"));
    assert.ok(!createBlock.includes("partnerEarning.update({"));
  });
});

describe("legacy settings bypass yok", () => {
  it("partner-service updatePartnerSettings kaldırıldı", () => {
    const src = readSrc("lib/partner-service.ts");
    assert.ok(!src.includes("updatePartnerSettings"));
    assert.ok(!src.includes("getPartnerSettings"));
  });

  it("partner-utils legacy schema kaldırıldı", () => {
    const src = readSrc("lib/partner-utils.ts");
    assert.ok(!src.includes("updatePartnerSettingsSchema"));
  });

  it("admin settings API canonical mutation", () => {
    const route = readRoute(["admin", "partners", "settings"]);
    assert.ok(route.includes("updateAdminPartnerSettings"));
    assert.ok(!route.includes("updatePartnerSettings"));
  });
});

describe("canonical audit/cache çağrısı", () => {
  it("settings mutation audit ve cache", () => {
    const src = readSrc("lib/admin/partner-settings/settings-mutation-service.ts");
    assert.ok(src.includes("logAdminPartnerSettingsAudit"));
    assert.ok(src.includes("invalidateAdminPartnerSettingsCaches"));
    assert.ok(src.includes("reason"));
    assert.ok(src.includes("confirm"));
    assert.ok(src.includes("assertSettingsSingleton"));
  });
});

describe("tenant admin reddi", () => {
  it("payout POST requireSuperAdminApi", () => {
    const src = readRoute(["admin", "partner-payouts"]);
    assert.match(src, /requireSuperAdminApi/);
  });

  it("tenant ADMIN reddedilir", () => {
    assert.equal(
      isPlatformSuperAdminUser({ role: "ADMIN", status: "ACTIVE", email: "a@t.com" }),
      false
    );
  });
});

describe("create UI minimum threshold", () => {
  it("modal minimum eşik ve submit guard", () => {
    const src = readSrc("components/admin/admin-partner-payout-create-modal.tsx");
    assert.ok(src.includes("minimumPayoutAmount"));
    assert.ok(src.includes("belowMinimumThreshold"));
    assert.ok(src.includes("canSubmit"));
    assert.ok(!src.includes("total:"));
  });
});
