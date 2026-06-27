import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminUserNoteError,
  createAdminUserNote,
  listAdminUserNotes,
} from "@/lib/admin/users/admin-user-note-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const data = await listAdminUserNotes(id);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("ADMIN_USER_NOTES_GET_ERROR", error);
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
    const data = await createAdminUserNote(id, auth.user.id, body);

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    if (error instanceof AdminUserNoteError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    console.error("ADMIN_USER_NOTES_POST_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Not oluşturulamadı." },
      { status: 500 }
    );
  }
}
