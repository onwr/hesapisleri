import "server-only";
import { db } from "@/lib/prisma";
import { logAdminSubscriptionAudit } from "@/lib/admin/subscriptions/admin-subscription-audit";
import { invalidateAdminSubscriptionCaches } from "@/lib/admin/subscriptions/admin-subscription-cache";
import type { AdminSubscriptionNoteCategory, AdminCompanyNotePriority } from "@prisma/client";

export async function getAdminSubscriptionNotes(subscriptionId: string) {
  const notes = await db.adminSubscriptionNote.findMany({
    where: { subscriptionId, deletedAt: null },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    include: {
      author: { select: { name: true, email: true } },
    },
  });

  return notes.map((n) => ({
    id: n.id,
    content: n.content,
    category: n.category,
    priority: n.priority,
    isPinned: n.isPinned,
    author: n.author ?? null,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  }));
}

export async function createAdminSubscriptionNote(input: {
  subscriptionId: string;
  actorUserId: string;
  content: string;
  category: AdminSubscriptionNoteCategory;
  priority: AdminCompanyNotePriority;
  isPinned: boolean;
}) {
  const sub = await db.companySubscription.findUnique({
    where: { id: input.subscriptionId },
    select: { id: true, companyId: true },
  });
  if (!sub) throw Object.assign(new Error("Abonelik bulunamadı"), { status: 404 });

  const note = await db.adminSubscriptionNote.create({
    data: {
      subscriptionId: input.subscriptionId,
      authorUserId: input.actorUserId,
      content: input.content,
      category: input.category,
      priority: input.priority,
      isPinned: input.isPinned,
    },
    include: { author: { select: { name: true, email: true } } },
  });

  await logAdminSubscriptionAudit({
    actorUserId: input.actorUserId,
    subscriptionId: input.subscriptionId,
    companyId: sub.companyId,
    action: "ADMIN_SUBSCRIPTION_NOTE_CREATED",
    metadata: { noteId: note.id, category: input.category, priority: input.priority },
  });

  invalidateAdminSubscriptionCaches(input.subscriptionId, sub.companyId);
  return note;
}

export async function updateAdminSubscriptionNote(input: {
  noteId: string;
  subscriptionId: string;
  actorUserId: string;
  content?: string;
  category?: AdminSubscriptionNoteCategory;
  priority?: AdminCompanyNotePriority;
  isPinned?: boolean;
}) {
  const note = await db.adminSubscriptionNote.findUnique({
    where: { id: input.noteId },
    select: { id: true, subscriptionId: true, deletedAt: true },
  });
  if (!note || note.subscriptionId !== input.subscriptionId || note.deletedAt) {
    throw Object.assign(new Error("Not bulunamadı"), { status: 404 });
  }

  const sub = await db.companySubscription.findUnique({
    where: { id: input.subscriptionId },
    select: { companyId: true },
  });

  const updated = await db.adminSubscriptionNote.update({
    where: { id: input.noteId },
    data: {
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.isPinned !== undefined ? { isPinned: input.isPinned } : {}),
    },
    include: { author: { select: { name: true, email: true } } },
  });

  await logAdminSubscriptionAudit({
    actorUserId: input.actorUserId,
    subscriptionId: input.subscriptionId,
    companyId: sub?.companyId ?? "",
    action: "ADMIN_SUBSCRIPTION_NOTE_UPDATED",
    metadata: { noteId: input.noteId },
  });

  if (sub?.companyId) {
    invalidateAdminSubscriptionCaches(input.subscriptionId, sub.companyId);
  }
  return updated;
}

export async function deleteAdminSubscriptionNote(input: {
  noteId: string;
  subscriptionId: string;
  actorUserId: string;
}) {
  const note = await db.adminSubscriptionNote.findUnique({
    where: { id: input.noteId },
    select: { id: true, subscriptionId: true, deletedAt: true },
  });
  if (!note || note.subscriptionId !== input.subscriptionId || note.deletedAt) {
    throw Object.assign(new Error("Not bulunamadı"), { status: 404 });
  }

  const sub = await db.companySubscription.findUnique({
    where: { id: input.subscriptionId },
    select: { companyId: true },
  });

  await db.adminSubscriptionNote.update({
    where: { id: input.noteId },
    data: { deletedAt: new Date() },
  });

  await logAdminSubscriptionAudit({
    actorUserId: input.actorUserId,
    subscriptionId: input.subscriptionId,
    companyId: sub?.companyId ?? "",
    action: "ADMIN_SUBSCRIPTION_NOTE_DELETED",
    metadata: { noteId: input.noteId },
  });

  if (sub?.companyId) {
    invalidateAdminSubscriptionCaches(input.subscriptionId, sub.companyId);
  }
  return { success: true };
}
