import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_DASHBOARD_SHORTCUT_IDS,
  normalizeDashboardShortcutIds,
  resolveDashboardShortcuts,
} from "./dashboard-shortcuts";

describe("dashboard shortcuts", () => {
  it("uses defaults for invalid storage", () => {
    assert.deepEqual(normalizeDashboardShortcutIds(null), [
      ...DEFAULT_DASHBOARD_SHORTCUT_IDS,
    ]);
  });

  it("deduplicates and limits shortcut ids", () => {
    const ids = normalizeDashboardShortcutIds([
      "products",
      "products",
      "pos",
      "invalid-id",
      "sales",
      "invoices",
      "customers",
      "cash-bank",
      "reports",
    ]);

    assert.equal(ids.length, 6);
    assert.equal(new Set(ids).size, 6);
    assert.ok(!ids.includes("invalid-id"));
  });

  it("resolves shortcuts with labels and hrefs", () => {
    const shortcuts = resolveDashboardShortcuts(["pos", "sales-new"]);
    assert.equal(shortcuts[0]?.href, "/pos");
    assert.equal(shortcuts[1]?.label, "Yeni Satış");
  });
});
