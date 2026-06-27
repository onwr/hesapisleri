import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AddOnServiceError,
  createAddOn,
  getAddOnSummary,
  listAddOns,
  parseAddOnApiFilters,
} from "@/lib/admin/addons";

export async function GET(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const filters = parseAddOnApiFilters(new URL(req.url).searchParams);
    const [list, summary] = await Promise.all([listAddOns(filters), getAddOnSummary()]);

    return NextResponse.json({ success: true, data: { ...list, summary } });
  } catch {
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

    const addOn = await createAddOn(auth.user.id, await req.json());

    return NextResponse.json({
      success: true,
      message: "Ek paket taslak olarak oluşturuldu.",
      data: addOn,
    });
  } catch (error) {
    if (error instanceof AddOnServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Ek paket oluşturulamadı." },
      { status: 500 }
    );
  }
}
