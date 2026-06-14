import type {
  EmployeeEmploymentType,
  EmployeeLeaveStatus,
  EmployeePayment,
  EmployeePaymentStatus,
  EmployeeSalaryPeriod,
  EmployeeStatus,
} from "@prisma/client";

export type EmployeeInput = {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  nationalId?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  departmentId?: string | null;
  employmentType?: EmployeeEmploymentType;
  status?: EmployeeStatus;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  birthDate?: string | Date | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  notes?: string | null;
  companyUserId?: string | null;
};

export type EmployeeBalanceSummary = {
  totalPending: number;
  totalPaid: number;
  totalDeductions: number;
  netPayable: number;
};

const STATUS_LABELS: Record<EmployeeStatus, string> = {
  ACTIVE: "Aktif",
  PASSIVE: "Pasif",
  ON_LEAVE: "İzinli",
  TERMINATED: "Sonlandırılmış",
};

const STATUS_BADGE: Record<EmployeeStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  PASSIVE: "bg-slate-100 text-slate-600 ring-slate-200",
  ON_LEAVE: "bg-amber-50 text-amber-700 ring-amber-100",
  TERMINATED: "bg-red-50 text-red-700 ring-red-100",
};

const EMPLOYMENT_LABELS: Record<EmployeeEmploymentType, string> = {
  FULL_TIME: "Tam zamanlı",
  PART_TIME: "Yarı zamanlı",
  CONTRACTOR: "Sözleşmeli",
  INTERN: "Stajyer",
  SEASONAL: "Mevsimlik",
};

const PAYMENT_STATUS_LABELS: Record<EmployeePaymentStatus, string> = {
  PENDING: "Bekliyor",
  PAID: "Ödendi",
  CANCELLED: "İptal",
  OVERDUE: "Gecikmiş",
};

const LEAVE_STATUS_LABELS: Record<EmployeeLeaveStatus, string> = {
  PENDING: "Onay bekliyor",
  APPROVED: "Onaylandı",
  REJECTED: "Reddedildi",
  CANCELLED: "İptal",
};

const SALARY_PERIOD_LABELS: Record<EmployeeSalaryPeriod, string> = {
  MONTHLY: "Aylık",
  WEEKLY: "Haftalık",
  DAILY: "Günlük",
  HOURLY: "Saatlik",
};

function trimOrNull(value?: string | null) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseOptionalDate(value?: string | Date | null) {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatEmployeeDisplayName(input: {
  firstName: string;
  lastName: string;
}) {
  return `${input.firstName.trim()} ${input.lastName.trim()}`.trim();
}

export function buildEmployeeActionUrl(employeeId: string) {
  return `/team/${employeeId}`;
}

export function normalizeEmployeeInput(input: EmployeeInput) {
  let firstName = trimOrNull(input.firstName) ?? "";
  let lastName = trimOrNull(input.lastName) ?? "";

  if (!firstName && !lastName && input.fullName) {
    const parts = input.fullName.trim().split(/\s+/);
    firstName = parts[0] ?? "";
    lastName = parts.slice(1).join(" ") || "";
  }

  return {
    firstName,
    lastName,
    email: trimOrNull(input.email),
    phone: trimOrNull(input.phone),
    avatarUrl: trimOrNull(input.avatarUrl),
    nationalId: trimOrNull(input.nationalId),
    jobTitle: trimOrNull(input.jobTitle),
    department: trimOrNull(input.department),
    employmentType: input.employmentType ?? "FULL_TIME",
    status: input.status ?? "ACTIVE",
    startDate: parseOptionalDate(input.startDate),
    endDate: parseOptionalDate(input.endDate),
    birthDate: parseOptionalDate(input.birthDate),
    address: trimOrNull(input.address),
    emergencyContactName: trimOrNull(input.emergencyContactName),
    emergencyContactPhone: trimOrNull(input.emergencyContactPhone),
    notes: trimOrNull(input.notes),
    companyUserId: input.companyUserId ?? null,
  };
}

export function validateEmployeeInput(input: ReturnType<typeof normalizeEmployeeInput>) {
  if (!input.firstName && !input.lastName) {
    return { ok: false as const, message: "Ad veya soyad zorunludur." };
  }

  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    return { ok: false as const, message: "Geçerli bir e-posta adresi girin." };
  }

  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    return { ok: false as const, message: "Bitiş tarihi başlangıçtan önce olamaz." };
  }

  return { ok: true as const };
}

export function getEmployeeStatusLabel(status: EmployeeStatus) {
  return STATUS_LABELS[status];
}

