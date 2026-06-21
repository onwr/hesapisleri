import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");

describe("dashboard recent activities", () => {
  it("dashboard content hardcoded demo metin içermez", () => {
    const content = read("components/dashboard/dashboard-content.tsx");
    assert.doesNotMatch(content, /Kırtasiye/i);
    assert.doesNotMatch(content, /Mehmet Kaya/);
    assert.doesNotMatch(content, /FTR-2026-00035/);
    assert.doesNotMatch(content, /₺3\.250,00/);
    assert.doesNotMatch(content, /₺350,00/);
  });

  it("dashboard page ActivityLog mapper kullanır", () => {
    const page = read("app/dashboard/page.tsx");
    assert.match(page, /mapActivityLogToDashboardItem/);
    assert.match(page, /activityLog\.findMany/);
    assert.match(page, /orderBy:\s*\{\s*createdAt:\s*"desc"/);
    assert.doesNotMatch(page, /getActivityTag\(log\.module\)/);
  });

  it("empty state metni tanımlı", () => {
    const content = read("components/dashboard/dashboard-content.tsx");
    assert.match(content, /Henüz işlem yok/);
    assert.match(
      content,
      /Satış, gider, ürün veya stok işlemleri yaptıkça burada görünecek/
    );
  });

  it("cleanup script dry-run ve apply destekler", () => {
    const script = read("scripts/cleanup-demo-activity-logs.ts");
    assert.match(script, /getDemoActivityCleanupWhere/);
    assert.match(script, /--apply/);
    assert.match(script, /Dry-run/);
  });
});
