import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  buildSupplierCsvRow,
  buildSuppliersCsv,
  getSupplierDisplayName,
  matchesSupplierSearch,
  normalizeSupplierTags,
  parseSupplierBalanceStatus,
} from "./supplier-utils";
import {
  canManageSuppliers,
  canAccessModule,
} from "./permission-utils";
import { getSidebarMenuItems } from "./sidebar-menu";

const webRoot = join(process.cwd());

function read(relativePath: string) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

const mockSupplierRow = {
  payableAmount: 0,
  receivableAmount: 0,
  netStatusLabel: "Hesap Kapalı",
  totalPurchases: 0,
  hasCustomerRole: false,
  linkedCustomerId: null,
} as const;

describe("supplier-utils", () => {
  it("getSupplierDisplayName firma adını önceler", () => {
    assert.equal(
      getSupplierDisplayName({ name: "Ahmet", companyName: "ABC Ltd." }),
      "ABC Ltd."
    );
  });

  it("normalizeSupplierTags virgülle ayrılmış etiketleri parse eder", () => {
    assert.deepEqual(normalizeSupplierTags("hammadde, lojistik"), [
      "hammadde",
      "lojistik",
    ]);
  });

  it("matchesSupplierSearch vergi no ile arar", () => {
    assert.equal(
      matchesSupplierSearch(
        {
          id: "1",
          code: null,
          name: "Test",
          companyName: null,
          contactName: null,
          phone: null,
          mobilePhone: null,
          email: null,
          taxNumber: "1234567890",
          category: null,
          city: null,
          district: null,
          currentBalance: 0,
          ...mockSupplierRow,
          overdueAmount: 0,
          overdueCount: 0,
          productCount: 0,
          currency: "TRY",
          isActive: true,
          isFavorite: false,
          updatedAt: new Date(),
          lastActivityAt: null,
          lastActivityType: null,
        },
        "123456"
      ),
      true
    );
  });

  it("CSV UTF-8 BOM içerir", () => {
    const csv = buildSuppliersCsv([
      buildSupplierCsvRow({
        id: "1",
        code: "T1",
        name: "Tedarikçi",
        companyName: "Firma",
        contactName: "Ali",
        phone: "555",
        mobilePhone: null,
        email: "a@b.com",
        taxNumber: "1",
        category: "Hammadde",
        city: "Malatya",
        district: "Merkez",
        currentBalance: 100,
        ...mockSupplierRow,
        overdueAmount: 0,
        overdueCount: 0,
        productCount: 0,
        currency: "TRY",
        isActive: true,
        isFavorite: false,
        updatedAt: new Date(),
        lastActivityAt: null,
        lastActivityType: null,
        address: "Adres",
        tags: ["etiket"],
        notes: "not",
      }),
    ]);
    assert.ok(csv.startsWith("\uFEFF"));
    assert.match(csv, /Tedarikçi/);
  });

  it("parseSupplierBalanceStatus payable/clear döner", () => {
    assert.equal(parseSupplierBalanceStatus("payable"), "payable");
    assert.equal(parseSupplierBalanceStatus("receivable"), "receivable");
    assert.equal(parseSupplierBalanceStatus("clear"), "clear");
    assert.equal(parseSupplierBalanceStatus("overdue"), "overdue");
  });
});

describe("supplier permissions", () => {
  it("OWNER/ADMIN yazabilir, STAFF yazamaz", () => {
    assert.equal(canManageSuppliers("OWNER"), true);
    assert.equal(canManageSuppliers("ADMIN"), true);
    assert.equal(canManageSuppliers("STAFF"), false);
    assert.equal(canManageSuppliers("ACCOUNTANT"), false);
  });

  it("ACCOUNTANT ve STAFF modülü görüntüleyebilir", () => {
    assert.equal(canAccessModule("ACCOUNTANT", "suppliers"), true);
    assert.equal(canAccessModule("STAFF", "suppliers"), true);
  });

  it("sidebar Tedarikçiler menüsünü gösterir", () => {
    const titles = getSidebarMenuItems("STAFF").map((item) => item.title);
    assert.ok(titles.includes("Tedarikçiler"));
    assert.ok(titles.includes("Müşteriler"));
  });
});

describe("supplier routes/ui", () => {
  it("/suppliers sayfası müşteriler ile aynı yapıda render edilir", () => {
    const page = read("app/suppliers/page.tsx");
    assert.match(page, /buildActionCards/);
    assert.match(page, /SuppliersTableToolbar/);
    assert.match(page, /getSuppliersPageData/);
  });

  it("yeni tedarikçi sayfası bölümlü form içerir", () => {
    const page = read("app/suppliers/new/page.tsx");
    assert.match(page, /Açılış Cari Yönü/);
    assert.match(page, /openingBalanceDirection/);
    assert.match(page, /Tedarikçiyi Kaydet/);
  });

  it("directory sync-suppliers endpoint vardır", () => {
    const route = read("app/api/directory/sync-suppliers/route.ts");
    assert.match(route, /syncDirectoryFromSupplier/);
  });

  it("fihrist supplier source href /suppliers", () => {
    const utils = read("lib/directory-utils.ts");
    assert.match(utils, /SUPPLIER.*\/suppliers/);
  });

  it("expense schema supplierId destekler", () => {
    const utils = read("lib/expense-utils.ts");
    assert.match(utils, /supplierId/);
  });

  it("stok hareketi schema supplierId destekler", () => {
    const utils = read("lib/stock-movement-utils.ts");
    assert.match(utils, /supplierId/);
  });
});

describe("supplier prisma models", () => {
  it("schema Supplier modellerini içerir", () => {
    const schema = read("prisma/schema.prisma");
    assert.match(schema, /model Supplier \{/);
    assert.match(schema, /model SupplierContact \{/);
    assert.match(schema, /model SupplierProduct \{/);
    assert.match(schema, /supplierId String\?/);
  });
});
