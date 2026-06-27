import "server-only";
import { db } from "@/lib/prisma";
import {
  adminPaymentNoteCreateSchema,
  adminPaymentNoteUpdateSchema,
} from "@/lib/admin/payments/admin-payment-schemas";
import { logAdminPaymentAudit } from "@/lib/admin/payments/admin-payment-audit";
import { invalidateAdminPaymentCaches } from "@/lib/admin/payments/admin-payment-cache";

export class AdminPaymentNoteError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "AdminPaymentNoteError";
    this.status = status;
  }
}

export async function listAdminPaymentNotes(paymentId: string) {
  const notes = await db.adminPaymentNote.findMany({
    where: { paymentId, deletedAt: null },
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

export async function createAdminPaymentNote(
  paymentId: string,
  actorUserId: string,
  body: unknown
) {
  const parsed = adminPaymentNoteCreateSchema.safeParse(body);
  if (!parsed.success) {
    throw new AdminPaymentNoteError(parsed.error.issues[0]?.message ?? "Geçersiz not.");
  }

  const payment = await db.membershipPayment.findUnique({
    where: { id: paymentId },
    select: { id: true, companyId: true, subscriptionId: true },
  });
  if (!payment) throw new AdminPaymentNoteError("Ödeme bulunamadı.", 404);

  const note = await db.adminPaymentNote.create({
    data: {
      paymentId,
      authorUserId: actorUserId,
      content: parsed.data.content,
      category: parsed.data.category,
      priority: parsed.data.priority,
      isPinned: parsed.data.isPinned,
    },
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  await logAdminPaymentAudit({
    actorUserId,
    paymentId,
    companyId: payment.companyId,
    subscriptionId: payment.subscriptionId,
    action: "ADMIN_PAYMENT_NOTE_CREATED",
    metadata: { noteId: note.id, category: note.category },
  });

  invalidateAdminPaymentCaches(paymentId, payment.companyId, payment.subscriptionId ?? undefined);
  return note;
}

export async function updateAdminPaymentNote(
  paymentId: string,
  noteId: string,
  actorUserId: string,
  body: unknown
) {
  const parsed = adminPaymentNoteUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw new AdminPaymentNoteError(parsed.error.issues[0]?.message ?? "Geçersiz not.");
  }

  const existing = await db.adminPaymentNote.findFirst({
    where: { id: noteId, paymentId, deletedAt: null },
  });
  if (!existing) throw new AdminPaymentNoteError("Not bulunamadı.", 404);

  const payment = await db.membershipPayment.findUnique({
    where: { id: paymentId },
    select: { companyId: true, subscriptionId: true },
  });
  if (!payment) throw new AdminPaymentNoteError("Ödeme bulunamadı.", 404);

  const note = await db.adminPaymentNote.update({
    where: { id: noteId },
    data: parsed.data,
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  await logAdminPaymentAudit({
    actorUserId,
    paymentId,
    companyId: payment.companyId,
    subscriptionId: payment.subscriptionId,
    action: "ADMIN_PAYMENT_NOTE_UPDATED",
    metadata: { noteId },
  });

  invalidateAdminPaymentCaches(paymentId, payment.companyId, payment.subscriptionId ?? undefined);
  return note;
}

export async function deleteAdminPaymentNote(
  paymentId: string,
  noteId: string,
  actorUserId: string
) {
  const existing = await db.adminPaymentNote.findFirst({
    where: { id: noteId, paymentId, deletedAt: null },
  });
  if (!existing) throw new AdminPaymentNoteError("Not bulunamadı.", 404);

  const payment = await db.membershipPayment.findUnique({
    where: { id: paymentId },
    select: { companyId: true, subscriptionId: true },
  });
  if (!payment) throw new AdminPaymentNoteError("Ödeme bulunamadı.", 404);

  await db.adminPaymentNote.update({
    where: { id: noteId },
    data: { deletedAt: new Date() },
  });

  await logAdminPaymentAudit({
    actorUserId,
    paymentId,
    companyId: payment.companyId,
    subscriptionId: payment.subscriptionId,
    action: "ADMIN_PAYMENT_NOTE_DELETED",
    metadata: { noteId },
  });

  invalidateAdminPaymentCaches(paymentId, payment.companyId, payment.subscriptionId ?? undefined);
  return { success: true };
}

export async function countAdminPaymentNotes(paymentId: string) {
  return db.adminPaymentNote.count({ where: { paymentId, deletedAt: null } });
}
