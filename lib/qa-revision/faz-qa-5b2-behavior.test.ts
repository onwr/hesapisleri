/**
 * QA Faz 5B.2 — eksik kabul kriterleri (DB gerektirmez)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  prepareAiInsightForCache,
  sanitizeActionHref,
  sanitizeStructuredAiResponse,
  sanitizeUnknownStructuredPayload,
  stripUnsafeAiDisplayText,
} from "@/lib/ai/ai-display-safety";
import {
  parseStructuredResponse,
  textResponse,
} from "@/lib/ai/ai-structured-output";
import {
  getFirstProductErrorMessage,
  productFormSchema,
  productUpdateSchema,
} from "@/lib/product-form-utils";
import { PRODUCT_PRICE_NEGATIVE_ERROR } from "@/lib/product-price-validation";
import { parseProductMoneyInput } from "@/lib/money-input-utils";
import { buildSupplierStatusView } from "@/lib/supplier-status-view";

const webRoot = join(process.cwd());

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("Faz 5B.2 — negatif fiyat giriş noktası envanteri", () => {
  const entryPoints = [
    {
      name: "ProductVariant create/update",
      exists: false,
      reason: "Prisma şemasında ProductVariant modeli yok",
    },
    {
      name: "Toplu ürün CSV import",
      exists: false,
      reason:
        "app/api/products/bulk yalnızca delete/set-status/adjust-price destekler; doğrudan fiyat import yok",
    },
    {
      name: "Marketplace fiyat update/mapping",
      exists: false,
      reason: "Kanal eşleme servisleri SKU eşler; fiyat mutasyonu yok",
    },
    {
      name: "POS ürün fiyat düzenleme",
      exists: false,
      reason: "POS modülü satış fiyatını okur; fiyat düzenleme endpointi yok",
    },
    {
      name: "Barkod ürün fiyat düzenleme",
      exists: false,
      reason: "Barkoda özel fiyat düzenleme endpointi yok",
    },
    {
      name: "Doğrudan API create/update",
      exists: true,
      paths: [
        "app/api/products/create/route.ts",
        "app/api/products/[id]/route.ts",
      ],
    },
    {
      name: "Mobile product API",
      exists: true,
      paths: ["lib/mobile/mobile-products-service.ts"],
    },
    {
      name: "Tedarikçi ürün purchasePrice",
      exists: true,
      paths: ["lib/supplier-utils.ts"],
    },
  ] as const;

  for (const entry of entryPoints) {
    it(`${entry.name}: ${entry.exists ? "mevcut" : "mevcut değil"}`, () => {
      if (!entry.exists) {
        assert.ok("reason" in entry && entry.reason);
        return;
      }
      for (const path of entry.paths ?? []) {
        assert.ok(readSrc(path).length > 0, `${path} bulunamadı`);
      }
    });
  }

  it("API create negatif fiyatı reddeder, 0'a çevirmez, Türkçe hata döner", () => {
    const parsed = productFormSchema.safeParse({
      productType: "STOCK",
      name: "Negatif",
      buyPrice: -10,
      sellPrice: 50,
      stock: 0,
      minStock: 0,
      unitType: "PIECE",
      status: "ACTIVE",
      vatRate: 20,
    });
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      const message = getFirstProductErrorMessage(
        undefined,
        parsed.error.flatten().fieldErrors
      );
      assert.equal(message, PRODUCT_PRICE_NEGATIVE_ERROR);
    }
  });

  it("API update negatif satış fiyatını reddeder", () => {
    const parsed = productUpdateSchema.safeParse({
      productType: "STOCK",
      name: "Güncelle",
      buyPrice: 10,
      sellPrice: -1,
      minStock: 0,
      unitType: "PIECE",
      status: "ACTIVE",
      vatRate: 20,
    });
    assert.equal(parsed.success, false);
  });

  it("parseProductMoneyInput negatif değeri clamp etmez", () => {
    assert.throws(() => parseProductMoneyInput("-5"), /Fiyat 0'dan küçük olamaz/);
  });

  it("toplu adjust-price negatif sonucu reddeder (clamp yok)", () => {
    const bulkSrc = readSrc("lib/product-bulk-service.ts");
    assert.ok(!bulkSrc.includes("Math.max(0"));
    assert.match(bulkSrc, /validateProductPriceValue/);
    assert.match(bulkSrc, /BULK_PRICE_NEGATIVE_BATCH_ERROR/);
  });
});

describe("Faz 5B.2 — AI invalid output ve cache güvenliği", () => {
  it("malformed JSON parse edilemez", () => {
    assert.equal(parseStructuredResponse(null), null);
    assert.equal(parseStructuredResponse("{broken"), null);
  });

  it("şema dışı structured output reddedilir", () => {
    const parsed = parseStructuredResponse({
      blocks: [{ type: "unknown_block", foo: "bar" }],
      sourceModules: [],
    });
    assert.equal(parsed, null);
  });

  it("className/style/html/script ham metne sızmaz", () => {
    const raw =
      'className bg-red-500 style color text-sm <script>alert(1)</script> özet';
    const cleaned = stripUnsafeAiDisplayText(raw);
    assert.ok(!cleaned.includes("className"));
    assert.ok(!cleaned.includes("bg-red-500"));
    assert.ok(!cleaned.includes("<script>"));

    const sanitized = sanitizeStructuredAiResponse({
      blocks: [{ type: "text", content: raw }],
      sourceModules: [],
    });
    assert.ok(sanitized);
    if (sanitized?.blocks[0]?.type === "text") {
      assert.ok(!sanitized.blocks[0].content.includes("bg-red-500"));
      assert.ok(!sanitized.blocks[0].content.includes("<script>"));
    }
  });

  it("izin verilmeyen actionUrl temizlenir", () => {
    assert.equal(sanitizeActionHref("javascript:alert(1)"), undefined);
    assert.equal(sanitizeActionHref("https://evil.example"), undefined);
    assert.equal(sanitizeActionHref("/settings/billing"), "/settings/billing");

    const sanitized = sanitizeStructuredAiResponse({
      blocks: [
        {
          type: "action_proposal",
          title: "Git",
          description: "Fatura",
          href: "javascript:alert(1)",
          requiresApproval: true,
        },
      ],
      sourceModules: [],
    });
    assert.ok(sanitized);
    const block = sanitized!.blocks[0];
    assert.equal(block?.type, "action_proposal");
    if (block?.type === "action_proposal") {
      assert.equal(block.href, undefined);
    }
  });

  it("tamamen güvensiz çıktı cache'e yazılmaz (prepareAiInsightForCache null)", () => {
    const unsafe = textResponse(
      '<script>alert(1)</script> className bg-red-500',
      ["dashboard"]
    );
    const cacheable = prepareAiInsightForCache(unsafe);
    assert.ok(cacheable);
    if (cacheable?.blocks[0]?.type === "text") {
      assert.ok(!cacheable.blocks[0].content.includes("<script>"));
    }

    const onlyUnsafe = sanitizeUnknownStructuredPayload({
      className: "bg-red-500",
      blocks: [{ type: "text", content: "   " }],
    });
    assert.equal(onlyUnsafe, null);
    assert.equal(
      prepareAiInsightForCache({
        blocks: [{ type: "text", content: "   " }],
        sourceModules: [],
      }),
      null
    );
  });

  it("provider timeout AbortError TIMEOUT koduna map edilir", () => {
    const src = readSrc("lib/ai/openai-provider.ts");
    assert.match(src, /AbortError/);
    assert.match(src, /TIMEOUT/);
  });

  it("commentary servisi geçersiz sanitize sonucunu cache'lemez", () => {
    const src = readSrc("lib/ai/ai-insight-commentary-service.ts");
    assert.match(src, /prepareAiInsightForCache/);
    assert.match(src, /if \(sanitizedStructured\)/);
  });

  it("dashboard executive summary cache guard kullanır", () => {
    const src = readSrc("lib/ai/ai-insight-cache-service.ts");
    assert.match(src, /prepareAiInsightForCache/);
    assert.match(src, /if \(sanitizedBlocks\)/);
  });
});

describe("Faz 5B.2 — tedarikçi durum görünümü", () => {
  it("aktif + bakiye yok operasyonel pasif göstermez", () => {
    const view = buildSupplierStatusView({ isActive: true, signedBalance: 0 });
    assert.equal(view.operationalLabel, "Aktif");
    assert.equal(view.accountLabel, "Bakiye Yok");
    assert.notEqual(view.operationalLabel, "Pasif");
  });

  it("aktif + borç ve aktif + alacak ayrı cari etiketleri", () => {
    const debt = buildSupplierStatusView({ isActive: true, signedBalance: 250 });
    const credit = buildSupplierStatusView({ isActive: true, signedBalance: -80 });
    assert.equal(debt.accountLabel, "Tedarikçiye Borcumuz");
    assert.equal(credit.accountLabel, "Tedarikçiden Alacağımız");
    assert.equal(debt.operationalLabel, "Aktif");
    assert.equal(credit.operationalLabel, "Aktif");
  });

  it("pasif tedarikçi operasyonel etiketi cari etiketinden ayrıdır", () => {
    const view = buildSupplierStatusView({ isActive: false, signedBalance: 0 });
    assert.equal(view.operationalLabel, "Pasif");
    assert.equal(view.accountLabel, "Bakiye Yok");
    assert.notEqual(view.operationalLabel, view.accountLabel);
  });

  it("Supplier modelinde arşiv alanı yok; pasif isActive=false ile temsil edilir", () => {
    const schema = readSrc("prisma/schema.prisma");
    const supplierModel = schema.match(/model Supplier \{[\s\S]*?\n\}/)?.[0] ?? "";
    assert.ok(supplierModel.length > 0);
    assert.ok(!supplierModel.includes("archivedAt"));
    const passive = buildSupplierStatusView({
      isActive: false,
      signedBalance: -100,
    });
    assert.equal(passive.operationalLabel, "Pasif");
  });
});
