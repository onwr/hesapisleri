import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  buildWarehouseAddress,
  parseWarehouseAddress,
} from "./warehouse-admin-service";
import { createWarehouseSchema } from "./warehouse-utils";
import {
  canManageWarehouses,
  canManageProducts,
} from "./permission-utils";

const webRoot = join(process.cwd());

function read(relativePath: string) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("warehouse admin utils", () => {
  it("buildWarehouseAddress il, ilçe ve adresi birleştirir", () => {
    assert.equal(
      buildWarehouseAddress({
        city: "Malatya",
        district: "Battalgazi",
        address: "Merkez",
      }),
      "Malatya, Battalgazi, Merkez"
    );
  });

  it("parseWarehouseAddress birleşik adresi ayırır", () => {
    assert.deepEqual(parseWarehouseAddress("Malatya, Battalgazi, Merkez"), {
      city: "Malatya",
      district: "Battalgazi",
      address: "Merkez",
    });
  });

  it("createWarehouseSchema name zorunlu", () => {
    const parsed = createWarehouseSchema.safeParse({ name: "   " });
    assert.equal(parsed.success, false);
  });

  it("createWarehouseSchema trim edilmiş adı kabul eder", () => {
    const parsed = createWarehouseSchema.safeParse({ name: "  Ana Depo  " });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.name, "Ana Depo");
    }
  });
});

describe("warehouse permissions", () => {
  it("OWNER/ADMIN depo yönetebilir", () => {
    assert.equal(canManageWarehouses("OWNER"), true);
    assert.equal(canManageWarehouses("ADMIN"), true);
  });

  it("STAFF depo yönetemez", () => {
    assert.equal(canManageWarehouses("STAFF"), false);
    assert.equal(canManageProducts("STAFF"), true);
  });
});

describe("warehouse UI routes", () => {
  it("warehouses sayfasında hızlı aksiyon ve kart grid vardır", () => {
    const page = read("components/stocks/warehouses-page-client.tsx");
    const shell = read("components/warehouses/warehouses-shell.tsx");
    assert.match(page, /WarehousesShell/);
    assert.match(page, /WarehouseCardGrid/);
    assert.match(shell, /WarehousesQuickActions/);
    assert.match(page, /WarehouseFormDialog/);
  });

  it("warehouse form dialog yeni API kullanır", () => {
    const dialog = read("components/stocks/warehouse-form-dialog.tsx");
    assert.match(dialog, /\/api\/products\/stocks\/warehouses/);
    assert.match(dialog, /Depo adı zorunludur/);
  });

  it("products alt nav Depolar linkini gösterir", () => {
    const nav = read("components/products/products-sub-nav.tsx");
    assert.match(nav, /Depolar/);
    assert.match(nav, /PRODUCTS_STOCKS_WAREHOUSES_PATH/);
  });

  it("/stocks/warehouses redirect korunur", () => {
    const page = read("app/stocks/warehouses/page.tsx");
    assert.match(page, /\/products\/stocks\/warehouses/);
  });

  it("warehouse API products ve stocks modülünü kabul eder", () => {
    const handlers = read("lib/warehouse-api-handlers.ts");
    assert.match(handlers, /requireApiWarehouseRead/);
    assert.match(handlers, /requireApiWarehouseManage/);
  });
});
