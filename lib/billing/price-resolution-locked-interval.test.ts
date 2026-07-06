import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

describe("price resolution locked interval", () => {
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "price-resolution-service.ts"),
    "utf8"
  );

  it("kilitli fiyat yalnız seçilen dönemle eşleşince uygulanır", () => {
    assert.match(src, /lockedPlanPrice\?\.billingInterval === input\.billingInterval/);
    assert.match(src, /include:\s*\{\s*lockedPlanPrice:/);
  });

  it("güncel plan fiyatı kilitli fiyattan düşükse yeni fiyat uygulanır", () => {
    assert.match(src, /catalogTotal < lockedTotal/);
    assert.match(src, /preferLockedPrice = false/);
  });
});
