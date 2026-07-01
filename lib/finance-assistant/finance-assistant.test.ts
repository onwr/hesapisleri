/**
 * Finans Asistanı testleri — DB gerektirmez.
 * Kaynak tarama + tip + davranış kontrolleri.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

// ─── 1. Komut tipleri ve schema ───────────────────────────────────────────────

describe("finance-assistant commands", () => {
  it("tüm komutlar FINANCE_ASSISTANT_COMMANDS listesinde tanımlı", async () => {
    const { FINANCE_ASSISTANT_COMMANDS, COMMAND_LABELS } = await import(
      "@/lib/finance-assistant/commands"
    );
    for (const cmd of FINANCE_ASSISTANT_COMMANDS) {
      assert.ok(cmd in COMMAND_LABELS, `${cmd} için COMMAND_LABELS eksik`);
    }
  });

  it("financeQuerySchema geçerli TOTAL_SALES komutunu kabul eder", async () => {
    const { financeQuerySchema } = await import("@/lib/finance-assistant/commands");
    const result = financeQuerySchema.safeParse({ command: "TOTAL_SALES", period: "THIS_MONTH" });
    assert.ok(result.success);
  });

  it("financeQuerySchema bilinmeyen komut reddeder", async () => {
    const { financeQuerySchema } = await import("@/lib/finance-assistant/commands");
    const result = financeQuerySchema.safeParse({ command: "UNKNOWN_CMD", period: "THIS_MONTH" });
    assert.ok(!result.success);
  });

  it("CUSTOM dönem startDate/endDate zorunlu tutar", async () => {
    const { financeQuerySchema } = await import("@/lib/finance-assistant/commands");
    const bad = financeQuerySchema.safeParse({ command: "TOTAL_SALES", period: "CUSTOM" });
    assert.ok(!bad.success);
    const good = financeQuerySchema.safeParse({
      command: "TOTAL_SALES",
      period: "CUSTOM",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });
    assert.ok(good.success);
  });

  it("17 komut tanımlı", async () => {
    const { FINANCE_ASSISTANT_COMMANDS } = await import("@/lib/finance-assistant/commands");
    assert.equal(FINANCE_ASSISTANT_COMMANDS.length, 17);
  });

  it("PRODUCT_COMMANDS doğru setler içeriyor", async () => {
    const { PRODUCT_COMMANDS } = await import("@/lib/finance-assistant/commands");
    assert.ok(PRODUCT_COMMANDS.has("PRODUCT_SALES"));
    assert.ok(PRODUCT_COMMANDS.has("PRODUCT_PURCHASES"));
    assert.ok(PRODUCT_COMMANDS.has("PRODUCT_STOCK"));
    assert.ok(!PRODUCT_COMMANDS.has("TOTAL_SALES"));
  });
});

// ─── 2. Dönem hesaplama ───────────────────────────────────────────────────────

describe("finance-assistant period", () => {
  it("THIS_MONTH başlangıcı ayın 1'i", async () => {
    const { resolvePeriod } = await import("@/lib/finance-assistant/period");
    const { startDate } = resolvePeriod("THIS_MONTH");
    const now = new Date();
    assert.equal(startDate.getDate(), 1);
    assert.equal(startDate.getMonth(), now.getMonth());
  });

  it("LAST_MONTH bitiş tarihi bu ayın öncesindedir", async () => {
    const { resolvePeriod } = await import("@/lib/finance-assistant/period");
    const { endDate } = resolvePeriod("LAST_MONTH");
    const now = new Date();
    assert.ok(endDate < now);
  });

  it("CUSTOM dönem doğru aralık üretir", async () => {
    const { resolvePeriod } = await import("@/lib/finance-assistant/period");
    const { startDate, endDate, label } = resolvePeriod("CUSTOM", "2026-06-01", "2026-06-30");
    assert.equal(startDate.getFullYear(), 2026);
    assert.equal(startDate.getMonth(), 5); // 0-indexed June
    assert.equal(endDate.getMonth(), 5);
    assert.ok(label.includes("2026"));
  });

  it("LAST_30_DAYS aralığı 30 güne yakın", async () => {
    const { resolvePeriod } = await import("@/lib/finance-assistant/period");
    const { startDate, endDate } = resolvePeriod("LAST_30_DAYS");
    const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    assert.ok(diffDays >= 28 && diffDays <= 31);
  });

  it("geçen ay karşılaştırması iki farklı dönem döndürür", async () => {
    const { resolvePeriod, resolveLastMonth } = await import("@/lib/finance-assistant/period");
    const thisMonth = resolvePeriod("THIS_MONTH");
    const lastMonth = resolveLastMonth();
    assert.ok(thisMonth.startDate > lastMonth.startDate);
  });
});

// ─── 3. Response builders ─────────────────────────────────────────────────────

describe("finance-assistant response-builders", () => {
  it("formatMoney TRY formatlar", async () => {
    const { formatMoney } = await import("@/lib/finance-assistant/response-builders");
    const result = formatMoney(1000);
    assert.ok(result.includes("1.000") || result.includes("1,000"), `Beklenmedik format: ${result}`);
  });

  it("formatQuantity birim etiketi ekler", async () => {
    const { formatQuantity } = await import("@/lib/finance-assistant/response-builders");
    assert.ok(formatQuantity(5, "KG").includes("kg"));
    assert.ok(formatQuantity(10, "PIECE").includes("adet"));
    assert.ok(formatQuantity(3, "LITER").includes("litre"));
  });

  it("buildPeriodResult ISO string döndürür", async () => {
    const { buildPeriodResult } = await import(
      "@/lib/finance-assistant/response-builders"
    );
    const period = { label: "Test", startDate: new Date("2026-01-01"), endDate: new Date("2026-01-31") };
    const result = buildPeriodResult(period);
    assert.equal(result.label, "Test");
    assert.ok(result.startDate.includes("2026"));
  });

  it("farklı para birimleri ayrı formatlarda gösterilir", async () => {
    const { formatMoney } = await import("@/lib/finance-assistant/response-builders");
    const tryStr = formatMoney(100, "TRY");
    const usdStr = formatMoney(100, "USD");
    assert.notEqual(tryStr, usdStr);
  });
});

// ─── 4. Service — kaynak tarama ──────────────────────────────────────────────

describe("finance-assistant service — kaynak tarama", () => {
  it("service dosyası mevcut", async () => {
    await assert.doesNotReject(fs.access("lib/finance-assistant/service.ts"));
  });

  it("service iptal edilen satışları filtreler (activeSaleStatusFilter)", async () => {
    const content = await fs.readFile("lib/finance-assistant/service.ts", "utf8");
    assert.ok(content.includes("activeSaleStatusFilter"), "activeSaleStatusFilter kullanılmalı");
  });

  it("service transferleri gelir/gider saymaz", async () => {
    const content = await fs.readFile("lib/finance-assistant/service.ts", "utf8");
    // COLLECTION tipi kullanıyor, INCOME değil
    assert.ok(content.includes(`type: "COLLECTION"`), "tahsilat tipi COLLECTION olmalı");
    assert.ok(!content.includes(`type: "INCOME"`), "gelir olarak INCOME sayılmamalı");
  });

  it("satın alma yalnız tedarikçi bağlantılı IN hareketlerinden hesaplanır", async () => {
    const content = await fs.readFile("lib/finance-assistant/service.ts", "utf8");
    assert.ok(content.includes(`type: "IN"`), "gerçek alış için type=IN kullanılmalı");
    assert.ok(content.includes(`supplierId: { not: null }`), "supplierId filtresi zorunlu");
    // RETURN = müşteri iadesi, satın alma değil — alış sorgusunda olmamalı
    assert.ok(!content.includes(`"RETURN"`), "RETURN satın alma olarak sayılmamalı");
    assert.ok(!content.includes(`"ADJUSTMENT"`), "ADJUSTMENT alış hesabına girmemeli");
  });

  it("tedarikçi bağlantısız stok girişi kesin alış olarak raporlanmaz", async () => {
    const content = await fs.readFile("lib/finance-assistant/service.ts", "utf8");
    assert.ok(
      content.includes("Satın alma bağlantısı bulunamadığı için kesin alış miktarı hesaplanamadı"),
      "supplier bağlantısız girişler için uyarı mesajı olmalı"
    );
  });

  it("güncel Product.buyPrice geçmiş kâr hesabında kullanılmaz", async () => {
    const content = await fs.readFile("lib/finance-assistant/service.ts", "utf8");
    // buyPrice Prisma sorgusunda select edilmemeli (sadece yorumda geçebilir)
    assert.ok(!content.includes("buyPrice: true"), "buyPrice Prisma select'e dahil edilmemeli");
    assert.ok(
      content.includes("satış anı maliyet verisi eksik"),
      "maliyet snapshot yoksa hata mesajı verilmeli"
    );
  });

  it("launcher AI enabled olsa bile Finans sekmesini açar", async () => {
    const content = await fs.readFile(
      "components/ai-assistant/ai-floating-launcher.tsx",
      "utf8"
    );
    assert.ok(content.includes("openFinance"), "openFinance çağrılmalı");
    assert.ok(!content.includes("openChat"), "chat'e yönlendirme olmamalı");
  });

  it("kâr hesaplanamadı mesajı mevcut", async () => {
    const content = await fs.readFile("lib/finance-assistant/service.ts", "utf8");
    assert.ok(content.includes("Kâr hesaplanamadı"), "maliyet yoksa Türkçe mesaj gösterilmeli");
  });

  it("gider iptalleri hariç tutulur", async () => {
    const content = await fs.readFile("lib/finance-assistant/service.ts", "utf8");
    assert.ok(content.includes(`status: { not: "CANCELLED" }`), "CANCELLED giderler hariç");
  });

  it("companyId her sorguda kullanılır", async () => {
    const content = await fs.readFile("lib/finance-assistant/service.ts", "utf8");
    const matches = content.match(/companyId/g) ?? [];
    assert.ok(matches.length > 10, "companyId tenant scope için çok sayıda kullanılmalı");
  });

  it("runFinanceCommand tüm 17 command'ı switch ile ele alır", async () => {
    const { FINANCE_ASSISTANT_COMMANDS } = await import("@/lib/finance-assistant/commands");
    const content = await fs.readFile("lib/finance-assistant/service.ts", "utf8");
    for (const cmd of FINANCE_ASSISTANT_COMMANDS) {
      assert.ok(content.includes(`case "${cmd}":`), `${cmd} switch case eksik`);
    }
  });
});

// ─── 5. API endpoint — kaynak tarama ─────────────────────────────────────────

describe("finance-assistant API endpoint", () => {
  it("route dosyası mevcut", async () => {
    await assert.doesNotReject(
      fs.access("app/api/finance-assistant/query/route.ts")
    );
  });

  it("endpoint ai-assistant permission zorunlu kılar", async () => {
    const content = await fs.readFile(
      "app/api/finance-assistant/query/route.ts",
      "utf8"
    );
    assert.ok(
      content.includes(`requireApiModuleAccess("ai-assistant")`),
      "ai-assistant permission zorunlu"
    );
  });

  it("companyId body'den alınmıyor, session'dan alınıyor", async () => {
    const content = await fs.readFile(
      "app/api/finance-assistant/query/route.ts",
      "utf8"
    );
    // companyId auth destructure ya da auth.companyId ile alınmalı
    assert.ok(
      content.includes("} = auth") || content.includes("auth.companyId"),
      "companyId auth'dan alınmalı"
    );
    assert.ok(!content.includes("body.companyId"), "body'den companyId alınmamalı");
    assert.ok(!content.includes("req.body?.companyId"), "req.body'den alınmamalı");
  });

  it("zod validation kullanılıyor", async () => {
    const content = await fs.readFile(
      "app/api/finance-assistant/query/route.ts",
      "utf8"
    );
    assert.ok(content.includes("financeQuerySchema"), "financeQuerySchema kullanılmalı");
    assert.ok(content.includes("safeParse"), "safeParse ile doğrulama yapılmalı");
  });

  it("merkezi rate-limit helper kullanılıyor", async () => {
    const content = await fs.readFile(
      "app/api/finance-assistant/query/route.ts",
      "utf8"
    );
    assert.ok(content.includes("assertAiChatRateLimits"), "merkezi assertAiChatRateLimits kullanılmalı");
    assert.ok(!content.includes("rateLimitMap"), "özel in-memory rate limit map olmamalı");
    assert.ok(content.includes("429"), "429 Too Many Requests dönülmeli");
  });

  it("foreign product hata fırlatır", async () => {
    const content = await fs.readFile("lib/finance-assistant/service.ts", "utf8");
    assert.ok(
      content.includes("Ürün bulunamadı veya erişim yetkiniz yok"),
      "foreign product için hata mesajı"
    );
  });
});

// ─── 6. LLM izolasyonu ───────────────────────────────────────────────────────

describe("finance-assistant — LLM izolasyonu", () => {
  it("service OpenAI çağırmıyor", async () => {
    const content = await fs.readFile("lib/finance-assistant/service.ts", "utf8");
    assert.ok(!content.includes("openai"), "OpenAI referansı olmamalı");
    assert.ok(!content.includes("gpt-"), "GPT model referansı olmamalı");
    assert.ok(!content.includes("abacus"), "Abacus referansı olmamalı");
  });

  it("route LLM çağırmıyor", async () => {
    const content = await fs.readFile(
      "app/api/finance-assistant/query/route.ts",
      "utf8"
    );
    assert.ok(!content.includes("openai"), "route'ta OpenAI referansı olmamalı");
    assert.ok(!content.includes("fetch.*openai"), "OpenAI fetch olmamalı");
  });

  it("config_missing durumunda launcher Finans Asistanı açar", async () => {
    const content = await fs.readFile(
      "components/ai-assistant/ai-floating-launcher.tsx",
      "utf8"
    );
    assert.ok(
      content.includes("openFinance"),
      "config_missing durumunda openFinance çağrılmalı"
    );
    assert.ok(
      content.includes("Finans Asistanı"),
      "buton etiketi Finans Asistanı olmalı"
    );
  });

  it("panel dosyası fetch/API çağrısı dışında model referansı içermiyor", async () => {
    const content = await fs.readFile(
      "components/ai-assistant/finance-assistant-panel.tsx",
      "utf8"
    );
    assert.ok(!content.includes("openai"), "panel'de OpenAI referansı olmamalı");
    assert.ok(!content.includes("gpt"), "panel'de GPT referansı olmamalı");
  });
});

// ─── 7. Response Türkçe mesaj ─────────────────────────────────────────────────

describe("finance-assistant — Türkçe mesajlar", () => {
  it("service Türkçe mesaj üretiyor", async () => {
    const content = await fs.readFile("lib/finance-assistant/service.ts", "utf8");
    assert.ok(content.includes("döneminde"), "dönem ifadesi Türkçe olmalı");
    assert.ok(content.includes("Toplam"), "Türkçe mesaj içermeli");
  });

  it("period label Türkçe döndürüyor", async () => {
    const { resolvePeriod } = await import("@/lib/finance-assistant/period");
    assert.equal(resolvePeriod("THIS_MONTH").label, "Bu Ay");
    assert.equal(resolvePeriod("LAST_MONTH").label, "Geçen Ay");
    assert.equal(resolvePeriod("TODAY").label, "Bugün");
  });
});

// ─── 8. Drawer entegrasyonu ───────────────────────────────────────────────────

describe("finance-assistant — drawer entegrasyonu", () => {
  it("global-ai-drawer Finans tabı içeriyor", async () => {
    const content = await fs.readFile(
      "components/ai-assistant/global-ai-drawer.tsx",
      "utf8"
    );
    assert.ok(content.includes("finance"), "finance tab tipi kullanılmalı");
    assert.ok(content.includes("Finans"), "Finans etiketi drawer'da olmalı");
    assert.ok(content.includes("FinanceAssistantPanel"), "FinanceAssistantPanel import edilmeli");
  });

  it("ai-drawer-utils finance tab tipini içeriyor", async () => {
    const content = await fs.readFile("lib/ai/ai-drawer-utils.ts", "utf8");
    assert.ok(content.includes('"finance"'), "finance tipi AiDrawerTab'a eklenmeli");
  });

  it("drawer context openFinance metodunu expose ediyor", async () => {
    const content = await fs.readFile(
      "components/ai-assistant/ai-drawer-context.tsx",
      "utf8"
    );
    assert.ok(content.includes("openFinance"), "openFinance metodu context'te olmalı");
  });
});

// ─── 9. Sipay izolasyonu ─────────────────────────────────────────────────────

describe("finance-assistant — Sipay izolasyonu", () => {
  it("service Sipay içermiyor", async () => {
    const content = await fs.readFile("lib/finance-assistant/service.ts", "utf8");
    assert.ok(!content.toLowerCase().includes("sipay"), "Sipay referansı olmamalı");
  });

  it("commands.ts Sipay içermiyor", async () => {
    const content = await fs.readFile("lib/finance-assistant/commands.ts", "utf8");
    assert.ok(!content.toLowerCase().includes("sipay"), "Sipay referansı olmamalı");
  });

  it("route Sipay içermiyor", async () => {
    const content = await fs.readFile(
      "app/api/finance-assistant/query/route.ts",
      "utf8"
    );
    assert.ok(!content.toLowerCase().includes("sipay"), "Sipay referansı olmamalı");
  });
});
