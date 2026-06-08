import {
  getCustomerGroupColorMap,
  getCustomerGroupNames,
} from "@/lib/customer-group-service";
import { normalizeGroupName } from "@/lib/customer-group-utils";
import { db } from "@/lib/prisma";

export type BulkBalanceType = "all" | "debtor" | "creditor" | "zero";

export type BulkStatusFilter = "all" | "ACTIVE" | "PASSIVE";

export type BulkActionsFilters = {
  group: string | null;
  status: BulkStatusFilter;
  balanceType: BulkBalanceType;
  search: string | null;
};

export type BulkActionCustomer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  taxNo: string | null;
  group: string;
  groupColor: string | null;
  balance: number;
  status: string;
};

export type BulkActionsSummary = {
  totalCustomers: number;
  selectedCustomers: number;
  withPhone: number;
  withEmail: number;
  debtorCount: number;
  selectedWithPhone: number;
  selectedWithEmail: number;
  totalDebt: number;
  totalCredit: number;
};

type CustomerBulkSourceRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  taxNo: string | null;
  group: string | null;
  balance: unknown;
  status: string;
};

export function parseBulkStatusFilter(value?: string | null): BulkStatusFilter {
  if (value === "ACTIVE" || value === "PASSIVE") {
    return value;
  }

  return "all";
}

export function parseBulkBalanceType(value?: string | null): BulkBalanceType {
  if (value === "debtor" || value === "creditor" || value === "zero") {
    return value;
  }

  return "all";
}

export function parseBulkSearch(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function parseBulkGroupFilter(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? normalizeGroupName(trimmed) : null;
}

export function parseBulkFilters(searchParams: {
  group?: string | null;
  status?: string | null;
  balanceType?: string | null;
  search?: string | null;
}): BulkActionsFilters {
  return {
    group: parseBulkGroupFilter(searchParams.group),
    status: parseBulkStatusFilter(searchParams.status),
    balanceType: parseBulkBalanceType(searchParams.balanceType),
    search: parseBulkSearch(searchParams.search),
  };
}

export function matchesBulkSearch(
  customer: CustomerBulkSourceRow,
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

export function matchesBulkBalanceFilter(
  balance: number,
  balanceType: BulkBalanceType
) {
  switch (balanceType) {
    case "debtor":
      return balance > 0;
    case "creditor":
      return balance < 0;
    case "zero":
      return balance === 0;
    default:
      return true;
  }
}

export function matchesBulkStatusFilter(
  status: string,
  statusFilter: BulkStatusFilter
) {
  if (statusFilter === "all") {
    return true;
  }

  if (statusFilter === "ACTIVE") {
    return status === "ACTIVE";
  }

  return status !== "ACTIVE";
}

export function mapBulkCustomerRow(
  customer: CustomerBulkSourceRow,
  groupColorMap: Record<string, string | null>
): BulkActionCustomer {
  const groupName = normalizeGroupName(customer.group);

  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    taxNo: customer.taxNo,
    group: groupName,
    groupColor: groupColorMap[groupName] ?? null,
    balance: Number(customer.balance),
    status: customer.status,
  };
}

export function filterBulkCustomers(
  customers: BulkActionCustomer[],
  filters: BulkActionsFilters
) {
  return customers.filter((customer) => {
    if (filters.group && customer.group !== filters.group) {
      return false;
    }

    if (!matchesBulkStatusFilter(customer.status, filters.status)) {
      return false;
    }

    if (!matchesBulkBalanceFilter(customer.balance, filters.balanceType)) {
      return false;
    }

    if (filters.search && !matchesBulkSearch(
      {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        taxNo: customer.taxNo,
        group: customer.group,
        balance: customer.balance,
        status: customer.status,
      },
      filters.search
    )) {
      return false;
    }

    return true;
  });
}

export function summarizeBulkActions(
  customers: BulkActionCustomer[],
  selectedIds?: Set<string> | string[]
): BulkActionsSummary {
  const selectedSet =
    selectedIds instanceof Set
      ? selectedIds
      : new Set(selectedIds ?? []);

  const selectedCustomers =
    selectedSet.size > 0
      ? customers.filter((customer) => selectedSet.has(customer.id))
      : [];

  let withPhone = 0;
  let withEmail = 0;
  let debtorCount = 0;
  let selectedWithPhone = 0;
  let selectedWithEmail = 0;
  let totalDebt = 0;
  let totalCredit = 0;

  for (const customer of customers) {
    if (customer.phone?.trim()) withPhone += 1;
    if (customer.email?.trim()) withEmail += 1;
    if (customer.balance > 0) debtorCount += 1;
  }

  for (const customer of selectedCustomers) {
    if (customer.phone?.trim()) selectedWithPhone += 1;
    if (customer.email?.trim()) selectedWithEmail += 1;

    if (customer.balance > 0) {
      totalDebt += customer.balance;
    } else if (customer.balance < 0) {
      totalCredit += Math.abs(customer.balance);
    }
  }

  return {
    totalCustomers: customers.length,
    selectedCustomers: selectedCustomers.length,
    withPhone,
    withEmail,
    debtorCount,
    selectedWithPhone,
    selectedWithEmail,
    totalDebt,
    totalCredit,
  };
}

export async function getBulkCustomersList(
  companyId: string,
  filters: BulkActionsFilters
) {
  const [groups, groupColorMap, customers] = await Promise.all([
    getCustomerGroupNames(companyId),
    getCustomerGroupColorMap(companyId),
    db.customer.findMany({
      where: { companyId },
      orderBy: [{ group: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        taxNo: true,
        group: true,
        balance: true,
        status: true,
      },
    }),
  ]);

  const rows = customers.map((customer: CustomerBulkSourceRow) =>
    mapBulkCustomerRow(customer, groupColorMap)
  );

  const filteredCustomers = filterBulkCustomers(rows, filters);
  const summary = summarizeBulkActions(filteredCustomers);

  return {
    groups,
    customers: filteredCustomers,
    summary,
  };
}

export async function getBulkCustomersExportRows(
  companyId: string,
  filters: BulkActionsFilters,
  selectedIds?: string[]
) {
  const { customers } = await getBulkCustomersList(companyId, filters);

  if (!selectedIds?.length) {
    return customers;
  }

  const idSet = new Set(selectedIds);
  return customers.filter((customer) => idSet.has(customer.id));
}

export async function getBulkActionsPageData(
  companyId: string,
  filters: BulkActionsFilters
) {
  return getBulkCustomersList(companyId, filters);
}
