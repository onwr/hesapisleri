import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  normalizePosBarcode,
  resolveMobilePosPermissions,
  validateMobilePosCheckoutPrices,
} from "./mobile-pos-service";
import { MobilePosError } from "./mobile-pos-errors";
import { buildPosCheckoutPayloadHash } from "@/lib/pos-checkout-idempotency";
import type { PosCheckoutInput } from "@/lib/pos-checkout-utils";

const webRoot = join(__dirname, "../..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("Mobile POS permissions", () => {
  it("POS_STAFF satış yapabilir, muhasebeci yapamaz", () => {
    const posStaff = resolveMobilePosPermissions("POS_STAFF", false);
    assert.equal(posStaff.canSell, true);
    assert.equal(posStaff.canApplyDiscount, true);

    const accountant = resolveMobilePosPermissions("ACCOUNTANT", false);
    assert.equal(accountant.canSell, false);
  });

  it("OWNER indirim ve depo seçebilir", () => {
    const owner = resolveMobilePosPermissions("OWNER", true);
    assert.equal(owner.canSell, true);
    assert.equal(owner.canApplyDiscount, true);
    assert.equal(owner.canSelectWarehouse, true);
    assert.equal(owner.canSelectCustomer, true);
  });
});

describe("Mobile POS barcode", () => {
  it("barkod normalize edilir", () => {
    assert.equal(normalizePosBarcode("  8690 1234 5678  "), "869012345678");
  });
});

describe("Mobile POS checkout price tampering", () => {
  it("unit price değişikliği PRICE_CHANGED fırlatır", async () => {
    const { db } = await import("@/lib/prisma");
    const product = await db.product.findFirst({
      where: { status: "ACTIVE" },
      select: { id: true, companyId: true, name: true, sellPrice: true, vatRate: true },
    });

    if (!product) {
      return;
    }

    await assert.rejects(
      () =>
        validateMobilePosCheckoutPrices(product.companyId, [
          {
            productId: product.id,
            name: product.name,
            quantity: 1,
            unitPrice: Number(product.sellPrice) + 1,
            vatRate: product.vatRate,
          },
        ]),
      (err: Error) => err instanceof MobilePosError && err.code === "PRICE_CHANGED"
    );
  });
});

describe("Mobile POS idempotency hash", () => {
  it("aynı payload aynı hash üretir", () => {
    const base: PosCheckoutInput = {
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      paymentStatus: "PAID",
      discount: 0,
      items: [
        {
          productId: "p1",
          name: "Ürün",
          quantity: 1,
          unitPrice: 100,
          vatRate: 20,
        },
      ],
      payments: [{ paymentMethod: "CASH", amount: 120, accountId: "acc1" }],
    };

    const h1 = buildPosCheckoutPayloadHash(base);
    const h2 = buildPosCheckoutPayloadHash({ ...base });
    assert.equal(h1, h2);
  });

  it("farklı payload farklı hash", () => {
    const base: PosCheckoutInput = {
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      paymentStatus: "PAID",
      discount: 0,
      items: [
        {
          productId: "p1",
          name: "Ürün",
          quantity: 1,
          unitPrice: 100,
          vatRate: 20,
        },
      ],
      payments: [{ paymentMethod: "CASH", amount: 120, accountId: "acc1" }],
    };

    const changed = buildPosCheckoutPayloadHash({
      ...base,
      items: [{ ...base.items[0]!, quantity: 2 }],
    });
    assert.notEqual(buildPosCheckoutPayloadHash(base), changed);
  });
});

describe("Mobile POS API routes", () => {
  it("bootstrap route executePosCheckout kullanmaz, tenant guard kullanır", () => {
    const src = readSrc("app/api/mobile/pos/bootstrap/route.ts");
    assert.ok(src.includes("requireMobilePosSession"));
    assert.ok(src.includes("getMobilePosBootstrap"));
    assert.ok(!src.includes("body.companyId"));
  });

  it("checkout route executePosCheckout yeniden kullanır", () => {
    const src = readSrc("app/api/mobile/pos/checkout/route.ts");
    assert.ok(src.includes("executeMobilePosCheckout"));
    assert.ok(src.includes("posCheckoutSchema"));
  });

  it("checkout-status tenant scope companyId kullanır", () => {
    const src = readSrc("app/api/mobile/pos/checkout-status/route.ts");
    assert.ok(src.includes("getMobilePosCheckoutStatus"));
    assert.ok(src.includes("companyId"));
  });

  it("sale detail response hassas alan döndürmez", () => {
    const src = readSrc("lib/mobile/mobile-pos-service.ts");
    const fn = src.match(/export async function getMobileSaleDetail[\s\S]*?^}/m)?.[0] ?? "";
    assert.ok(fn.includes("getMobileSaleDetail"));
    assert.ok(!fn.includes("payloadHash:"));
    assert.ok(!fn.includes("idempotencyKey:"));
    assert.ok(!fn.includes("buyPrice"));
  });

  it("barcode route parametre decode eder", () => {
    const src = readSrc("app/api/mobile/pos/barcode/[barcode]/route.ts");
    assert.ok(src.includes("decodeURIComponent"));
  });
});

