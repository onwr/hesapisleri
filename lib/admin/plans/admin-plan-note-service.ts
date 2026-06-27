import "server-only";

import { db } from "@/lib/prisma";
import {
  adminPlanNoteCreateSchema,
  adminPlanNotePatchSchema,
} from "@/lib/admin/plans/admin-plan-schemas";
import { invalidateAdminPlanNoteCaches } from "@/lib/admin/plans/admin-plan-cache";
import { logAdminPlanAudit } from "@/lib/admin/plans/admin-plan-audit-service";

export class AdminPlanNoteError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "AdminPlanNoteError";
    this.status = status;
  }
}

async function logPlanNoteAudit(input: {
  adminUserId: string;
  action: string;
  planId: string;
  noteId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}) {
  await logAdminPlanAudit({
    userId: input.adminUserId,
    action: input.action,
    planId: input.planId,
    entityType: "AdminPlanNote",
    entityId: input.noteId,
    displayMessage: `Plan notu: ${input.action}`,
    metadata: {
      noteId: input.noteId,
      before: input.before,
      after: input.after,
    },
  });
}

function noteSnapshot(note: {
  content: string;
  category: string;
  priority: string;
  isPinned: boolean;
}) {
  return {
    content: note.content.length > 200 ? `${note.content.slice(0, 200)}…` : note.content,
    category: note.category,
    priority: note.priority,
    isPinned: note.isPinned,
  };
}

export async function listAdminPlanNotes(planId: string) {
  const notes = await db.adminPlanNote.findMany({
    where: { planId, deletedAt: null },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    include: {
      author: { select: { id: true, name: true, email: true } },
    },
  });

  return notes.map((note) => ({
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
  }));
}

export async function countAdminPlanNotes(planId: string) {
  return db.adminPlanNote.count({ where: { planId, deletedAt: null } });
}

export async function createAdminPlanNote(planId: string, actorUserId: string, body: unknown) {
  const parsed = adminPlanNoteCreateSchema.safeParse(body);
  if (!parsed.success) {
    throw new AdminPlanNoteError(parsed.error.issues[0]?.message ?? "Geçersiz not.");
  }

  const plan = await db.membershipPlan.findUnique({ where: { id: planId }, select: { id: true } });
  if (!plan) throw new AdminPlanNoteError("Plan bulunamadı.", 404);

  const note = await db.adminPlanNote.create({
    data: {
      planId,
      authorUserId: actorUserId,
      content: parsed.data.content,
      category: parsed.data.category,
      priority: parsed.data.priority,
      isPinned: parsed.data.isPinned ?? false,
    },
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  await logPlanNoteAudit({
    adminUserId: actorUserId,
    action: "ADMIN_PLAN_NOTE_CREATED",
    planId,
    noteId: note.id,
    after: noteSnapshot(note),
  });

  invalidateAdminPlanNoteCaches(planId);
  return note;
}

export async function updateAdminPlanNote(
  planId: string,
  noteId: string,
  actorUserId: string,
  body: unknown
) {
  const parsed = adminPlanNotePatchSchema.safeParse(body);
  if (!parsed.success) {
    throw new AdminPlanNoteError(parsed.error.issues[0]?.message ?? "Geçersiz not.");
  }

  const existing = await db.adminPlanNote.findFirst({
    where: { id: noteId, planId, deletedAt: null },
  });
  if (!existing) throw new AdminPlanNoteError("Not bulunamadı.", 404);

  const before = noteSnapshot(existing);
  const note = await db.adminPlanNote.update({
    where: { id: noteId },
    data: parsed.data,
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  let action = "ADMIN_PLAN_NOTE_UPDATED";
  if (
    parsed.data.isPinned !== undefined &&
    parsed.data.isPinned !== existing.isPinned &&
    Object.keys(parsed.data).length === 1
  ) {
    action = parsed.data.isPinned ? "ADMIN_PLAN_NOTE_PINNED" : "ADMIN_PLAN_NOTE_UNPINNED";
  }

  await logPlanNoteAudit({
    adminUserId: actorUserId,
    action,
    planId,
    noteId: note.id,
    before,
    after: noteSnapshot(note),
  });

  invalidateAdminPlanNoteCaches(planId);
  return note;
}

export async function deleteAdminPlanNote(planId: string, noteId: string, actorUserId: string) {
  const existing = await db.adminPlanNote.findFirst({
    where: { id: noteId, planId, deletedAt: null },
  });
  if (!existing) throw new AdminPlanNoteError("Not bulunamadı.", 404);

  await db.adminPlanNote.update({
    where: { id: noteId },
    data: { deletedAt: new Date() },
  });

  await logPlanNoteAudit({
    adminUserId: actorUserId,
    action: "ADMIN_PLAN_NOTE_DELETED",
    planId,
    noteId,
    before: noteSnapshot(existing),
  });

  invalidateAdminPlanNoteCaches(planId);
  return { success: true };
}
