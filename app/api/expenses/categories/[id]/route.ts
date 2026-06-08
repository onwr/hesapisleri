import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiModuleAccess } from "@/lib/module-access";
import { db } from "@/lib/prisma";
import {
  deleteExpenseCategory,
  updateExpenseCategory,
} from "@/lib/expense-category-service";
import { EXPENSE_CATEGORY_COLORS } from "@/lib/expense-category-utils";

const updateCategorySchema = z.object({
  name: z.string().trim().min(1).optional(),
  color: z.enum(EXPENSE_CATEGORY_COLORS).optional(),
  note: z.string().nullable().optional(),
  status: z.enum(["ACTIVE", "PASSIVE"]).optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requireApiModuleAccess("expenses");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json();
    const parsed = updateCategorySchema.safeParse(body);

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

    const category = await updateExpenseCategory(auth.companyId, id, parsed.data);

    await db.activityLog.create({
      data: {
        companyId: auth.companyId,
        userId: auth.userId,
        action: "UPDATE",
        module: "expenses",
        message: `${category.name} gider kategorisi güncellendi.`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Kategori güncellendi.",
      data: category,
    });
  } catch (error) {
    console.error("UPDATE_EXPENSE_CATEGORY_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Kategori güncellenirken bir hata oluştu.",
      },
      { status: 400 }
    );
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const auth = await requireApiModuleAccess("expenses");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    await deleteExpenseCategory(auth.companyId, id);

    await db.activityLog.create({
      data: {
        companyId: auth.companyId,
        userId: auth.userId,
        action: "DELETE",
        module: "expenses",
        message: "Gider kategorisi silindi.",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Kategori silindi.",
    });
  } catch (error) {
    console.error("DELETE_EXPENSE_CATEGORY_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Kategori silinirken bir hata oluştu.",
      },
      { status: 400 }
    );
  }
}
