import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminPartnerServiceError,
  createAdminPartnerNote,
  listAdminPartnerNotes,
} from "@/lib/admin/partners";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const data = await listAdminPartnerNotes(id);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof AdminPartnerServiceError) {
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
    const note = await createAdminPartnerNote(id, auth.user.id, await req.json());

    return NextResponse.json({
      success: true,
      message: "Not eklendi.",
      data: note,
    });
  } catch (error) {
    if (error instanceof AdminPartnerServiceError) {
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
