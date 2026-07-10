import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMarketplaceOrderNote,
  stripMarketplaceSyncMetadata,
} from "@/lib/marketplace/marketplace-order-note";

describe("marketplace order note merge", () => {
  it("mevcut kullanıcı notunu korur", () => {
    const merged = buildMarketplaceOrderNote({
      existingNote: "Müşteri hediye paketi istedi.",
      buyerName: "Ayşe Yılmaz",
      channel: "TRENDYOL",
      externalStatus: "Created",
    });

    assert.match(merged, /Müşteri hediye paketi istedi/);
    assert.match(merged, /Alıcı: Ayşe Yılmaz/);
    assert.match(merged, /Pazaryeri siparişi \(TRENDYOL\)/);
  });

  it("ikinci sync duplicate Alıcı satırı üretmez", () => {
    const first = buildMarketplaceOrderNote({
      existingNote: "Özel talimat.",
      buyerName: "Ali Veli",
      channel: "TRENDYOL",
      externalStatus: "Created",
    });

    const second = buildMarketplaceOrderNote({
      existingNote: first,
      buyerName: "Ali Veli",
      channel: "TRENDYOL",
      externalStatus: "Shipped",
    });

    const buyerMatches = second.match(/Alıcı:/gi) ?? [];
    assert.equal(buyerMatches.length, 1);
    assert.match(second, /Özel talimat/);
    assert.match(second, /Dış durum: Shipped/);
  });

  it("sync metadata strip yalnız sistem satırlarını temizler", () => {
    const stripped = stripMarketplaceSyncMetadata(
      "Kullanıcı notu. Alıcı: Eski Kişi. Pazaryeri siparişi (TRENDYOL). Dış durum: Created."
    );
    assert.equal(stripped, "Kullanıcı notu");
  });
});
