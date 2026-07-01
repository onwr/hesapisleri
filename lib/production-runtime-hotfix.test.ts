import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  coerceValidDate,
  formatDateTimeDisplay,
  formatDisplayDate,
  formatShortDisplayDate,
  toIsoString,
} from "@/lib/format-utils";

const TENANT_DATE_AUDIT_DIRS = [
  "app/settings",
  "app/dashboard",
  "app/suppliers",
  "app/customers",
  "app/expenses",
  "app/invoices",
  "app/sales",
  "app/cash-bank",
  "app/team",
  "components/settings",
  "components/dashboard",
  "components/suppliers",
  "components/customers",
];

const SETTINGS_TAB_ROUTES: Array<{ href: string; pageFile: string }> = [
  { href: "/settings", pageFile: "app/settings/page.tsx" },
  { href: "/settings/ai", pageFile: "app/settings/ai/page.tsx" },
  { href: "/settings/ai/usage", pageFile: "app/settings/ai/usage/page.tsx" },
  { href: "/settings/billing", pageFile: "app/settings/billing/page.tsx" },
  {
    href: "/settings/integrations",
    pageFile: "app/settings/integrations/page.tsx",
  },
];

function collectSourceFiles(dir: string): string[] {
  const absolute = path.join(process.cwd(), dir);
  if (!fs.existsSync(absolute)) return [];

  const files: string[] = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const entryPath = path.join(absolute, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(path.join(dir, entry.name)));
      continue;
    }
    if (/\.(tsx|ts)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) {
      files.push(entryPath);
    }
  }
  return files;
}

describe("production runtime hotfix — date helpers", () => {
  it("ISO string tarih settings sayfasını çökertmez", () => {
    const iso = "2026-03-15T10:30:00.000Z";
    assert.doesNotThrow(() => formatShortDisplayDate(iso));
    assert.match(formatShortDisplayDate(iso), /2026/);
  });

  it("invalid tarih → —", () => {
    assert.equal(formatDisplayDate("not-a-date"), "—");
    assert.equal(formatShortDisplayDate("bad"), "—");
    assert.equal(formatDateTimeDisplay("bad"), "—");
  });

  it("null tarih → —", () => {
    assert.equal(formatDisplayDate(null), "—");
    assert.equal(formatShortDisplayDate(null), "—");
  });

  it("Date nesnesi hâlâ formatlanır", () => {
    const formatted = formatDisplayDate(new Date("2024-06-15T14:30:00.000Z"));
    assert.match(formatted, /2024/);
    assert.notEqual(formatted, "—");
  });

  it("settings-center güvenli tarih helper kullanır", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "components/settings/settings-center.tsx"),
      "utf8"
    );
    assert.match(source, /formatShortDisplayDate/);
    assert.doesNotMatch(source, /\.toLocaleDateString\(/);
  });
});

describe("production runtime hotfix — settings routes", () => {
  for (const route of SETTINGS_TAB_ROUTES) {
    it(`${route.href} route dosyası mevcut`, () => {
      assert.ok(
        fs.existsSync(path.join(process.cwd(), route.pageFile)),
        `Missing ${route.pageFile}`
      );
    });
  }

  it("settings-center tab linkleri gerçek route dosyalarına işaret eder", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "components/settings/settings-center.tsx"),
      "utf8"
    );
    const hrefs = [
      ...source.matchAll(/href="(\/settings[^"]*)"/g),
    ].map((match) => match[1]);

    for (const href of hrefs) {
      assert.notEqual(href, "#", `Invalid href: ${href}`);
      const pagePath = path.join(
        process.cwd(),
        "app",
        href.replace(/^\//, ""),
        "page.tsx"
      );
      assert.ok(fs.existsSync(pagePath), `No page for ${href}`);
    }
  });
});

describe("production runtime hotfix — tenant date audit", () => {
  it("tenant sayfalarında güvensiz toLocaleDateString kalmadı", () => {
    const offenders: string[] = [];

    for (const dir of TENANT_DATE_AUDIT_DIRS) {
      for (const file of collectSourceFiles(dir)) {
        const relative = path.relative(process.cwd(), file);
        const source = fs.readFileSync(file, "utf8");
        if (source.includes(".toLocaleDateString(")) {
          offenders.push(relative);
        }
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `Unsafe .toLocaleDateString in:\n${offenders.join("\n")}`
    );
  });
});

describe("production runtime hotfix — unique constraint races", () => {
  it("companyOnboarding P2002 sonrası mevcut kaydı okur", async () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "lib/onboarding/onboarding-service.ts"),
      "utf8"
    );
    assert.match(source, /isPrismaUniqueConstraintError\(error\)/);
    assert.match(source, /companyOnboarding\.findUnique/);
  });

  it("companyAISettings P2002 sonrası mevcut kaydı okur", async () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "lib/ai/company-ai-settings-repository.ts"),
      "utf8"
    );
    assert.match(source, /isPrismaUniqueConstraintError\(error\)/);
    assert.match(source, /findUniqueOrThrow/);
  });

  it("onboarding createForNewCompany upsert kullanır", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "lib/onboarding/onboarding-service.ts"),
      "utf8"
    );
    assert.match(source, /companyOnboarding\.upsert/);
  });
});

describe("production runtime hotfix — DTO serialization", () => {
  it("settings serialization ISO string üretir", () => {
    const iso = toIsoString(new Date("2026-01-01T00:00:00.000Z"));
    assert.equal(iso, "2026-01-01T00:00:00.000Z");
    assert.equal(coerceValidDate(iso)?.toISOString(), iso);
  });
});
