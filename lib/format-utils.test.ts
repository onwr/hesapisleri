import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatMoneyInput,
  parseTurkishMoneyInput,
} from "./format-utils";

describe("format-utils money re-exports", () => {
  it("virgüllü ondalık değeri parse eder", () => {
    assert.equal(parseTurkishMoneyInput("1108,60"), 1108.6);
    assert.equal(parseTurkishMoneyInput("1.108,60"), 1108.6);
  });

  it("noktalı ondalık değeri parse eder", () => {
    assert.equal(parseTurkishMoneyInput("1108.60"), 1108.6);
  });

  it("tam sayı girişini parse eder", () => {
    assert.equal(parseTurkishMoneyInput("1108"), 1108);
  });

  it("formatMoneyInput Türkçe gösterir", () => {
    assert.equal(formatMoneyInput(1108.6), "1.108,6");
  });
});
