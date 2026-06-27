import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { adminSubNoteCreateSchema } from "@/lib/admin/subscriptions/admin-subscription-schemas";
import {
  getAdminSubscriptionNotes,
  createAdminSubscriptionNote,
} from "@/lib/admin/subscriptions/admin-subscription-note-service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id: subscriptionId } = await params;
    const notes = await getAdminSubscriptionNotes(subscriptionId);
    return NextResponse.json({ success: true, data: notes });
  } catch (err) {
    console.error("[GET notes]", err);
    return NextResponse.json({ success: false, message: "Sunucu hatası" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id: subscriptionId } = await params;
    const body = await req.json();
    const parsed = adminSubNoteCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz istek.", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const note = await createAdminSubscriptionNote({
      subscriptionId,
      actorUserId: auth.user.id,
      ...parsed.data,
    });

    return NextResponse.json({ success: true, data: note });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json(
      { success: false, message: e?.message ?? "Sunucu hatası" },
      { status: e?.status ?? 500 }
    );
  }
}
