import "server-only";

import { db } from "@/lib/prisma";
import { AdminPartnerServiceError } from "@/lib/admin/partners/admin-partner-errors";
import {
  adminPartnerNoteCreateSchema,
  adminPartnerNotePatchSchema,
} from "@/lib/admin/partners/admin-partner-schemas";
import { logAdminPartnerAudit } from "@/lib/admin/partners/admin-partner-audit-service";
import { invalidateAdminPartnerCaches } from "@/lib/admin/partners/admin-partner-cache";
import { redactPartnerActivityRow } from "@/lib/admin/partners/admin-partner-activity-scope";

export async function listAdminPartnerNotes(partnerId: string) {
  const notes = await db.adminPartnerNote.findMany({
    where: { partnerId, deletedAt: null },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  return notes.map((note) =>
    redactPartnerActivityRow({
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

export async function createAdminPartnerNote(
  partnerId: string,
  actorUserId: string,
  input: Record<string, unknown>
) {
  const parsed = adminPartnerNoteCreateSchema.parse(input);
  const partner = await db.partnerProfile.findUnique({ where: { id: partnerId } });
  if (!partner) throw new AdminPartnerServiceError("Partner bulunamadı.", 404);

  const note = await db.$transaction(async (tx) => {
    const row = await tx.adminPartnerNote.create({
      data: {
        partnerId,
        authorUserId: actorUserId,
        content: parsed.content.trim(),
        category: parsed.category,
        priority: parsed.priority,
        isPinned: parsed.isPinned ?? false,
      },
    });
    await logAdminPartnerAudit({
      userId: actorUserId,
      action: "PARTNER_NOTE_CREATED",
      partnerId,
      entityType: "AdminPartnerNote",
      entityId: row.id,
      displayMessage: "Partner notu eklendi.",
      tx,
    });
    return row;
  });

  invalidateAdminPartnerCaches(partnerId);
  return { id: note.id };
}

export async function updateAdminPartnerNote(
  partnerId: string,
  noteId: string,
  actorUserId: string,
  input: Record<string, unknown>
) {
  const parsed = adminPartnerNotePatchSchema.parse(input);
  const existing = await db.adminPartnerNote.findFirst({
    where: { id: noteId, partnerId, deletedAt: null },
  });
  if (!existing) throw new AdminPartnerServiceError("Not bulunamadı.", 404);

  await db.$transaction(async (tx) => {
    await tx.adminPartnerNote.update({
      where: { id: noteId },
      data: {
        ...(parsed.content !== undefined ? { content: parsed.content.trim() } : {}),
        ...(parsed.category !== undefined ? { category: parsed.category } : {}),
        ...(parsed.priority !== undefined ? { priority: parsed.priority } : {}),
        ...(parsed.isPinned !== undefined ? { isPinned: parsed.isPinned } : {}),
      },
    });
    await logAdminPartnerAudit({
      userId: actorUserId,
      action: "PARTNER_NOTE_UPDATED",
      partnerId,
      entityType: "AdminPartnerNote",
      entityId: noteId,
      displayMessage: "Partner notu güncellendi.",
      tx,
    });
  });

  invalidateAdminPartnerCaches(partnerId);
}

export async function deleteAdminPartnerNote(
  partnerId: string,
  noteId: string,
  actorUserId: string
) {
  const existing = await db.adminPartnerNote.findFirst({
    where: { id: noteId, partnerId, deletedAt: null },
  });
  if (!existing) throw new AdminPartnerServiceError("Not bulunamadı.", 404);

  await db.$transaction(async (tx) => {
    await tx.adminPartnerNote.update({
      where: { id: noteId },
      data: { deletedAt: new Date() },
    });
    await logAdminPartnerAudit({
      userId: actorUserId,
      action: "PARTNER_NOTE_DELETED",
      partnerId,
      entityType: "AdminPartnerNote",
      entityId: noteId,
      displayMessage: "Partner notu silindi.",
      tx,
    });
  });

  invalidateAdminPartnerCaches(partnerId);
}
