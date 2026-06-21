import {
  getSupplierSummary,
  syncAllSupplierBalances,
} from "@/lib/supplier-balance-service";
import { getSuppliers } from "@/lib/supplier-service";
import { SUPPLIER_CATEGORIES } from "@/lib/supplier-utils";
import {
  formatSupplierMoney,
  parseCategoryFilter,
  parseFavoriteFilter,
  parsePage,
  parseSearchQuery,
  parseSupplierTab,
  toSupplierTableRow,
  type SupplierStatCard,
  type SupplierTabKey,
} from "@/lib/suppliers-page-utils";

export const SUPPLIERS_PAGE_SIZE = 10;

export {
  buildSuppliersExportQuery,
  buildSuppliersQuery,
  formatSupplierMoney,
  getCategoryBadge,
  getInitials,
  getSupplierBalanceStatus,
  getSupplierStatusBadge,
  parseCategoryFilter,
  parseFavoriteFilter,
  parsePage,
  parseSearchQuery,
  parseSupplierTab,
  SUPPLIER_TAB_LABELS,
} from "@/lib/suppliers-page-utils";

function filterByTab<T extends { isActive: boolean; balance: number; overdueAmount: number }>(
  rows: T[],
  tab: SupplierTabKey
) {
  switch (tab) {
    case "active":
      return rows.filter((row) => row.isActive);
    case "passive":
      return rows.filter((row) => !row.isActive);
    case "payable":
      return rows.filter((row) => row.balance > 0);
    case "overdue":
      return rows.filter((row) => row.overdueAmount > 0);
    default:
      return rows;
  }
}

export function parseSuppliersPageOptions(params: {
  tab?: string;
  q?: string;
  category?: string;
  favorite?: string;
  page?: string;
}) {
  return {
    tab: parseSupplierTab(params.tab),
    q: parseSearchQuery(params.q),
    category: parseCategoryFilter(params.category),
    favorite: parseFavoriteFilter(params.favorite),
    page: parsePage(params.page),
  };
}

export async function getSuppliersPageData(
  companyId: string,
  options: ReturnType<typeof parseSuppliersPageOptions>
) {
  const allRows = await getSuppliers({
    companyId,
    search: options.q,
    category: options.category,
    isFavorite: options.favorite || null,
  });

  const summary = await getSupplierSummary(companyId);

  const statCards: SupplierStatCard[] = [
    {
      title: "Toplam Tedarikçi",
      value: String(summary.total),
      subtitle: `Aktif: ${summary.active}`,
      secondSubtitle: `Favori: ${summary.favorite}`,
      iconKey: "truck",
      color: "emerald",
    },
    {
      title: "Toplam Borç",
      value: formatSupplierMoney(summary.payableTotal),
      subtitle: "Açık tedarikçi bakiyesi",
      iconKey: "wallet",
      color: "rose",
    },
    {
      title: "Bu Ay Ödenen",
      value: formatSupplierMoney(summary.thisMonthPaid),
      subtitle: `Bu ay alış: ${formatSupplierMoney(summary.thisMonthPurchases)}`,
      iconKey: "check",
      color: "emerald",
    },
    {
      title: "Vadesi Geçen",
      value: formatSupplierMoney(summary.overduePayable),
      subtitle: "Ödeme bekleyen kayıtlar",
      iconKey: "bell",
      color: "orange",
    },
    {
      title: "Ürün Bağlantılı",
      value: String(summary.linkedProductSuppliers),
      subtitle: "Ürün eşleşmesi olan tedarikçi",
      iconKey: "package",
      color: "blue",
    },
  ];

  const tableSource = allRows.map((row, index) => ({
    ...toSupplierTableRow(row, index),
    balance: row.currentBalance,
    overdueAmount: row.overdueAmount,
    isActive: row.isActive,
  }));

  let filteredRows = filterByTab(tableSource, options.tab);

  const totalRecords = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / SUPPLIERS_PAGE_SIZE));
  const currentPage = Math.min(options.page, totalPages);
  const start = (currentPage - 1) * SUPPLIERS_PAGE_SIZE;
  const rows = filteredRows.slice(start, start + SUPPLIERS_PAGE_SIZE);

  const categories = Array.from(
    new Set([
      ...SUPPLIER_CATEGORIES,
      ...allRows.map((row) => row.category).filter(Boolean) as string[],
    ])
  ).sort((a, b) => a.localeCompare(b, "tr"));

  return {
    rows,
    statCards,
    categories,
    totalRecords,
    totalPages,
    currentPage,
    filters: options,
    totals: {
      all: allRows.length,
      active: allRows.filter((row) => row.isActive).length,
      passive: allRows.filter((row) => !row.isActive).length,
      payable: allRows.filter((row) => row.currentBalance > 0).length,
      overdue: allRows.filter((row) => row.overdueAmount > 0).length,
    },
  };
}

export async function syncSuppliersPageBalances(companyId: string) {
  return syncAllSupplierBalances(companyId);
}
