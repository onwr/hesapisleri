import { db } from "@/lib/prisma";
import { SUPPLIER_BALANCE_LABELS } from "@/lib/supplier-balance-utils";
import { getSupplierDetailLedgerData } from "@/lib/supplier-detail-ledger-data";
import { formatSupplierMoney, escapeCsvCell, getSupplierDisplayName } from "@/lib/supplier-utils";
import type { SupplierLedgerRowType } from "@/lib/supplier-ledger-utils";

export type SupplierLedgerExportFilters = {
  companyId: string;
  supplierId?: string | null;
  from?: Date | null;
  to?: Date | null;
  type?: SupplierLedgerRowType | "all";
  accountId?: string | null;
  balanceDirection?: "PAYABLE" | "RECEIVABLE" | "SETTLED" | "all";
};

const CSV_HEADERS = [
  "Tedarikçi",
  "Tarih",
  "Hareket Türü",
  "Açıklama",
  "Borç",
  "Alacak",
  "Hareket Sonrası Bakiye",
  "Cari Yön",
  "İlişkili Belge",
  "Kasa/Banka Hesabı",
] as const;

function matchesDate(rowDate: string, from?: Date | null, to?: Date | null) {
  const date = new Date(rowDate);
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export async function buildSupplierLedgerExportCsv(filters: SupplierLedgerExportFilters) {
  const suppliers = await db.supplier.findMany({
    where: {
      companyId: filters.companyId,
      ...(filters.supplierId ? { id: filters.supplierId } : {}),
    },
    select: { id: true, name: true, companyName: true, currency: true },
    orderBy: { name: "asc" },
  });

  const lines: string[] = [CSV_HEADERS.join(",")];

  for (const supplier of suppliers) {
    const ledgerData = await getSupplierDetailLedgerData(filters.companyId, supplier.id);
    if (!ledgerData) continue;

    const currency = supplier.currency ?? "TRY";
    const supplierName = getSupplierDisplayName(supplier);

    for (const row of ledgerData.ledger) {
      if (!matchesDate(row.date, filters.from, filters.to)) continue;
      if (filters.type && filters.type !== "all" && row.type !== filters.type) continue;
      if (filters.accountId && row.accountId !== filters.accountId) continue;
      if (
        filters.balanceDirection &&
        filters.balanceDirection !== "all" &&
        row.balanceDirection !== filters.balanceDirection
      ) {
        continue;
      }

      const balanceLabel =
        row.balanceDirection === "SETTLED"
          ? SUPPLIER_BALANCE_LABELS.SETTLED
          : formatSupplierMoney(Math.abs(row.balance), currency);

      lines.push(
        [
          supplierName,
          new Date(row.date).toISOString(),
          row.typeLabel,
          row.description,
          row.debit > 0 ? formatSupplierMoney(row.debit, currency) : "",
          row.credit > 0 ? formatSupplierMoney(row.credit, currency) : "",
          balanceLabel,
          SUPPLIER_BALANCE_LABELS[row.balanceDirection],
          row.relatedEntityHref ?? "",
          row.accountName ?? "",
        ]
          .map((cell) => escapeCsvCell(String(cell)))
          .join(",")
      );
    }
  }

  return `\uFEFF${lines.join("\n")}`;
}
