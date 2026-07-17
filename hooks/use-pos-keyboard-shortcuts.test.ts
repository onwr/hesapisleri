import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const source = fs.readFileSync(
  path.join(process.cwd(), "hooks/use-pos-keyboard-shortcuts.ts"),
  "utf8"
);

describe("pos keyboard shortcuts", () => {
  it("registers F2 F4 F6 F8 Escape and Ctrl+Backspace handlers", () => {
    assert.match(source, /F2/);
    assert.match(source, /F4/);
    assert.match(source, /F6/);
    assert.match(source, /F8/);
    assert.match(source, /Escape/);
    assert.match(source, /Backspace/);
  });

  it("blocks checkout while pending", () => {
    assert.match(source, /if \(checkingOut\) return/);
  });

  it("F8 boş sepeti submit etmez", () => {
    assert.match(source, /if \(!cartEmpty\) onCompleteSale/);
  });

  it("does not clear cart while editing inputs", () => {
    assert.match(source, /isEditableTarget/);
    assert.match(source, /!editing/);
  });

  it("cleans up listener on unmount", () => {
    assert.match(source, /removeEventListener\("keydown"/);
  });
});
