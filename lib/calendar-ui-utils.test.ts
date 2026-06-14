import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildEmployeeLeaveSystemEvents,
  buildEmployeePaymentSystemEvents,
  buildPayrollRunSystemEvents,
} from "./calendar-service";
import {
  canEditCalendarEvent,
  computeCalendarStats,
  filterCalendarEvents,
  getCalendarEventBadgeClass,
  getCalendarEventSourceLabel,
  getCalendarEventTypeLabel,
  getVisibleEventChips,
  isCalendarEventCritical,
} from "./calendar-ui-utils";
import {
  groupEventsByDay,
  normalizeCalendarEvent,
} from "./calendar-utils";

function manualEvent(
  overrides: Partial<Parameters<typeof normalizeCalendarEvent>[0]> = {}
) {
  return normalizeCalendarEvent({
    id: "manual-1",
    companyId: "c1",
    type: "REMINDER",
    title: "Toplantı",
    startAt: "2026-06-10T10:00:00.000Z",
    allDay: false,
    status: "SCHEDULED",
    source: "MANUAL",
    ...overrides,
  });
}

describe("calendar ui utils", () => {
  it("event type label Türkçe ve teknik enum göstermez", () => {
    assert.equal(
      getCalendarEventTypeLabel({
        type: "PAYMENT",
        source: "MANUAL",
        relatedType: null,
      }),
      "Ödeme"
    );
    assert.equal(
      getCalendarEventTypeLabel({
        type: "REMINDER",
        source: "SYSTEM",
        relatedType: "EMPLOYEE_LEAVE",
      }),
      "İzin"
    );
    assert.equal(
      getCalendarEventTypeLabel({
        type: "PAYMENT",
        source: "SYSTEM",
        relatedType: "PAYROLL_RUN",
      }),
      "Bordro"
    );
  });

  it("source label teknik enum göstermez", () => {
    assert.equal(getCalendarEventSourceLabel("SYSTEM"), "Otomatik");
    assert.equal(getCalendarEventSourceLabel("MANUAL"), "Manuel");
    assert.notEqual(getCalendarEventSourceLabel("SYSTEM"), "SYSTEM");
  });

  it("badge class mapping relatedType'a göre döner", () => {
    const leave = normalizeCalendarEvent(
      {
        id: "system:employee-leave:1",
        companyId: "c1",
        type: "REMINDER",
        title: "Ayşe Yılmaz izinli",
        startAt: "2026-06-10T00:00:00.000Z",
        allDay: true,
        status: "SCHEDULED",
        source: "SYSTEM",
        relatedType: "EMPLOYEE_LEAVE",
        relatedId: "leave1",
      },
      true
    );
    assert.match(getCalendarEventBadgeClass(leave), /violet/);
  });

  it("critical event detection geciken ödemeleri yakalar", () => {
    const overdue = manualEvent({
      type: "PAYMENT",
      startAt: "2020-01-01T00:00:00.000Z",
      status: "SCHEDULED",
    });
    assert.equal(isCalendarEventCritical(overdue), true);

    const future = manualEvent({
      type: "PAYMENT",
      startAt: "2099-01-01T00:00:00.000Z",
      status: "SCHEDULED",
    });
    assert.equal(isCalendarEventCritical(future), false);
  });

  it("manual event düzenlenebilir, sistem event düzenlenemez", () => {
    assert.equal(canEditCalendarEvent(manualEvent()), true);
    assert.equal(
      canEditCalendarEvent(
        normalizeCalendarEvent(
          {
            id: "system:1",
            companyId: "c1",
            type: "PAYMENT",
            title: "Sistem",
            startAt: "2026-06-10T00:00:00.000Z",
            allDay: true,
            status: "SCHEDULED",
            source: "SYSTEM",
          },
          true
        )
      ),
      false
    );
  });

  it("event chip limit +n daha hesabı", () => {
    const events = [1, 2, 3, 4, 5].map((n) => ({ id: String(n) }));
    const result = getVisibleEventChips(events, 3);
    assert.equal(result.visible.length, 3);
    assert.equal(result.hiddenCount, 2);
  });

  it("list view date grouping gün anahtarına göre gruplar", () => {
    const events = [
      manualEvent({ id: "a", startAt: "2026-06-10T10:00:00.000Z" }),
      manualEvent({ id: "b", startAt: "2026-06-10T14:00:00.000Z" }),
      manualEvent({ id: "c", startAt: "2026-06-11T09:00:00.000Z" }),
    ];
    const grouped = groupEventsByDay(events);
    assert.equal(grouped.size, 2);
    assert.equal(grouped.get("2026-06-10")?.length, 2);
  });

  it("filterCalendarEvents arama ve kaynak filtresi uygular", () => {
    const events = [
      manualEvent({ id: "m1", title: "Manuel toplantı", source: "MANUAL" }),
      normalizeCalendarEvent(
        {
          id: "s1",
          companyId: "c1",
          type: "PAYMENT",
          title: "Sistem tahsilat",
          startAt: "2026-06-10T00:00:00.000Z",
          allDay: true,
          status: "SCHEDULED",
          source: "SYSTEM",
        },
        true
      ),
    ];

    const manualOnly = filterCalendarEvents(events, {
      showPayments: true,
      showAppointments: true,
      showReminders: true,
      showSystem: true,
      searchQuery: "",
      sourceFilter: "MANUAL",
      statusFilter: "ALL",
      moduleFilter: "ALL",
      dateFrom: "",
      dateTo: "",
    });

    assert.equal(manualOnly.length, 1);
    assert.equal(manualOnly[0]?.id, "m1");
  });

  it("computeCalendarStats kritik sayısını döner", () => {
    const events = [
      manualEvent({ id: "1", startAt: new Date().toISOString() }),
      manualEvent({
        id: "2",
        type: "PAYMENT",
        startAt: "2020-01-01T00:00:00.000Z",
        status: "SCHEDULED",
      }),
    ];
    const stats = computeCalendarStats(events);
    assert.ok(stats.todayCount >= 1);
    assert.equal(stats.criticalCount, 1);
  });
});

