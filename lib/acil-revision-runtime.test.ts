import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  formatShortDateTime,
  serializeSalesDocumentDate,
} from "@/lib/sales-page-utils";
import {
  formatReportDateTime,
  sanitizeReportNumber,
} from "@/lib/reports-page-utils";
import { getCashBalanceClass } from "@/lib/cash-bank-page-utils";
import { partnerApplicationSchema } from "@/lib/partner-utils";

describe("acil revision runtime — sales/reports dates", () => {
  it("/sales ISO tarih ile formatlanır", () => {
    const iso = "2026-03-15T10:30:00.000Z";
    const formatted = formatShortDateTime(iso);
    assert.notEqual(formatted, "—");
    assert.match(formatted, /2026/);
  });

  it("serializeSalesDocumentDate invalid için epoch döner", () => {
    const serialized = serializeSalesDocumentDate("bad");
    assert.equal(typeof serialized, "string");
    assert.match(serialized, /1970/);
  });

  it("/reports lastUpdatedAt ISO string formatlanır", () => {
    const formatted = formatReportDateTime("2026-01-01T12:00:00.000Z");
    assert.notEqual(formatted, "—");
  });

  it("boş rapor verisinde sanitizeReportNumber 0 döner", () => {
    assert.equal(sanitizeReportNumber(NaN), 0);
    assert.equal(sanitizeReportNumber(Infinity), 0);
    assert.equal(sanitizeReportNumber(undefined), 0);
  });

  it("sales-page-data getTimeMs sıralama kullanır", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "lib/sales-page-data.ts"),
      "utf8"
    );
    assert.match(source, /getTimeMs\(b\.createdAt\)/);
    assert.match(source, /serializeSalesDocumentDate/);
  });
});

describe("acil revision runtime — settings & navigation", () => {
  it("settings-center güvenli tarih helper kullanır", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "components/settings/settings-center.tsx"),
      "utf8"
    );
    assert.match(source, /formatShortDisplayDate/);
  });

  it("app-shell geri tuşunda refresh dinler", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "components/layout/app-shell-client.tsx"),
      "utf8"
    );
    assert.match(source, /popstate/);
    assert.match(source, /router\.refresh/);
  });

  it("firma değişiminde tenant cache sync çağrılır", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "components/layout/app-user-menu.tsx"),
      "utf8"
    );
    assert.match(source, /notifyTenantCacheSync/);
  });
});

describe("acil revision runtime — links & UI", () => {
  it("müşteri isim linki doğru route", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app/customers/page.tsx"),
      "utf8"
    );
    assert.match(source, /href=\{`\/customers\/\$\{customer\.id\}`\}/);
  });

  it("tedarikçi isim linki doğru route", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app/suppliers/page.tsx"),
      "utf8"
    );
    assert.match(source, /href=\{`\/suppliers\/\$\{supplier\.id\}`\}/);
  });

  it("çalışan isim linki doğru route", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "components/employees/employee-list-row.tsx"),
      "utf8"
    );
    assert.match(source, /href=\{`\/team\/\$\{employee\.id\}`\}/);
  });

  it("negatif bakiye kırmızı görünüm", () => {
    assert.match(getCashBalanceClass(-10), /rose/);
    assert.match(getCashBalanceClass(10), /0f1f4d/);
  });

  it("çalışan rozetleri kompakt class içerir", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "components/employees/employee-profile-header.tsx"),
      "utf8"
    );
    assert.match(source, /text-\[9px\]/);
    assert.match(source, /px-2 py-0\.5/);
  });
});

describe("acil revision runtime — finance assistant & partnership", () => {
  it("Finans Asistanı kategori öneri servisi var", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "lib/finance-assistant/category-suggestions.ts"),
      "utf8"
    );
    assert.match(source, /buildFinanceCategorySuggestions/);
    assert.match(source, /SALES_COMPARISON/);
    assert.match(source, /LOW_STOCK_PRODUCTS/);
  });

  it("Finans Asistanı paneli öneri API çağırır", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "components/ai-assistant/finance-assistant-panel.tsx"),
      "utf8"
    );
    assert.match(source, /\/api\/finance-assistant\/suggestions/);
  });

  it("ortaklık telefon validation TR formatı kabul eder", () => {
    const ok = partnerApplicationSchema.safeParse({
      fullName: "Test User",
      email: "test@example.com",
      phone: "05551234567",
      audienceType: "BUSINESS",
      termsAccepted: true,
    });
    assert.equal(ok.success, true);

    const bad = partnerApplicationSchema.safeParse({
      fullName: "Test User",
      email: "test@example.com",
      phone: "123",
      audienceType: "BUSINESS",
      termsAccepted: true,
    });
    assert.equal(bad.success, false);
  });

  it("stoksuz satış ayarı settings-center içinde", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "components/settings/settings-center.tsx"),
      "utf8"
    );
    assert.match(source, /allowNegativeStockSales/);
  });
});
