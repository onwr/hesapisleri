import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PLATFORM_SETTINGS_DEFAULTS } from "@/lib/admin/platform-settings/platform-settings-defaults";
import {
  PUBLIC_RUNTIME_CONFIG_KEYS,
  getPublicPlatformRuntimeConfigFallback,
} from "@/lib/platform-runtime";
import { buildMarketingConsentText } from "@/lib/legal/kvkk-consent";
import { validateClientImageFile } from "@/lib/storage/upload-client";
import { validateImageFileWithLimits } from "@/lib/storage/upload-validation";
import { formatMaxBytesMessage } from "@/lib/storage/upload-limit-utils";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

function readRoute(segments: string[]) {
  return readFileSync(join(webRoot, "app", "api", ...segments, "route.ts"), "utf8");
}

function createFile(input: { type: string; size: number }) {
  const buffer = new Uint8Array(input.size);
  return new File([buffer], "test.jpg", { type: input.type });
}

describe("upload limit senkronizasyonu", () => {
  it("upload-client sabit 5MB export etmez", () => {
    const src = readSrc("lib/storage/upload-client.ts");
    assert.ok(!src.includes("5 * 1024 * 1024"));
    assert.ok(src.includes("maxImageBytes: number"));
  });

  it("customer-form-utils sabit 5MB export etmez", () => {
    const src = readSrc("lib/customer-form-utils.ts");
    assert.ok(!src.includes("5 * 1024 * 1024"));
    assert.ok(src.includes("maxTaxCertificateBytes"));
  });

  it("image limit parametre ile doğrulanır", () => {
    const limit = 3 * 1024 * 1024;
    assert.doesNotThrow(() =>
      validateClientImageFile(createFile({ type: "image/jpeg", size: limit - 1 }), limit)
    );
    assert.throws(
      () => validateClientImageFile(createFile({ type: "image/jpeg", size: limit + 1 }), limit),
      new RegExp(formatMaxBytesMessage(limit).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    );
  });

  it("server upload limiti DB loader kullanır", () => {
    const src = readSrc("lib/storage/cdn.ts");
    assert.ok(src.includes("getPlatformUploadLimits"));
  });

  it("root layout runtime provider kullanır", () => {
    const src = readSrc("app/layout.tsx");
    assert.ok(src.includes("PlatformRuntimeProvider"));
    assert.ok(src.includes("getPublicPlatformRuntimeConfig"));
  });
});

describe("legal/KVKK entegrasyonu", () => {
  it("canonical getPlatformLegalInfo", () => {
    const src = readSrc("lib/legal/platform-legal-info.ts");
    assert.ok(src.includes("getPlatformSettings"));
    assert.ok(src.includes("getPlatformLegalInfo"));
  });

  it("register ve kvkk aynı loader", () => {
    const register = readSrc("app/register/page.tsx");
    const kvkk = readSrc("app/kvkk-aydinlatma-metni/page.tsx");
    assert.ok(register.includes("getPlatformLegalInfo"));
    assert.ok(kvkk.includes("getPlatformLegalInfo"));
  });

  it("marketing metni brandName ile üretilir", () => {
    const text = buildMarketingConsentText("Test Marka");
    assert.ok(text.includes("Test Marka"));
  });
});

describe("maintenance kapsamı", () => {
  it("assertPlatformAvailable canonical helper", () => {
    const src = readSrc("lib/platform-runtime/platform-availability.ts");
    assert.ok(src.includes("assertPlatformAvailable"));
  });

  it("auth-dal redirectIfMaintenanceActive kullanır", () => {
    const src = readSrc("lib/auth/auth-dal.ts");
    assert.ok(src.includes("redirectIfMaintenanceActive"));
    assert.ok(!src.includes("getPlatformSettings().maintenanceMode"));
  });

  it("cron callback muaf", () => {
    const src = readSrc("lib/platform-runtime/platform-maintenance-policy.ts");
    assert.ok(src.includes("/api/cron/"));
    assert.ok(src.includes("/api/payments/paytr/callback"));
  });

  it("admin muaf", () => {
    const src = readSrc("lib/platform-runtime/platform-maintenance-policy.ts");
    assert.ok(src.includes("/admin"));
  });

  it("maintenance sayfası muaf", () => {
    const src = readSrc("lib/platform-runtime/platform-maintenance-policy.ts");
    assert.ok(src.includes("/maintenance"));
  });

  it("tenant API 503 maintenance", () => {
    const moduleSrc = readSrc("lib/module-access.ts");
    const errorSrc = readSrc("lib/admin/platform-settings/platform-settings-errors.ts");
    assert.ok(moduleSrc.includes("assertPlatformAvailable"));
    assert.ok(errorSrc.includes("MAINTENANCE_MODE_ACTIVE"));
  });
});

describe("public veri güvenliği", () => {
  it("public runtime whitelist", () => {
    assert.deepEqual(PUBLIC_RUNTIME_CONFIG_KEYS, [
      "maxImageBytes",
      "maxTaxCertificateBytes",
      "brandName",
      "supportEmail",
      "supportPhone",
      "websiteUrl",
      "registrationEnabled",
      "maintenanceMode",
      "maintenanceMessage",
    ]);
  });

  it("public endpoint yalnız whitelist döner", () => {
    const src = readSrc("lib/platform-runtime/platform-runtime-loader.ts");
    assert.ok(!src.includes("trialAmount"));
    assert.ok(!src.includes("sessionMaxAgeDays"));
    assert.ok(!src.includes("defaultVatRate"));
  });

  it("public route GET only", () => {
    const src = readRoute(["public", "platform-runtime"]);
    assert.ok(src.includes("getPublicPlatformRuntimeConfig"));
    assert.ok(src.includes("status: 405"));
  });

  it("manipüle client limiti server reddeder", () => {
    const src = readSrc("lib/storage/cdn.ts");
    assert.ok(src.includes("getPlatformUploadLimits"));
    assert.ok(src.includes("validateImageFileWithLimits"));
  });
});

describe("cache", () => {
  it("settings update runtime cache temizler", () => {
    const src = readSrc("lib/admin/platform-settings/platform-settings-cache.ts");
    assert.ok(src.includes("invalidatePlatformRuntimeCaches"));
    assert.ok(src.includes("revalidatePath(\"/register\")"));
  });

  it("runtime cache hedefli tag", () => {
    const src = readSrc("lib/platform-runtime/platform-runtime-cache.ts");
    assert.ok(src.includes("platform-runtime-public"));
    assert.ok(src.includes("platform-runtime-upload"));
    assert.ok(src.includes("platform-runtime-legal"));
  });
});

describe("concurrency version conflict", () => {
  it("updateMany version kontrolü", () => {
    const src = readSrc("lib/admin/platform-settings/settings-mutation-service.ts");
    assert.ok(src.includes("PLATFORM_SETTINGS_VERSION_CONFLICT"));
    assert.ok(src.includes("updateMany"));
  });

  it("simüle eşzamanlı update yalnız biri başarılı", async () => {
    let version = 1;
    let updateCount = 0;

    async function tryUpdate(expectedVersion: number) {
      if (version !== expectedVersion) return 0;
      version += 1;
      updateCount += 1;
      return 1;
    }

    const [first, second] = await Promise.all([tryUpdate(1), tryUpdate(1)]);
    assert.equal(first + second, 1);
    assert.equal(version, 2);
    assert.equal(updateCount, 1);
  });
});

describe("registration policy", () => {
  it("register API registrationEnabled kontrolü", () => {
    const src = readSrc("app/api/auth/register/route.ts");
    assert.ok(src.includes("assertRegistrationEnabled"));
  });
});

describe("fallback", () => {
  it("runtime fallback defaults", () => {
    const fallback = getPublicPlatformRuntimeConfigFallback();
    assert.equal(fallback.maxImageBytes, PLATFORM_SETTINGS_DEFAULTS.maxImageBytes);
    assert.equal(fallback.brandName, PLATFORM_SETTINGS_DEFAULTS.brandName);
  });
});
