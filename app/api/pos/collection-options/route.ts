import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { getPosCollectionAccountOptions } from "@/lib/pos-collection-account-service";

export async function GET() {
  try {
    const auth = await requireApiModuleAccess("pos");
    if ("error" in auth) return auth.error;

    const accounts = await getPosCollectionAccountOptions(auth.companyId);

    return NextResponse.json({
      success: true,
      data: accounts,
    });
  } catch (error) {
    console.error("POS_COLLECTION_OPTIONS_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "POS tahsilat hesapları yüklenemedi.",
      },
      { status: 500 }
    );
  }
}
