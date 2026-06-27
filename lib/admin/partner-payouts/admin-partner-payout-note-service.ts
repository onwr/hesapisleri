import "server-only";

import { db } from "@/lib/prisma";
import { AdminPartnerPayoutServiceError } from "@/lib/admin/partner-payouts/admin-partner-payout-errors";
import { logAdminPartnerPayoutAudit } from "@/lib/admin/partner-payouts/admin-partner-payout-audit-service";
import { invalidateAdminPartnerPayoutCaches } from "@/lib/admin/partner-payouts/admin-partner-payout-cache";
import { redactPayoutActivityRow } from "@/lib/admin/partner-payouts/admin-partner-payout-activity-scope";
import {
  adminPartnerPayoutNoteCreateSchema,
  adminPartnerPayoutNotePatchSchema,
} from "@/lib/admin/partner-payouts/admin-partner-payout-schemas";

export async function listAdminPartnerPayoutNotes(payoutId: string) {
  const payout = await db.partnerPayout.findUnique({ where: { id: payoutId }, select: { id: true, partnerId: true } });
  if (!payout) throw new AdminPartnerPayoutServiceError("Ödeme bulunamadı.", 404);

  const notes = await db.adminPartnerPayoutNote.findMany({
    where: { payoutId, deletedAt: null },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  return notes.map((note) =>
    redactPayoutActivityRow({
      id: note.id,
      content: note.content,
      category: note.category,
      priority: note.priority,
      isPinned: note.isPinned,
      author: note.author
        ? { id: note.author.id, name: note.author.name, email: note.author.email }
        : null,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    })
  );
}

export async function createAdminPartnerPayoutNote(
  payoutId: string,
  actorUserId: string,
  input: Record<string, unknown>
) {
  const parsed = adminPartnerPayoutNoteCreateSchema.parse(input);
  const payout = await db.partnerPayout.findUnique({ where: { id: payoutId } });
  if (!payout) throw new AdminPartnerPayoutServiceError("Ödeme bulunamadı.", 404);

  const note = await db.$transaction(async (tx) => {
    const row = await tx.adminPartnerPayoutNote.create({
      data: {
        payoutId,
        authorUserId: actorUserId,
        content: parsed.content.trim(),
        category: parsed.category ?? "GENERAL",
        priority: parsed.priority ?? "NORMAL",
        isPinned: parsed.isPinned ?? false,
      },
      include: { author: { select: { id: true, name: true, email: true } } },
    });

    await logAdminPartnerPayoutAudit({
      userId: actorUserId,
      action: "PARTNER_PAYOUT_NOTE_CREATED",
      payoutId,
      partnerId: payout.partnerId,
      displayMessage: "Partner ödemesine not eklendi.",
      tx,
    });

    return row;
  });

  invalidateAdminPartnerPayoutCaches(payout.partnerId);

  return redactPayoutActivityRow({
    id: note.id,
    content: note.content,
    category: note.category,
    priority: note.priority,
    isPinned: note.isPinned,
    author: note.author
      ? { id: note.author.id, name: note.author.name, email: note.author.email }
      : null,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  });
}

export async function patchAdminPartnerPayoutNote(
  payoutId: string,
  noteId: string,
  actorUserId: string,
  input: Record<string, unknown>
) {
  const parsed = adminPartnerPayoutNotePatchSchema.parse(input);
  const existing = await db.adminPartnerPayoutNote.findFirst({
    where: { id: noteId, payoutId, deletedAt: null },
    include: { payout: { select: { partnerId: true } } },
  });
  if (!existing) throw new AdminPartnerPayoutServiceError("Not bulunamadı.", 404);

  const note = await db.adminPartnerPayoutNote.update({
    where: { id: noteId },
    data: {
      content: parsed.content?.trim(),
      category: parsed.category,
      priority: parsed.priority,
      isPinned: parsed.isPinned,
    },
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  invalidateAdminPartnerPayoutCaches(existing.payout.partnerId);

  return redactPayoutActivityRow({
    id: note.id,
    content: note.content,
    category: note.category,
    priority: note.priority,
    isPinned: note.isPinned,
    author: note.author
      ? { id: note.author.id, name: note.author.name, email: note.author.email }
      : null,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  });
}

export async function deleteAdminPartnerPayoutNote(
  payoutId: string,
  noteId: string,
  actorUserId: string
) {
  const existing = await db.adminPartnerPayoutNote.findFirst({
    where: { id: noteId, payoutId, deletedAt: null },
    include: { payout: { select: { partnerId: true } } },
  });
  if (!existing) throw new AdminPartnerPayoutServiceError("Not bulunamadı.", 404);

  await db.adminPartnerPayoutNote.update({
    where: { id: noteId },
    data: { deletedAt: new Date() },
  });

  invalidateAdminPartnerPayoutCaches(existing.payout.partnerId);
  return { ok: true };
}
