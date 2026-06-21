import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { RLS_PHASE_ONE_TABLES } from "./tenant-policy";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("tenant infrastructure", () => {
  it("withTenantDb sets transaction-scoped config", () => {
    const source = read("lib/tenant/tenant-db.ts");
    assert.match(source, /set_config/);
    assert.match(source, /true\s*\)/);
    assert.doesNotMatch(source, /\$executeRawUnsafe/);
  });

  it("RLS migration covers phase one tables", () => {
    const migration = read(
      "prisma/migrations/20260611140000_enable_tenant_rls_phase1/migration.sql"
    );

    for (const table of RLS_PHASE_ONE_TABLES) {
      assert.match(migration, new RegExp(`'${table}'`));
    }
  });

  it("sales create validates tenant customer", () => {
    const source = read("app/api/sales/create/route.ts");
    assert.match(source, /requireApiTenantContext/);
    assert.match(source, /assertOptionalTenantCustomer/);
  });

  it("pos checkout validates tenant customer", () => {
    const source = read("lib/pos-checkout-service.ts");
    assert.match(source, /assertOptionalTenantCustomer/);
  });
});
