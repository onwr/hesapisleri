import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HepsiburadaAdapter,
  normalizeHepsiburadaOrder,
  formatHepsiburadaDate,
} from "./adapters/hepsiburada-adapter";
import { mapHepsiburadaStatusToOrderStatus } from "./marketplace-status-map";

function createAdapter() {
  return new HepsiburadaAdapter({
    merchantId: "merchant-1",
    username: "service-user",
    password: "secret",
  });
}

describe("hepsiburada adapter", () => {
  it("testConnection success", async () => {
    const adapter = createAdapter();
    const originalFetch = global.fetch;
    global.fetch = (async () =>
      new Response(JSON.stringify({ packages: [] }), { status: 200 })) as typeof fetch;
    try {
      const result = await adapter.testConnection();
      assert.equal(result.ok, true);
      assert.match(result.message, /Hepsiburada API erişimi doğrulandı/);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("401 retry yapmaz", async () => {
    const adapter = createAdapter();
    let callCount = 0;
    const originalFetch = global.fetch;
    global.fetch = (async () => {
      callCount += 1;
      return new Response("unauthorized", { status: 401 });
    }) as typeof fetch;
    try {
      const result = await adapter.fetchOrders({ since: new Date("2026-01-01"), limit: 50 });
      assert.equal(callCount, 1);
      assert.equal(result.errors?.[0]?.message, "API bilgileri hatalı veya yetkisiz.");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("429 retry yapar", async () => {
    const adapter = createAdapter();
    let callCount = 0;
    const originalFetch = global.fetch;
    global.fetch = (async () => {
      callCount += 1;
      if (callCount < 3) {
        return new Response("rate", { status: 429 });
      }
      return new Response(JSON.stringify({ packages: [] }), { status: 200 });
    }) as typeof fetch;
    try {
      const result = await adapter.fetchOrders({ since: new Date("2026-01-01"), limit: 50 });
      assert.equal(result.orders.length, 0);
      assert.equal(callCount, 3);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("packages endpoint success", async () => {
    const adapter = createAdapter();
    const originalFetch = global.fetch;
    global.fetch = (async (url) => {
      assert.match(String(url), /\/packages\/merchantid\/merchant-1/);
      return new Response(
        JSON.stringify({
          packages: [
            {
              orderNumber: "HB-100",
              status: "Open",
              lineItems: [{ merchantSKU: "SKU-1", quantity: 2, price: 50 }],
            },
          ],
        }),
        { status: 200 }
      );
    }) as typeof fetch;
    try {
      const result = await adapter.fetchOrders({ since: new Date("2026-01-01"), limit: 50 });
      assert.equal(result.orders.length, 1);
      assert.equal(result.orders[0]?.externalOrderId, "HB-100");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("packages 404 ise orders fallback", async () => {
    const adapter = createAdapter();
    const originalFetch = global.fetch;
    global.fetch = (async (url) => {
      const target = String(url);
      if (target.includes("/packages/")) {
        return new Response("not found", { status: 404 });
      }
      return new Response(
        JSON.stringify({
          orders: [
            {
              orderId: "HB-200",
              orderStatus: "Packaged",
              orderItems: [{ sku: "SKU-2", qty: 1, unitPrice: 120 }],
            },
          ],
        }),
        { status: 200 }
      );
    }) as typeof fetch;
    try {
      const result = await adapter.fetchOrders({ since: new Date("2026-01-01"), limit: 50 });
      assert.equal(result.orders.length, 1);
      assert.equal(result.orders[0]?.externalOrderId, "HB-200");
      assert.equal(result.orders[0]?.orderStatus, "APPROVED");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("pagination offset/limit çalışır", async () => {
    const adapter = createAdapter();
    const offsets: number[] = [];
    const originalFetch = global.fetch;
    global.fetch = (async (url) => {
      const parsed = new URL(String(url));
      offsets.push(Number(parsed.searchParams.get("offset") ?? "0"));
      const offset = Number(parsed.searchParams.get("offset") ?? "0");
      if (offset === 0) {
        return new Response(
          JSON.stringify({
            packages: Array.from({ length: 2 }, (_, index) => ({
              orderNumber: `HB-${index + 1}`,
              status: "Open",
              items: [{ merchantSku: `SKU-${index + 1}`, quantity: 1, price: 10 }],
            })),
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ packages: [] }), { status: 200 });
    }) as typeof fetch;
    try {
      const result = await adapter.fetchOrders({
        since: new Date("2026-01-01"),
        limit: 2,
      });
      assert.equal(result.orders.length, 2);
      assert.deepEqual(offsets, [0, 2]);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("normalize farklı raw shape işler", () => {
    const normalized = normalizeHepsiburadaOrder({
      packageNo: "PKG-1",
      packageStatus: "InCargo",
      packageItems: [
        {
          hbSku: "HB-SKU",
          productName: "Test Ürün",
          count: 3,
          salePrice: 25,
        },
      ],
      totalAmount: 75,
      cargoCompanyName: "Hepsijet",
      cargoTrackingNumber: "TRK-1",
    });
    assert.ok(normalized);
    assert.equal(normalized?.externalOrderId, "PKG-1");
    assert.equal(normalized?.items[0]?.merchantSku, "HB-SKU");
    assert.equal(normalized?.orderStatus, "SHIPPING");
  });

  it("externalOrderId yoksa null döner", () => {
    const normalized = normalizeHepsiburadaOrder({
      status: "Open",
      items: [{ merchantSku: "SKU-1", quantity: 1, price: 10 }],
    });
    assert.equal(normalized, null);
  });

  it("status map çalışır", () => {
    assert.equal(mapHepsiburadaStatusToOrderStatus("payment_awaiting"), "WAITING");
    assert.equal(mapHepsiburadaStatusToOrderStatus("ready_to_ship"), "APPROVED");
    assert.equal(mapHepsiburadaStatusToOrderStatus("in_cargo"), "SHIPPING");
    assert.equal(mapHepsiburadaStatusToOrderStatus("return_requested"), "RETURN_REQUESTED");
    assert.equal(mapHepsiburadaStatusToOrderStatus("unknown_status"), "WAITING");
  });

  it("formatHepsiburadaDate yyyy-MM-dd HH:mm üretir", () => {
    const formatted = formatHepsiburadaDate(new Date("2026-06-08T12:34:00.000Z"));
    assert.match(formatted, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });
});
