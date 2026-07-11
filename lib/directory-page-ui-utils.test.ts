import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  applyDirectoryFilterChip,
  buildDirectoryDistribution,
  buildDirectoryQuickActionCards,
  buildDirectorySummaryCards,
  filterDirectoryQuickActionCards,
  getActiveDirectoryFilterChip,
} from "./directory-page-ui-utils";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");

describe("directory page ui utils", () => {
  it("quick action kartları 5 adet", () => {
    const cards = buildDirectoryQuickActionCards();
    assert.equal(cards.length, 5);
    assert.ok(cards.some((card) => card.key === "new-person"));
    assert.ok(cards.some((card) => card.key === "sync-customers"));
    assert.ok(cards.some((card) => card.key === "sync-suppliers"));
    assert.ok(cards.some((card) => card.key === "sync-employees"));
    assert.ok(cards.some((card) => card.key === "export"));
    assert.ok(!cards.some((card) => (card.key as string) === "favorites"));
  });

  it("manage yetkisi olmayanlarda yalnızca export görünür", () => {
    const filtered = filterDirectoryQuickActionCards(
      buildDirectoryQuickActionCards(),
      false
    );
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.key, "export");
  });

  it("summary kartları 5 ana metrik üretir", () => {
    const cards = buildDirectorySummaryCards({
      total: 20,
      manual: 5,
      customers: 8,
      crmActiveCustomers: 8,
      suppliers: 3,
      employees: 4,
      favorites: 2,
      missingInfo: 1,
    });
    assert.equal(cards.length, 5);
  });

  it("dağılım verisi üretir", () => {
    const distribution = buildDirectoryDistribution({
      total: 10,
      manual: 2,
      customers: 3,
      crmActiveCustomers: 3,
      suppliers: 2,
      employees: 2,
      favorites: 1,
      missingInfo: 0,
    });
    assert.equal(distribution.length, 5);
  });

  it("favori filtresi chip state üretir", () => {
    assert.equal(
      getActiveDirectoryFilterChip({ sourceType: "ALL", favorite: "yes" }),
      "favorite"
    );
    assert.deepEqual(applyDirectoryFilterChip("supplier"), {
      sourceType: "SUPPLIER",
      favorite: "ALL",
    });
  });
});

describe("directory invoices-like layout", () => {
  it("büyük hero container render edilmez", () => {
    const client = read("components/directory/directory-page-client.tsx");
    assert.doesNotMatch(client, /text-2xl font-extrabold/);
    assert.doesNotMatch(client, /rounded-\[24px\]/);
  });

  it("directory sayfasında faturalar benzeri layout render edilir", () => {
    const client = read("components/directory/directory-page-client.tsx");
    const sidebar = read("components/directory/directory-sidebar-widgets.tsx");
    assert.match(client, /DirectoryQuickActions/);
    assert.match(client, /DirectorySummaryCards/);
    assert.match(client, /DirectorySourceFilterChips/);
    assert.match(client, /DirectorySidebarWidgets/);
    assert.match(client, /xl:grid-cols-\[minmax\(0,1fr\)_420px\]/);
    assert.match(sidebar, /Fihrist Dağılımı/);
    assert.match(sidebar, /Hızlı İşlemler/);
    assert.match(sidebar, /İpuçları/);
  });

  it("sync endpointleri korunur", () => {
    const client = read("components/directory/directory-page-client.tsx");
    assert.match(client, /sync-customers/);
    assert.match(client, /sync-suppliers/);
    assert.match(client, /sync-employees/);
    assert.match(client, /\/api\/directory\/sync-/);
  });
});
