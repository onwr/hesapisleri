import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { validateDirectoryContactInput } from "./directory-utils";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");

describe("directory service", () => {
  it("manuel kayıt validasyonu ad/firma ister", () => {
    assert.equal(
      validateDirectoryContactInput({ name: "Test Kişi" }).ok,
      true
    );
    assert.equal(
      validateDirectoryContactInput({ companyName: "Test Firma" }).ok,
      true
    );
    assert.equal(validateDirectoryContactInput({}).ok, false);
  });

  it("servis CRUD ve sync fonksiyonlarını export eder", () => {
    const source = read("lib/directory-service.ts");
    assert.match(source, /createDirectoryContact/);
    assert.match(source, /updateDirectoryContact/);
    assert.match(source, /deleteDirectoryContact/);
    assert.match(source, /toggleFavoriteDirectoryContact/);
    assert.match(source, /syncDirectoryFromCustomer/);
    assert.match(source, /syncDirectoryFromEmployee/);
    assert.match(source, /upsertDirectorySyncEntry/);
    assert.match(source, /companyId/);
    assert.match(source, /isActive: false/);
  });

  it("sync tekrar çalışınca duplicate oluşturmaz", () => {
    const source = read("lib/directory-service.ts");
    assert.match(source, /companyId_sourceType_sourceId/);
    assert.match(source, /directorySyncFieldsEqual/);
    assert.match(source, /return "skipped"/);
    assert.match(source, /return "updated"/);
    assert.match(source, /return "created"/);
  });

  it("manuel olmayan kayıtlar düzenlenemez", () => {
    const source = read("lib/directory-service.ts");
    assert.match(source, /Senkron kaynaklı fihrist kayıtları düzenlenemez/);
  });

  it("arama matchesDirectorySearch ile filtrelenir", () => {
    const source = read("lib/directory-service.ts");
    assert.match(source, /matchesDirectorySearch/);
  });
});

describe("directory API routes", () => {
  it("GET /api/directory modül erişimi ister", () => {
    const route = read("app/api/directory/route.ts");
    assert.match(route, /requireApiModuleAccess\("directory"\)/);
    assert.match(route, /requireApiDirectoryManage/);
  });

  it("POST yazma işlemleri yönetici ister", () => {
    assert.match(
      read("app/api/directory/route.ts"),
      /requireApiDirectoryManage/
    );
    assert.match(
      read("app/api/directory/[id]/route.ts"),
      /requireApiDirectoryManage/
    );
  });

  it("DELETE soft delete yapar", () => {
    const route = read("app/api/directory/[id]/route.ts");
    assert.match(route, /permanentlyDeleteDirectoryContact/);
    assert.match(route, /deleteDirectoryContact/);
    const service = read("lib/directory-service.ts");
    assert.match(service, /permanentlyDeleteDirectoryContact/);
    assert.match(service, /isActive: false/);
  });

  it("sync customers ve employees endpointleri yönetici ister", () => {
    assert.match(
      read("app/api/directory/sync-customers/route.ts"),
      /requireApiDirectoryManage/
    );
    assert.match(
      read("app/api/directory/sync-employees/route.ts"),
      /requireApiDirectoryManage/
    );
    assert.match(
      read("app/api/directory/sync-customers/route.ts"),
      /syncDirectoryFromCustomer/
    );
  });

  it("export CSV UTF-8 BOM kullanır", () => {
    const route = read("app/api/directory/export/route.ts");
    assert.match(route, /buildDirectoryCsvWithBom/);
    const utils = read("lib/directory-utils.ts");
    assert.match(utils, /\\uFEFF/);
  });
});

describe("directory UI wiring", () => {
  it("sidebar Fihrist linki ekler", () => {
    const menu = read("lib/sidebar-menu.ts");
    assert.match(menu, /title: "Fihrist"/);
    assert.match(menu, /href: "\/directory"/);
    assert.match(menu, /module: "directory"/);
  });

  it("renkli quick actions, summary ve sol/sağ layout içerir", () => {
    const client = read("components/directory/directory-page-client.tsx");
    assert.match(client, /DirectoryQuickActions/);
    assert.match(client, /DirectorySummaryCards/);
    assert.match(client, /DirectorySidebarWidgets/);
    assert.match(client, /DirectorySourceFilterChips/);
    assert.match(client, /id="directory-list"/);
    assert.match(client, /hidden overflow-x-auto[\s\S]*md:block/);
    assert.match(client, /md:hidden/);
    assert.match(client, /DirectoryContactActions/);
    assert.match(client, /DIRECTORY_SEARCH_PLACEHOLDER/);
    assert.match(client, /Fihristte kayıt bulunmuyor/);
    assert.match(client, /sync-customers/);
  });

  it("detay sheet kaynak kayıt mesajı ve kart linki gösterir", () => {
    const sheet = read("components/directory/directory-detail-sheet.tsx");
    assert.match(sheet, /getDirectorySourceManageMessage/);
    assert.match(sheet, /Müşteri kartına git/);
    assert.match(sheet, /Çalışan kartına git/);
    assert.match(sheet, /onRequestDelete/);
  });

  it("STAFF write yapamaz, OWNER/ADMIN yapabilir", () => {
    const permissions = read("lib/permission-utils.ts");
    assert.match(permissions, /canManageDirectory/);
    assert.match(permissions, /directory: \["OWNER", "ADMIN", "STAFF"/);
  });
});
