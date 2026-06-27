import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { requireApiModuleAccess } from "@/lib/module-access";
import {
  formatProductValidationErrors,
  getFirstProductErrorMessage,
  normalizeImageUrl,
  normalizeOptionalText,
  productUpdateSchema,
} from "@/lib/product-form-utils";
import { isServiceProductType } from "@/lib/product-type-utils";
import {
  assertUniqueProductIdentifiers,
  deleteProduct,
  resolveProductCategoryId,
  toggleProductStatus,
} from "@/lib/product-service";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_req: Request, { params }: Props) {
  try {
    const auth = await requireApiModuleAccess("products");
    if ("error" in auth) return auth.error;

    const { companyId } = auth;
    const { id } = await params;

    const product = await db.product.findFirst({
      where: {
        id,
        companyId,
      },
      include: {
        category: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, message: "Ürün bulunamadı." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error("PRODUCT_DETAIL_API_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Ürün bilgisi alınırken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, { params }: Props) {
  try {
    const auth = await requireApiModuleAccess("products");
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const { companyId, userId } = auth;

    const existing = await db.product.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Ürün bulunamadı." },
        { status: 404 }
      );
    }

    const body = await req.json();
    const parsed = productUpdateSchema.safeParse(body);

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

    const data = parsed.data;
    const isService = isServiceProductType(existing.productType);
    const sku = normalizeOptionalText(data.sku);
    const hasBarcodeField =
      !isService && Object.prototype.hasOwnProperty.call(body, "barcode");
    const barcode = hasBarcodeField
      ? normalizeOptionalText(data.barcode ?? null)
      : isService
        ? null
        : existing.barcode;

    const uniqueCheck = await assertUniqueProductIdentifiers(companyId, {
      sku,
      barcode,
      excludeProductId: id,
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

    const updateData: Parameters<typeof db.product.update>[0]["data"] = {
      categoryId,
      name: data.name,
      sku,
      description: normalizeOptionalText(data.description),
      imageUrl: normalizeImageUrl(data.imageUrl),
      minStock: isService ? 0 : data.minStock,
      unitType: data.unitType,
      warehouseLocation: isService
        ? null
        : normalizeOptionalText(data.warehouseLocation),
      buyPrice: data.buyPrice,
      sellPrice: data.sellPrice,
      vatRate: data.vatRate,
      status: data.status,
    };

    if (hasBarcodeField) {
      updateData.barcode = barcode;
    }

    const updateResult = await db.product.updateMany({
      where: { id, companyId },
      data: updateData,
    });

    if (updateResult.count === 0) {
      return NextResponse.json(
        { success: false, message: "Ürün bulunamadı." },
        { status: 404 }
      );
    }

    const product = await db.product.findFirstOrThrow({
      where: { id, companyId },
      include: {
        category: true,
      },
    });

    await db.activityLog.create({
      data: {
        companyId,
        userId,
        action: "UPDATE",
        module: "products",
        message: `${product.name} ürünü güncellendi.`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Ürün başarıyla güncellendi.",
      data: product,
    });
  } catch (error) {
    console.error("PRODUCT_UPDATE_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: getFirstProductErrorMessage(
          "Ürün güncellenirken bir hata oluştu."
        ),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: Props) {
  try {
    const auth = await requireApiModuleAccess("products");
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const result = await deleteProduct(auth.companyId, id, auth.userId);

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          message: result.message,
          code: result.code,
          saleItemCount: result.saleItemCount,
          transferCount: result.transferCount,
        },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("PRODUCT_DELETE_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Ürün silinirken bir hata oluştu." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, { params }: Props) {
  try {
    const auth = await requireApiModuleAccess("products");
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "set-status") {
      const status = body?.status;
      if (status !== "ACTIVE" && status !== "PASSIVE") {
        return NextResponse.json(
          { success: false, message: "Geçersiz durum." },
          { status: 400 }
        );
      }

      const { setProductStatus } = await import("@/lib/product-bulk-service");
      const result = await setProductStatus(
        auth.companyId,
        id,
        auth.userId,
        status
      );

      if (!result.ok) {
        return NextResponse.json(
          { success: false, message: result.message },
          { status: result.status }
        );
      }

      return NextResponse.json({
        success: true,
        message: result.message,
      });
    }

    if (action === "toggle-status") {
      const result = await toggleProductStatus(
        auth.companyId,
        id,
        auth.userId
      );

      if (!result.ok) {
        return NextResponse.json(
          { success: false, message: result.message },
          { status: result.status }
        );
      }

      return NextResponse.json({
        success: true,
        message: result.message,
        data: result.data,
      });
    }

    return NextResponse.json(
      { success: false, message: "Geçersiz işlem." },
      { status: 400 }
    );
  } catch (error) {
    console.error("PRODUCT_ACTION_ERROR", error);

    return NextResponse.json(
      { success: false, message: "İşlem tamamlanamadı." },
      { status: 500 }
    );
  }
}
