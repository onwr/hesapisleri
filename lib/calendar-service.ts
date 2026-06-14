import type {
  CalendarEventType,
  EmployeeLeave,
  EmployeePayment,
  Expense,
  Invoice,
  MembershipPayment,
  Sale,
} from "@prisma/client";
import { db } from "@/lib/prisma";
import { getInvoiceRemainingAmount } from "@/lib/invoice-payment-utils";
import {
  buildEmployeeActionUrl,
  formatEmployeeDisplayName,
} from "@/lib/employee-utils";
import { buildPayrollRunActionUrl } from "@/lib/payroll-utils";
import {
  isSystemEventId,
  isDateInRange,
  normalizeCalendarEvent,
  rangesOverlap,
  resolveCollectionDueDate,
  type NormalizedCalendarEvent,
  validateCalendarEventInput,
} from "@/lib/calendar-utils";
import { activeSaleStatusFilter, isActiveSaleStatus } from "@/lib/sale-query-utils";
import { getSaleRemainingAmount } from "@/lib/sale-payment-utils";

export class CalendarServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "CalendarServiceError";
    this.status = status;
  }
}

type InvoiceWithCustomer = Invoice & {
  customer: { name: string } | null;
};

type SaleWithCustomer = Sale & {
  customer: { name: string } | null;
};

export function buildInvoiceCollectionEvents(
  invoices: InvoiceWithCustomer[],
  from: Date,
  to: Date,
  defaultDueDays: number
): NormalizedCalendarEvent[] {
  return invoices
    .filter(
      (invoice) =>
        (invoice.paymentStatus === "UNPAID" ||
          invoice.paymentStatus === "PARTIAL") &&
        invoice.status !== "CANCELLED" &&
        invoice.status !== "DRAFT"
    )
    .map((invoice) => {
      const dueDate = resolveCollectionDueDate({
        issueDate: invoice.createdAt,
        dueDate: invoice.dueDate,
        defaultDueDays,
      });
      const remaining = getInvoiceRemainingAmount(
        Number(invoice.total),
        Number(invoice.paidAmount)
      );

      return { invoice, dueDate, remaining };
    })
    .filter(
      ({ dueDate, remaining }) =>
        remaining > 0 && isDateInRange(dueDate, from, to)
    )
    .map(({ invoice, dueDate, remaining }) =>
      normalizeCalendarEvent(
        {
          id: `system:invoice:${invoice.id}`,
          companyId: invoice.companyId,
          userId: null,
          type: "PAYMENT",
          title: `Yaklaşan tahsilat: ${invoice.customer?.name ?? invoice.invoiceNo}`,
          description: invoice.invoiceNo,
          startAt: dueDate,
          endAt: null,
          allDay: true,
          amount: remaining,
          currency: "TRY",
          color: "orange",
          status: "SCHEDULED",
          source: "SYSTEM",
          relatedType: "INVOICE",
          relatedId: invoice.id,
        },
        true
      )
    );
}

/** @deprecated Use buildInvoiceCollectionEvents */
export const buildInvoiceSystemEvents = buildInvoiceCollectionEvents;

export function buildSaleCollectionEvents(
  sales: SaleWithCustomer[],
  from: Date,
  to: Date,
  defaultDueDays: number
): NormalizedCalendarEvent[] {
  return sales
    .filter(
      (sale) =>
        isActiveSaleStatus(sale.status) &&
        (sale.paymentStatus === "UNPAID" || sale.paymentStatus === "PARTIAL")
    )
    .map((sale) => {
      const dueDate = resolveCollectionDueDate({
        issueDate: sale.createdAt,
        defaultDueDays,
      });
      const remaining = getSaleRemainingAmount(
        Number(sale.total),
        Number(sale.paidAmount)
      );

      return { sale, dueDate, remaining };
    })
    .filter(
      ({ dueDate, remaining }) =>
        remaining > 0 && isDateInRange(dueDate, from, to)
    )
    .map(({ sale, dueDate, remaining }) =>
      normalizeCalendarEvent(
        {
          id: `system:sale:${sale.id}`,
          companyId: sale.companyId,
          userId: sale.userId,
          type: "PAYMENT",
          title: `Yaklaşan tahsilat: ${sale.customer?.name ?? sale.saleNo}`,
          description: sale.saleNo,
          startAt: dueDate,
          endAt: null,
          allDay: true,
          amount: remaining,
          currency: "TRY",
          color: "orange",
          status: "SCHEDULED",
          source: "SYSTEM",
          relatedType: "SALE",
          relatedId: sale.id,
        },
        true
      )
    );
}

