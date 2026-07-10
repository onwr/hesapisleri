import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { createExpenseRecord } from "@/lib/expense-service";
import { createExpenseSchema } from "@/lib/expense-utils";
import { buildZodValidationErrorBody } from "@/lib/api-zod-validation";
import { buildTenantMutationSuccess } from "@/lib/tenant-cache/tenant-mutation-response";

export async function POST(req: Request) {
  try {
    const auth = await requireApiModuleAccess("expenses");
    if ("error" in auth) return auth.error;

    const { userId, companyId } = auth;

    const body = await req.json();
    const parsed = createExpenseSchema.safeParse({
      ...body,
      amount:
        body.amount !== undefined && body.amount !== null
          ? Number(body.amount)
          : body.amount,
    });

    if (!parsed.success) {
      return NextResponse.json(buildZodValidationErrorBody(parsed.error), {
        status: 400,
      });
    }

    const result = await createExpenseRecord({
      companyId,
      userId,
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
        reason: "expense-create",
        entityIds: { expenseId: result.data.id },
        entity: result.data as Record<string, unknown>,
        message: "Gider başarıyla oluşturuldu.",
      }),
    );
  } catch (error) {
    console.error("CREATE_EXPENSE_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gider oluşturulurken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