describe("calendar employee/payroll ui events", () => {
  it("employee leave label ve actionUrl", () => {
    const events = buildEmployeeLeaveSystemEvents(
      [
        {
          id: "leave1",
          companyId: "c1",
          employeeId: "emp1",
          type: "ANNUAL",
          startAt: new Date("2026-06-10T00:00:00.000Z"),
          endAt: new Date("2026-06-12T00:00:00.000Z"),
          totalDays: 3 as never,
          status: "APPROVED",
          reason: "Tatil",
          approvedByUserId: null,
          approvedAt: new Date(),
          createdByUserId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          employee: { id: "emp1", firstName: "Ayşe", lastName: "Yılmaz" },
        },
      ],
      new Date("2026-06-01T00:00:00.000Z"),
      new Date("2026-06-30T23:59:59.999Z")
    );

    assert.match(events[0]?.title ?? "", /Ayşe Yılmaz izinli/);
    assert.equal(getCalendarEventTypeLabel(events[0]!), "İzin");
    assert.equal(events[0]?.actionUrl, "/team/emp1");
  });

  it("employee payment amount ve actionUrl", () => {
    const events = buildEmployeePaymentSystemEvents(
      [
        {
          id: "pay1",
          companyId: "c1",
          employeeId: "emp1",
          type: "SALARY",
          direction: "PAYABLE",
          amount: 25000 as never,
          currency: "TRY",
          dueDate: new Date("2026-06-15T00:00:00.000Z"),
          paidAt: null,
          status: "PENDING",
          description: "Haziran maaşı",
          relatedExpenseId: null,
          relatedAccountId: null,
          relatedTransactionId: null,
          createdByUserId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          employee: { id: "emp1", firstName: "Mehmet", lastName: "Demir" },
        },
      ],
      new Date("2026-06-01T00:00:00.000Z"),
      new Date("2026-06-30T23:59:59.999Z")
    );

    assert.equal(events[0]?.amount, 25000);
    assert.equal(events[0]?.actionUrl, "/team/emp1?tab=payments");
    assert.equal(getCalendarEventTypeLabel(events[0]!), "Çalışan Ödemesi");
  });

  it("payroll event actionUrl", () => {
    const events = buildPayrollRunSystemEvents(
      [
        {
          id: "pr1",
          companyId: "c1",
          title: "Haziran 2026",
          payDate: new Date("2026-06-25T00:00:00.000Z"),
          netTotal: 120000,
          currency: "TRY",
          status: "APPROVED",
        },
      ],
      new Date("2026-06-01T00:00:00.000Z"),
      new Date("2026-06-30T23:59:59.999Z")
    );

    assert.match(events[0]?.title ?? "", /Bordro ödemesi/);
    assert.equal(events[0]?.actionUrl, "/team/payroll/pr1");
  });
});

describe("calendar view toggle labels", () => {
  it("Ay Hafta Liste görünüm etiketleri", () => {
    const labels = ["Ay", "Hafta", "Liste"];
    assert.deepEqual(labels, ["Ay", "Hafta", "Liste"]);
  });
});