export function buildExpenseSystemEvents(
  expenses: Expense[],
  from: Date,
  to: Date
): NormalizedCalendarEvent[] {
  return expenses
    .filter(
      (expense) =>
        expense.paymentStatus === "UNPAID" && expense.status !== "CANCELLED"
    )
    .filter((expense) => {
      const eventDate = expense.date;
      return isDateInRange(eventDate, from, to);
    })
    .map((expense) =>
      normalizeCalendarEvent(
        {
          id: `system:expense:${expense.id}`,
          companyId: expense.companyId,
          userId: expense.userId,
          type: "PAYMENT",
          title: `Gider ödemesi: ${expense.title}${expense.category ? ` (${expense.category})` : ""}`,
          description: expense.note,
          startAt: expense.date,
          endAt: null,
          allDay: true,
          amount: expense.amount,
          currency: "TRY",
          color: "amber",
          status: "SCHEDULED",
          source: "SYSTEM",
          relatedType: "EXPENSE",
          relatedId: expense.id,
        },
        true
      )
    );
}

export function buildMembershipSystemEvents(
  memberships: MembershipPayment[],
  from: Date,
  to: Date
): NormalizedCalendarEvent[] {
  return memberships
    .filter(
      (membership) =>
        membership.status === "PENDING" || membership.provider === "TRIAL"
    )
    .filter((membership) =>
      isDateInRange(membership.periodEnd, from, to)
    )
    .map((membership) =>
      normalizeCalendarEvent(
        {
          id: `system:membership:${membership.id}`,
          companyId: membership.companyId,
          userId: null,
          type: "PAYMENT",
          title:
            membership.provider === "TRIAL"
              ? "Üyelik/trial bitişi"
              : "Üyelik ödemesi vadesi",
          description: membership.paymentRef,
          startAt: membership.periodEnd,
          endAt: null,
          allDay: true,
          amount: membership.amount,
          currency: "TRY",
          color: "amber",
          status: "SCHEDULED",
          source: "SYSTEM",
          relatedType: "MEMBERSHIP",
          relatedId: membership.id,
        },
        true
      )
    );
}

type EmployeeLeaveWithEmployee = EmployeeLeave & {
  employee: { id: string; firstName: string; lastName: string };
};

type EmployeePaymentWithEmployee = EmployeePayment & {
  employee: { id: string; firstName: string; lastName: string };
};

export function buildEmployeeLeaveSystemEvents(
  leaves: EmployeeLeaveWithEmployee[],
  from: Date,
  to: Date
): NormalizedCalendarEvent[] {
  return leaves
    .filter(
      (leave) =>
        leave.status === "APPROVED" &&
        rangesOverlap(leave.startAt, leave.endAt, from, to)
    )
    .map((leave) => {
      const employeeName = formatEmployeeDisplayName(leave.employee);
      return normalizeCalendarEvent(
        {
          id: `system:employee-leave:${leave.id}`,
          companyId: leave.companyId,
          userId: null,
          type: "REMINDER",
          title: `${employeeName} izinli`,
          description: leave.reason,
          startAt: leave.startAt,
          endAt: leave.endAt,
          allDay: true,
          amount: null,
          currency: null,
          color: "purple",
          status: "SCHEDULED",
          source: "SYSTEM",
          relatedType: "EMPLOYEE_LEAVE",
          relatedId: leave.id,
          actionUrl: buildEmployeeActionUrl(leave.employee.id),
        },
        true
      );
    });
}

