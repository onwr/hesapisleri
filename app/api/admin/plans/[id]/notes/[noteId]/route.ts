import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  deleteAdminPlanNote,
  updateAdminPlanNote,
  AdminPlanNoteError,
} from "@/lib/admin/plans/admin-plan-note-service";

type RouteContext = { params: Promise<{ id: string; noteId: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const { id, noteId } = await context.params;
    const note = await updateAdminPlanNote(id, noteId, auth.user.id, body);
    return NextResponse.json({ success: true, message: "Not güncellendi.", data: note });
  } catch (error) {
    if (error instanceof AdminPlanNoteError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    console.error("[PATCH /api/admin/plans/[id]/notes/[noteId]]", error);
    return NextResponse.json({ success: false, message: "Güncellenemedi." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id, noteId } = await context.params;
    await deleteAdminPlanNote(id, noteId, auth.user.id);
    return NextResponse.json({ success: true, message: "Not silindi." });
  } catch (error) {
    if (error instanceof AdminPlanNoteError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    console.error("[DELETE /api/admin/plans/[id]/notes/[noteId]]", error);
    return NextResponse.json({ success: false, message: "Silinemedi." }, { status: 500 });
  }
}
