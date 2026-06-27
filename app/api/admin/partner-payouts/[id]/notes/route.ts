import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { AdminPartnerPayoutServiceError } from "@/lib/admin/partner-payouts";
import {
  createAdminPartnerPayoutNote,
  listAdminPartnerPayoutNotes,
} from "@/lib/admin/partner-payouts/admin-partner-payout-note-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const notes = await listAdminPartnerPayoutNotes(id);

    return NextResponse.json({ success: true, data: { notes } });
  } catch (error) {
    if (error instanceof AdminPartnerPayoutServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Notlar yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json();
    const note = await createAdminPartnerPayoutNote(id, auth.user.id, body);

    return NextResponse.json({
      success: true,
      message: "Not eklendi.",
      data: { note },
    });
  } catch (error) {
    if (error instanceof AdminPartnerPayoutServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Not eklenemedi." },
      { status: 500 }
    );
  }
}