export function buildEmployeePaymentSystemEvents(
  payments: EmployeePaymentWithEmployee[],
  from: Date,
  to: Date
): NormalizedCalendarEvent[] {
  return payments
    .filter(
      (payment) =>
        (payment.status === "PENDING" || payment.status === "OVERDUE") &&
        payment.dueDate != null &&
        Number(payment.amount) > 0 &&
        isDateInRange(payment.dueDate, from, to)
    )
    .map((payment) => {
      const employeeName = formatEmployeeDisplayName(payment.employee);
      return normalizeCalendarEvent(
        {
          id: `system:employee-payment:${payment.id}`,
          companyId: payment.companyId,
          userId: null,
          type: "PAYMENT",
          title: `Çalışan ödemesi: ${employeeName}`,
          description: payment.description,
          startAt: payment.dueDate!,
          endAt: null,
          allDay: true,
          amount: payment.amount,
          currency: payment.currency,
          color: "orange",
          status: "SCHEDULED",
          source: "SYSTEM",
          relatedType: "EMPLOYEE_PAYMENT",
          relatedId: payment.id,
          actionUrl: `${buildEmployeeActionUrl(payment.employee.id)}?tab=payments`,
        },
        true
      );
    });
}

export function buildPayrollRunSystemEvents(
  runs: Array<{
    id: string;
    companyId: string;
    title: string;
    payDate: Date | null;
    netTotal: unknown;
    currency: string;
    status: string;
  }>,
  from: Date,
  to: Date
) {
  return runs
    .filter(
      (run) =>
        run.payDate != null &&
        run.status !== "CANCELLED" &&
        run.status !== "PAID" &&
        Number(run.netTotal) > 0 &&
        isDateInRange(run.payDate, from, to)
    )
    .map((run) =>
      normalizeCalendarEvent(
        {
          id: `system:payroll-run:${run.id}`,
          companyId: run.companyId,
          userId: null,
          type: "PAYMENT",
          title: `Bordro ödemesi: ${run.title}`,
          description: null,
          startAt: run.payDate!,
          endAt: null,
          allDay: true,
          amount: run.netTotal,
          currency: run.currency,
          color: "violet",
          status: "SCHEDULED",
          source: "SYSTEM",
          relatedType: "PAYROLL_RUN",
          relatedId: run.id,
          actionUrl: buildPayrollRunActionUrl(run.id),
        },
        true
      )
    );
}

function filterByTypes(
  events: NormalizedCalendarEvent[],
  types: CalendarEventType[]
) {
  const allowed = new Set(types);
  return events.filter((event) => allowed.has(event.type));
}

