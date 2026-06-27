import { db } from "@/lib/prisma";
import { logAdminCompanyAudit } from "@/lib/admin/companies/admin-company-audit";
import {
  adminCompanyNotePatchSchema,
  adminCompanyNoteSchema,
} from "@/lib/admin/companies/admin-company-schemas";
import { invalidateAdminCompanyCaches } from "@/lib/admin/companies/admin-company-cache";

export class AdminCompanyNoteError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "AdminCompanyNoteError";
    this.status = status;
  }
}

export async function listAdminCompanyNotes(companyId: string) {
  const notes = await db.adminCompanyNote.findMany({
    where: { companyId, deletedAt: null },
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
    author: {
      id: note.author.id,
      name: note.author.name,
      email: note.author.email,
    },
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  }));
}

export async function createAdminCompanyNote(
  companyId: string,
  actorUserId: string,
  body: unknown
) {
  const parsed = adminCompanyNoteSchema.safeParse(body);
  if (!parsed.success) {
    throw new AdminCompanyNoteError(parsed.error.issues[0]?.message ?? "Geçersiz not.");
  }

  const note = await db.adminCompanyNote.create({
    data: {
      companyId,
      authorUserId: actorUserId,
      content: parsed.data.content,
      category: parsed.data.category,
      priority: parsed.data.priority,
      isPinned: parsed.data.isPinned ?? false,
    },
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  await logAdminCompanyAudit({
    actorUserId,
    companyId,
    action: "ADMIN_COMPANY_NOTE_CREATED",
    metadata: { noteId: note.id, category: note.category },
  });

  invalidateAdminCompanyCaches(companyId);
  return note;
}

export async function updateAdminCompanyNote(
  companyId: string,
  noteId: string,
  actorUserId: string,
  body: unknown
) {
  const parsed = adminCompanyNotePatchSchema.safeParse(body);
  if (!parsed.success) {
    throw new AdminCompanyNoteError(parsed.error.issues[0]?.message ?? "Geçersiz not.");
  }

  const existing = await db.adminCompanyNote.findFirst({
    where: { id: noteId, companyId, deletedAt: null },
  });
  if (!existing) {
    throw new AdminCompanyNoteError("Not bulunamadı.", 404);
  }

  const note = await db.adminCompanyNote.update({
    where: { id: noteId },
    data: parsed.data,
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  await logAdminCompanyAudit({
    actorUserId,
    companyId,
    action: "ADMIN_COMPANY_NOTE_UPDATED",
    metadata: { noteId },
  });

  invalidateAdminCompanyCaches(companyId);
  return note;
}

export async function deleteAdminCompanyNote(
  companyId: string,
  noteId: string,
  actorUserId: string
) {
  const existing = await db.adminCompanyNote.findFirst({
    where: { id: noteId, companyId, deletedAt: null },
  });
  if (!existing) {
    throw new AdminCompanyNoteError("Not bulunamadı.", 404);
  }

  await db.adminCompanyNote.update({
    where: { id: noteId },
    data: { deletedAt: new Date() },
  });

  await logAdminCompanyAudit({
    actorUserId,
    companyId,
    action: "ADMIN_COMPANY_NOTE_DELETED",
    metadata: { noteId },
  });

  invalidateAdminCompanyCaches(companyId);
  return { success: true };
}

export async function countAdminCompanyNotes(companyId: string) {
  return db.adminCompanyNote.count({
    where: { companyId, deletedAt: null },
  });
}
