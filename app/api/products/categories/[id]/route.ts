import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { z } from "zod";
import { db } from "@/lib/prisma";
import {
  deleteProductCategory,
  updateProductCategory,
} from "@/lib/product-category-service";
import { PRODUCT_CATEGORY_COLORS } from "@/lib/product-category-utils";
import { buildTenantMutationSuccess } from "@/lib/tenant-cache/tenant-mutation-response";

type Props = {
  params: Promise<{ id: string }>;
};

const categoryColorSchema = z.enum(PRODUCT_CATEGORY_COLORS);

const updateCategorySchema = z.object({
  name: z.string().trim().min(1).optional(),
  color: categoryColorSchema.optional(),
  note: z.string().nullable().optional(),
  status: z.enum(["ACTIVE", "PASSIVE"]).optional(),
});

export async function PATCH(req: Request, { params }: Props) {
  try {
    const { id } = await params;
    const auth = await requireApiModuleAccess("products");
    if ("error" in auth) return auth.error;

    const companyId = auth.companyId;
    const userId = auth.userId;
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

    const category = await updateProductCategory(
      companyId,
      id,
      parsed.data
    );

    await db.activityLog.create({
      data: {
        companyId: companyId,
        userId: userId,
        action: "UPDATE",
        module: "products",
        message: `${category.name} ürün kategorisi güncellendi.`,
      },
    });

    return NextResponse.json(
      buildTenantMutationSuccess(companyId, {
        reason: "product-category-change",
        entity: category as Record<string, unknown>,
        message: "Kategori başarıyla güncellendi.",
      }),
    );
  } catch (error) {
    console.error("UPDATE_PRODUCT_CATEGORY_ERROR", error);

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

export async function DELETE(_req: Request, { params }: Props) {
  try {
    const { id } = await params;
    const auth = await requireApiModuleAccess("products");
    if ("error" in auth) return auth.error;

    const companyId = auth.companyId;
    const userId = auth.userId;
    await deleteProductCategory(companyId, id);

    await db.activityLog.create({
      data: {
        companyId: companyId,
        userId: userId,
        action: "DELETE",
        module: "products",
        message: "Ürün kategorisi silindi.",
      },
    });

    return NextResponse.json(
      buildTenantMutationSuccess(companyId, {
        reason: "product-category-change",
        entity: { id },
        message: "Kategori silindi.",
      }),
    );
  } catch (error) {
    console.error("DELETE_PRODUCT_CATEGORY_ERROR", error);

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
