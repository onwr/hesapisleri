import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildExpenseSystemEvents,
  buildEmployeeLeaveSystemEvents,
  buildEmployeePaymentSystemEvents,
  buildInvoiceCollectionEvents,
  buildInvoiceSystemEvents,
  buildMembershipSystemEvents,
  buildSaleCollectionEvents,
} from "./calendar-service";
import {
  buildMonthGrid,
  getCalendarEventHref,
  groupEventsByDay,
  isDateInRange,
  isSystemEventId,
  normalizeCalendarEvent,
  parseCalendarDateRange,
  parseCalendarTypesParam,
  parseIncludeSystemParam,
  parseSystemEventId,
  resolveCollectionDueDate,
  validateCalendarEventInput,
} from "./calendar-utils";

describe("calendar utils", () => {
  it("buildMonthGrid 42 hücre üretir", () => {
    const grid = buildMonthGrid(2026, 5);
    assert.equal(grid.length, 42);
    assert.ok(grid.filter((cell) => cell.isCurrentMonth).length >= 28);
  });

  it("groupEventsByDay gün anahtarına göre gruplar", () => {
    const events = [
      normalizeCalendarEvent({
        id: "1",
        companyId: "c1",
        type: "APPOINTMENT",
        title: "A",
        startAt: "2026-06-10T10:00:00.000Z",
        allDay: false,
        status: "SCHEDULED",
        source: "MANUAL",
      }),
      normalizeCalendarEvent({
        id: "2",
        companyId: "c1",
        type: "REMINDER",
        title: "B",
        startAt: "2026-06-10T14:00:00.000Z",
        allDay: false,
        status: "SCHEDULED",
        source: "MANUAL",
      }),
    ];

    const grouped = groupEventsByDay(events);
    assert.ok([...grouped.values()].some((list) => list.length === 2));
  });

  it("validateCalendarEventInput title/startAt zorunlu", () => {
    const invalid = validateCalendarEventInput({
      type: "APPOINTMENT",
      title: "",
      startAt: "",
    });
    assert.equal(invalid.ok, false);

    const valid = validateCalendarEventInput({
      type: "APPOINTMENT",
      title: "Toplantı",
      startAt: "2026-06-10T10:00:00.000Z",
    });
    assert.equal(valid.ok, true);
  });

  it("system event id parse edilir", () => {
    assert.equal(isSystemEventId("system:invoice:abc"), true);
    assert.deepEqual(parseSystemEventId("system:invoice:abc"), {
      entityType: "invoice",
      entityId: "abc",
    });
  });

  it("parseIncludeSystemParam varsayılan true", () => {
    assert.equal(parseIncludeSystemParam(undefined), true);
    assert.equal(parseIncludeSystemParam("false"), false);
  });

  it("parseCalendarTypesParam geçersizleri filtreler", () => {
    assert.deepEqual(parseCalendarTypesParam("PAYMENT,FOO"), ["PAYMENT"]);
  });

  it("parseCalendarDateRange geçersiz tarihi reddeder", () => {
    const result = parseCalendarDateRange({ from: "invalid", to: "2026-06-01" });
    assert.equal(result.ok, false);
  });
});

