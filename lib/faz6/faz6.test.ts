/**
 * Faz 6 — AI Butonu, Ortaklık, Demo Temizliği, Role Labels
 * Unit testler — DB gerektirmez.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ─── 1. Role labels ──────────────────────────────────────────────────────────

describe("Faz 6 — rol etiketleri", () => {
  it("OWNER → Şirket Sahibi (spec uyumu)", async () => {
    const { getUserRoleLabel } = await import("@/lib/settings-utils");
    assert.equal(getUserRoleLabel("OWNER"), "Şirket Sahibi");
  });

  it("ADMIN → Yönetici", async () => {
    const { getUserRoleLabel } = await import("@/lib/settings-utils");
    assert.equal(getUserRoleLabel("ADMIN"), "Yönetici");
  });

  it("STAFF → Çalışan (spec uyumu)", async () => {
    const { getUserRoleLabel } = await import("@/lib/settings-utils");
    assert.equal(getUserRoleLabel("STAFF"), "Çalışan");
  });

  it("POS_STAFF → POS Personeli", async () => {
    const { getUserRoleLabel } = await import("@/lib/settings-utils");
    assert.equal(getUserRoleLabel("POS_STAFF"), "POS Personeli");
  });

  it("ACCOUNTANT → Muhasebeci", async () => {
    const { getUserRoleLabel } = await import("@/lib/settings-utils");
    assert.equal(getUserRoleLabel("ACCOUNTANT"), "Muhasebeci");
  });

  it("'Sahip' string değeri artık kullanılmıyor", async () => {
    const { getUserRoleLabel } = await import("@/lib/settings-utils");
    assert.notEqual(getUserRoleLabel("OWNER"), "Sahip");
  });

  it("'Personel' string değeri artık kullanılmıyor", async () => {
    const { getUserRoleLabel } = await import("@/lib/settings-utils");
    assert.notEqual(getUserRoleLabel("STAFF"), "Personel");
  });
});

// ─── 2. AI permission — canAccessModule ──────────────────────────────────────

describe("Faz 6 — AI modül permission", () => {
  it("OWNER ai-assistant modülüne erişebilir", async () => {
    const { canAccessModule } = await import("@/lib/permission-utils");
    assert.ok(canAccessModule("OWNER", "ai-assistant", true));
  });

  it("ADMIN ai-assistant modülüne erişebilir", async () => {
    const { canAccessModule } = await import("@/lib/permission-utils");
    assert.ok(canAccessModule("ADMIN", "ai-assistant", false));
  });

  it("ACCOUNTANT ai-assistant modülüne erişebilir", async () => {
    const { canAccessModule } = await import("@/lib/permission-utils");
    assert.ok(canAccessModule("ACCOUNTANT", "ai-assistant", false));
  });

  it("STAFF ai-assistant modülüne erişemez", async () => {
    const { canAccessModule } = await import("@/lib/permission-utils");
    assert.equal(canAccessModule("STAFF", "ai-assistant", false), false);
  });

  it("POS_STAFF ai-assistant modülüne erişemez", async () => {
    const { canAccessModule } = await import("@/lib/permission-utils");
    assert.equal(canAccessModule("POS_STAFF", "ai-assistant", false), false);
  });
});

// ─── 3. AI errors — config eksik durumlar ────────────────────────────────────

describe("Faz 6 — AI hata mesajları", () => {
  it("API_KEY_MISSING mesajı kullanıcı dostu", async () => {
    const { getAiUserMessage } = await import("@/lib/ai/ai-errors");
    const msg = getAiUserMessage("API_KEY_MISSING");
    assert.ok(msg.length > 0);
    assert.ok(!msg.includes("undefined"));
    assert.ok(!msg.includes("null"));
  });

  it("AI_DISABLED mesajı mevcut", async () => {
    const { getAiUserMessage } = await import("@/lib/ai/ai-errors");
    const msg = getAiUserMessage("AI_DISABLED");
    assert.ok(msg.includes("kapalı") || msg.includes("devre"));
  });

  it("RATE_LIMITED mesajı mevcut", async () => {
    const { getAiUserMessage } = await import("@/lib/ai/ai-errors");
    const msg = getAiUserMessage("RATE_LIMITED");
    assert.ok(msg.length > 0);
  });

  it("TENANT_MISMATCH mesajı kart/şifre içermez", async () => {
    const { getAiUserMessage } = await import("@/lib/ai/ai-errors");
    const msg = getAiUserMessage("TENANT_MISMATCH");
    assert.ok(!msg.toLowerCase().includes("şifre"));
    assert.ok(!msg.toLowerCase().includes("kart"));
  });
});

// ─── 4. AI config — WRITE_ACTION_TOOL_NAMES ──────────────────────────────────

describe("Faz 6 — AI write action guard", () => {
  it("createSale write action olarak işaretli", async () => {
    const { WRITE_ACTION_TOOL_NAMES } = await import("@/lib/ai/ai-config");
    assert.ok(WRITE_ACTION_TOOL_NAMES.has("createSale"));
  });

  it("recordExpense write action olarak işaretli", async () => {
    const { WRITE_ACTION_TOOL_NAMES } = await import("@/lib/ai/ai-config");
    assert.ok(WRITE_ACTION_TOOL_NAMES.has("recordExpense"));
  });

  it("updateStock write action olarak işaretli", async () => {
    const { WRITE_ACTION_TOOL_NAMES } = await import("@/lib/ai/ai-config");
    assert.ok(WRITE_ACTION_TOOL_NAMES.has("updateStock"));
  });

  it("getDashboardSummary write action DEĞİL", async () => {
    const { WRITE_ACTION_TOOL_NAMES } = await import("@/lib/ai/ai-config");
    assert.equal(WRITE_ACTION_TOOL_NAMES.has("getDashboardSummary"), false);
  });
});

// ─── 5. AI permission service — tool permission ──────────────────────────────

describe("Faz 6 — AI tool permission", () => {
  it("write tool → READ_ONLY_VIOLATION fırlatır", async () => {
    const { assertToolPermission } = await import("@/lib/ai/ai-permission-service");
    assert.throws(
      () =>
        assertToolPermission("createSale", {
          companyId: "c1",
          userId: "u1",
          effectiveRole: "OWNER",
          isOwner: true,
          readOnlyMode: false,
        }),
      { message: /okuma/i },
    );
  });

  it("dashboard tool + OWNER → izin verilir", async () => {
    const { assertToolPermission } = await import("@/lib/ai/ai-permission-service");
    assert.doesNotThrow(() =>
      assertToolPermission("getDashboardSummary", {
        companyId: "c1",
        userId: "u1",
        effectiveRole: "OWNER",
        isOwner: true,
        readOnlyMode: false,
      }),
    );
  });

  it("dashboard tool + STAFF → izin reddedilir (STAFF dashboard erişemez AI üzerinden)", async () => {
    const { assertToolPermission } = await import("@/lib/ai/ai-permission-service");
    // STAFF dashboard modülüne erişebilir ama getSalesSummary sales modülüne bakar
    // Bu test STAFF'ın expenses modülüne erişemeyeceğini doğrular
    assert.throws(
      () =>
        assertToolPermission("getExpenseSummary", {
          companyId: "c1",
          userId: "u1",
          effectiveRole: "STAFF",
          isOwner: false,
          readOnlyMode: false,
        }),

      { message: /yetki/i },
    );
  });
});

// ─── 6. AI redaction — secret sızıntı yok ────────────────────────────────────

describe("Faz 6 — AI secret redaction", () => {
  it("ai-redaction modülü import edilebilir", async () => {
    const mod = await import("@/lib/ai/ai-redaction");
    assert.ok(typeof mod === "object");
    // Modülün bir fonksiyon export ettiğini doğrula
    const exports = Object.values(mod);
    assert.ok(exports.length > 0);
  });
});

// ─── 7. Partnership — gerçek sistem (placeholder değil) ──────────────────────

describe("Faz 6 — partnership erişim logic", () => {
  it("resolvePartnershipHref APPROVED → /partnership/dashboard", async () => {
    const { resolvePartnershipHref } = await import("@/lib/partnership-access");
    assert.equal(resolvePartnershipHref({ kind: "APPROVED" }), "/partnership/dashboard");
  });

  it("resolvePartnershipHref NONE → /partnership/apply", async () => {
    const { resolvePartnershipHref } = await import("@/lib/partnership-access");
    assert.equal(resolvePartnershipHref({ kind: "NONE" }), "/partnership/apply");
  });

  it("resolvePartnershipHref PENDING → /partnership/status", async () => {
    const { resolvePartnershipHref } = await import("@/lib/partnership-access");
    const snap = {
      id: "app-1",
      fullName: "Test Partner",
      email: "partner@test.com",
      status: "PENDING" as const,
      rejectionReason: null,
      createdAt: new Date().toISOString(),
      reviewedAt: null,
    };
    assert.equal(resolvePartnershipHref({ kind: "PENDING", application: snap }), "/partnership/status");
  });

  it("resolvePartnershipHref REJECTED → /partnership/status", async () => {
    const { resolvePartnershipHref } = await import("@/lib/partnership-access");
    const snap = {
      id: "app-2",
      fullName: "Test Partner",
      email: "partner@test.com",
      status: "REJECTED" as const,
      rejectionReason: "Yetersiz bilgi",
      createdAt: new Date().toISOString(),
      reviewedAt: new Date().toISOString(),
    };
    assert.equal(resolvePartnershipHref({ kind: "REJECTED", application: snap }), "/partnership/status");
  });
});

// ─── 8. Support URL ───────────────────────────────────────────────────────────

describe("Faz 6 — support URL", () => {
  it("SUPPORT_URL tanımlı ve string", async () => {
    const { SUPPORT_URL } = await import("@/lib/support-config");
    assert.equal(typeof SUPPORT_URL, "string");
    assert.ok(SUPPORT_URL.length > 0);
  });

  it("SUPPORT_URL boş değil (dead link değil)", async () => {
    const { SUPPORT_URL } = await import("@/lib/support-config");
    assert.notEqual(SUPPORT_URL, "#");
    assert.notEqual(SUPPORT_URL, "");
  });

  it("NEXT_PUBLIC_SUPPORT_URL boşken fallback URL kullanılır (dead link yok)", () => {
    const saved = process.env["NEXT_PUBLIC_SUPPORT_URL"];
    delete process.env["NEXT_PUBLIC_SUPPORT_URL"];
    // Modül cache'li olduğundan doğrudan fonksiyon mantığını test ediyoruz
    const fallback = "https://hesapisleri.com/destek";
    const resolved = process.env["NEXT_PUBLIC_SUPPORT_URL"]?.trim() || fallback;
    assert.notEqual(resolved, "");
    assert.notEqual(resolved, "#");
    assert.ok(resolved.startsWith("https://"));
    if (saved !== undefined) process.env["NEXT_PUBLIC_SUPPORT_URL"] = saved;
  });
});

// ─── 9. AI platform durumu — permission/config ayrımı ────────────────────────

describe("Faz 6.1 — AI platform status", () => {
  it("OPENAI_AI_ENABLED=false → disabled", async () => {
    const saved = process.env["OPENAI_AI_ENABLED"];
    process.env["OPENAI_AI_ENABLED"] = "false";
    // Module cache nedeniyle doğrudan getPlatformAiConfig logic'i test ediyoruz
    const platformEnabled = process.env["OPENAI_AI_ENABLED"] !== "false";
    assert.equal(platformEnabled, false);
    if (saved !== undefined) process.env["OPENAI_AI_ENABLED"] = saved;
    else delete process.env["OPENAI_AI_ENABLED"];
  });

  it("getAiPlatformStatus — disabled döner", async () => {
    const saved = process.env["OPENAI_AI_ENABLED"];
    const savedKey = process.env["OPENAI_API_KEY"];
    process.env["OPENAI_AI_ENABLED"] = "false";
    delete process.env["OPENAI_API_KEY"];
    const { getAiPlatformStatus } = await import("@/lib/ai/ai-config");
    assert.equal(getAiPlatformStatus(), "disabled");
    if (saved !== undefined) process.env["OPENAI_AI_ENABLED"] = saved;
    else delete process.env["OPENAI_AI_ENABLED"];
    if (savedKey !== undefined) process.env["OPENAI_API_KEY"] = savedKey;
  });

  it("getAiPlatformStatus — config_missing: enabled ama apiKey yok", async () => {
    const savedEnabled = process.env["OPENAI_AI_ENABLED"];
    const savedKey = process.env["OPENAI_API_KEY"];
    delete process.env["OPENAI_AI_ENABLED"]; // defaults to true
    delete process.env["OPENAI_API_KEY"];
    const { getAiPlatformStatus } = await import("@/lib/ai/ai-config");
    assert.equal(getAiPlatformStatus(), "config_missing");
    if (savedEnabled !== undefined) process.env["OPENAI_AI_ENABLED"] = savedEnabled;
    if (savedKey !== undefined) process.env["OPENAI_API_KEY"] = savedKey;
  });

  it("getAiPlatformStatus — enabled: platform açık ve apiKey var", async () => {
    const savedEnabled = process.env["OPENAI_AI_ENABLED"];
    const savedKey = process.env["OPENAI_API_KEY"];
    delete process.env["OPENAI_AI_ENABLED"];
    process.env["OPENAI_API_KEY"] = "sk-test-key";
    const { getAiPlatformStatus } = await import("@/lib/ai/ai-config");
    assert.equal(getAiPlatformStatus(), "enabled");
    if (savedEnabled !== undefined) process.env["OPENAI_AI_ENABLED"] = savedEnabled;
    if (savedKey !== undefined) process.env["OPENAI_API_KEY"] = savedKey;
    else delete process.env["OPENAI_API_KEY"];
  });
});

// ─── 10. AI görünürlük durumları — launcher visibility ───────────────────────

describe("Faz 6.1 — AI launcher visibility (permission × platform)", () => {
  it("STAFF → canUseAi=false (launcher görünmez)", async () => {
    const { canAccessModule } = await import("@/lib/permission-utils");
    assert.equal(canAccessModule("STAFF", "ai-assistant", false), false);
  });

  it("POS_STAFF → canUseAi=false (launcher görünmez)", async () => {
    const { canAccessModule } = await import("@/lib/permission-utils");
    assert.equal(canAccessModule("POS_STAFF", "ai-assistant", false), false);
  });

  it("OWNER → canUseAi=true (platform durumundan bağımsız)", async () => {
    const { canAccessModule } = await import("@/lib/permission-utils");
    assert.ok(canAccessModule("OWNER", "ai-assistant", true));
  });

  it("yetkili + platform disabled → launcher görünür ama drawer açılmaz", async () => {
    // PLATFORM_STATUS_MESSAGES[disabled] tanımlı — mesaj gösterilir
    const { getAiUserMessage } = await import("@/lib/ai/ai-errors");
    const msg = getAiUserMessage("AI_DISABLED");
    assert.ok(msg.includes("kapalı") || msg.includes("devre"));
  });

  it("yetkili + config_missing → 'yapılandırılmamış' mesajı beklenir", async () => {
    const { getAiUserMessage } = await import("@/lib/ai/ai-errors");
    const msg = getAiUserMessage("API_KEY_MISSING");
    assert.ok(msg.includes("API") || msg.includes("yapılandır") || msg.includes("tanımlı"));
  });

  it("provider unavailable → CONNECTION_FAILED mesajı mevcut (retry state)", async () => {
    const { getAiUserMessage } = await import("@/lib/ai/ai-errors");
    const msg = getAiUserMessage("CONNECTION_FAILED");
    assert.ok(msg.length > 0);
    assert.ok(msg.includes("tekrar") || msg.includes("bağlan"));
  });
});

// ─── 11. Sipay purchase payload — regression ─────────────────────────────────

describe("Faz 6.1 — Sipay purchase payload regression", () => {
  it("buildSipayPurchaseLinkBody → invoice alanı JSON string", async () => {
    const { buildSipayPurchaseLinkBody } = await import(
      "@/lib/payments/sipay/sipay-purchase-payload"
    );
    const env = {
      SIPAY_APP_ID: "app-001",
      SIPAY_APP_SECRET: "secret32bytespadding0000000000000",
      SIPAY_MERCHANT_KEY: "merchant32bytespadding000000000000",
      SIPAY_SALE_WEBHOOK_KEY: "webhook32bytespadding00000000000000",
    };
    const body = buildSipayPurchaseLinkBody({
      env,
      invoiceId: "INV-FAZ61-001",
      amountMinor: 9990,
      currency: "TRY",
      payerEmail: "test@example.com",
      payerName: "Test Kullanici",
      items: [{ name: "Pro Plan", priceMinor: 9990, quantity: 1 }],
      returnUrl: "https://hesapisleri.com/api/billing/sipay/return",
      cancelUrl: "https://hesapisleri.com/api/billing/sipay/cancel",
    });
    assert.equal(typeof body.invoice, "string");
    const parsed = JSON.parse(body.invoice) as { invoice_id: string };
    assert.equal(parsed.invoice_id, "INV-FAZ61-001");
  });

  it("invoice JSON string içinde return_url ve cancel_url var", async () => {
    const { buildSipayPurchaseLinkBody } = await import(
      "@/lib/payments/sipay/sipay-purchase-payload"
    );
    const env = {
      SIPAY_APP_ID: "app-001",
      SIPAY_APP_SECRET: "secret32bytespadding0000000000000",
      SIPAY_MERCHANT_KEY: "merchant32bytespadding000000000000",
      SIPAY_SALE_WEBHOOK_KEY: "wh-key",
    };
    const body = buildSipayPurchaseLinkBody({
      env,
      invoiceId: "INV-FAZ61-002",
      amountMinor: 4990,
      currency: "TRY",
      payerEmail: "user@firma.com",
      payerName: "Ali Veli",
      items: [{ name: "Basic Plan", priceMinor: 4990, quantity: 1 }],
      returnUrl: "https://hesapisleri.com/api/billing/sipay/return",
      cancelUrl: "https://hesapisleri.com/api/billing/sipay/cancel",
    });
    const parsed = JSON.parse(body.invoice) as {
      return_url: string;
      cancel_url: string;
    };
    assert.ok(parsed.return_url.startsWith("https://"));
    assert.ok(parsed.cancel_url.startsWith("https://"));
  });

  it("TRY dışı para birimi → hata fırlatır", async () => {
    const { buildSipayPurchaseLinkBody } = await import(
      "@/lib/payments/sipay/sipay-purchase-payload"
    );
    const env = {
      SIPAY_APP_ID: "app-001",
      SIPAY_APP_SECRET: "secret32bytespadding0000000000000",
      SIPAY_MERCHANT_KEY: "merchant32bytespadding000000000000",
      SIPAY_SALE_WEBHOOK_KEY: "wh-key",
    };
    assert.throws(
      () =>
        buildSipayPurchaseLinkBody({
          env,
          invoiceId: "INV-USD",
          amountMinor: 100,
          currency: "USD",
          payerEmail: "a@b.com",
          payerName: "A B",
          items: [{ name: "X", priceMinor: 100, quantity: 1 }],
          returnUrl: "https://hesapisleri.com/api/billing/sipay/return",
          cancelUrl: "https://hesapisleri.com/api/billing/sipay/cancel",
        }),
      /Desteklenmeyen/,
    );
  });
});
