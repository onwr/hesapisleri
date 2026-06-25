import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFinanceMirrorNote,
  getFinanceMirrorKind,
  isFinanceMirrorTransaction,
} from "@/lib/finance-reversal-utils";

describe("finance reversal utils", () => {
  it("iptal hareketini REVERSAL olarak işaretler", () => {
    const note = buildFinanceMirrorNote(
      "REVERSAL",
      "SAT-001 numaralı satış iptal edildi."
    );

    assert.match(note, /^\[REVERSAL\]/);
    assert.equal(
      getFinanceMirrorKind({
        title: "Satış İptali - SAT-001",
        note,
      }),
      "REVERSAL"
    );
    assert.equal(
      isFinanceMirrorTransaction({
        title: "Satış İptali - SAT-001",
        note,
      }),
      true
    );
  });

  it("düzeltme hareketini CORRECTION olarak işaretler", () => {
    const note = buildFinanceMirrorNote(
      "CORRECTION",
      "önceki tahsilat geri alındı."
    );

    assert.match(note, /^\[CORRECTION\]/);
    assert.equal(
      getFinanceMirrorKind({
        title: "Satış Düzeltme Geri Alım - SAT-002",
        note,
      }),
      "CORRECTION"
    );
  });
});
