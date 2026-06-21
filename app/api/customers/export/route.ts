import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import {
  getCustomersExportRows,
  parseCustomerTab,
  parseGroupFilter,
  parseSearchQuery,
} from "@/lib/customers-page-data";
import {
  buildCsvContent,
  buildCustomerListCsvRow,
  CUSTOMER_LIST_CSV_HEADER,
} from "@/lib/customer-export-utils";

export async function GET(request: Request) {
  try {
    const auth = await requireApiModuleAccess("customers");
    if ("error" in auth) return auth.error;

    const companyId = auth.companyId;
    const userId = auth.userId;
    const { searchParams } = new URL(request.url);
    const tab = parseCustomerTab(searchParams.get("tab"));
    const group = parseGroupFilter(searchParams.get("group"));
    const q = parseSearchQuery(searchParams.get("q"));

    const customers = await getCustomersExportRows(companyId, {
      tab,
      group,
      q,
    });

    const csv = buildCsvContent(
      CUSTOMER_LIST_CSV_HEADER,
      customers.map((customer) => buildCustomerListCsvRow(customer))
    );

    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="musteriler.csv"',
      },
    });
  } catch (error) {
    console.error("CUSTOMER_EXPORT_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Müşteri listesi dışa aktarılamadı.",
      },
      { status: 500 }
    );
  }
}
