import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { requireApiModuleAccess } from "@/lib/module-access";
import {
  mapProductFieldErrors,
  normalizeImageUrl,
  normalizeOptionalText,
  productFormSchema,
} from "@/lib/product-form-utils";
import {
  assertUniqueProductIdentifiers,
  resolveProductCategoryId,
} from "@/lib/product-service";
import { applyWarehouseStockMovement } from "@/lib/warehouse-service";

export async function POST(req: Request) {
  try {
    const auth = await requireApiModuleAccess("products");
    if ("error" in auth) return auth.error;

    const { userId, companyId } = auth;

    const body = await req.json();
    const parsed = productFormSchema.safeParse(body);

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

    const data = parsed.data;
    const sku = normalizeOptionalText(data.sku);
    const barcode = normalizeOptionalText(data.barcode);

    const uniqueCheck = await assertUniqueProductIdentifiers(companyId, {
      sku,
      barcode,
    });

    if (!uniqueCheck.ok) {
      return NextResponse.json(
        {
          success: false,
          message: uniqueCheck.message,
          errors: { [uniqueCheck.field]: [uniqueCheck.message] },
        },
        { status: 400 }
      );
    }

    const categoryId = await resolveProductCategoryId(
      companyId,
      data.categoryName
    );

    const product = await db.product.create({
      data: {
        companyId: companyId,
        categoryId,
        name: data.name,
        sku,
        barcode,
        description: normalizeOptionalText(data.description),
        imageUrl: normalizeImageUrl(data.imageUrl),
        stock: data.stock,
        minStock: data.minStock,
        unitType: data.unitType,
        warehouseLocation: normalizeOptionalText(data.warehouseLocation),
        buyPrice: data.buyPrice,
        sellPrice: data.sellPrice,
        vatRate: data.vatRate,
        status: data.status,
      },
    });

    if (data.stock > 0) {
      await applyWarehouseStockMovement({
        companyId,
        userId,
        productId: product.id,
        input: {
          type: "IN",
          quantity: data.stock,
          note: "Ürün oluşturulurken başlangıç stoğu eklendi.",
        },
      });
    }

    await db.activityLog.create({
      data: {
        companyId: companyId,
        userId: userId,
        action: "CREATE",
        module: "products",
        message: `${product.name} ürünü oluşturuldu.`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Ürün başarıyla oluşturuldu.",
      data: product,
    });
  } catch (error) {
    console.error("CREATE_PRODUCT_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Ürün oluşturulurken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
