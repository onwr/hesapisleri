import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  buildWarehouseTransferPayloadHash,
  generateTransferNo,
  getTransferItemsForCancel,
  normalizeWarehouseTransferItems,
  SERVICE_TRANSFER_ERROR_MESSAGE,
  SAME_WAREHOUSE_TRANSFER_ERROR_MESSAGE,
} from "./warehouse-transfer-utils";
import {
  isPrismaUniqueConstraintError,
  isRetryableTransactionError,
} from "./prisma-transaction-utils";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");

describe("warehouse transfer utils", () => {
  it("generateTransferNo TRF formatı üretir", () => {
    const no = generateTransferNo();
    assert.match(no, /^TRF-\d{4}-\d+$/);
  });

  it("tek ürün isteğini kaleme normalize eder", () => {
    const result = normalizeWarehouseTransferItems({
      productId: "product-1",
      quantity: 5,
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.items, [{ productId: "product-1", quantity: 5 }]);
    }
  });

  it("çoklu kalem isteğini kabul eder", () => {
    const result = normalizeWarehouseTransferItems({
      items: [
        { productId: "p1", quantity: 2 },
        { productId: "p2", quantity: 7 },
      ],
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.items.length, 2);
    }
  });

  it("aynı ürünün tekrarlı kalemlerini reddeder", () => {
    const result = normalizeWarehouseTransferItems({
      items: [
        { productId: "p1", quantity: 2 },
        { productId: "p1", quantity: 3 },
      ],
    });

    assert.equal(result.ok, false);
  });

  it("payload hash aynı girdide deterministik", () => {
    const input = {
      fromWarehouseId: "w1",
      toWarehouseId: "w2",
      items: [{ productId: "p1", quantity: 4 }],
      note: "test",
    };

    const first = buildWarehouseTransferPayloadHash(input);
    const second = buildWarehouseTransferPayloadHash(input);
    assert.equal(first, second);
  });

  it("farklı payload farklı hash üretir", () => {
    const base = {
      fromWarehouseId: "w1",
      toWarehouseId: "w2",
      items: [{ productId: "p1", quantity: 4 }],
    };

    const first = buildWarehouseTransferPayloadHash(base);
    const second = buildWarehouseTransferPayloadHash({
      ...base,
      items: [{ productId: "p1", quantity: 5 }],
    });

    assert.notEqual(first, second);
  });

  it("legacy transfer iptali için tek kaleme düşer", () => {
    const items = getTransferItemsForCancel({
      productId: "p1",
      quantity: 9,
    });

    assert.deepEqual(items, [{ productId: "p1", quantity: 9 }]);
  });

  it("çok kalemli transfer iptali tüm kalemleri döner", () => {
    const items = getTransferItemsForCancel({
      productId: "p1",
      quantity: 9,
      items: [
        { productId: "p1", quantity: 4 },
        { productId: "p2", quantity: 5 },
      ],
    });

    assert.equal(items.length, 2);
  });

  it("sabit hata mesajları tanımlı", () => {
    assert.match(SERVICE_TRANSFER_ERROR_MESSAGE, /Hizmet/);
    assert.match(SAME_WAREHOUSE_TRANSFER_ERROR_MESSAGE, /aynı/);
  });
});

describe("warehouse transfer transaction utils", () => {
  it("P2034 retryable kabul edilir", () => {
    assert.equal(isRetryableTransactionError({ code: "P2034" }), true);
  });

  it("validation hatası retryable değildir", () => {
    assert.equal(isRetryableTransactionError({ code: "P2002" }), false);
  });

  it("idempotency unique hatası tanınır", () => {
    assert.equal(
      isPrismaUniqueConstraintError(
        { code: "P2002", meta: { target: ["companyId", "idempotencyKey"] } },
        "idempotencyKey"
      ),
      true
    );
  });
});

describe("warehouse transfer architecture", () => {
  it("transfer servisi interactive transaction kullanır", () => {
    const source = read("lib/warehouse-transfer-service.ts");
    const stockUtils = read("lib/warehouse-transfer-stock-utils.ts");
    assert.match(source, /runTransactionWithRetry/);
    assert.match(stockUtils, /quantity:\s*\{\s*decrement/);
    assert.match(stockUtils, /quantity:\s*\{\s*increment/);
    assert.match(source, /status:\s*"PENDING"/);
    assert.match(source, /status:\s*"COMPLETED"/);
    assert.match(source, /TRANSFER_OUT/);
    assert.match(source, /TRANSFER_IN/);
    assert.match(read("app/api/stocks/transfers/route.ts"), /invalidateDashboardCache/);
  });

  it("warehouse-service legacy transfer kodu içermez", () => {
    const source = read("lib/warehouse-service.ts");
    assert.match(source, /executeWarehouseTransfer/);
    assert.doesNotMatch(source, /fromStock\.quantity - input\.quantity/);
  });

  it("prisma şemasında idempotency ve item modelleri vardır", () => {
    const schema = read("prisma/schema.prisma");
    assert.match(schema, /model WarehouseTransferItem/);
    assert.match(schema, /idempotencyKey/);
    assert.match(schema, /PENDING/);
    assert.match(schema, /@@unique\(\[companyId, idempotencyKey\]\)/);
  });

  it("client idempotencyKey gönderir", () => {
    const source = read("components/stocks/warehouse-transfer-modal.tsx");
    assert.match(source, /idempotencyKey/);
    assert.match(source, /disabled=\{saving\}/);
  });
});

describe("applyWarehouseStockDelta rollback simulation", () => {
  it("kaynak decrement ve hedef increment birlikte uygulanır", async () => {
    const { applyWarehouseStockDelta } = await import("./warehouse-transfer-stock-utils");

    const operations: Array<{
      warehouseId: string;
      productId: string;
      delta: number;
    }> = [];

    const tx = {
      warehouseStock: {
        upsert: async (args: {
          where: { warehouseId_productId: { warehouseId: string; productId: string } };
          create: { quantity: number };
          update: { quantity: { decrement?: number; increment?: number } };
        }) => {
          const warehouseId = args.where.warehouseId_productId.warehouseId;
          const productId = args.where.warehouseId_productId.productId;
          const delta =
            args.create.quantity ??
            (args.update.quantity.decrement
              ? -args.update.quantity.decrement
              : args.update.quantity.increment ?? 0);

          operations.push({ warehouseId, productId, delta });
        },
      },
    };

    await applyWarehouseStockDelta(tx as never, {
      companyId: "c1",
      warehouseId: "w-from",
      productId: "p1",
      delta: -5,
    });

    await applyWarehouseStockDelta(tx as never, {
      companyId: "c1",
      warehouseId: "w-to",
      productId: "p1",
      delta: 5,
    });

    assert.deepEqual(operations, [
      { warehouseId: "w-from", productId: "p1", delta: -5 },
      { warehouseId: "w-to", productId: "p1", delta: 5 },
    ]);
  });
});
