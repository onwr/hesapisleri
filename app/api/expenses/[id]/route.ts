import { NextResponse } from "next/server";
import {
  getExpenseDetail,
  updateExpenseRecord,
  updateExpenseSchema,
} from "@/lib/expense-service";
import { requireApiModuleAccess } from "@/lib/module-access";

type Props = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, { params }: Props) {
  try {
    const auth = await requireApiModuleAccess("expenses");
    if ("error" in auth) return auth.error;

    const { companyId } = auth;
    const { id } = await params;
    const expense = await getExpenseDetail(companyId, id);

    if (!expense) {
      return NextResponse.json(
        { success: false, message: "Gider bulunamadı." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: expense });
  } catch (error) {
    console.error("GET_EXPENSE_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Gider getirilemedi." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, { params }: Props) {
  try {
    const auth = await requireApiModuleAccess("expenses");
    if ("error" in auth) return auth.error;

    const { userId, companyId } = auth;
    const { id } = await params;
    const body = await req.json();
    const parsed = updateExpenseSchema.safeParse(body);

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

    const result = await updateExpenseRecord({
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

    return NextResponse.json({
      success: true,
      message: "Gider güncellendi.",
      data: result.data,
    });
  } catch (error) {
    console.error("UPDATE_EXPENSE_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Gider güncellenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
