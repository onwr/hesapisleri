import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { createExpenseRecord } from "@/lib/expense-service";
import { createExpenseSchema } from "@/lib/expense-utils";

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
      return NextResponse.json(
        {
          success: false,
          message: "Bilgileri kontrol edin.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
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

    return NextResponse.json({
      success: true,
      message: "Gider başarıyla oluşturuldu.",
      data: result.data,
    });
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
