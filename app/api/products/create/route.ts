import { NextResponse } from "next/server";
import { createActivityLog } from "@/lib/activity-log-utils";
import { db } from "@/lib/prisma";
import { requireApiModuleAccess } from "@/lib/module-access";
import {
  formatProductValidationErrors,
  getFirstProductErrorMessage,
  normalizeImageUrl,
  normalizeOptionalText,
  productFormSchema,
} from "@/lib/product-form-utils";
import { normalizeServiceProductFields } from "@/lib/product-type-utils";
import {
  assertUniqueProductIdentifiers,
  resolveProductCategoryId,
} from "@/lib/product-service";
import { requireCompanyLimit } from "@/lib/billing/entitlements/entitlement-enforcement-service";
import { EntitlementError } from "@/lib/billing/entitlements/entitlement-errors";
import { applyWarehouseStockMovement } from "@/lib/warehouse-service";

export async function POST(req: Request) {
  try {
    const auth = await requireApiModuleAccess("products");
    if ("error" in auth) return auth.error;

    const { userId, companyId } = auth;

    const body = await req.json();
    const parsed = productFormSchema.safeParse(body);

    if (!parsed.success) {
      const errors = formatProductValidationErrors(
        parsed.error.flatten().fieldErrors
      );

      return NextResponse.json(
        {
          success: false,
          message: getFirstProductErrorMessage("Bilgileri kontrol edin.", errors),
          errors,
        },
        { status: 400 }
      );
    }

    const data = normalizeServiceProductFields(parsed.data);
    const isService = data.productType === "SERVICE";
    const sku = normalizeOptionalText(data.sku);
    const hasBarcodeField = Object.prototype.hasOwnProperty.call(body, "barcode");
    const barcode =
      isService || !hasBarcodeField
        ? null
        : normalizeOptionalText(data.barcode ?? null);

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
        { status: uniqueCheck.field === "barcode" ? 409 : 400 }
      );
    }

    const categoryId = await resolveProductCategoryId(
      companyId,
      data.categoryName
    );

    try {
      await requireCompanyLimit(companyId, "MAX_PRODUCTS", { incrementBy: 1 });
    } catch (error) {
      if (error instanceof EntitlementError) {
        return NextResponse.json(
          { success: false, message: error.message },
          { status: error.status }
        );
      }
      throw error;
    }

    const product = await db.product.create({
      data: {
        companyId: companyId,
        categoryId,
        productType: data.productType,
        name: data.name,
        sku,
        barcode,
        description: normalizeOptionalText(data.description),
        imageUrl: normalizeImageUrl(data.imageUrl),
        stock: isService ? 0 : data.stock,
        minStock: isService ? 0 : data.minStock,
        unitType: data.unitType,
        warehouseLocation: isService
          ? null
          : normalizeOptionalText(data.warehouseLocation),
        buyPrice: data.buyPrice,
        sellPrice: data.sellPrice,
        vatRate: data.vatRate,
        status: data.status,
      },
    });

    if (!isService && data.stock > 0) {
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

    await createActivityLog({
      companyId,
      userId,
      action: "CREATE",
      module: "products",
      message: isService
        ? `Hizmet oluşturuldu: ${product.name}`
        : `Ürün oluşturuldu: ${product.name}`,
    });

    return NextResponse.json({
      success: true,
      message: isService
        ? "Hizmet başarıyla oluşturuldu."
        : "Ürün başarıyla oluşturuldu.",
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
