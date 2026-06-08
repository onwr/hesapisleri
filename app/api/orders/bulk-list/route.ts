import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import {
  getBulkOrderList,
  parseBulkOrderFilters,
} from "@/lib/orders-bulk-actions-service";

export async function GET(request: Request) {
  try {
    const auth = await requireApiModuleAccess("orders");
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const filters = parseBulkOrderFilters({
      q: searchParams.get("q"),
      channel: searchParams.get("channel"),
      orderStatus: searchParams.get("orderStatus"),
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      tab: searchParams.get("tab"),
    });

    const result = await getBulkOrderList(auth.companyId, filters);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Liste alınamadı." },
      { status: 500 }
    );
  }
}