export function getEmployeeStatusBadgeClass(status: EmployeeStatus) {
  return STATUS_BADGE[status];
}

export function getEmploymentTypeLabel(type: EmployeeEmploymentType) {
  return EMPLOYMENT_LABELS[type];
}

export function getPaymentStatusLabel(status: EmployeePaymentStatus) {
  return PAYMENT_STATUS_LABELS[status];
}

export function getPaymentStatusBadgeClass(status: EmployeePaymentStatus) {
  const map: Record<EmployeePaymentStatus, string> = {
    PENDING: "bg-amber-50 text-amber-700 ring-amber-100",
    PAID: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    CANCELLED: "bg-slate-100 text-slate-600 ring-slate-200",
    OVERDUE: "bg-red-100 text-red-800 ring-2 ring-red-200",
  };
  return map[status];
}

export const PAYMENT_TYPE_HINTS: Record<
  import("@prisma/client").EmployeePaymentType,
  string
> = {
  SALARY: "Dönemsel maaş ödemesi",
  ADVANCE: "Maaştan mahsup edilebilir avans",
  BONUS: "Performans veya ek ödeme primi",
  DEDUCTION: "Maaştan düşülecek kesinti",
  EXPENSE_REIMBURSEMENT: "Personel masraf iadesi",
  OTHER: "Diğer personel ödemesi",
};

export function getLeaveStatusLabel(status: EmployeeLeaveStatus) {
  return LEAVE_STATUS_LABELS[status];
}

export function getSalaryPeriodLabel(period: EmployeeSalaryPeriod) {
  return SALARY_PERIOD_LABELS[period];
}

export function calculateLeaveDays(startAt: Date, endAt: Date) {
  const msPerDay = 1000 * 60 * 60 * 24;
  const diff = endAt.getTime() - startAt.getTime();
  if (diff < 0) return 0;
  return Math.ceil(diff / msPerDay) + 1;
}

export function calculateEmployeeBalance(
  payments: Pick<
    EmployeePayment,
    "amount" | "status" | "direction" | "type"
  >[]
): EmployeeBalanceSummary {
  let totalPending = 0;
  let totalPaid = 0;
  let totalDeductions = 0;

  for (const payment of payments) {
    const amount = Number(payment.amount);

    if (payment.status === "CANCELLED") continue;

    if (payment.direction === "DEDUCTED" || payment.type === "DEDUCTION") {
      totalDeductions += amount;
      continue;
    }

    if (payment.status === "PAID" || payment.direction === "PAID") {
      totalPaid += amount;
      continue;
    }

    if (
      payment.status === "PENDING" ||
      payment.status === "OVERDUE" ||
      payment.direction === "PAYABLE"
    ) {
      totalPending += amount;
    }
  }

  return {
    totalPending,
    totalPaid,
    totalDeductions,
    netPayable: totalPending - totalDeductions,
  };
}

const PAYMENT_TYPE_LABELS: Record<
  import("@prisma/client").EmployeePaymentType,
  string
> = {
  SALARY: "Maaş",
  ADVANCE: "Avans",
  BONUS: "Prim",
  DEDUCTION: "Kesinti",
  EXPENSE_REIMBURSEMENT: "Masraf iadesi",
  OTHER: "Diğer",
};

export function getPaymentTypeLabel(
  type: import("@prisma/client").EmployeePaymentType
) {
  return PAYMENT_TYPE_LABELS[type];
}

export function isEmployeeLeaveVisibleOnCalendar(
  status: import("@prisma/client").EmployeeLeaveStatus
) {
  return status === "APPROVED";
}

export type EmployeeTabKey =
  | "active"
  | "on_leave"
  | "passive"
  | "all";

export function parseEmployeeTab(value?: string | null): EmployeeTabKey {
  const allowed: EmployeeTabKey[] = [
    "active",
    "on_leave",
    "passive",
    "all",
  ];
  if (value && allowed.includes(value as EmployeeTabKey)) {
    return value as EmployeeTabKey;
  }
  if (value === "terminated" || value === "invites") {
    return value === "terminated" ? "passive" : "active";
  }
  return "active";
}

export type EmployeeSortKey =
  | "name"
  | "startDate"
  | "salary"
  | "createdAt";

export function parseEmployeeSort(value?: string | null): EmployeeSortKey {
  const allowed: EmployeeSortKey[] = ["name", "startDate", "salary", "createdAt"];
  if (value && allowed.includes(value as EmployeeSortKey)) {
    return value as EmployeeSortKey;
  }
  return "name";
}
