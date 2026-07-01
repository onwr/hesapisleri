import { NextResponse } from "next/server";
import { payExpenseRecord, payExpenseSchema } from "@/lib/expense-service";
import { requireApiModuleAccess } from "@/lib/module-access";
import { buildTenantMutationSuccess } from "@/lib/tenant-cache/tenant-mutation-response";

type Props = {
  params: Promise<{ id: string }>;
};

export async function POST(req: Request, { params }: Props) {
  try {
    const auth = await requireApiModuleAccess("expenses");
    if ("error" in auth) return auth.error;

    const { userId, companyId } = auth;

    const body = await req.json();
    const parsed = payExpenseSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      const firstError = Object.values(errors).flat()[0];

      return NextResponse.json(
        {
          success: false,
          message: firstError || "Geçersiz istek.",
          errors,
        },
        { status: 400 }
      );
    }

    const { id } = await params;

    const result = await payExpenseRecord({
      companyId,
      userId,
      expenseId: id,
      data: parsed.data,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json(
      buildTenantMutationSuccess(companyId, {
        reason: "expense-pay",
        entityIds: { expenseId: id },
        entity: result.data as Record<string, unknown>,
        message: "Gider ödemesi kaydedildi.",
        balances: undefined,
      }),
    );
  } catch (error) {
    console.error("PAY_EXPENSE_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Gider ödenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
