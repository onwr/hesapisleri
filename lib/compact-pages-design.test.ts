import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { COMPACT_ACTION_ICON_NAMES } from "@/components/cards/compact-action-card-types";

const webRoot = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(webRoot, relativePath), "utf8");
}

function assertCompactActionPage(relativePath: string) {
  const source = read(relativePath);
  assert.match(source, /CompactActionCard/);
  assert.match(source, /iconName/);
  assert.doesNotMatch(source, /CompactActionCard[\s\S]{0,200}icon=\{/);
  assert.doesNotMatch(
    source,
    /icon:\s*(Truck|Wallet|Plus|UserPlus|FilePlus2|LayoutGrid)/
  );
}

describe("compact pages design unity", () => {
  it("directory CompactActionCard kullanıyor", () => {
    assertCompactActionPage("components/directory/directory-quick-actions.tsx");
    const utils = read("lib/directory-page-ui-utils.ts");
    assert.match(utils, /iconName:/);
  });

  it("invoices CompactActionCard kullanıyor", () => {
    assertCompactActionPage("app/invoices/page.tsx");
  });

  it("expenses CompactActionCard kullanıyor", () => {
    assertCompactActionPage("app/expenses/page.tsx");
  });

  it("orders CompactActionCard kullanıyor", () => {
    assertCompactActionPage("app/orders/page.tsx");
  });

  it("AI sayfalarında eski büyük hero sınıfları yok", () => {
    const page = read("app/ai-assistant/page.tsx");
    assert.doesNotMatch(page, /from-violet-50 via-white to-blue-50 p-5/);
    assert.doesNotMatch(page, /h-\[86px\]/);
    assert.match(page, /text-\[22px\] font-black/);
    const controls = read("components/ai-assistant/ai-assistant-page-controls.tsx");
    assert.match(controls, /CompactActionCard/);
  });

  it("mobil grid class'ları mevcut", () => {
    const grid = read("components/cards/compact-action-card-grid.tsx");
    assert.match(grid, /sm:grid-cols-2/);
    assert.match(grid, /grid grid-cols-1 gap-3/);
  });

  it("büyük sabit yükseklikler action kartlarında yok", () => {
    for (const file of [
      "app/invoices/page.tsx",
      "app/expenses/page.tsx",
      "app/orders/page.tsx",
      "components/directory/directory-quick-actions.tsx",
      "components/ai-assistant/ai-assistant-page-controls.tsx",
    ]) {
      const source = read(file);
      assert.doesNotMatch(source, /h-\[86px\]/, `${file} h-[86px] içermemeli`);
      assert.doesNotMatch(source, /h-\[120px\]/, `${file} h-[120px] içermemeli`);
    }
  });

  it("FinanceAssistantPanel kompakt komut kartı yüksekliği", () => {
    const panel = read("components/ai-assistant/finance-assistant-panel.tsx");
    assert.match(panel, /min-h-\[56px\]/);
    assert.match(panel, /max-h-\[72px\]/);
  });

  it("iconName registry yeni sayfa ikonlarını kapsar", () => {
    const required = [
      "clock",
      "alert-triangle",
      "layout-grid",
      "hourglass",
      "shopping-bag",
      "book-user",
      "brain",
      "message-circle",
      "upload",
    ];
    for (const icon of required) {
      assert.equal(
        (COMPACT_ACTION_ICON_NAMES as readonly string[]).includes(icon),
        true,
        `${icon} registry'de olmalı`
      );
    }
  });

  it("directory isimleri detay linki kullanır", () => {
    const client = read("components/directory/directory-page-client.tsx");
    assert.match(client, /getDirectoryContactDetailHref/);
    const utils = read("lib/directory-utils.ts");
    assert.match(utils, /getDirectoryContactDetailHref/);
  });
});
