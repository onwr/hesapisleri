import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiModuleAccess } from "@/lib/module-access";
import { bulkPayExpenses } from "@/lib/expense-bulk-actions-service";

const schema = z.object({
  ids: z.array(z.string().min(1)).min(1, "En az bir gider seçin."),
  accountId: z.string().trim().min(1, "Ödeme hesabı seçilmelidir."),
  paidAt: z.string().optional(),
  note: z.string().optional(),
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

    const result = await bulkPayExpenses({
      companyId: auth.companyId,
      userId: auth.userId,
      ids: parsed.data.ids,
      accountId: parsed.data.accountId,
      paidAt: parsed.data.paidAt,
      note: parsed.data.note,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${result.data.paidCount} gider ödendi.`,
      data: result.data,
    });
  } catch (error) {
    console.error("EXPENSE_BULK_PAY_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Toplu ödeme başarısız." },
      { status: 500 }
    );
  }
}
