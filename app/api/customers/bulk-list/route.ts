import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import {
  getBulkCustomersList,
  parseBulkFilters,
} from "@/lib/customer-bulk-actions-service";

export async function GET(req: Request) {
  try {
    const auth = await requireApiModuleAccess("customers");
    if ("error" in auth) return auth.error;

    const companyId = auth.companyId;
    const userId = auth.userId;
    const { searchParams } = new URL(req.url);
    const filters = parseBulkFilters({
      group: searchParams.get("group"),
      status: searchParams.get("status"),
      balanceType: searchParams.get("balanceType"),
      search: searchParams.get("search"),
    });

    const data = await getBulkCustomersList(companyId, filters);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("GET_CUSTOMER_BULK_LIST_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Müşteri listesi alınamadı.",
      },
      { status: 500 }
    );
  }
}
