import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  executePricePreview,
  PricePreviewServiceError,
} from "@/lib/admin/price-preview";
import { pricePreviewResultCacheControl } from "@/lib/admin/price-preview/admin-price-preview-cache";

export async function POST(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const data = await executePricePreview(body);

    return NextResponse.json(
      { success: true, data },
      {
        headers: {
          "Cache-Control": pricePreviewResultCacheControl(),
        },
      }
    );
  } catch (error) {
    if (error instanceof PricePreviewServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Fiyat önizlemesi başarısız." },
      { status: 500 }
    );
  }
}
