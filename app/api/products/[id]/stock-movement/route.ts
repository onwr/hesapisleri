import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { applyProductStockMovement } from "@/lib/stock-movement-service";
import {
  getFirstStockMovementErrorMessage,
  stockMovementRequestSchema,
} from "@/lib/stock-movement-utils";

type Props = {
  params: Promise<{ id: string }>;
};

export async function POST(req: Request, { params }: Props) {
  try {
    const auth = await requireApiModuleAccess("products");
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const body = await req.json();
    const parsed = stockMovementRequestSchema.safeParse(body);

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

    const { companyId, userId } = auth;

    const result = await applyProductStockMovement({
      companyId,
      userId,
      productId: id,
      input: parsed.data,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          message: result.message,
          errors: result.errors,
        },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Stok hareketi kaydedildi.",
      data: result.data,
    });
  } catch (error) {
    console.error("PRODUCT_STOCK_MOVEMENT_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: getFirstStockMovementErrorMessage(
          "Stok hareketi kaydedilirken bir hata oluştu."
        ),
      },
      { status: 500 }
    );
  }
}
