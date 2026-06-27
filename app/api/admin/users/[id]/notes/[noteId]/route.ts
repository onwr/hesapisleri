import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminUserNoteError,
  deleteAdminUserNote,
  updateAdminUserNote,
} from "@/lib/admin/users/admin-user-note-service";

type RouteContext = { params: Promise<{ id: string; noteId: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id, noteId } = await context.params;
    const body = await req.json();
    const data = await updateAdminUserNote(id, noteId, auth.user.id, body);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof AdminUserNoteError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    console.error("ADMIN_USER_NOTE_PATCH_ERROR", error);
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
    const data = await deleteAdminUserNote(id, noteId, auth.user.id);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof AdminUserNoteError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    console.error("ADMIN_USER_NOTE_DELETE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Not silinemedi." },
      { status: 500 }
    );
  }
}
