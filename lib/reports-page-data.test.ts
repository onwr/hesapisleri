import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { calculateInventoryValue } from "./inventory-value-utils";
import { sumActiveAccountBalances } from "./finance-aggregation-utils";
import {
  buildReportCardHref,
  buildReportKpiCards,
  normalizeDateRange,
  parseDateParam,
  parseReportTab,
  parseReportView,
  resolveReportSections,
  tabShowsFinancial,
} from "./reports-page-utils";
import { canAccessReports } from "./permission-utils";

const webRoot = join(process.cwd());

function read(relativePath: string) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("reports page utils", () => {
  it("parseReportTab geçersiz değerde all döner", () => {
    assert.equal(parseReportTab("invalid"), "all");
    assert.equal(parseReportTab("financial"), "financial");
  });

  it("normalizeDateRange ters tarihleri düzeltir", () => {
    const from = parseDateParam("2026-06-10")!;
    const to = parseDateParam("2026-06-01")!;
    const normalized = normalizeDateRange(from, to);
    assert.ok(normalized.from.getTime() <= normalized.to.getTime());
  });

  it("buildReportKpiCards boş aylık veriyle patlamaz", () => {
    const cards = buildReportKpiCards(0, 0, [], 0, 0);
    assert.equal(cards.length, 3);
    assert.equal(cards[0]?.miniLineData.length, 1);
  });

  it("tabShowsFinancial finansal sekmeyi gösterir", () => {
    assert.equal(tabShowsFinancial("financial"), true);
    assert.equal(tabShowsFinancial("sales"), false);
  });

  it("parseReportView geçerli rapor anahtarını döner", () => {
    assert.equal(parseReportView("sales"), "sales");
    assert.equal(parseReportView("invalid"), null);
  });

  it("resolveReportSections gelir-gider raporunda doğru bölümleri açar", () => {
    const sections = resolveReportSections("income-expense", "all");
    assert.equal(sections.showKpi, true);
    assert.equal(sections.showIncomeExpenseChart, true);
    assert.equal(sections.showCashFlowChart, false);
    assert.equal(sections.showTopProducts, false);
  });

  it("resolveReportSections ürün raporunda satış tablosunu açar", () => {
    const sections = resolveReportSections("products", "stock");
    assert.equal(sections.showTopProducts, true);
    assert.equal(sections.showStockTable, false);
  });

  it("buildReportCardHref rapor kartını report parametresiyle bağlar", () => {
    const card = {
      key: "sales",
      title: "Satış Raporu",
      description: "Satışlarınızı analiz edin",
      tab: "sales" as const,
      iconKey: "barChart" as const,
      color: "orange" as const,
    };

    assert.match(
      buildReportCardHref(card, new Date("2026-06-01"), new Date("2026-06-30")),
      /report=sales/
    );
  });
});

describe("reports inventory rules", () => {
  it("stok değeri buyPrice ile hesaplanır", () => {
    const value = calculateInventoryValue([
      { productType: "STOCK", stock: 10, buyPrice: 25 },
    ]);
    assert.equal(value, 250);
  });

  it("SERVICE stok değerine dahil edilmez", () => {
    const value = calculateInventoryValue([
      { productType: "SERVICE", stock: 5, buyPrice: 100 },
    ]);
    assert.equal(value, 0);
  });

  it("negatif stok negatif değer üretir", () => {
    const value = calculateInventoryValue([
      { productType: "STOCK", stock: -3, buyPrice: 20 },
    ]);
    assert.equal(value, -60);
  });
});

describe("reports finance helpers", () => {
  it("sumActiveAccountBalances sadece aktif hesapları toplar", () => {
    const total = sumActiveAccountBalances([
      { balance: 100, status: "ACTIVE" },
      { balance: 50, status: "PASSIVE" },
      { balance: 25, status: "ACTIVE" },
    ]);
    assert.equal(total, 125);
  });
});

describe("reports permissions", () => {
  it("ACCOUNTANT raporlara erişebilir", () => {
    assert.equal(canAccessReports("ACCOUNTANT"), true);
  });

  it("STAFF raporlara erişemez", () => {
    assert.equal(canAccessReports("STAFF"), false);
  });
});

describe("reports UI integration", () => {
  it("reports page rapor görünümü destekler", () => {
    const page = read("app/reports/page.tsx");
    assert.match(page, /parseReportView/);
    assert.match(page, /resolveReportSections/);
    assert.match(page, /buildReportCardHref/);
  });

  it("report charts boş veri empty state içerir", () => {
    const charts = read("components/reports/report-charts.tsx");
    assert.match(charts, /Bu dönem için rapor verisi bulunmuyor/);
    assert.match(charts, /ComposedChart/);
  });

  it("reports export API getReportsPageData kullanır", () => {
    const route = read("app/api/reports/export/route.ts");
    assert.match(route, /getReportsPageData/);
    assert.match(route, /normalizeDateRange/);
  });
});
