import type { Invoice, InvoiceItem } from "@prisma/client";
import type { InvoiceFinancialSnapshot, InvoiceLineSnapshot } from "@/lib/e-document/invoice-e-document-snapshot-types";
import { invoiceMoneyToMinor } from "@/lib/efaturam/efaturam-money";
import { xmlAmountToMinor, minorUnitsToXmlAmount } from "@/lib/e-document/ubl-tr/minor-units";

export type TotalValidationIssue = {
  field: string;
  message: string;
};

export type TotalValidationResult = {
  ok: boolean;
  issues: TotalValidationIssue[];
};

function minorToXml(minor: number) {
  return minorUnitsToXmlAmount(minor);
}

function compareMinor(
  label: string,
  headerValue: Invoice[keyof Invoice],
  calculatedMinor: number,
  issues: TotalValidationIssue[]
) {
  const expectedMinor = invoiceMoneyToMinor(headerValue as never);
  if (expectedMinor !== calculatedMinor) {
    issues.push({
      field: label,
      message: `${label} uyuşmuyor (beklenen ${minorToXml(expectedMinor)}, hesaplanan ${minorToXml(calculatedMinor)}).`,
    });
  }
}

export function validateInvoiceTotals(invoice: Invoice, items: InvoiceItem[]): TotalValidationResult {
  const issues: TotalValidationIssue[] = [];

  const lineNetSum = items.reduce((sum, item) => sum + invoiceMoneyToMinor(item.lineNetAmount), 0);
  const vatSum = items.reduce((sum, item) => sum + invoiceMoneyToMinor(item.vatAmount), 0);
  const grossSum = items.reduce((sum, item) => sum + invoiceMoneyToMinor(item.lineGrossAmount), 0);
  const discountSum = items.reduce((sum, item) => sum + invoiceMoneyToMinor(item.discountAmount), 0);

  compareMinor("taxableAmount", invoice.taxableAmount, lineNetSum, issues);
  compareMinor("totalVat", invoice.totalVat, vatSum, issues);
  compareMinor("total", invoice.total, grossSum, issues);
  compareMinor("totalDiscount", invoice.totalDiscount, discountSum, issues);

  if (invoice.financialSnapshotStatus === "NEEDS_REVIEW") {
    issues.push({
      field: "financialSnapshotStatus",
      message: "Fatura finansal snapshot durumu tamamlanmamış (NEEDS_REVIEW).",
    });
  }

  const headerTotal = minorToXml(invoiceMoneyToMinor(invoice.total));
  if (headerTotal === "0.00" && items.length > 0) {
    issues.push({
      field: "total",
      message: "Fatura toplamı sıfır olamaz.",
    });
  }

  return { ok: issues.length === 0, issues };
}

export function validateFinancialSnapshotTotals(input: {
  financial: InvoiceFinancialSnapshot;
  lineSnapshots: InvoiceLineSnapshot[];
}): TotalValidationResult {
  const issues: TotalValidationIssue[] = [];

  const lineNetSum = input.lineSnapshots.reduce(
    (sum, item) => sum + xmlAmountToMinor(item.lineNetAmount),
    0
  );
  const vatSum = input.lineSnapshots.reduce(
    (sum, item) => sum + xmlAmountToMinor(item.vatAmount),
    0
  );
  const grossSum = input.lineSnapshots.reduce(
    (sum, item) => sum + xmlAmountToMinor(item.lineGrossAmount),
    0
  );
  const discountSum = input.lineSnapshots.reduce(
    (sum, item) => sum + xmlAmountToMinor(item.discountAmount),
    0
  );

  function compareSnapshot(label: keyof InvoiceFinancialSnapshot, calculatedMinor: number) {
    const field = input.financial[label];
    if (typeof field !== "string") return;
    const expectedMinor = xmlAmountToMinor(field);
    if (expectedMinor !== calculatedMinor) {
      issues.push({
        field: label,
        message: `${label} uyuşmuyor (beklenen ${minorToXml(expectedMinor)}, hesaplanan ${minorToXml(calculatedMinor)}).`,
      });
    }
  }

  compareSnapshot("taxableAmount", lineNetSum);
  compareSnapshot("totalVat", vatSum);
  compareSnapshot("total", grossSum);
  compareSnapshot("totalDiscount", discountSum);

  if (input.financial.status === "NEEDS_REVIEW") {
    issues.push({
      field: "financialSnapshotStatus",
      message: "Fatura finansal snapshot durumu tamamlanmamış (NEEDS_REVIEW).",
    });
  }

  if (input.financial.total === "0.00" && input.lineSnapshots.length > 0) {
    issues.push({
      field: "total",
      message: "Fatura toplamı sıfır olamaz.",
    });
  }

  return { ok: issues.length === 0, issues };
}
