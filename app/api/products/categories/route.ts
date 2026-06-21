import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { z } from "zod";
import { db } from "@/lib/prisma";
import {
  createProductCategory,
  getProductCategoriesWithStats,
} from "@/lib/product-category-service";
import { PRODUCT_CATEGORY_COLORS } from "@/lib/product-category-utils";

const categoryColorSchema = z.enum(PRODUCT_CATEGORY_COLORS);

const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Kategori adı zorunludur."),
  color: categoryColorSchema.optional(),
  note: z.string().optional(),
});

export async function GET() {
  try {
    const auth = await requireApiModuleAccess("products");
    if ("error" in auth) return auth.error;

    const companyId = auth.companyId;
    const userId = auth.userId;
    const { categories, summary } = await getProductCategoriesWithStats(
      companyId
    );

    return NextResponse.json({
      success: true,
      data: {
        categories,
        summary,
      },
    });
  } catch (error) {
    console.error("PRODUCT_CATEGORIES_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Kategoriler alınamadı.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiModuleAccess("products");
    if ("error" in auth) return auth.error;

    const companyId = auth.companyId;
    const userId = auth.userId;
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

    const category = await createProductCategory(companyId, parsed.data);

    await db.activityLog.create({
      data: {
        companyId: companyId,
        userId: userId,
        action: "CREATE",
        module: "products",
        message: `${category.name} ürün kategorisi oluşturuldu.`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Kategori başarıyla oluşturuldu.",
      data: category,
    });
  } catch (error) {
    console.error("CREATE_PRODUCT_CATEGORY_ERROR", error);

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
