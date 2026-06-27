import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { adminSubNoteUpdateSchema } from "@/lib/admin/subscriptions/admin-subscription-schemas";
import {
  updateAdminSubscriptionNote,
  deleteAdminSubscriptionNote,
} from "@/lib/admin/subscriptions/admin-subscription-note-service";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id: subscriptionId, noteId } = await params;
    const body = await req.json();
    const parsed = adminSubNoteUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz istek.", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const note = await updateAdminSubscriptionNote({
      noteId,
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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id: subscriptionId, noteId } = await params;
    const result = await deleteAdminSubscriptionNote({
      noteId,
      subscriptionId,
      actorUserId: auth.user.id,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json(
      { success: false, message: e?.message ?? "Sunucu hatası" },
      { status: e?.status ?? 500 }
    );
  }
}
