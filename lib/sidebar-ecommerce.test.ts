import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  getSidebarMenuItems,
  getSidebarNavItems,
  getSidebarVisibleHrefs,
  getSidebarVisibleLinkTitles,
  isEcommerceSidebarPath,
  isSidebarSubMenuItemActive,
} from "./sidebar-menu";

const webRoot = join(process.cwd());

function read(relativePath: string) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("sidebar ecommerce group", () => {
  it("Siparişler ayrı ana menü item'ı olarak görünmez", () => {
    const topLevelTitles = getSidebarMenuItems("STAFF").map((item) => item.title);
    assert.ok(!topLevelTitles.includes("Siparişler"));
  });

  it("STAFF için E-Ticaret grubu ve altında Siparişler görünür", () => {
    const nav = getSidebarNavItems("STAFF");
    const ecommerce = nav.find(
      (entry) => entry.type === "group" && entry.id === "ecommerce"
    );

    assert.ok(ecommerce && ecommerce.type === "group");
    assert.equal(ecommerce.title, "E-Ticaret");
    assert.ok(ecommerce.items.some((item) => item.title === "Siparişler"));
    assert.ok(
      ecommerce.items.some((item) => item.href === "/orders")
    );
  });

  it("OWNER E-Ticaret altında Siparişler ve Pazaryeri Entegrasyonları görür", () => {
    const titles = getSidebarVisibleLinkTitles("OWNER");
    assert.ok(titles.includes("Siparişler"));
    assert.ok(titles.includes("Pazaryeri Entegrasyonları"));
  });

  it("ACCOUNTANT E-Ticaret grubunu görmez (orders ve integrations yok)", () => {
    const nav = getSidebarNavItems("ACCOUNTANT");
    assert.ok(
      !nav.some((entry) => entry.type === "group" && entry.id === "ecommerce")
    );
    const titles = getSidebarVisibleLinkTitles("ACCOUNTANT");
    assert.ok(!titles.includes("Siparişler"));
    assert.ok(!titles.includes("Pazaryeri Entegrasyonları"));
  });

  it("STAFF Pazaryeri Entegrasyonları menüsünü görmez", () => {
    const titles = getSidebarVisibleLinkTitles("STAFF");
    assert.ok(titles.includes("Siparişler"));
    assert.ok(!titles.includes("Pazaryeri Entegrasyonları"));
  });

  it("/orders aktifken E-Ticaret path helper true döner", () => {
    assert.equal(isEcommerceSidebarPath("/orders"), true);
    assert.equal(isEcommerceSidebarPath("/orders/abc"), true);
    assert.equal(isEcommerceSidebarPath("/settings/integrations"), true);
    assert.equal(isEcommerceSidebarPath("/products"), false);
  });

  it("isSidebarSubMenuItemActive alt route'ları yakalar", () => {
    assert.equal(isSidebarSubMenuItemActive("/orders/import", "/orders"), true);
    assert.equal(
      isSidebarSubMenuItemActive("/settings/integrations", "/settings/integrations"),
      true
    );
  });

  it("/orders route korunur", () => {
    const page = read("app/orders/page.tsx");
    assert.match(page, /getOrdersPageData/);
    assert.doesNotMatch(page, /redirect\(\s*"\/ecommerce/);
  });

  it("orders layout module guard korunur", () => {
    const layout = read("app/orders/layout.tsx");
    assert.match(layout, /module="orders"/);
  });

  it("getSidebarVisibleHrefs /orders içerir", () => {
    const hrefs = getSidebarVisibleHrefs("STAFF");
    assert.ok(hrefs.includes("/orders"));
  });

  it("sidebar-menu.ts Siparişler'i E-Ticaret grubunda tanımlar", () => {
    const menu = read("lib/sidebar-menu.ts");
    assert.match(menu, /SIDEBAR_ECOMMERCE_GROUP/);
    assert.match(menu, /title: "E-Ticaret"/);
    assert.match(menu, /href: "\/orders"/);
    assert.match(menu, /href: "\/settings\/integrations"/);
    assert.doesNotMatch(menu, /title: "Siparişler"[\s\S]*module: "orders"[\s\S]*title: "Raporlar"/);
  });
});
