import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const webRoot = join(process.cwd());

function read(relativePath: string) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("warehouses real UI layout", () => {
  it("liste sayfası shell, kart grid ve tek filtre kullanır", () => {
    const client = read("components/stocks/warehouses-page-client.tsx");
    assert.match(client, /WarehousesShell/);
    assert.match(client, /WarehouseCardGrid/);
    assert.match(client, /WarehousesRecentTransfers/);
    assert.doesNotMatch(client, /WarehousesTable/);
    assert.doesNotMatch(client, /WarehousesSummaryBar/);
  });

  it("warehouse-page-data buyPrice seçer", () => {
    const data = read("lib/warehouse-page-data.ts");
    assert.match(data, /buyPrice: true/);
    assert.doesNotMatch(data, /sellPrice: true/);
  });

  it("filtrelerde tek arama alanı vardır", () => {
    const filters = read("components/warehouses/warehouses-filters.tsx");
    const matches = filters.match(/Depo adı, kodu veya konum ara/g) ?? [];
    assert.equal(matches.length, 1);
  });
});

describe("calendar real UI layout", () => {
  it("takvim iki kolonlu layout ve özet kartları kullanır", () => {
    const shell = read("components/calendar/calendar-shell.tsx");
    assert.match(shell, /CalendarSummaryCards/);
    assert.match(shell, /CalendarSidePanel/);
    assert.match(shell, /xl:grid-cols-\[minmax\(0,1fr\)_320px\]/);
    assert.match(shell, /CalendarMobileDayView/);
  });
});
