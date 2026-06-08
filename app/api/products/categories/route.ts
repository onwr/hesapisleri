import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { db } from "@/lib/prisma";
import {
  createProductCategory,
  getProductCategoriesWithStats,
} from "@/lib/product-category-service";
import { PRODUCT_CATEGORY_COLORS } from "@/lib/product-category-utils";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

const categoryColorSchema = z.enum(PRODUCT_CATEGORY_COLORS);

const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Kategori adı zorunludur."),
  color: categoryColorSchema.optional(),
  note: z.string().optional(),
});

export async function GET() {
  try {
    const token = await getAuthToken();

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Oturum bulunamadı." },
        { status: 401 }
      );
    }

    const payload = verifyToken<AuthPayload>(token);

    if (!payload?.companyId) {
      return NextResponse.json(
        { success: false, message: "Oturum geçersiz." },
        { status: 401 }
      );
    }

    const { categories, summary } = await getProductCategoriesWithStats(
      payload.companyId
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
    const token = await getAuthToken();

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Oturum bulunamadı." },
        { status: 401 }
      );
    }

    const payload = verifyToken<AuthPayload>(token);

    if (!payload?.userId || !payload.companyId) {
      return NextResponse.json(
        { success: false, message: "Oturum geçersiz." },
        { status: 401 }
      );
    }

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

    const category = await createProductCategory(payload.companyId, parsed.data);

    await db.activityLog.create({
      data: {
        companyId: payload.companyId,
        userId: payload.userId,
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
