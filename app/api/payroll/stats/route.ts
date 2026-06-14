import { NextResponse } from "next/server";
import { getPayrollDashboardStats } from "@/lib/payroll-service";
import { requireApiModuleAccess } from "@/lib/module-access";

export async function GET() {
  try {
    const auth = await requireApiModuleAccess("employees");
    if ("error" in auth) return auth.error;

    const stats = await getPayrollDashboardStats(auth.companyId);

    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error("PAYROLL_STATS_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Bordro istatistikleri yüklenemedi." },
      { status: 500 }
    );
  }
}
