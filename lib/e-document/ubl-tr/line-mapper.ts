import type { InvoiceItem } from "@prisma/client";
import type { InvoiceLineSnapshot } from "@/lib/e-document/invoice-e-document-snapshot-types";
import { decimalToXmlAmount, quantityToXml } from "@/lib/e-document/ubl-tr/decimal-format";
import { resolveUnitCode } from "@/lib/e-document/ubl-tr/unit-codes";

export type LineFieldIssue = {
  field: string;
  message: string;
  lineIndex: number;
};

export type MappedInvoiceLine = {
  lineIndex: number;
  id: number;
  name: string;
  quantity: string;
  unitCode: string;
  unitPrice: string;
  discountAmount: string;
  lineNetAmount: string;
  vatRate: string;
  vatAmount: string;
  lineGrossAmount: string;
};

export function mapInvoiceLines(items: InvoiceItem[]): {
  lines: MappedInvoiceLine[];
  issues: LineFieldIssue[];
} {
  const issues: LineFieldIssue[] = [];
  const lines: MappedInvoiceLine[] = [];

  const sorted = items.slice().sort((a, b) => a.lineIndex - b.lineIndex);

  for (const [index, item] of sorted.entries()) {
    const lineNo = item.lineIndex || index + 1;
    const productName = item.productName?.trim();
    if (!productName) {
      issues.push({
        field: "line.productName",
        message: "Ürün adı snapshot alanı zorunludur.",
        lineIndex: lineNo,
      });
    }

    const unit = resolveUnitCode(item.unit);
    if (!unit.ok) {
      issues.push({
        field: "line.unit",
        message: unit.message,
        lineIndex: lineNo,
      });
    }

    if (issues.some((issue) => issue.lineIndex === lineNo)) {
      continue;
    }

    lines.push({
      lineIndex: lineNo,
      id: index + 1,
      name: productName!,
      quantity: quantityToXml(item.quantity),
      unitCode: unit.ok ? unit.code : "",
      unitPrice: decimalToXmlAmount(item.unitPrice),
      discountAmount: decimalToXmlAmount(item.discountAmount),
      lineNetAmount: decimalToXmlAmount(item.lineNetAmount),
      vatRate: decimalToXmlAmount(item.vatRate),
      vatAmount: decimalToXmlAmount(item.vatAmount),
      lineGrossAmount: decimalToXmlAmount(item.lineGrossAmount),
    });
  }

  if (sorted.length === 0) {
    issues.push({
      field: "invoice.items",
      message: "Faturada en az bir kalem olmalıdır.",
      lineIndex: 0,
    });
  }

  return { lines, issues };
}

export function mapInvoiceLinesFromSnapshots(snapshots: InvoiceLineSnapshot[]): {
  lines: MappedInvoiceLine[];
  issues: LineFieldIssue[];
} {
  const issues: LineFieldIssue[] = [];
  const lines: MappedInvoiceLine[] = [];

  if (snapshots.length === 0) {
    issues.push({
      field: "invoice.lineSnapshots",
      message: "Fatura satır snapshot kaydı bulunamadı.",
      lineIndex: 0,
    });
    return { lines, issues };
  }

  const sorted = snapshots.slice().sort((a, b) => a.lineIndex - b.lineIndex);

  for (const [index, item] of sorted.entries()) {
    const lineNo = item.lineIndex || index + 1;
    if (!item.productName?.trim()) {
      issues.push({
        field: "line.productName",
        message: "Ürün adı snapshot alanı zorunludur.",
        lineIndex: lineNo,
      });
      continue;
    }

    if (!item.unit?.trim()) {
      issues.push({
        field: "line.unit",
        message: "Birim kodu snapshot alanı zorunludur.",
        lineIndex: lineNo,
      });
      continue;
    }

    lines.push({
      lineIndex: lineNo,
      id: index + 1,
      name: item.productName.trim(),
      quantity: item.quantity,
      unitCode: item.unit,
      unitPrice: item.unitPrice,
      discountAmount: item.discountAmount,
      lineNetAmount: item.lineNetAmount,
      vatRate: item.vatRate,
      vatAmount: item.vatAmount,
      lineGrossAmount: item.lineGrossAmount,
    });
  }

  return { lines, issues };
}
