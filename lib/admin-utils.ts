import { z } from "zod";
import type { MembershipStatus, Status, UserRole } from "@prisma/client";

export const adminCompanyPatchSchema = z.object({
  status: z.enum(["ACTIVE", "PASSIVE", "SUSPENDED"]).optional(),
  name: z.string().min(2).optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  taxNo: z.string().nullable().optional(),
  taxOffice: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  membershipStatus: z.enum(["ACTIVE", "PAST_DUE", "CANCELLED"]).optional(),
  lastPaymentDate: z.string().datetime().nullable().optional(),
  nextPaymentDate: z.string().datetime().nullable().optional(),
  monthlyFee: z.number().min(0).optional(),
  membershipNote: z.string().nullable().optional(),
});

// role ve status bu schema üzerinden değiştirilemez.
// Durum değişikliği yalnızca /suspend ve /reactivate endpointleri üzerinden yapılır.
// Platform rol değişikliği ayrı bir güvenlik fazında ele alınacak.
export const adminUserPatchSchema = z.object({}).strict();

export function getMembershipStatusLabel(status: MembershipStatus | string) {
  const map: Record<string, string> = {
    TRIAL: "Deneme",
    ACTIVE: "Aktif",
    PAST_DUE: "Gecikmiş",
    GRACE_PERIOD: "Ek Süre",
    CANCELLED: "İptal",
    EXPIRED: "Süresi Doldu",
  };
  return map[status] ?? "Bilinmiyor";
}

export function getMembershipStatusClass(status: MembershipStatus | string) {
  if (status === "ACTIVE" || status === "TRIAL")
    return "bg-emerald-100 text-emerald-700";
  if (status === "PAST_DUE" || status === "GRACE_PERIOD")
    return "bg-orange-100 text-orange-700";
  if (status === "EXPIRED") return "bg-rose-100 text-rose-700";
  if (status === "CANCELLED") return "bg-slate-100 text-slate-600";
  return "bg-slate-100 text-slate-700";
}

/** @deprecated use getMembershipStatusLabel */
export function getSubscriptionStatusLabel(status: string) {
  return getMembershipStatusLabel(status);
}

/** @deprecated use getMembershipStatusClass */
export function getSubscriptionStatusClass(status: string) {
  return getMembershipStatusClass(status);
}

export function getCompanyStatusLabel(status: Status) {
  if (status === "ACTIVE") return "Aktif";
  if (status === "PASSIVE") return "Pasif";
  return "Askıda";
}

export function getCompanyStatusClass(status: Status) {
  if (status === "ACTIVE") return "bg-emerald-100 text-emerald-700";
  if (status === "PASSIVE") return "bg-slate-100 text-slate-700";
  return "bg-rose-100 text-rose-700";
}

export function getPlatformRoleLabel(role: UserRole) {
  return role === "SUPER_ADMIN" ? "Super Admin" : "Kullanıcı";
}

export function validateSuperAdminRoleChange(input: {
  actorUserId: string;
  targetUserId: string;
  nextRole: UserRole;
}) {
  if (
    input.actorUserId === input.targetUserId &&
    input.nextRole !== "SUPER_ADMIN"
  ) {
    return {
      ok: false as const,
      message: "Kendi Super Admin yetkinizi kaldıramazsınız.",
    };
  }

  return { ok: true as const };
}

export function validateUserStatusChange(input: {
  actorUserId: string;
  targetUserId: string;
  nextStatus: Status;
}) {
  if (input.actorUserId === input.targetUserId && input.nextStatus !== "ACTIVE") {
    return {
      ok: false as const,
      message: "Kendi hesabınızı pasife alamazsınız.",
    };
  }

  return { ok: true as const };
}

export function parseOptionalDate(value?: string | null) {
  if (!value) return null;
  return new Date(value);
}

export { formatMoney as formatAdminMoney } from "@/lib/format-utils";

export function formatAdminDate(date?: Date | string | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export function formatAdminDateTime(date?: Date | string | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}
