import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  createAdminPlanNote,
  listAdminPlanNotes,
  AdminPlanNoteError,
} from "@/lib/admin/plans/admin-plan-note-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const notes = await listAdminPlanNotes(id);
    return NextResponse.json({ success: true, data: { notes } });
  } catch (error) {
    console.error("[GET /api/admin/plans/[id]/notes]", error);
    return NextResponse.json({ success: false, message: "Notlar yüklenemedi." }, { status: 500 });
  }
}

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const { id } = await context.params;
    const note = await createAdminPlanNote(id, auth.user.id, body);
    return NextResponse.json({ success: true, message: "Not oluşturuldu.", data: note });
  } catch (error) {
    if (error instanceof AdminPlanNoteError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    console.error("[POST /api/admin/plans/[id]/notes]", error);
    return NextResponse.json({ success: false, message: "Not oluşturulamadı." }, { status: 500 });
  }
}
