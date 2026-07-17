import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const source = fs.readFileSync(
  path.join(process.cwd(), "lib/pos-stats-service.ts"),
  "utf8"
);

describe("pos stats service", () => {
  it("bugünü Istanbul gün başlangıcıyla hesaplar", () => {
    assert.match(source, /startOfZonedDay/);
  });

  it("nakit ve kart toplamlarını salePayment groupBy ile üretir", () => {
    assert.match(source, /salePayment\.groupBy/);
    assert.match(source, /todayCashTotal/);
    assert.match(source, /todayCardTotal/);
    assert.match(source, /paymentMethod === "CASH"/);
    assert.match(source, /paymentMethod === "CARD"/);
  });

  it("hızlı ürünler için en çok satılan 12 ürünü alır", () => {
    assert.match(source, /saleItem\.groupBy/);
    assert.match(source, /take: 12/);
    assert.match(source, /topProducts/);
  });

  it("POS_STAFF için kullanıcıya göre filtreler", () => {
    assert.match(source, /staffScoped/);
    assert.match(source, /userId: input\.userId/);
  });
});
