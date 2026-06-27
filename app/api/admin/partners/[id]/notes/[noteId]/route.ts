import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminPartnerServiceError,
  deleteAdminPartnerNote,
  updateAdminPartnerNote,
} from "@/lib/admin/partners";

type RouteContext = { params: Promise<{ id: string; noteId: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id, noteId } = await context.params;
    await updateAdminPartnerNote(id, noteId, auth.user.id, await req.json());

    return NextResponse.json({ success: true, message: "Not güncellendi." });
  } catch (error) {
    if (error instanceof AdminPartnerServiceError) {
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
    await deleteAdminPartnerNote(id, noteId, auth.user.id);

    return NextResponse.json({ success: true, message: "Not silindi." });
  } catch (error) {
    if (error instanceof AdminPartnerServiceError) {
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
