/**
 * Faz 5 route güvenliği — requireSuperAdminApi ve parametre politikası.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readRoute(...segments: string[]) {
  return readFileSync(join(webRoot, "app", "api", "admin", "payments", ...segments), "utf8");
}

const ROUTES: Array<{ file: string[]; methods: string[] }> = [
  { file: ["route.ts"], methods: ["GET"] },
  { file: ["export", "route.ts"], methods: ["GET"] },
  { file: ["[id]", "route.ts"], methods: ["GET"] },
  { file: ["[id]", "sync-provider", "route.ts"], methods: ["POST"] },
  { file: ["[id]", "refund", "route.ts"], methods: ["POST"] },
  { file: ["[id]", "notes", "route.ts"], methods: ["GET", "POST"] },
  { file: ["[id]", "notes", "[noteId]", "route.ts"], methods: ["PATCH", "DELETE"] },
];

describe("admin payments route security", () => {
  for (const route of ROUTES) {
    const label = route.file.join("/");
    it(`${label} requireSuperAdminApi kullanır`, () => {
      const source = readRoute(...route.file);
      assert.ok(source.includes("requireSuperAdminApi"), `${label} missing auth`);
    });
  }

  it("refund route paymentId params'tan alınır", () => {
    const source = readRoute("[id]", "refund", "route.ts");
    assert.ok(source.includes("await params"));
    assert.ok(source.includes("paymentId: id"));
    assert.ok(!source.includes("body.paymentId"));
  });

  it("legacy membership-payments PATCH 405", () => {
    const source = readFileSync(
      join(webRoot, "app/api/admin/membership-payments/[id]/route.ts"),
      "utf8"
    );
    assert.ok(source.includes("405"));
    assert.ok(!source.includes("updateMembershipPaymentAdmin"));
  });

  it("updateMembershipPaymentAdmin deprecated 405", () => {
    const source = readFileSync(join(webRoot, "lib/membership-service.ts"), "utf8");
    assert.ok(source.includes("updateMembershipPaymentAdmin"));
    assert.match(source, /405/);
  });

  it("tenant admin requireSuperAdminApi ile reddedilir", () => {
    const source = readFileSync(join(webRoot, "lib/admin-auth.ts"), "utf8");
    assert.ok(source.includes("SUPER_ADMIN"));
    assert.ok(source.includes("isPlatformSuperAdminUser"));
  });
});

describe("manual status mutation scan", () => {
  it("admin route PAID mutation yok", () => {
    const patchRoute = readFileSync(
      join(webRoot, "app/api/admin/membership-payments/[id]/route.ts"),
      "utf8"
    );
    assert.ok(!patchRoute.includes('status: "PAID"'));
    assert.ok(!patchRoute.includes("applyPaidMembershipPayment"));
  });

  it("payment-refund-service dışında admin PAID seti yok", () => {
    const refundSource = readFileSync(join(webRoot, "lib/payments/payment-refund-service.ts"), "utf8");
    assert.ok(!refundSource.includes('status: "PAID"'));
  });
});
