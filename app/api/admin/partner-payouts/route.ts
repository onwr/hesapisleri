import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminPartnerPayoutServiceError,
  createPartnerPayoutAdmin,
  getPartnerPayoutSummary,
  listPartnerPayoutsAdmin,
  parsePayoutListFilters,
} from "@/lib/admin/partner-payouts";

export async function GET(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const url = new URL(req.url);
    const filters = parsePayoutListFilters(Object.fromEntries(url.searchParams.entries()));

    const [summary, list] = await Promise.all([
      getPartnerPayoutSummary(),
      listPartnerPayoutsAdmin(filters),
    ]);

    return NextResponse.json({ success: true, data: { summary, ...list } });
  } catch {
    return NextResponse.json(
      { success: false, message: "Ödemeler yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const payout = await createPartnerPayoutAdmin(auth.user.id, body);

    return NextResponse.json({
      success: true,
      message: "Partner ödemesi oluşturuldu.",
      data: { payout },
    });
  } catch (error) {
    if (error instanceof AdminPartnerPayoutServiceError) {
      return NextResponse.json(
        { success: false, message: error.message, code: error.code },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Ödeme oluşturulamadı." },
      { status: 500 }
    );
  }
}