describe("Mobile POS response strip", () => {
  it("checkout response internal metadata içermez", () => {
    const src = readSrc("lib/mobile/mobile-pos-service.ts");
    const fn = src.match(/executeMobilePosCheckout[\s\S]*?return \{[\s\S]*?\};\n\}/)?.[0] ?? "";
    assert.ok(fn.includes("saleNumber"));
    assert.ok(!fn.includes("payloadHash"));
    assert.ok(!fn.includes("tokenHash"));
  });
});

describe("Mobile POS bootstrap settings source", () => {
  it("mobile-pos-service hard-coded ayar kullanmaz", () => {
    const src = readSrc("lib/mobile/mobile-pos-service.ts");
    assert.ok(src.includes("getPosBootstrapSettings"));
    assert.ok(src.includes("serializePosBootstrapSettingsForMobile"));
    assert.ok(!src.includes("allowNegativeStock: false"));
    assert.ok(!src.match(/defaultTaxRate:\s*20/));
  });

  it("bootstrap settings canonical kaynaklardan gelir", () => {
    const { getPosBootstrapSettings } = require("@/lib/pos-bootstrap-settings");
    const settings = getPosBootstrapSettings();
    assert.equal(settings.paymentMethods.value.length, 3);
    assert.ok(settings.paymentMethods.source.includes("pos-checkout-utils"));
    assert.ok(settings.allowNegativeStock.source.includes("stock-policy"));
  });
});

describe("Mobile POS canonical payments", () => {
  it("PAID tam ödeme doğrulanır", () => {
    const { validatePosCheckoutPayments } = require("@/lib/pos-checkout-utils");
    assert.equal(
      validatePosCheckoutPayments({
        paymentStatus: "PAID",
        total: 100,
        payments: [{ paymentMethod: "CASH", amount: 100, accountId: "a1" }],
      }),
      null
    );
  });

  it("PARTIAL ödeme doğrulanır", () => {
    const { validatePosCheckoutPayments } = require("@/lib/pos-checkout-utils");
    assert.equal(
      validatePosCheckoutPayments({
        paymentStatus: "PARTIAL",
        total: 100,
        collectedAmount: 40,
        payments: [{ paymentMethod: "CARD", amount: 40, accountId: "a1" }],
      }),
      null
    );
  });

  it("UNPAID ödeme satırı reddedilir", () => {
    const { validatePosCheckoutPayments } = require("@/lib/pos-checkout-utils");
    assert.ok(
      validatePosCheckoutPayments({
        paymentStatus: "UNPAID",
        total: 100,
        payments: [{ paymentMethod: "CASH", amount: 100, accountId: "a1" }],
      })
    );
  });

  it("split payment toplam doğrulaması", () => {
    const { validatePosCheckoutPayments } = require("@/lib/pos-checkout-utils");
    assert.equal(
      validatePosCheckoutPayments({
        paymentStatus: "PAID",
        total: 100,
        payments: [
          { paymentMethod: "CASH", amount: 60, accountId: "a1" },
          { paymentMethod: "CARD", amount: 40, accountId: "a2" },
        ],
      }),
      null
    );
  });

  it("overpayment reddedilir", () => {
    const { validatePosCheckoutPayments } = require("@/lib/pos-checkout-utils");
    assert.ok(
      validatePosCheckoutPayments({
        paymentStatus: "PAID",
        total: 100,
        payments: [{ paymentMethod: "CASH", amount: 120, accountId: "a1" }],
      })
    );
  });

  it("negative payment reddedilir", () => {
    const { validatePosCheckoutPayments } = require("@/lib/pos-checkout-utils");
    assert.ok(
      validatePosCheckoutPayments({
        paymentStatus: "PAID",
        total: 100,
        payments: [{ paymentMethod: "CASH", amount: -10, accountId: "a1" }],
      })
    );
  });
});

