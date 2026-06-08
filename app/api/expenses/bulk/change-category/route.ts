import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiModuleAccess } from "@/lib/module-access";
import { bulkChangeExpenseCategory } from "@/lib/expense-bulk-actions-service";

const schema = z.object({
  ids: z.array(z.string().min(1)).min(1, "En az bir gider seçin."),
  category: z.string().trim().min(1, "Kategori adı zorunludur."),
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

    const result = await bulkChangeExpenseCategory({
      companyId: auth.companyId,
      userId: auth.userId,
      ids: parsed.data.ids,
      category: parsed.data.category,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${result.data.updatedCount} giderin kategorisi güncellendi.`,
      data: result.data,
    });
  } catch (error) {
    console.error("EXPENSE_BULK_CHANGE_CATEGORY_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Kategori güncelleme başarısız." },
      { status: 500 }
    );
  }
}
