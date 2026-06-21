import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AddOnServiceError,
  createAddOn,
  getAddOnSummary,
  listAddOns,
  parseAddOnListFilters,
} from "@/lib/admin/addons";

export async function GET(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(req.url);
    const params: Record<string, string> = {};
    searchParams.forEach((v, k) => {
      params[k] = v;
    });

    const filters = parseAddOnListFilters(params);
    const [list, summary] = await Promise.all([listAddOns(filters), getAddOnSummary()]);

    return NextResponse.json({ success: true, data: { ...list, summary } });
  } catch (error) {
    console.error("ADMIN_ADDONS_LIST_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Ek paketler yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const addOn = await createAddOn({
      ...body,
      actorUserId: auth.user.id,
    });

    return NextResponse.json({
      success: true,
      message: "Ek paket oluşturuldu.",
      data: addOn,
    });
  } catch (error) {
    if (error instanceof AddOnServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    console.error("ADMIN_ADDON_CREATE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Ek paket oluşturulamadı." },
      { status: 500 }
    );
  }
}