export async function getCalendarEvents(input: {
  companyId: string;
  from: Date;
  to: Date;
  types?: CalendarEventType[];
  includeSystem?: boolean;
}) {
  const types = input.types ?? ["APPOINTMENT", "PAYMENT", "REMINDER"];
  const includeSystem = input.includeSystem ?? true;

  const manualEvents = await db.calendarEvent.findMany({
    where: {
      companyId: input.companyId,
      source: "MANUAL",
      startAt: {
        gte: input.from,
        lte: input.to,
      },
    },
    orderBy: [{ startAt: "asc" }, { createdAt: "asc" }],
  });

  let events = filterByTypes(
    manualEvents.map((event) => normalizeCalendarEvent(event)),
    types
  );

  if (includeSystem) {
    const loads: Promise<void>[] = [];

    if (types.includes("PAYMENT")) {
      loads.push(
        (async () => {
          const settings = await db.companySettings.findUnique({
            where: { companyId: input.companyId },
            select: { defaultDueDays: true },
          });
          const defaultDueDays = settings?.defaultDueDays ?? 30;

          const [invoices, sales, expenses, memberships, employeePayments, payrollRuns] =
            await Promise.all([
              db.invoice.findMany({
                where: {
                  companyId: input.companyId,
                  paymentStatus: { in: ["UNPAID", "PARTIAL"] },
                  status: { notIn: ["CANCELLED", "DRAFT"] },
                },
                include: { customer: { select: { name: true } } },
              }),
              db.sale.findMany({
                where: {
                  companyId: input.companyId,
                  paymentStatus: { in: ["UNPAID", "PARTIAL"] },
                  invoice: { is: null },
                  ...activeSaleStatusFilter(),
                },
                include: { customer: { select: { name: true } } },
              }),
              db.expense.findMany({
                where: {
                  companyId: input.companyId,
                  paymentStatus: "UNPAID",
                  status: { not: "CANCELLED" },
                },
              }),
              db.membershipPayment.findMany({
                where: {
                  companyId: input.companyId,
                  OR: [{ status: "PENDING" }, { provider: "TRIAL" }],
                },
              }),
              db.employeePayment.findMany({
                where: {
                  companyId: input.companyId,
                  status: { in: ["PENDING", "OVERDUE"] },
                  dueDate: { not: null },
                  amount: { gt: 0 },
                },
                include: {
                  employee: {
                    select: { id: true, firstName: true, lastName: true },
                  },
                },
              }),
              db.payrollRun.findMany({
                where: {
                  companyId: input.companyId,
                  payDate: { not: null },
                  status: { in: ["DRAFT", "APPROVED"] },
                },
                select: {
                  id: true,
                  companyId: true,
                  title: true,
                  payDate: true,
                  netTotal: true,
                  currency: true,
                  status: true,
                },
              }),
            ]);

          events = [
            ...events,
            ...buildInvoiceCollectionEvents(
              invoices,
              input.from,
              input.to,
              defaultDueDays
            ),
            ...buildSaleCollectionEvents(
              sales,
              input.from,
              input.to,
              defaultDueDays
            ),
            ...buildExpenseSystemEvents(expenses, input.from, input.to),
            ...buildMembershipSystemEvents(memberships, input.from, input.to),
            ...buildEmployeePaymentSystemEvents(
              employeePayments,
              input.from,
              input.to
            ),
            ...buildPayrollRunSystemEvents(
              payrollRuns,
              input.from,
              input.to
            ),
          ];
        })()
      );
    }

    if (types.includes("REMINDER")) {
      loads.push(
        (async () => {
          const employeeLeaves = await db.employeeLeave.findMany({
            where: {
              companyId: input.companyId,
              status: "APPROVED",
              startAt: { lte: input.to },
              endAt: { gte: input.from },
            },
            include: {
              employee: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          });

          events = [
            ...events,
            ...buildEmployeeLeaveSystemEvents(
              employeeLeaves,
              input.from,
              input.to
            ),
          ];
        })()
      );
    }

    await Promise.all(loads);
  }

  events.sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );

  return events;
}

export async function createCalendarEvent(input: {
  companyId: string;
  userId: string;
  data: {
    type: CalendarEventType;
    title: string;
    description?: string;
    startAt: string;
    endAt?: string;
    allDay?: boolean;
    amount?: number;
    currency?: string;
    color?: string;
    status?: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  };
}) {
  const validation = validateCalendarEventInput(input.data);
  if (!validation.ok) {
    throw new CalendarServiceError(validation.message, 400);
  }

  const event = await db.calendarEvent.create({
    data: {
      companyId: input.companyId,
      userId: input.userId,
      type: validation.data.type,
      title: validation.data.title.trim(),
      description: validation.data.description?.trim() || null,
      startAt: new Date(validation.data.startAt),
      endAt: validation.data.endAt ? new Date(validation.data.endAt) : null,
      allDay: validation.data.allDay ?? false,
      amount:
        validation.data.type === "PAYMENT" && validation.data.amount != null
          ? validation.data.amount
          : null,
      currency:
        validation.data.type === "PAYMENT"
          ? validation.data.currency ?? "TRY"
          : null,
      color: validation.data.color ?? null,
      status: validation.data.status ?? "SCHEDULED",
      source: "MANUAL",
    },
  });

  return normalizeCalendarEvent(event);
}

