import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { posCheckoutSchema } from "@/lib/pos-checkout-utils";
import {
  executePosCheckout,
  PosCheckoutIdempotencyError,
  SaleStockValidationError,
} from "@/lib/pos-checkout-service";

export async function POST(req: Request) {
  try {
    const auth = await requireApiModuleAccess("pos");
    if ("error" in auth) return auth.error;

    const { userId, companyId } = auth;

    const body = await req.json();
    const parsed = posCheckoutSchema.safeParse(body);

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

    try {
      const result = await executePosCheckout({
        companyId,
        userId,
        data: parsed.data,
      });

      const warning =
        result.stockWarnings.length > 0
          ? result.stockWarnings[0]?.message
          : undefined;

      return NextResponse.json({
        success: true,
        message: result.replayed
          ? "POS satışı daha önce tamamlanmıştı."
          : "POS satışı başarıyla tamamlandı.",
        replayed: result.replayed,
        ...(warning ? { warning } : {}),
        ...(result.stockWarnings.length > 0
          ? { negativeStockItems: result.stockWarnings }
          : {}),
        data: result.sale,
      });
    } catch (error) {
      if (error instanceof PosCheckoutIdempotencyError) {
        return NextResponse.json(
          {
            success: false,
            code: error.code,
            message: error.message,
          },
          { status: 409 }
        );
      }

      if (error instanceof SaleStockValidationError) {
        return NextResponse.json(
          { success: false, message: error.message },
          { status: 400 }
        );
      }

      if (error instanceof Error) {
        return NextResponse.json(
          { success: false, message: error.message },
          { status: 400 }
        );
      }

      throw error;
    }
  } catch (error) {
    console.error("POS_CHECKOUT_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "POS satışı tamamlanırken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
