import { z } from "zod";
import type { UserRole } from "@prisma/client";
import {
  canManageUsers,
  isOwnerRole,
  resolveEffectiveRole,
} from "@/lib/permission-utils";

export const INVITE_EXPIRY_DAYS = 7;

export const assignableInviteRoleSchema = z.enum([
  "ADMIN",
  "ACCOUNTANT",
  "STAFF",
]);

export const createInviteSchema = z.object({
  email: z.string().email("Geçerli bir e-posta girin."),
  role: assignableInviteRoleSchema,
});

export const changeCompanyUserRoleSchema = z.object({
  role: assignableInviteRoleSchema,
});

export const acceptInviteSchema = z.object({
  token: z.string().min(10, "Davet kodu geçersiz."),
  name: z.string().min(2).optional(),
  password: z.string().min(6).optional(),
});

export type AssignableInviteRole = z.infer<typeof assignableInviteRoleSchema>;

export function normalizeInviteEmail(email: string) {
  return email.trim().toLowerCase();
}

export function buildInviteExpiryDate(from = new Date()) {
  const expiresAt = new Date(from);
  expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);
  return expiresAt;
}

export function buildInviteLink(token: string, baseUrl?: string) {
  const origin =
    baseUrl ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000";

  return `${origin.replace(/\/$/, "")}/invite?token=${encodeURIComponent(token)}`;
}

export function isInviteExpired(expiresAt: Date, now = new Date()) {
  return expiresAt.getTime() <= now.getTime();
}

export function validateActorCanManageUsers(input: {
  actorRole: UserRole;
  actorIsOwner: boolean;
}) {
  if (!canManageUsers(input.actorRole, input.actorIsOwner)) {
    return {
      ok: false as const,
      message: "Kullanıcı yönetimi için yetkiniz yok.",
    };
  }

  return { ok: true as const };
}

export function validateInviteTargetEmail(input: {
  email: string;
  existingMemberEmails: string[];
}) {
  const normalized = normalizeInviteEmail(input.email);

  if (
    input.existingMemberEmails.some(
      (entry) => normalizeInviteEmail(entry) === normalized
    )
  ) {
    return {
      ok: false as const,
      message: "Bu e-posta adresi zaten şirkette kayıtlı.",
    };
  }

  return { ok: true as const, email: normalized };
}

export function validateRoleChange(input: {
  actorRole: UserRole;
  actorIsOwner: boolean;
  actorUserId: string;
  targetUserId: string;
  targetRole: UserRole;
  targetIsOwner: boolean;
  nextRole: AssignableInviteRole;
}) {
  const actorCheck = validateActorCanManageUsers({
    actorRole: input.actorRole,
    actorIsOwner: input.actorIsOwner,
  });

  if (!actorCheck.ok) {
    return actorCheck;
  }

  if (isOwnerRole(input.targetRole, input.targetIsOwner)) {
    return {
      ok: false as const,
      message: "Firma sahibinin rolü bu işlemle değiştirilemez.",
    };
  }

  const actorEffective = resolveEffectiveRole({
    role: input.actorRole,
    isOwner: input.actorIsOwner,
  });

  if (
    actorEffective === "ADMIN" &&
    isOwnerRole(input.targetRole, input.targetIsOwner)
  ) {
    return {
      ok: false as const,
      message: "Yönetici, firma sahibi üzerinde işlem yapamaz.",
    };
  }

  if (
    input.actorUserId === input.targetUserId &&
    isOwnerRole(input.actorRole, input.actorIsOwner)
  ) {
    return {
      ok: false as const,
      message: "Kendi sahip yetkinizi düşüremezsiniz.",
    };
  }

  return { ok: true as const };
}

export function validateRemoveCompanyUser(input: {
  actorRole: UserRole;
  actorIsOwner: boolean;
  actorUserId: string;
  targetUserId: string;
  targetRole: UserRole;
  targetIsOwner: boolean;
}) {
  const actorCheck = validateActorCanManageUsers({
    actorRole: input.actorRole,
    actorIsOwner: input.actorIsOwner,
  });

  if (!actorCheck.ok) {
    return actorCheck;
  }

  if (input.actorUserId === input.targetUserId) {
    return {
      ok: false as const,
      message: "Kendi hesabınızı firmadan çıkaramazsınız.",
    };
  }

  if (isOwnerRole(input.targetRole, input.targetIsOwner)) {
    return {
      ok: false as const,
      message: "Firma sahibi firmadan çıkarılamaz.",
    };
  }

  const actorEffective = resolveEffectiveRole({
    role: input.actorRole,
    isOwner: input.actorIsOwner,
  });

  if (
    actorEffective === "ADMIN" &&
    isOwnerRole(input.targetRole, input.targetIsOwner)
  ) {
    return {
      ok: false as const,
      message: "Yönetici, firma sahibini firmadan çıkaramaz.",
    };
  }

  return { ok: true as const };
}
