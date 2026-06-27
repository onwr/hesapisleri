import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { isPlatformSuperAdminUser } from "@/lib/admin-auth";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readRoute(segments: string[]) {
  return readFileSync(join(webRoot, "app", "api", ...segments, "route.ts"), "utf8");
}

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

const CANONICAL_ROUTES: Array<{ segments: string[]; methods: string[] }> = [
  { segments: ["admin", "partner-payouts"], methods: ["GET", "POST"] },
  { segments: ["admin", "partner-payouts", "[id]"], methods: ["GET", "PATCH"] },
  { segments: ["admin", "partner-payouts", "[id]", "approve"], methods: ["POST"] },
  { segments: ["admin", "partner-payouts", "[id]", "reject"], methods: ["POST"] },
  { segments: ["admin", "partner-payouts", "[id]", "mark-paid"], methods: ["POST"] },
  { segments: ["admin", "partner-payouts", "[id]", "earnings"], methods: ["GET"] },
  { segments: ["admin", "partner-payouts", "[id]", "history"], methods: ["GET"] },
  { segments: ["admin", "partner-payouts", "[id]", "activity"], methods: ["GET"] },
  { segments: ["admin", "partner-payouts", "[id]", "notes"], methods: ["GET", "POST"] },
  { segments: ["admin", "partner-payouts", "eligible-earnings"], methods: ["GET"] },
  { segments: ["admin", "partner-payouts", "[id]", "notes", "[noteId]"], methods: ["PATCH", "DELETE"] },
];

describe("partner payout API auth matrix", () => {
  for (const { segments, methods } of CANONICAL_ROUTES) {
    it(`${segments.join("/")} (${methods.join(",")}) requireSuperAdminApi`, () => {
      const source = readRoute(segments);
      assert.match(source, /requireSuperAdminApi/);
      assert.match(source, /"error" in auth/);
      for (const method of methods) {
        assert.match(source, new RegExp(`export async function ${method}`));
      }
    });
  }

  it("SUPER_ADMIN erişir", () => {
    assert.equal(
      isPlatformSuperAdminUser({ role: "SUPER_ADMIN", status: "ACTIVE", email: "s@p.com" }),
      true
    );
  });

  it("tenant ADMIN reddedilir", () => {
    assert.equal(
      isPlatformSuperAdminUser({ role: "ADMIN", status: "ACTIVE", email: "a@t.com" }),
      false
    );
  });

  it("generic PATCH 405", () => {
    const src = readRoute(["admin", "partner-payouts", "[id]"]);
    assert.match(src, /405/);
    assert.match(src, /Generic status PATCH/);
  });
});

describe("legacy payout wrappers", () => {
  it("list re-exports canonical GET", () => {
    const src = readFileSync(
      join(webRoot, "app/api/admin/partners/payouts/route.ts"),
      "utf8"
    );
    assert.match(src, /partner-payouts\/route/);
  });

  it("note isolation payoutId", () => {
    const src = readSrc("lib/admin/partner-payouts/admin-partner-payout-note-service.ts");
    assert.ok(src.includes("where: { id: noteId, payoutId"));
  });
});

describe("cache invalidation", () => {
  it("mutation sonrası cache temizler", () => {
    const src = readSrc("lib/admin/partner-payouts/admin-partner-payout-cache.ts");
    assert.ok(src.includes("admin-partner-payouts"));
    assert.ok(src.includes("admin-overview"));
    assert.ok(src.includes("admin-partners"));
  });
});
