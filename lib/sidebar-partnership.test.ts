import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  getSidebarNavItems,
  getSidebarVisibleHrefs,
  getSidebarVisibleLinkTitles,
} from "./sidebar-menu";
import { canAccessModule } from "./permission-utils";

const webRoot = join(process.cwd());

function read(relativePath: string) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("sidebar partnership visibility", () => {
  it("Ortaklık Programı tüm temel rollere görünür", () => {
    for (const role of ["OWNER", "ADMIN", "ACCOUNTANT", "STAFF", "POS_STAFF"] as const) {
      const titles = getSidebarVisibleLinkTitles(role);
      assert.ok(
        titles.includes("Ortaklık Programı"),
        `${role} için Ortaklık Programı görünmeli`
      );
    }
  });

  it("Ortaklık Programı /partnership href'ine bağlanır", () => {
    const hrefs = getSidebarVisibleHrefs("STAFF");
    assert.ok(hrefs.includes("/partnership"));
  });

  it("partnership modülü entitlement dışı permission-utils üzerinden açılır", () => {
    assert.equal(canAccessModule("STAFF", "partnership"), true);
    assert.equal(canAccessModule("POS_STAFF", "partnership"), true);
  });

  it("sidebar-menu.ts Ortaklık Programı kaydını içerir", () => {
    const menu = read("lib/sidebar-menu.ts");
    assert.match(menu, /title: "Ortaklık Programı"/);
    assert.match(menu, /href: "\/partnership"/);
    assert.match(menu, /module: "partnership"/);
  });

  it("partnership route sayfaları mevcuttur", () => {
    assert.match(read("app/partnership/page.tsx"), /getPartnershipAccessState/);
    assert.match(read("app/partnership/apply/page.tsx"), /PartnerApplyForm/);
    assert.match(read("app/partnership/dashboard/page.tsx"), /PartnerDashboardClient/);
    assert.match(read("app/partnership/status/page.tsx"), /PartnershipStatusClient/);
  });

  it("legacy /partner route'ları /partnership'e yönlendirir", () => {
    assert.match(read("app/partner/page.tsx"), /redirect\("\/partnership"\)/);
    assert.match(read("app/partner/apply/page.tsx"), /redirect\("\/partnership\/apply"\)/);
    assert.match(
      read("app/partner/dashboard/page.tsx"),
      /redirect\("\/partnership\/dashboard"\)/
    );
  });

  it("getSidebarNavItems partnership kaydını Ayarlar'dan önce listeler", () => {
    const nav = getSidebarNavItems("OWNER");
    const partnershipIndex = nav.findIndex(
      (entry) => entry.type === "link" && entry.href === "/partnership"
    );
    const settingsIndex = nav.findIndex(
      (entry) => entry.type === "link" && entry.href === "/settings"
    );
    assert.ok(partnershipIndex >= 0);
    assert.ok(settingsIndex > partnershipIndex);
  });
});
