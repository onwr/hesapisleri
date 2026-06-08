import { NextResponse } from "next/server";
import { getAuthToken, verifyToken } from "@/lib/auth";
import {
  getBulkCustomersList,
  parseBulkFilters,
} from "@/lib/customer-bulk-actions-service";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

export async function GET(req: Request) {
  try {
    const token = await getAuthToken();

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Oturum bulunamadı." },
        { status: 401 }
      );
    }

    const payload = verifyToken<AuthPayload>(token);

    if (!payload?.companyId) {
      return NextResponse.json(
        { success: false, message: "Oturum geçersiz." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const filters = parseBulkFilters({
      group: searchParams.get("group"),
      status: searchParams.get("status"),
      balanceType: searchParams.get("balanceType"),
      search: searchParams.get("search"),
    });

    const data = await getBulkCustomersList(payload.companyId, filters);

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
