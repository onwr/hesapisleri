import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  getPricePreviewOptions,
  PricePreviewServiceError,
} from "@/lib/admin/price-preview";
import { pricePreviewOptionsCacheControl } from "@/lib/admin/price-preview/admin-price-preview-cache";

export async function GET() {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const data = await getPricePreviewOptions();

    return NextResponse.json(
      { success: true, data },
      {
        headers: {
          "Cache-Control": pricePreviewOptionsCacheControl(),
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
      { success: false, message: "Seçenekler yüklenemedi." },
      { status: 500 }
    );
  }
}
