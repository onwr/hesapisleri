import {
  getCustomerGroupColorMap,
  getCustomerGroupNames,
} from "@/lib/customer-group-service";
import { normalizeGroupName } from "@/lib/customer-group-utils";
import { db } from "@/lib/prisma";
import {
  endOfLastMonth,
  endOfMonth,
  startOfLastMonth,
  startOfMonth,
} from "@/lib/dashboard-metrics";
import {
  AVATAR_COLORS,
  formatCustomerMoney,
  type CustomerStatCard,
  type CustomerTabKey,
  type CustomerTableRow,
} from "@/lib/customers-page-utils";

export type { CustomerStatCard, CustomerTabKey, CustomerTableRow } from "@/lib/customers-page-utils";
export {
  buildCustomersExportQuery,
  buildCustomersQuery,
  buildSingleCustomerExportHref,
  CUSTOMER_TAB_LABELS,
  formatCustomerMoney,
  getBalanceStatus,
  getCustomerStatusBadge,
  getGroupBadge,
  getInitials,
  parseCustomerTab,
  parseGroupFilter,
  parsePage,
  parseSearchQuery,
} from "@/lib/customers-page-utils";

const PAGE_SIZE = 10;

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function matchesSearch(
  customer: {
    name: string;
    phone: string | null;
    email: string | null;
    taxNo: string | null;
  },
  query: string
) {
  const normalized = query.toLocaleLowerCase("tr-TR");

  return (
    customer.name.toLocaleLowerCase("tr-TR").includes(normalized) ||
    (customer.phone?.includes(query) ?? false) ||
    (customer.email?.toLocaleLowerCase("tr-TR").includes(normalized) ?? false) ||
    (customer.taxNo?.includes(query) ?? false)
  );
}

function filterByTab<T extends { status: string; balance: unknown }>(
  rows: T[],
  tab: CustomerTabKey
) {
  switch (tab) {
    case "active":
      return rows.filter((row) => row.status === "ACTIVE");
    case "passive":
      return rows.filter((row) => row.status !== "ACTIVE");
    case "debtors":
      return rows.filter((row) => Number(row.balance) > 0);
    case "receivables":
      return rows.filter((row) => Number(row.balance) < 0);
    default:
      return rows;
  }
}

function toTableRow(
  customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    taxNo: string | null;
    taxOffice?: string | null;
    group: string | null;
    balance: unknown;
    status: string;
  },
  index: number,
  groupColorMap: Record<string, string>
): CustomerTableRow {
  const groupName = normalizeGroupName(customer.group);

  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    taxNo: customer.taxNo,
    taxOffice: customer.taxOffice ?? null,
    group: groupName,
    groupColor: groupColorMap[groupName] ?? null,
    balance: Number(customer.balance),
    status: customer.status,
    avatarColorClass: AVATAR_COLORS[index % AVATAR_COLORS.length],
  };
}

export async function getCustomersPageData(
  companyId: string,
  options: {
    tab: CustomerTabKey;
    page: number;
    group?: string | null;
    q?: string | null;
  }
) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const lastMonthStart = startOfLastMonth(now);
  const lastMonthEnd = endOfLastMonth(now);
  const todayEnd = endOfDay(now);

  const [customers, overdueInvoices, groups, groupColorMap] = await Promise.all([
    db.customer.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    }),
    db.invoice.findMany({
      where: {
        companyId,
        paymentStatus: { in: ["UNPAID", "PARTIAL"] },
        OR: [{ dueDate: { lte: todayEnd } }, { dueDate: null }],
      },
      select: {
        total: true,
        customerId: true,
      },
    }),
    getCustomerGroupNames(companyId),
    getCustomerGroupColorMap(companyId),
  ]);

  const activeCustomers = customers.filter((customer) => customer.status === "ACTIVE");
  const passiveCustomers = customers.filter((customer) => customer.status !== "ACTIVE");
  const debtors = customers.filter((customer) => Number(customer.balance) > 0);
  const receivables = customers.filter((customer) => Number(customer.balance) < 0);

  const totalDebt = debtors.reduce(
    (sum, customer) => sum + Number(customer.balance),
    0
  );

  const totalReceivable = Math.abs(
    receivables.reduce((sum, customer) => sum + Number(customer.balance), 0)
  );

  const overdueTotal = overdueInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.total),
    0
  );

  const overdueCustomerCount = new Set(
    overdueInvoices.map((invoice) => invoice.customerId).filter(Boolean)
  ).size;

  const newThisMonth = customers.filter(
    (customer) =>
      customer.createdAt >= monthStart && customer.createdAt <= monthEnd
  ).length;

  const newLastMonth = customers.filter(
    (customer) =>
      customer.createdAt >= lastMonthStart && customer.createdAt <= lastMonthEnd
  ).length;

  const statCards: CustomerStatCard[] = [
    {
      title: "Toplam Müşteri",
      value: String(customers.length),
      subtitle: `Aktif: ${activeCustomers.length}`,
      secondSubtitle: `Pasif: ${passiveCustomers.length}`,
      iconKey: "users",
      color: "emerald",
    },
    {
      title: "Toplam Borç",
      value: formatCustomerMoney(totalDebt),
      subtitle: `${debtors.length} müşteri borçlu`,
      iconKey: "wallet",
      color: "rose",
    },
    {
      title: "Toplam Alacak",
      value: formatCustomerMoney(totalReceivable),
      subtitle: `${receivables.length} müşteri alacaklı`,
      iconKey: "check",
      color: "emerald",
    },
    {
      title: "Vadesi Gelen Borç",
      value: formatCustomerMoney(overdueTotal),
      subtitle: `${overdueCustomerCount} müşteri`,
      iconKey: "bell",
      color: "orange",
    },
    {
      title: "Bu Ay Yeni Müşteri",
      value: String(newThisMonth),
      subtitle: `Geçen ay: ${newLastMonth}`,
      iconKey: "userPlus",
      color: "blue",
    },
  ];

  let filteredCustomers = filterByTab(customers, options.tab);

  if (options.group) {
    filteredCustomers = filteredCustomers.filter(
      (customer) => normalizeGroupName(customer.group) === options.group
    );
  }

  if (options.q) {
    filteredCustomers = filteredCustomers.filter((customer) =>
      matchesSearch(customer, options.q!)
    );
  }

  const totalRecords = filteredCustomers.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
  const currentPage = Math.min(options.page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;

  const rows = filteredCustomers
    .slice(startIndex, startIndex + PAGE_SIZE)
    .map((customer, index) =>
      toTableRow(customer, startIndex + index, groupColorMap)
    );

  return {
    statCards,
    rows,
    groups,
    totalRecords,
    totalPages,
    currentPage,
    pageSize: PAGE_SIZE,
    totals: {
      all: customers.length,
      active: activeCustomers.length,
      passive: passiveCustomers.length,
      debtors: debtors.length,
      receivables: receivables.length,
    },
  };
}

export async function getCustomersExportRows(
  companyId: string,
  options: {
    tab: CustomerTabKey;
    group?: string | null;
    q?: string | null;
  }
) {
  const customers = await db.customer.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
  });

  let filteredCustomers = filterByTab(customers, options.tab);

  if (options.group) {
    filteredCustomers = filteredCustomers.filter(
      (customer) => normalizeGroupName(customer.group) === options.group
    );
  }

  if (options.q) {
    filteredCustomers = filteredCustomers.filter((customer) =>
      matchesSearch(customer, options.q!)
    );
  }

  return filteredCustomers;
}
