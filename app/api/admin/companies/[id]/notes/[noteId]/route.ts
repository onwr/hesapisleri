import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  deleteAdminCompanyNote,
  updateAdminCompanyNote,
  AdminCompanyNoteError,
} from "@/lib/admin/companies/admin-company-note-service";

type RouteContext = { params: Promise<{ id: string; noteId: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  const auth = await requireSuperAdminApi();
  if ("error" in auth) return auth.error;

  try {
    const { id, noteId } = await context.params;
    const body = await req.json();
    const data = await updateAdminCompanyNote(id, noteId, auth.user.id, body);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof AdminCompanyNoteError) {
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
  const auth = await requireSuperAdminApi();
  if ("error" in auth) return auth.error;

  try {
    const { id, noteId } = await context.params;
    const data = await deleteAdminCompanyNote(id, noteId, auth.user.id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof AdminCompanyNoteError) {
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
