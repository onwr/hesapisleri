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
  parseSupplierCustomerRoleFilter,
  parseSupplierLastActivityFrom,
  parseSupplierListBalanceDirection,
  parseSupplierStatusFilter,
  parseSupplierTab,
  toSupplierTableRow,
  type SupplierListBalanceDirection,
  type SupplierStatCard,
  type SupplierTabKey,
} from "@/lib/suppliers-page-utils";
import type { GetSuppliersOptions } from "@/lib/supplier-service";

export const SUPPLIERS_PAGE_SIZE = 10;

export {
  buildSuppliersExportQuery,
  buildSuppliersLedgerExportQuery,
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

function tabToSupplierQuery(tab: SupplierTabKey): Partial<GetSuppliersOptions> {
  switch (tab) {
    case "active":
      return { isActive: true };
    case "passive":
      return { isActive: false };
    case "payable":
      return { balanceDirection: "PAYABLE" };
    case "overdue":
      return { balanceStatus: "overdue" };
    default:
      return {};
  }
}

export type SuppliersPageOptions = {
  tab: SupplierTabKey;
  q: string | null;
  category: string | null;
  favorite: boolean;
  page: number;
  balanceDirection: SupplierListBalanceDirection;
  customerRole: "all" | "with" | "without";
  lastActivityFrom: Date | null;
  status: "all" | "active" | "passive";
};

export function parseSuppliersPageOptions(params: {
  tab?: string;
  q?: string;
  category?: string;
  favorite?: string;
  page?: string;
  balanceDirection?: string;
  customerRole?: string;
  lastActivityFrom?: string;
  status?: string;
}) {
  const tab = parseSupplierTab(params.tab);
  const statusFilter = parseSupplierStatusFilter(params.status);

  const status: "all" | "active" | "passive" =
    statusFilter !== "all"
      ? statusFilter
      : tab === "active"
        ? "active"
        : tab === "passive"
          ? "passive"
          : "all";

  return {
    tab,
    q: parseSearchQuery(params.q),
    category: parseCategoryFilter(params.category),
    favorite: parseFavoriteFilter(params.favorite),
    page: parsePage(params.page),
    balanceDirection: parseSupplierListBalanceDirection(params.balanceDirection),
    customerRole: parseSupplierCustomerRoleFilter(params.customerRole),
    lastActivityFrom: parseSupplierLastActivityFrom(params.lastActivityFrom),
    status,
  } satisfies SuppliersPageOptions;
}

export async function getSuppliersPageData(
  companyId: string,
  options: ReturnType<typeof parseSuppliersPageOptions>
) {
  const tabFilters = tabToSupplierQuery(options.tab);

  const allRows = await getSuppliers({
    companyId,
    search: options.q,
    category: options.category,
    isFavorite: options.favorite || null,
    ...tabFilters,
    ...(options.balanceDirection !== "all"
      ? { balanceDirection: options.balanceDirection }
      : {}),
    ...(options.customerRole === "with"
      ? { hasCustomerRole: true }
      : options.customerRole === "without"
        ? { hasCustomerRole: false }
        : {}),
    ...(options.lastActivityFrom
      ? { lastActivityFrom: options.lastActivityFrom }
      : {}),
    ...(options.status === "active"
      ? { isActive: true }
      : options.status === "passive"
        ? { isActive: false }
        : {}),
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
      title: "Toplam Tedarikçiye Borç",
      value: formatSupplierMoney(summary.payableTotal),
      subtitle: `Tedarikçiden alacak: ${formatSupplierMoney(summary.receivableTotal)}`,
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

  const tableSource = allRows.map((row, index) => toSupplierTableRow(row, index));

  const totalRecords = tableSource.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / SUPPLIERS_PAGE_SIZE));
  const currentPage = Math.min(options.page, totalPages);
  const start = (currentPage - 1) * SUPPLIERS_PAGE_SIZE;
  const rows = tableSource.slice(start, start + SUPPLIERS_PAGE_SIZE);

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
