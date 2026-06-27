import { db } from "@/lib/prisma";
import { logAdminUserAudit } from "@/lib/admin/users/admin-user-audit";
import {
  adminUserNoteSchema,
  adminUserNotePatchSchema,
} from "@/lib/admin/users/admin-user-schemas";

export class AdminUserNoteError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "AdminUserNoteError";
    this.status = status;
  }
}

export async function listAdminUserNotes(userId: string) {
  const notes = await db.adminUserNote.findMany({
    where: { userId, deletedAt: null },
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

export async function createAdminUserNote(
  userId: string,
  actorUserId: string,
  body: unknown
) {
  const parsed = adminUserNoteSchema.safeParse(body);
  if (!parsed.success) {
    throw new AdminUserNoteError(
      parsed.error.issues[0]?.message ?? "Geçersiz not."
    );
  }

  const note = await db.adminUserNote.create({
    data: {
      userId,
      authorUserId: actorUserId,
      content: parsed.data.content,
      category: parsed.data.category,
      priority: parsed.data.priority,
      isPinned: parsed.data.isPinned,
    },
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  await logAdminUserAudit({
    actorUserId,
    targetUserId: userId,
    action: "ADMIN_USER_NOTE_CREATED",
    metadata: { noteId: note.id, category: note.category },
  });

  return {
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
  };
}

export async function updateAdminUserNote(
  userId: string,
  noteId: string,
  actorUserId: string,
  body: unknown
) {
  const parsed = adminUserNotePatchSchema.safeParse(body);
  if (!parsed.success) {
    throw new AdminUserNoteError(
      parsed.error.issues[0]?.message ?? "Geçersiz not."
    );
  }

  const existing = await db.adminUserNote.findFirst({
    where: { id: noteId, userId, deletedAt: null },
  });
  if (!existing) {
    throw new AdminUserNoteError("Not bulunamadı.", 404);
  }

  const note = await db.adminUserNote.update({
    where: { id: noteId },
    data: parsed.data,
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  await logAdminUserAudit({
    actorUserId,
    targetUserId: userId,
    action: "ADMIN_USER_NOTE_UPDATED",
    metadata: { noteId },
  });

  return {
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
  };
}

export async function deleteAdminUserNote(
  userId: string,
  noteId: string,
  actorUserId: string
) {
  const existing = await db.adminUserNote.findFirst({
    where: { id: noteId, userId, deletedAt: null },
  });
  if (!existing) {
    throw new AdminUserNoteError("Not bulunamadı.", 404);
  }

  await db.adminUserNote.update({
    where: { id: noteId },
    data: { deletedAt: new Date() },
  });

  await logAdminUserAudit({
    actorUserId,
    targetUserId: userId,
    action: "ADMIN_USER_NOTE_DELETED",
    metadata: { noteId },
  });

  return { success: true };
}

export async function countAdminUserNotes(userId: string) {
  return db.adminUserNote.count({ where: { userId, deletedAt: null } });
}
