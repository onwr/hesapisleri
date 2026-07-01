import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiModuleAccess } from "@/lib/module-access";
import { db } from "@/lib/prisma";
import {
  createExpenseCategory,
  getExpenseCategoriesWithStats,
} from "@/lib/expense-category-service";
import { EXPENSE_CATEGORY_COLORS } from "@/lib/expense-category-utils";
import { buildTenantMutationSuccess } from "@/lib/tenant-cache/tenant-mutation-response";

const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Kategori adı zorunludur."),
  color: z.enum(EXPENSE_CATEGORY_COLORS).optional(),
  note: z.string().optional(),
});

export async function GET() {
  try {
    const auth = await requireApiModuleAccess("expenses");
    if ("error" in auth) return auth.error;

    const { categories, summary } = await getExpenseCategoriesWithStats(
      auth.companyId
    );

    return NextResponse.json({
      success: true,
      data: { categories, summary },
    });
  } catch (error) {
    console.error("EXPENSE_CATEGORIES_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Kategoriler alınamadı." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiModuleAccess("expenses");
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const parsed = createCategorySchema.safeParse(body);

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

    const category = await createExpenseCategory(auth.companyId, parsed.data);

    await db.activityLog.create({
      data: {
        companyId: auth.companyId,
        userId: auth.userId,
        action: "CREATE",
        module: "expenses",
        message: `${category.name} gider kategorisi oluşturuldu.`,
      },
    });

    return NextResponse.json(
      buildTenantMutationSuccess(auth.companyId, {
        reason: "expense-category-change",
        entity: category as Record<string, unknown>,
        message: "Kategori başarıyla oluşturuldu.",
      }),
    );
  } catch (error) {
    console.error("CREATE_EXPENSE_CATEGORY_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Kategori oluşturulurken bir hata oluştu.",
      },
      { status: 400 }
    );
  }
}