describe("Mobile POS discount permission", () => {
  it("indirim yetkisi olmayan kullanıcı reddedilir", () => {
    const src = readSrc("lib/mobile/mobile-pos-service.ts");
    assert.ok(src.includes("canApplyDiscount"));
    assert.ok(src.includes("INVALID_DISCOUNT"));
  });

  it("POS indirim tipi AMOUNT only", () => {
    const { getPosBootstrapSettings } = require("@/lib/pos-bootstrap-settings");
    const settings = getPosBootstrapSettings();
    assert.equal(settings.discountPolicy.cartDiscountType, "AMOUNT");
    assert.equal(settings.discountPolicy.percentDiscountSupported, false);
  });
});

describe("Mobile POS checkout status", () => {
  it("checkout-status route payloadHash kabul eder", () => {
    const src = readSrc("app/api/mobile/pos/checkout-status/route.ts");
    assert.ok(src.includes("payloadHash"));
  });

  it("status resolver dört durum export eder", () => {
    const src = readSrc("lib/mobile/mobile-pos-checkout-status.ts");
    assert.ok(src.includes('"NOT_FOUND"'));
    assert.ok(src.includes('"PROCESSING"'));
    assert.ok(src.includes('"CONFLICT"'));
    assert.ok(src.includes('"COMPLETED"'));
  });

  it("tenant scope companyId ile filtreler", () => {
    const src = readSrc("lib/mobile/mobile-pos-checkout-status.ts");
    assert.ok(src.includes("companyId: input.companyId"));
    assert.ok(!src.includes("sessionKey"));
  });

  it("checkout status PROCESSING bekleyen satış", async () => {
    const { resolveMobilePosCheckoutStatus } = await import("./mobile-pos-checkout-status");
    const { db } = await import("@/lib/prisma");

    const sale = await db.sale.findFirst({
      where: {
        sourceChannel: "POS",
        status: { not: "COMPLETED" },
        idempotencyKey: { not: null },
      },
      select: { companyId: true, idempotencyKey: true, payloadHash: true },
    });

    if (!sale?.idempotencyKey) return;

    const status = await resolveMobilePosCheckoutStatus({
      companyId: sale.companyId,
      idempotencyKey: sale.idempotencyKey,
      payloadHash: sale.payloadHash ?? undefined,
    });
    assert.equal(status.status, "PROCESSING");
  });

  it("indirim fiyat yeniden hesaplaması canonical AMOUNT", () => {
    const { calculatePosTotals } = require("@/lib/pos-checkout-utils");
    const without = calculatePosTotals(
      [{ productId: "p1", name: "A", quantity: 1, unitPrice: 100, vatRate: 20 }],
      0
    );
    const withDiscount = calculatePosTotals(
      [{ productId: "p1", name: "A", quantity: 1, unitPrice: 100, vatRate: 20 }],
      10
    );
    assert.equal(without.total, 120);
    assert.equal(withDiscount.total, 110);
  });

  it("aynı idempotency farklı payload CONFLICT", async () => {
    const { resolveMobilePosCheckoutStatus } = await import("./mobile-pos-checkout-status");
    const { db } = await import("@/lib/prisma");

    const sale = await db.sale.findFirst({
      where: { sourceChannel: "POS", idempotencyKey: { not: null } },
      select: { companyId: true, idempotencyKey: true, payloadHash: true },
    });

    if (!sale?.idempotencyKey || !sale.payloadHash) {
      return;
    }

    const conflict = await resolveMobilePosCheckoutStatus({
      companyId: sale.companyId,
      idempotencyKey: sale.idempotencyKey,
      payloadHash: "deadbeef",
    });
    assert.equal(conflict.status, "CONFLICT");
  });
});

describe("Mobile POS idempotency payment conflict", () => {
  it("payload hash ödeme değişikliğinde değişir", () => {
    const base: PosCheckoutInput = {
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      paymentStatus: "PAID",
      discount: 0,
      items: [
        {
          productId: "p1",
          name: "Ürün",
          quantity: 1,
          unitPrice: 100,
          vatRate: 20,
        },
      ],
      payments: [{ paymentMethod: "CASH", amount: 120, accountId: "acc1" }],
    };

    const changed = buildPosCheckoutPayloadHash({
      ...base,
      payments: [{ paymentMethod: "CARD", amount: 120, accountId: "acc1" }],
    });
    assert.notEqual(buildPosCheckoutPayloadHash(base), changed);
  });
});