export async function updateCalendarEvent(input: {
  companyId: string;
  eventId: string;
  data: Partial<{
    type: CalendarEventType;
    title: string;
    description?: string;
    startAt: string;
    endAt?: string;
    allDay?: boolean;
    amount?: number;
    currency?: string;
    color?: string;
    status?: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  }>;
}) {
  if (isSystemEventId(input.eventId)) {
    throw new CalendarServiceError(
      "Sistem kayıtları takvimden düzenlenemez.",
      403
    );
  }

  const existing = await db.calendarEvent.findFirst({
    where: {
      id: input.eventId,
      companyId: input.companyId,
    },
  });

  if (!existing) {
    throw new CalendarServiceError("Takvim kaydı bulunamadı.", 404);
  }

  if (existing.source === "SYSTEM") {
    throw new CalendarServiceError(
      "Sistem kayıtları takvimden düzenlenemez.",
      403
    );
  }

  const merged = {
    type: input.data.type ?? existing.type,
    title: input.data.title ?? existing.title,
    description:
      input.data.description !== undefined
        ? input.data.description
        : existing.description ?? undefined,
    startAt: input.data.startAt ?? existing.startAt.toISOString(),
    endAt:
      input.data.endAt !== undefined
        ? input.data.endAt
        : existing.endAt?.toISOString(),
    allDay: input.data.allDay ?? existing.allDay,
    amount:
      input.data.amount !== undefined
        ? input.data.amount
        : existing.amount != null
          ? Number(existing.amount)
          : undefined,
    currency: input.data.currency ?? existing.currency ?? undefined,
    color: input.data.color ?? existing.color ?? undefined,
    status: input.data.status ?? existing.status,
  };

  const validation = validateCalendarEventInput(merged);
  if (!validation.ok) {
    throw new CalendarServiceError(validation.message, 400);
  }

  const event = await db.calendarEvent.update({
    where: { id: existing.id },
    data: {
      type: validation.data.type,
      title: validation.data.title.trim(),
      description: validation.data.description?.trim() || null,
      startAt: new Date(validation.data.startAt),
      endAt: validation.data.endAt ? new Date(validation.data.endAt) : null,
      allDay: validation.data.allDay ?? false,
      amount:
        validation.data.type === "PAYMENT" && validation.data.amount != null
          ? validation.data.amount
          : null,
      currency:
        validation.data.type === "PAYMENT"
          ? validation.data.currency ?? "TRY"
          : null,
      color: validation.data.color ?? null,
      status: validation.data.status ?? "SCHEDULED",
    },
  });

  return normalizeCalendarEvent(event);
}

export async function deleteCalendarEvent(input: {
  companyId: string;
  eventId: string;
}) {
  if (isSystemEventId(input.eventId)) {
    throw new CalendarServiceError(
      "Sistem kayıtları takvimden silinemez.",
      403
    );
  }

  const existing = await db.calendarEvent.findFirst({
    where: {
      id: input.eventId,
      companyId: input.companyId,
    },
  });

  if (!existing) {
    throw new CalendarServiceError("Takvim kaydı bulunamadı.", 404);
  }

  if (existing.source === "SYSTEM") {
    throw new CalendarServiceError(
      "Sistem kayıtları takvimden silinemez.",
      403
    );
  }

  await db.calendarEvent.delete({ where: { id: existing.id } });
}

export type CalendarEventCreateInput = Parameters<
  typeof createCalendarEvent
>[0]["data"];

export type CalendarEventUpdateInput = Parameters<
  typeof updateCalendarEvent
>[0]["data"];

export type { NormalizedCalendarEvent };
