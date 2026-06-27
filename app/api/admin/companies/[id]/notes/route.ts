import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  createAdminCompanyNote,
  listAdminCompanyNotes,
  AdminCompanyNoteError,
} from "@/lib/admin/companies/admin-company-note-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const auth = await requireSuperAdminApi();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const data = await listAdminCompanyNotes(id);
  return NextResponse.json({ success: true, data });
}

export async function POST(req: Request, context: RouteContext) {
  const auth = await requireSuperAdminApi();
  if ("error" in auth) return auth.error;

  try {
    const { id } = await context.params;
    const body = await req.json();
    const data = await createAdminCompanyNote(id, auth.user.id, body);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof AdminCompanyNoteError) {
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
