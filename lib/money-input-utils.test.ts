import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatMoneyInput,
  isValidMoneyInput,
  isValidProductMoneyInput,
  normalizeMoneyInput,
  parseProductMoneyInput,
  parseTurkishMoneyInput,
} from "./money-input-utils";

describe("parseTurkishMoneyInput", () => {
  it("virgüllü Türkçe formatı parse eder", () => {
    assert.equal(parseTurkishMoneyInput("1108,60"), 1108.6);
    assert.equal(parseTurkishMoneyInput("1.108,60"), 1108.6);
    assert.equal(parseTurkishMoneyInput("0,99"), 0.99);
  });

  it("noktalı ondalık formatı parse eder", () => {
    assert.equal(parseTurkishMoneyInput("1108.60"), 1108.6);
  });

  it("boş değer sıfır döner", () => {
    assert.equal(parseTurkishMoneyInput(""), 0);
    assert.equal(parseTurkishMoneyInput("   "), 0);
  });

  it("geçersiz metin NaN döner", () => {
    assert.ok(Number.isNaN(parseTurkishMoneyInput("abc")));
  });
});

describe("formatMoneyInput", () => {
  it("Türkçe sayı formatı üretir", () => {
    assert.equal(formatMoneyInput(1108.6), "1.108,6");
    assert.equal(formatMoneyInput(0.99), "0,99");
  });
});

describe("normalizeMoneyInput", () => {
  it("girişi parse edip formatlar", () => {
    assert.equal(normalizeMoneyInput("1108,60"), "1.108,6");
  });
});

describe("isValidMoneyInput", () => {
  it("negatif ürün fiyatını reddeder", () => {
    assert.equal(isValidProductMoneyInput("-10"), false);
    assert.equal(isValidProductMoneyInput("1108,60"), true);
  });

  it("geçersiz metni reddeder", () => {
    assert.equal(isValidProductMoneyInput("abc"), false);
  });

  it("negatif izin verilen alanlarda kabul edilir", () => {
    assert.equal(isValidMoneyInput("-5", { allowNegative: true }), true);
  });
});

describe("parseProductMoneyInput", () => {
  it("negatif ve geçersiz değerleri sıfıra çeker", () => {
    assert.equal(parseProductMoneyInput("-10"), 0);
    assert.equal(parseProductMoneyInput("abc"), 0);
    assert.equal(parseProductMoneyInput("1108,60"), 1108.6);
  });
});
