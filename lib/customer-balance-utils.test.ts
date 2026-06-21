import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const source = fs.readFileSync(
  path.join(process.cwd(), "lib/customer-balance-utils.ts"),
  "utf8"
);

describe("customer balance tenant scope", () => {
  it("adjustCustomerBalance uses updateMany with companyId", () => {
    assert.match(source, /updateMany\(\s*\{[\s\S]*where:\s*\{[\s\S]*companyId/);
  });

  it("applyCustomerDebtFromDocument requires companyId parameter", () => {
    assert.match(
      source,
      /export async function applyCustomerDebtFromDocument\([\s\S]*companyId: string/
    );
  });

  it("applyCustomerCollection requires companyId parameter", () => {
    assert.match(
      source,
      /export async function applyCustomerCollection\([\s\S]*companyId: string/
    );
  });

  it("throws TenantNotFoundError when customer not in tenant", () => {
    assert.match(source, /TenantNotFoundError/);
    assert.match(source, /result\.count === 0/);
  });
});
