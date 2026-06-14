import type { SerializedEmployee } from "@/lib/employee-page-types";
import {
  parseEmployeeSort,
  parseEmployeeTab,
  type EmployeeSortKey,
  type EmployeeTabKey,
} from "@/lib/employee-utils";

export type EmployeeStats = {
  activeCount: number;
  onLeaveCount: number;
  passiveCount: number;
  terminatedCount: number;
  totalCount: number;
  monthlyPayable: number;
  pendingLeaveCount: number;
  pendingPaymentCount: number;
  withUserAccountCount: number;
  withPosAccessCount: number;
  salesThisMonthEmployeeCount: number;
  thisMonthSalesTotal: number;
};

export function buildEmployeePageQuery(input: {
  tab?: EmployeeTabKey;
  q?: string;
  department?: string;
  jobTitle?: string;
  status?: string;
  employmentType?: string;
  sort?: EmployeeSortKey;
}) {
  const params = new URLSearchParams();
  if (input.tab && input.tab !== "active") params.set("tab", input.tab);
  if (input.q) params.set("q", input.q);
  if (input.department) params.set("department", input.department);
  if (input.jobTitle) params.set("jobTitle", input.jobTitle);
  if (input.status) params.set("status", input.status);
  if (input.employmentType) params.set("employmentType", input.employmentType);
  if (input.sort && input.sort !== "name") params.set("sort", input.sort);
  const qs = params.toString();
  return qs ? `/team?${qs}` : "/team";
}

export function applyEmployeeFilters(input: {
  employees: SerializedEmployee[];
  tab: EmployeeTabKey;
  search: string;
  department: string;
  jobTitle: string;
  status: string;
  employmentType: string;
  sort: EmployeeSortKey;
}) {
  let rows = [...input.employees];

  if (input.tab === "active") {
    rows = rows.filter((e) => e.status === "ACTIVE");
  } else if (input.tab === "on_leave") {
    rows = rows.filter((e) => e.status === "ON_LEAVE");
  } else if (input.tab === "passive") {
    rows = rows.filter((e) => e.status === "PASSIVE");
  }

  if (input.search.trim()) {
    const q = input.search.trim().toLowerCase();
    rows = rows.filter(
      (e) =>
        e.fullName.toLowerCase().includes(q) ||
        (e.email?.toLowerCase().includes(q) ?? false) ||
        (e.phone?.includes(q) ?? false) ||
        (e.jobTitle?.toLowerCase().includes(q) ?? false) ||
        (e.department?.toLowerCase().includes(q) ?? false)
    );
  }

  if (input.department) {
    rows = rows.filter((e) => e.department === input.department);
  }

  if (input.jobTitle) {
    rows = rows.filter((e) => e.jobTitle === input.jobTitle);
  }

  if (input.status) {
    rows = rows.filter((e) => e.status === input.status);
  }

  if (input.employmentType) {
    rows = rows.filter((e) => e.employmentType === input.employmentType);
  }

  if (input.sort === "salary") {
    rows.sort(
      (a, b) =>
        (b.activeSalary?.amount ?? 0) - (a.activeSalary?.amount ?? 0)
    );
  } else if (input.sort === "startDate") {
    rows.sort((a, b) => {
      const da = a.startDate ? new Date(a.startDate).getTime() : 0;
      const db = b.startDate ? new Date(b.startDate).getTime() : 0;
      return db - da;
    });
  } else if (input.sort === "createdAt") {
    rows.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } else {
    rows.sort((a, b) => a.fullName.localeCompare(b.fullName, "tr"));
  }

  return rows;
}

export function parseEmployeeSearch(value?: string | null) {
  return value?.trim() ?? "";
}

export function parseEmployeeDepartment(value?: string | null) {
  return value?.trim() ?? "";
}

export function parseEmployeeJobTitle(value?: string | null) {
  return value?.trim() ?? "";
}

export function parseEmployeeStatusFilter(value?: string | null) {
  return value?.trim() ?? "";
}

export { parseEmployeeTab, parseEmployeeSort };
export type { EmployeeTabKey, EmployeeSortKey };

export const EMPLOYEE_TABS: { key: EmployeeTabKey; label: string }[] = [
  { key: "active", label: "Aktif" },
  { key: "on_leave", label: "İzinli" },
  { key: "passive", label: "Pasif" },
  { key: "all", label: "Tümü" },
];

export const EMPLOYEE_SORT_OPTIONS: { value: EmployeeSortKey; label: string }[] =
  [
    { value: "name", label: "Ada göre" },
    { value: "startDate", label: "Başlangıç tarihi" },
    { value: "salary", label: "Maaş" },
    { value: "createdAt", label: "Eklenme tarihi" },
  ];

export const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "", label: "Tüm istihdam tipleri" },
  { value: "FULL_TIME", label: "Tam zamanlı" },
  { value: "PART_TIME", label: "Yarı zamanlı" },
  { value: "CONTRACTOR", label: "Sözleşmeli" },
  { value: "INTERN", label: "Stajyer" },
  { value: "SEASONAL", label: "Mevsimlik" },
];

export const EMPLOYEE_STATUS_FILTER_OPTIONS = [
  { value: "", label: "Tüm durumlar" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "ON_LEAVE", label: "İzinli" },
  { value: "PASSIVE", label: "Pasif" },
  { value: "TERMINATED", label: "Sonlandırılmış" },
];

export function getEmployeeInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function formatEmployeeDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatEmployeePaymentSummary(employee: SerializedEmployee) {
  if (employee.paymentSummary.pendingCount > 0) {
    return `${employee.paymentSummary.pendingCount} bekleyen · ${employee.paymentSummary.netPayable.toLocaleString("tr-TR")} ₺`;
  }
  return employee.paymentSummary.netPayable > 0
    ? `${employee.paymentSummary.netPayable.toLocaleString("tr-TR")} ₺`
    : "—";
}

export function formatEmployeePerformanceSummary(employee: SerializedEmployee) {
  if (employee.performanceSummary.thisMonthSaleCount <= 0) {
    return "Bu ay satış yok";
  }
  return `${employee.performanceSummary.thisMonthSaleCount} satış · ${employee.performanceSummary.thisMonthSales.toLocaleString("tr-TR")} ₺`;
}
