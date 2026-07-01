import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiModuleAccess } from "@/lib/module-access";
import { bulkCancelExpenses } from "@/lib/expense-bulk-actions-service";
import { buildTenantMutationSuccess } from "@/lib/tenant-cache/tenant-mutation-response";

const schema = z.object({
  ids: z.array(z.string().min(1)).min(1, "En az bir gider seçin."),
});

export async function POST(req: Request) {
  try {
    const auth = await requireApiModuleAccess("expenses");
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const parsed = schema.safeParse(body);

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

    const result = await bulkCancelExpenses({
      companyId: auth.companyId,
      userId: auth.userId,
      ids: parsed.data.ids,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json(
      buildTenantMutationSuccess(auth.companyId, {
        reason: "expense-cancel",
        affectedIds: parsed.data.ids,
        entity: result.data as Record<string, unknown>,
        message: `${result.data.cancelledCount} gider iptal edildi.`,
        status: "bulk-cancelled",
      }),
    );
  } catch (error) {
    console.error("EXPENSE_BULK_CANCEL_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Toplu iptal başarısız." },
      { status: 500 }
    );
  }
}
