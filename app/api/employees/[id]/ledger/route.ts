import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createEmployeeLedgerMovement,
  createEmployeeSalary,
  EmployeeServiceError,
  getEmployeeLedger,
  type EmployeeLedgerActionType,
} from "@/lib/employee-service";
import { requireApiEmployeesPermission } from "@/lib/module-access";

type RouteContext = { params: Promise<{ id: string }> };

const ledgerBodySchema = z.object({
  type: z.enum([
    "SALARY_ACCRUAL",
    "SALARY_PAYMENT",
    "ADVANCE",
    "DEDUCTION",
    "BONUS",
    "ADJUSTMENT",
  ]),
  amount: z.coerce.number().positive("Tutar sıfırdan büyük olmalıdır."),
  date: z.string().optional(),
  accountId: z.string().optional().nullable(),
  description: z.string().trim().max(300).optional().nullable(),
  direction: z.enum(["DEBIT", "CREDIT"]).optional(),
});

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requireApiEmployeesPermission("view");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const ledger = await getEmployeeLedger({
      companyId: auth.companyId,
      employeeId: id,
    });

    return NextResponse.json({ success: true, ...ledger });
  } catch (error) {
    if (error instanceof EmployeeServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("[employees/ledger] GET", error);
    return NextResponse.json(
      { success: false, message: "Cari hareketler yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireApiEmployeesPermission("processPayments");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json();
    const parsed = ledgerBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message ?? "Geçersiz cari hareket.",
        },
        { status: 400 }
      );
    }

    const result = await createEmployeeLedgerMovement({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      employeeId: id,
      type: parsed.data.type as EmployeeLedgerActionType,
      amount: parsed.data.amount,
      date: parsed.data.date ? new Date(parsed.data.date) : undefined,
      accountId: parsed.data.accountId,
      description: parsed.data.description,
      direction: parsed.data.direction,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof EmployeeServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("[employees/ledger] POST", error);
    return NextResponse.json(
      { success: false, message: "Cari hareket kaydedilemedi." },
      { status: 500 }
    );
  }
}
