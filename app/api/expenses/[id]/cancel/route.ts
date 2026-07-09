import { NextResponse } from "next/server";
import { z } from "zod";
import { cancelExpenseRecord } from "@/lib/expense-service";
import { requireApiModuleAccess } from "@/lib/module-access";
import { buildTenantMutationSuccess } from "@/lib/tenant-cache/tenant-mutation-response";

type Props = {
  params: Promise<{ id: string }>;
};

const cancelSchema = z.object({
  reason: z.string().optional(),
});

export async function POST(req: Request, { params }: Props) {
  try {
    const auth = await requireApiModuleAccess("expenses");
    if ("error" in auth) return auth.error;

    const { userId, companyId } = auth;
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = cancelSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz istek." },
        { status: 400 }
      );
    }

    const result = await cancelExpenseRecord({
      companyId,
      userId,
      expenseId: id,
      reason: parsed.data.reason,
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
