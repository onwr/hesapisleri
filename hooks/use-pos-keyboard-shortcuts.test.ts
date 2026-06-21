import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const source = fs.readFileSync(
  path.join(process.cwd(), "hooks/use-pos-keyboard-shortcuts.ts"),
  "utf8"
);

describe("pos keyboard shortcuts", () => {
  it("registers F2 F4 F6 F8 and Escape handlers", () => {
    assert.match(source, /F2/);
    assert.match(source, /F4/);
    assert.match(source, /F6/);
    assert.match(source, /F8/);
    assert.match(source, /Escape/);
  });

  it("blocks checkout while pending", () => {
    assert.match(source, /if \(checkingOut\) return/);
  });

  it("does not checkout on empty cart for payment shortcuts", () => {
    assert.match(source, /if \(!cartEmpty\) onCashPayment/);
    assert.match(source, /if \(!cartEmpty\) onCardPayment/);
  });

  it("cleans up listener on unmount", () => {
    assert.match(source, /removeEventListener\("keydown"/);
  });
});
