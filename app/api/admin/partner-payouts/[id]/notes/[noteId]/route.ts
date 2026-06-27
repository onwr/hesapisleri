import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { AdminPartnerPayoutServiceError } from "@/lib/admin/partner-payouts";
import {
  deleteAdminPartnerPayoutNote,
  patchAdminPartnerPayoutNote,
} from "@/lib/admin/partner-payouts/admin-partner-payout-note-service";

type RouteContext = { params: Promise<{ id: string; noteId: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id, noteId } = await context.params;
    const body = await req.json();
    const note = await patchAdminPartnerPayoutNote(id, noteId, auth.user.id, body);

    return NextResponse.json({ success: true, data: { note } });
  } catch (error) {
    if (error instanceof AdminPartnerPayoutServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Not güncellenemedi." },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id, noteId } = await context.params;
    await deleteAdminPartnerPayoutNote(id, noteId, auth.user.id);

    return NextResponse.json({ success: true, message: "Not silindi." });
  } catch (error) {
    if (error instanceof AdminPartnerPayoutServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Not silinemedi." },
      { status: 500 }
    );
  }
}
