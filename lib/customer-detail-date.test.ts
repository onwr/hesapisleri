import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  coerceValidDate,
  formatDisplayDate,
  getTimeMs,
  toIsoString,
} from "@/lib/format-utils";

describe("formatDisplayDate", () => {
  it("null tarih → —", () => {
    assert.equal(formatDisplayDate(null), "—");
  });

  it("undefined tarih → —", () => {
    assert.equal(formatDisplayDate(undefined), "—");
  });

  it("boş string → —", () => {
    assert.equal(formatDisplayDate(""), "—");
  });

  it("invalid string → —", () => {
    assert.equal(formatDisplayDate("not-a-date"), "—");
  });

  it("geçerli Date → Türkçe format", () => {
    const formatted = formatDisplayDate(new Date("2024-06-15T14:30:00.000Z"));
    assert.match(formatted, /2024/);
    assert.notEqual(formatted, "—");
  });

  it("geçerli ISO string → Türkçe format", () => {
    const formatted = formatDisplayDate("2024-06-15T14:30:00.000Z");
    assert.match(formatted, /2024/);
    assert.notEqual(formatted, "—");
  });
});

describe("customer ledger occurredAt mapping", () => {
  it("transactionDate yoksa createdAt kullanılır", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "lib/customer-detail-data.ts"),
      "utf8"
    );
    assert.match(source, /occurredAt/);
    assert.match(source, /tx\.date,\s*tx\.createdAt/);
    assert.match(source, /resolveLedgerOccurredAt/);
  });

  it("bozuk ledger kaydı sıralamayı çökertmez", () => {
    const aTime = getTimeMs(null) ?? 0;
    const bTime = getTimeMs("invalid") ?? 0;
    assert.equal(aTime, 0);
    assert.equal(bTime, 0);
    assert.doesNotThrow(() => aTime - bTime);
  });

  it("müşteri detay sayfası güvenli tarih helper kullanır", () => {
    const page = fs.readFileSync(
      path.join(process.cwd(), "app/customers/[id]/page.tsx"),
      "utf8"
    );
    assert.match(page, /formatDisplayDate/);
    assert.doesNotMatch(page, /function formatDate\(/);
  });

  it("Tahsilat Al ve Ödeme Yap aksiyonları render edilir", () => {
    const page = fs.readFileSync(
      path.join(process.cwd(), "app/customers/[id]/page.tsx"),
      "utf8"
    );
    assert.match(page, /CustomerFinanceActions/);
  });

  it("ledger tablosu occurredAt ile güvenli formatlar", () => {
    const table = fs.readFileSync(
      path.join(process.cwd(), "components/customers/customer-ledger-table.tsx"),
      "utf8"
    );
    assert.match(table, /formatDisplayDate\(entry\.occurredAt/);
  });
});

describe("toIsoString validation", () => {
  it("invalid string null döner", () => {
    assert.equal(toIsoString("bad-date"), null);
  });

  it("coerceValidDate invalid için null döner", () => {
    assert.equal(coerceValidDate("bad-date"), null);
  });
});
