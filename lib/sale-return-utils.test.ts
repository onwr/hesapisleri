import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allocateSaleReturnRefundAmounts,
  buildReturnedQuantityMap,
  computeSaleReturnLineAmount,
  getReturnableQuantity,
  resolveSaleReturnStatus,
  shouldRestockReturnItem,
  validateSaleReturnLines,
} from "./sale-return-utils";

describe("sale return utils", () => {
  it("iade edilebilir adedi doğru hesaplar", () => {
    assert.equal(getReturnableQuantity(5, 2), 3);
    assert.equal(getReturnableQuantity(5, 5), 0);
    assert.equal(getReturnableQuantity(5, 8), 0);
  });

  it("satır iade tutarını orantılı hesaplar", () => {
    assert.equal(
      computeSaleReturnLineAmount({
        quantity: 1,
        soldQuantity: 2,
        lineTotal: 200,
        unitPrice: 100,
      }),
      100
    );
    assert.equal(
      computeSaleReturnLineAmount({
        quantity: 2,
        soldQuantity: 2,
        lineTotal: 200,
        unitPrice: 100,
      }),
      200
    );
  });

  it("fazla iadeyi reddeder", () => {
    const result = validateSaleReturnLines({
      saleStatus: "COMPLETED",
      items: [
        {
          id: "si-1",
          name: "Ürün",
          quantity: 2,
          unitPrice: 50,
          total: 100,
          productId: "p1",
          productType: "STOCK",
        },
      ],
      alreadyReturnedByItemId: buildReturnedQuantityMap([
        { saleItemId: "si-1", quantity: 1 },
      ]),
      lines: [{ saleItemId: "si-1", quantity: 2 }],
    });
    assert.equal(result.ok, false);
  });

  it("tam iade REFUNDED, kısmi PARTIALLY_REFUNDED üretir", () => {
    assert.equal(
      resolveSaleReturnStatus({
        items: [{ quantity: 2, alreadyReturned: 0, returning: 2 }],
      }),
      "REFUNDED"
    );
    assert.equal(
      resolveSaleReturnStatus({
        items: [{ quantity: 2, alreadyReturned: 0, returning: 1 }],
      }),
      "PARTIALLY_REFUNDED"
    );
  });

  it("SERVICE ürün stok geri almaz", () => {
    assert.equal(
      shouldRestockReturnItem({
        restock: true,
        productId: "p1",
        productType: "SERVICE",
      }),
      false
    );
  });

  it("iade yöntemine göre tutar dağıtır", () => {
    assert.deepEqual(allocateSaleReturnRefundAmounts({
      refundMethod: "CASH",
      totalReturnAmount: 120,
    }), {
      totalCashRefund: 120,
      totalCardRefund: 0,
      totalCreditAdjustment: 0,
    });
    assert.deepEqual(allocateSaleReturnRefundAmounts({
      refundMethod: "CREDIT",
      totalReturnAmount: 80,
    }), {
      totalCashRefund: 0,
      totalCardRefund: 0,
      totalCreditAdjustment: 80,
    });
  });

  it("iptal satışa iadeyi reddeder", () => {
    const result = validateSaleReturnLines({
      saleStatus: "CANCELLED",
      items: [],
      alreadyReturnedByItemId: new Map(),
      lines: [{ saleItemId: "x", quantity: 1 }],
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /iade yapılamaz/i);
  });
});