describe("calendar system event builders", () => {
  it("fatura vadesi sistem eventi üretir", () => {
    const events = buildInvoiceSystemEvents(
      [
        {
          id: "inv1",
          companyId: "c1",
          customerId: null,
          saleId: null,
          invoiceNo: "FTR-001",
          type: "NORMAL",
          status: "APPROVED",
          total: 1500 as unknown as import("@prisma/client/runtime/library").Decimal,
          paymentStatus: "UNPAID",
          paidAmount: 0 as unknown as import("@prisma/client/runtime/library").Decimal,
          gibStatus: null,
          gibMessage: null,
          pdfUrl: null,
          xmlUrl: null,
          dueDate: new Date("2026-06-15T00:00:00.000Z"),
          createdAt: new Date(),
          updatedAt: new Date(),
          customer: { name: "ABC Ltd." },
        },
      ],
      new Date("2026-06-01T00:00:00.000Z"),
      new Date("2026-06-30T23:59:59.999Z"),
      30
    );

    assert.equal(events.length, 1);
    assert.equal(events[0]?.id, "system:invoice:inv1");
    assert.equal(events[0]?.readOnly, true);
    assert.match(events[0]?.title ?? "", /Yaklaşan tahsilat/);
    assert.equal(events[0]?.amount, 1500);
  });

  it("dueDate olmayan fatura defaultDueDays ile hesaplanır", () => {
    const issueDate = new Date(2026, 5, 1);
    const events = buildInvoiceCollectionEvents(
      [
        {
          id: "inv2",
          companyId: "c1",
          customerId: null,
          saleId: null,
          invoiceNo: "FTR-002",
          type: "NORMAL",
          status: "APPROVED",
          total: 800 as unknown as import("@prisma/client/runtime/library").Decimal,
          paymentStatus: "UNPAID",
          paidAmount: 0 as unknown as import("@prisma/client/runtime/library").Decimal,
          gibStatus: null,
          gibMessage: null,
          pdfUrl: null,
          xmlUrl: null,
          dueDate: null,
          createdAt: issueDate,
          updatedAt: new Date(),
          customer: { name: "XYZ A.Ş." },
        },
      ],
      new Date(2026, 5, 1),
      new Date(2026, 5, 30, 23, 59, 59, 999),
      15
    );

    assert.equal(events.length, 1);
    assert.equal(
      new Date(events[0]?.startAt ?? "").toISOString().slice(0, 10),
      new Date(2026, 5, 16).toISOString().slice(0, 10)
    );
  });

  it("satış tahsilatı sistem eventi üretir", () => {
    const sales = [
      {
        id: "sale1",
        companyId: "c1",
        userId: "u1",
        customerId: null,
        saleNo: "SAT-001",
        status: "COMPLETED",
        total: 2500 as unknown as import("@prisma/client/runtime/library").Decimal,
        paymentStatus: "PARTIAL",
        paidAmount: 500 as unknown as import("@prisma/client/runtime/library").Decimal,
        createdAt: new Date("2026-06-05T00:00:00.000Z"),
        updatedAt: new Date(),
        customer: { name: "Müşteri A" },
      },
    ] as Parameters<typeof buildSaleCollectionEvents>[0];

    const events = buildSaleCollectionEvents(
      sales,
      new Date("2026-06-01T00:00:00.000Z"),
      new Date("2026-06-30T23:59:59.999Z"),
      10
    );

    assert.equal(events.length, 1);
    assert.equal(events[0]?.id, "system:sale:sale1");
    assert.equal(events[0]?.relatedType, "SALE");
    assert.equal(events[0]?.amount, 2000);
    assert.match(events[0]?.title ?? "", /Yaklaşan tahsilat/);
  });

  it("resolveCollectionDueDate dueDate yoksa issueDate + defaultDueDays", () => {
    const due = resolveCollectionDueDate({
      issueDate: new Date(2026, 5, 1),
      defaultDueDays: 14,
    });
    assert.equal(due.getFullYear(), 2026);
    assert.equal(due.getMonth(), 5);
    assert.equal(due.getDate(), 15);
  });

  it("isDateInRange aralık kontrolü yapar", () => {
    const from = new Date(2026, 5, 1);
    const to = new Date(2026, 5, 30, 23, 59, 59, 999);
    assert.equal(isDateInRange(new Date(2026, 5, 15), from, to), true);
    assert.equal(isDateInRange(new Date(2026, 6, 1), from, to), false);
  });

  it("ödenmemiş gider sistem eventi üretir", () => {
    const events = buildExpenseSystemEvents(
      [
        {
          id: "exp1",
          companyId: "c1",
          userId: null,
          title: "Kira",
          category: "Ofis",
          supplier: null,
          amount: 5000 as unknown as import("@prisma/client/runtime/library").Decimal,
          status: "APPROVED",
          paymentStatus: "UNPAID",
          accountId: null,
          date: new Date("2026-06-12T00:00:00.000Z"),
          note: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      new Date("2026-06-01T00:00:00.000Z"),
      new Date("2026-06-30T23:59:59.999Z")
    );

    assert.equal(events.length, 1);
    assert.equal(events[0]?.relatedType, "EXPENSE");
  });

  it("üyelik trial bitişi sistem eventi üretir", () => {
    const events = buildMembershipSystemEvents(
      [
        {
          id: "mem1",
          companyId: "c1",
          periodStart: new Date("2026-06-01T00:00:00.000Z"),
          periodEnd: new Date("2026-06-15T00:00:00.000Z"),
          amount: 1499 as unknown as import("@prisma/client/runtime/library").Decimal,
          status: "PENDING",
          provider: "TRIAL",
          paymentRef: "TRIAL-1",
          paidAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      new Date("2026-06-01T00:00:00.000Z"),
      new Date("2026-06-30T23:59:59.999Z")
    );

    assert.equal(events.length, 1);
    assert.match(events[0]?.title ?? "", /trial/i);
  });

  it("approved employee leave system event üretir", () => {
    const from = new Date("2026-06-01T00:00:00.000Z");
    const to = new Date("2026-06-30T23:59:59.999Z");
    const events = buildEmployeeLeaveSystemEvents(
      [
        {
          id: "leave1",
          companyId: "c1",
          employeeId: "emp1",
          type: "ANNUAL",
          startAt: new Date("2026-06-10T00:00:00.000Z"),
          endAt: new Date("2026-06-12T00:00:00.000Z"),
          totalDays: 3 as unknown as import("@prisma/client/runtime/library").Decimal,
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
      from,
      to
    );

    assert.equal(events.length, 1);
    assert.equal(events[0]?.id, "system:employee-leave:leave1");
    assert.equal(events[0]?.relatedType, "EMPLOYEE_LEAVE");
    assert.equal(events[0]?.type, "REMINDER");
    assert.match(events[0]?.title ?? "", /Ayşe Yılmaz izinli/);
    assert.equal(events[0]?.actionUrl, "/team/emp1");
    assert.equal(events[0]?.readOnly, true);
  });

  it("pending employee payment system event üretir", () => {
    const from = new Date("2026-06-01T00:00:00.000Z");
    const to = new Date("2026-06-30T23:59:59.999Z");
    const events = buildEmployeePaymentSystemEvents(
      [
        {
          id: "pay1",
          companyId: "c1",
          employeeId: "emp1",
          type: "SALARY",
          direction: "PAYABLE",
          amount: 25000 as unknown as import("@prisma/client/runtime/library").Decimal,
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
      from,
      to
    );

    assert.equal(events.length, 1);
    assert.equal(events[0]?.id, "system:employee-payment:pay1");
    assert.equal(events[0]?.relatedType, "EMPLOYEE_PAYMENT");
    assert.equal(events[0]?.type, "PAYMENT");
    assert.equal(events[0]?.amount, 25000);
    assert.equal(events[0]?.actionUrl, "/team/emp1?tab=payments");
  });

  it("getCalendarEventHref actionUrl kullanır", () => {
    const event = normalizeCalendarEvent(
      {
        id: "system:employee-leave:leave1",
        companyId: "c1",
        type: "REMINDER",
        title: "Test",
        startAt: new Date(),
        allDay: true,
        status: "SCHEDULED",
        source: "SYSTEM",
        relatedType: "EMPLOYEE_LEAVE",
        relatedId: "leave1",
        actionUrl: "/team/emp1",
      },
      true
    );

    assert.equal(getCalendarEventHref(event), "/team/emp1");
  });
});

describe("calendar API validation helpers", () => {
  it("SYSTEM event id update/delete için işaretlenir", () => {
    assert.equal(isSystemEventId("system:membership:abc"), true);
    assert.equal(isSystemEventId("clx123"), false);
  });
});
