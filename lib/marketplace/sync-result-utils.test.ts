import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isEmptySyncResult } from "@/lib/marketplace/sync-result-utils";

describe("isEmptySyncResult", () => {
  it("returns true when all counts are zero and no errors", () => {
    assert.equal(
      isEmptySyncResult({
        fetchedCount: 0,
        createdCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        errors: [],
      }),
      true
    );
  });

  it("returns false when any count is greater than zero", () => {
    assert.equal(
      isEmptySyncResult({
        fetchedCount: 1,
        createdCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        errors: [],
      }),
      false
    );
  });

  it("returns false when errors exist", () => {
    assert.equal(
      isEmptySyncResult({
        fetchedCount: 0,
        createdCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        errors: [{ message: "fail" }],
      }),
      false
    );
  });
});
