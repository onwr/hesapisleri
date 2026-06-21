import { createHash, randomBytes } from "crypto";
import type {
  PartnerAudienceType,
  PartnerBadgeType,
  PartnerConversionType,
  PartnerEarningStatus,
} from "@prisma/client";
import { z } from "zod";

export const PARTNER_IP_SALT =
  process.env.PARTNER_IP_SALT ?? "hesapisleri-partner-salt";

export const partnerApplicationSchema = z.object({
  fullName: z.string().min(2, "Ad soyad zorunludur."),
  email: z.string().email("Geçerli bir e-posta girin."),
  phone: z.string().optional(),
  socialUrl: z.string().url("Geçerli bir URL girin.").optional().or(z.literal("")),
  audienceType: z.enum([
    "BUSINESS",
    "INFLUENCER",
    "AGENCY",
    "CUSTOMER",
    "OTHER",
  ]),
  expectedReach: z.string().optional(),
  message: z.string().max(2000).optional(),
  termsAccepted: z
    .boolean()
    .refine((value) => value === true, {
      message: "Şartları kabul etmelisiniz.",
    }),
});

export const approvePartnerApplicationSchema = z.object({
  referralCode: z.string().min(3).max(32).optional(),
  commissionRate: z.number().min(0).max(100),
  badgeType: z.enum([
    "NONE",
    "PARTNER",
    "VERIFIED",
    "INFLUENCER",
    "CELEBRITY",
    "VIP",
  ]),
  badgeLabel: z.string().max(80).optional(),
  notes: z.string().max(2000).optional(),
});

export const rejectPartnerApplicationSchema = z.object({
  rejectionReason: z.string().min(3, "Red nedeni zorunludur."),
});

export const updatePartnerProfileAdminSchema = z.object({
  commissionRate: z.number().min(0).max(100).optional(),
  badgeType: z
    .enum(["NONE", "PARTNER", "VERIFIED", "INFLUENCER", "CELEBRITY", "VIP"])
    .optional(),
  badgeLabel: z.string().max(80).nullable().optional(),
  status: z.enum(["ACTIVE", "PASSIVE", "SUSPENDED"]).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const updatePartnerSettingsSchema = z.object({
  defaultCommissionRate: z.number().min(0).max(100).optional(),
  cookieDurationDays: z.number().int().min(1).max(365).optional(),
  minimumPayoutAmount: z.number().min(0).optional(),
  autoApproveConversions: z.boolean().optional(),
  commissionOnRenewals: z.boolean().optional(),
  isApplicationOpen: z.boolean().optional(),
  termsText: z.string().max(5000).nullable().optional(),
});

export const createPartnerPayoutSchema = z.object({
  earningIds: z.array(z.string()).min(1),
  paymentMethod: z.enum(["IBAN", "CASH", "MANUAL"]).default("MANUAL"),
  note: z.string().max(2000).optional(),
  markPaid: z.boolean().default(true),
});

const AUDIENCE_LABELS: Record<PartnerAudienceType, string> = {
  BUSINESS: "İşletme Sahibi",
  INFLUENCER: "Influencer",
  AGENCY: "Ajans",
  CUSTOMER: "Müşteri",
  OTHER: "Diğer",
};

const BADGE_LABELS: Record<PartnerBadgeType, string> = {
  NONE: "Yok",
  PARTNER: "Partner",
  VERIFIED: "Doğrulanmış",
  INFLUENCER: "Influencer",
  CELEBRITY: "Ünlü",
  VIP: "VIP",
};

const CONVERSION_TYPE_LABELS: Record<PartnerConversionType, string> = {
  SIGNUP: "Kayıt",
  PAID_MEMBERSHIP: "Üyelik Ödemesi",
  RENEWAL: "Yenileme",
};

const EARNING_STATUS_LABELS: Record<PartnerEarningStatus, string> = {
  PENDING: "Bekliyor",
  APPROVED: "Onaylandı",
  PAYABLE: "Ödenebilir",
  PAID: "Ödendi",
  CANCELLED: "İptal",
};

export function normalizePartnerEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hashPartnerIp(ip: string) {
  return createHash("sha256")
    .update(`${PARTNER_IP_SALT}:${ip}`)
    .digest("hex");
}

export function sanitizeReferralCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 24);
}

export function generateReferralCode(seed: string) {
  const base = sanitizeReferralCode(seed.split(" ")[0] ?? "PARTNER") || "PARTNER";
  const suffix = randomBytes(2).toString("hex").toUpperCase();
  return `${base}${suffix}`.slice(0, 16);
}

export function calculatePartnerCommission(amount: number, commissionRate: number) {
  const safeAmount = Math.max(0, amount);
  const safeRate = Math.min(100, Math.max(0, commissionRate));
  return Math.round(((safeAmount * safeRate) / 100) * 100) / 100;
}

export function getAudienceTypeLabel(type: PartnerAudienceType) {
  return AUDIENCE_LABELS[type];
}

export function getBadgeTypeLabel(type: PartnerBadgeType) {
  return BADGE_LABELS[type];
}

export function getConversionTypeLabel(type: PartnerConversionType) {
  return CONVERSION_TYPE_LABELS[type];
}

export function getEarningStatusLabel(status: PartnerEarningStatus) {
  return EARNING_STATUS_LABELS[status];
}

export function getPartnerBadgeClass(type: PartnerBadgeType) {
  switch (type) {
    case "CELEBRITY":
      return "bg-rose-100 text-rose-700 border-rose-200";
    case "INFLUENCER":
      return "bg-violet-100 text-violet-700 border-violet-200";
    case "VIP":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "VERIFIED":
      return "bg-cyan-100 text-cyan-700 border-cyan-200";
    case "PARTNER":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

export function calculateConversionRate(clicks: number, conversions: number) {
  if (clicks <= 0) return 0;
  return Math.round((conversions / clicks) * 1000) / 10;
}
