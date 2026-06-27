import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { parseAdminCompanyFilters } from "@/lib/admin/companies/admin-company-filter-utils";
import {
  exportAdminCompaniesCsv,
  listAdminCompaniesPaginated,
} from "@/lib/admin/companies/admin-company-list-service";
import { getAdminCompanyListMetrics } from "@/lib/admin/companies/admin-company-metric-service";

export async function GET(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(req.url);
    const params = Object.fromEntries(searchParams.entries());
    const filters = parseAdminCompanyFilters(params);

    if (searchParams.get("export") === "csv") {
      const csv = await exportAdminCompaniesCsv(filters);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="firmalar.csv"',
        },
      });
    }

    const [list, metrics] = await Promise.all([
      listAdminCompaniesPaginated(filters),
      getAdminCompanyListMetrics(),
    ]);

    return NextResponse.json({ success: true, data: { list, metrics } });
  } catch (error) {
    console.error("ADMIN_COMPANIES_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Firmalar yüklenemedi." },
      { status: 500 }
    );
  }
}
