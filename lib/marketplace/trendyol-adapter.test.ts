import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TrendyolAdapter, mapTrendyolProductToListing } from "./adapters/trendyol-adapter";

function createAdapter() {
  return new TrendyolAdapter({
    supplierId: "123",
    apiKey: "key",
    apiSecret: "secret",
  });
}

describe("trendyol adapter", () => {
  it("multi page response hepsini işler", async () => {
    const adapter = createAdapter();
    let callCount = 0;

    const originalFetch = global.fetch;
    global.fetch = (async () => {
      const page = callCount;
      callCount += 1;
      return new Response(
        JSON.stringify({
          content: [
            {
              orderNumber: `TY-${page + 1}`,
              status: "Created",
              lines: [{ merchantSku: `SKU-${page + 1}`, quantity: 1, price: 10 }],
            },
          ],
          totalPages: 2,
          page,
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    try {
      const result = await adapter.fetchOrders({ since: new Date("2026-01-01"), limit: 50 });
      assert.equal(result.orders.length, 2);
      assert.equal(result.errors?.length ?? 0, 0);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("429 için retry yapar", async () => {
    const adapter = createAdapter();
    let callCount = 0;
    const originalFetch = global.fetch;

    global.fetch = (async () => {
      callCount += 1;
      if (callCount < 3) {
        return new Response("rate", { status: 429 });
      }
      return new Response(JSON.stringify({ content: [], totalPages: 1, page: 0 }), {
        status: 200,
      });
    }) as typeof fetch;

    try {
      const result = await adapter.fetchOrders({ since: new Date("2026-01-01"), limit: 50 });
      assert.equal(result.orders.length, 0);
      assert.equal(callCount, 3);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("401 için retry yapmaz", async () => {
    const adapter = createAdapter();
    let callCount = 0;
    const originalFetch = global.fetch;

    global.fetch = (async () => {
      callCount += 1;
      return new Response("unauthorized", { status: 401 });
    }) as typeof fetch;

    try {
      const result = await adapter.fetchOrders({ since: new Date("2026-01-01"), limit: 50 });
      assert.equal(result.errors?.length, 1);
      assert.equal(callCount, 1);
      assert.equal(result.errors?.[0]?.message, "API bilgileri hatalı veya yetkisiz.");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("testConnection 401 dönerse bağlantı başarısız", async () => {
    const adapter = createAdapter();
    const originalFetch = global.fetch;

    global.fetch = (async () =>
      new Response("unauthorized", { status: 401 })) as typeof fetch;

    try {
      const result = await adapter.testConnection();
      assert.equal(result.ok, false);
      assert.match(result.message, /yetkisiz/);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("testConnection 200 + boş sipariş listesi başarılı kabul edilir", async () => {
    const adapter = createAdapter();
    const originalFetch = global.fetch;

    global.fetch = (async () =>
      new Response(
        JSON.stringify({
          totalElements: 0,
          totalPages: 0,
          page: 0,
          size: 0,
          content: [],
        }),
        { status: 200 }
      )) as typeof fetch;

    try {
      const result = await adapter.testConnection();
      assert.equal(result.ok, true);
      assert.match(result.message, /Son 24 saatte sipariş bulunamadı/);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("User-Agent supplierId içerir", async () => {
    const adapter = createAdapter();
    const originalFetch = global.fetch;
    let userAgent = "";

    global.fetch = (async (_url, init) => {
      userAgent = String(
        (init?.headers as Record<string, string> | undefined)?.["User-Agent"] ?? ""
      );
      return new Response(JSON.stringify({ content: [], totalPages: 0 }), {
        status: 200,
      });
    }) as typeof fetch;

    try {
      await adapter.testConnection();
      assert.equal(userAgent, "123 - SelfIntegration");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("fetchListings 200 listings normalize edilir", async () => {
    const adapter = createAdapter();
    const originalFetch = global.fetch;
    let requestUrl = "";

    global.fetch = (async (url) => {
      requestUrl = String(url);
      return new Response(
        JSON.stringify({
          content: [
            {
              stockCode: "STK-1",
              barcode: "8691111111111",
              title: "Test Ürün",
              salePrice: 99.9,
              quantity: 5,
              productCode: 12345,
            },
            {
              barcode: "8692222222222",
              title: "SKUsuz",
            },
          ],
          totalPages: 1,
          totalElements: 2,
          page: 0,
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    try {
      const result = await adapter.fetchListings?.({ limit: 50 });
      assert.ok(result);
      assert.equal(result.listings.length, 1);
      assert.equal(result.listings[0]?.merchantSku, "STK-1");
      assert.equal(result.listings[0]?.barcode, "8691111111111");
      assert.equal(result.listings[0]?.title, "Test Ürün");
      assert.match(requestUrl, /integration\/product\/sellers\/123\/products/);
      assert.match(requestUrl, /approved=true/);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("fetchListings 401 retry yapmaz", async () => {
    const adapter = createAdapter();
    let callCount = 0;
    const originalFetch = global.fetch;

    global.fetch = (async (url) => {
      callCount += 1;
      if (String(url).includes("/integration/product/")) {
        return new Response("unauthorized", { status: 401 });
      }
      return new Response(JSON.stringify({ content: [], totalPages: 0 }), {
        status: 200,
      });
    }) as typeof fetch;

    try {
      const result = await adapter.fetchListings?.({ limit: 50 });
      assert.ok(result);
      assert.equal(result.listings.length, 0);
      assert.equal(result.errors?.length, 1);
      assert.equal(callCount, 1);
      assert.equal(result.errors?.[0]?.message, "API bilgileri hatalı veya yetkisiz.");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("mapTrendyolProductToListing merchantSku yoksa null döner", () => {
    assert.equal(mapTrendyolProductToListing({ title: "x" }), null);
  });
});
