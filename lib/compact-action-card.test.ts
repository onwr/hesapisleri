import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  COMPACT_ACTION_ICON_NAMES,
  isCompactActionIconName,
} from "@/components/cards/compact-action-card-types";

const webRoot = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(webRoot, relativePath), "utf8");
}

function assertNoLucideFunctionPropsInPage(relativePath: string) {
  const source = read(relativePath);
  assert.doesNotMatch(source, /CompactActionCard[\s\S]{0,220}icon=\{/);
  assert.doesNotMatch(
    source,
    /icon:\s*(Truck|Wallet|BellRing|FileSpreadsheet|UserX|ShoppingCart|UserPlus|Users|Mail)/
  );
  assert.match(source, /iconName=/);
}

describe("CompactActionCard icon serialization", () => {
  it("props yalnız serializable iconName kullanır", () => {
    const source = read("components/cards/compact-action-card.tsx");
    assert.match(source, /iconName: CompactActionIconName/);
    assert.doesNotMatch(source, /\bicon:\s*LucideIcon/);
    assert.doesNotMatch(source, /icon\?:/);
    assert.match(source, /"use client"/);
  });

  it("icon prop function olarak tanımlı değil", () => {
    const source = read("components/cards/compact-action-card.tsx");
    assert.doesNotMatch(source, /icon:\s*LucideIcon/);
    assert.doesNotMatch(source, /icon:\s*ReactNode/);
  });

  it("tüm iconName değerleri iconMap içinde tanımlı", () => {
    const source = read("components/cards/compact-action-card.tsx");
    for (const iconName of COMPACT_ACTION_ICON_NAMES) {
      const escaped = iconName.replace(/-/g, "\\-");
      const pattern = iconName.includes("-")
        ? new RegExp(`"${escaped}":`)
        : new RegExp(`\\b${escaped}:`);
      assert.match(source, pattern);
    }
  });

  it("unknown icon güvenli fallback gösteriyor", () => {
    const source = read("components/cards/compact-action-card.tsx");
    assert.match(source, /LayoutGrid/);
    assert.match(source, /resolveIcon/);
  });

  it("suppliers page Truck string kullanıyor", () => {
    const source = read("app/suppliers/page.tsx");
    assert.match(source, /iconName:\s*"truck"/);
    assertNoLucideFunctionPropsInPage("app/suppliers/page.tsx");
  });

  it("customers page Lucide function prop kullanmıyor", () => {
    assertNoLucideFunctionPropsInPage("app/customers/page.tsx");
  });

  it("sales page Lucide function prop kullanmıyor", () => {
    assertNoLucideFunctionPropsInPage("app/sales/page.tsx");
  });

  it("products quick actions Lucide function prop kullanmıyor", () => {
    const source = read("components/products/products-quick-actions.tsx");
    assert.match(source, /iconName=/);
    assert.doesNotMatch(source, /icon=\{/);
    assert.doesNotMatch(source, /from "lucide-react"/);
  });

  it("team shell ActionCard iconName kullanıyor", () => {
    const source = read("components/team/team-shell.tsx");
    assert.match(source, /iconName="user-plus"/);
    assert.doesNotMatch(source, /ActionCard[\s\S]{0,180}icon=\{/);
  });

  it("cash-bank action cards iconName kullanıyor", () => {
    const source = read("components/cash-bank/cash-bank-list-actions.tsx");
    assert.match(source, /iconName="wallet"/);
    assert.match(source, /iconName="repeat"/);
    assert.doesNotMatch(source, /CompactActionCard[\s\S]{0,180}icon=\{/);
  });

  it("isCompactActionIconName registry ile uyumlu", () => {
    assert.equal(isCompactActionIconName("truck"), true);
    assert.equal(isCompactActionIconName("unknown-icon"), false);
    assert.equal(COMPACT_ACTION_ICON_NAMES.length >= 20, true);
  });
});
