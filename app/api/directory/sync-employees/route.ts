import { NextResponse } from "next/server";
import {
  DirectoryServiceError,
  syncDirectoryFromEmployee,
} from "@/lib/directory-service";
import { requireApiDirectoryManage } from "@/lib/module-access";

export async function POST() {
  try {
    const auth = await requireApiDirectoryManage();
    if ("error" in auth) return auth.error;

    const result = await syncDirectoryFromEmployee({
      companyId: auth.companyId,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof DirectoryServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("DIRECTORY_SYNC_EMPLOYEES_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Çalışanlar aktarılamadı." },
      { status: 500 }
    );
  }
}
