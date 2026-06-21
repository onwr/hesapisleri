import { NextResponse } from "next/server";
import { requireApiDirectoryManage } from "@/lib/module-access";
import { syncDirectoryFromSupplier } from "@/lib/directory-service";

export async function POST() {
  try {
    const auth = await requireApiDirectoryManage();
    if ("error" in auth) return auth.error;

    const result = await syncDirectoryFromSupplier({ companyId: auth.companyId });

    return NextResponse.json({
      success: true,
      message: "Tedarikçiler fihriste aktarıldı.",
      data: result,
    });
  } catch (error) {
    console.error("DIRECTORY_SYNC_SUPPLIERS_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Tedarikçiler fihriste aktarılamadı." },
      { status: 500 }
    );
  }
}
