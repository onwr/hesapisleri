import { NextResponse } from "next/server";
import { cancelExpenseRecord } from "@/lib/expense-service";
import { requireApiModuleAccess } from "@/lib/module-access";
import { buildTenantMutationSuccess } from "@/lib/tenant-cache/tenant-mutation-response";

type Props = {
  params: Promise<{ id: string }>;
};

export async function POST(_req: Request, { params }: Props) {
  try {
    const auth = await requireApiModuleAccess("expenses");
    if ("error" in auth) return auth.error;

    const { userId, companyId } = auth;
    const { id } = await params;

    const result = await cancelExpenseRecord({
      companyId,
      userId,
      expenseId: id,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json(
      buildTenantMutationSuccess(companyId, {
        reason: "expense-cancel",
        entityIds: { expenseId: id },
        entity: result.data as Record<string, unknown>,
        message: "Gider iptal edildi.",
      }),
    );
  } catch (error) {
    console.error("CANCEL_EXPENSE_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Gider iptal edilirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
