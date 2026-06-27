import "server-only";

import type { PartnerProfile, PartnerProfileStatus } from "@prisma/client";

export type PartnerIssueCode =
  | "MISSING_CONTACT"
  | "REFERRAL_CODE_REQUIRED"
  | "REFERRAL_CODE_ALREADY_EXISTS"
  | "ACTIVE_WITHOUT_COMMISSION_RULE"
  | "COMPANY_RELATION_MISSING"
  | "ORPHAN_COMMISSION"
  | "COMMISSION_CURRENCY_MISMATCH"
  | "ARCHIVED_WITH_ACTIVE_COMPANIES"
  | "PAYMENT_PROFILE_MISSING";

export type PartnerIssue = {
  code: PartnerIssueCode;
  severity: "info" | "warning" | "error";
  message: string;
};

export type PartnerIssueInput = {
  partner: Pick<
    PartnerProfile,
    | "id"
    | "status"
    | "email"
    | "phone"
    | "referralCode"
    | "commissionRate"
    | "iban"
    | "payoutMethod"
    | "accountHolderName"
  >;
  companyCount?: number;
  activeCompanyCount?: number;
  orphanEarningCount?: number;
  currencyMismatchCount?: number;
  referralCodeDuplicate?: boolean;
};

export function detectPartnerIssues(input: PartnerIssueInput): PartnerIssue[] {
  const issues: PartnerIssue[] = [];
  const p = input.partner;
  const rate = Number(p.commissionRate);

  if (!p.email?.trim() && !p.phone?.trim()) {
    issues.push({
      code: "MISSING_CONTACT",
      severity: "error",
      message: "E-posta veya telefon zorunludur.",
    });
  } else if (!p.email?.trim() || !p.phone?.trim()) {
    issues.push({
      code: "MISSING_CONTACT",
      severity: "warning",
      message: "İletişim bilgileri eksik.",
    });
  }

  if (p.status === "ACTIVE" && (!Number.isFinite(rate) || rate <= 0)) {
    issues.push({
      code: "ACTIVE_WITHOUT_COMMISSION_RULE",
      severity: "error",
      message: "Aktif partner için komisyon oranı tanımlı olmalıdır.",
    });
  }

  if ((input.companyCount ?? 0) === 0 && p.status === "ACTIVE") {
    issues.push({
      code: "COMPANY_RELATION_MISSING",
      severity: "info",
      message: "Henüz bağlı firma yok.",
    });
  }

  if ((input.orphanEarningCount ?? 0) > 0) {
    issues.push({
      code: "ORPHAN_COMMISSION",
      severity: "warning",
      message: "Dönüşümü olmayan hak ediş kaydı var.",
    });
  }

  if ((input.currencyMismatchCount ?? 0) > 0) {
    issues.push({
      code: "COMMISSION_CURRENCY_MISMATCH",
      severity: "warning",
      message: "Farklı para birimlerinde hak edişler ayrı tutulmalıdır.",
    });
  }

  if (p.status === "ARCHIVED" && (input.activeCompanyCount ?? 0) > 0) {
    issues.push({
      code: "ARCHIVED_WITH_ACTIVE_COMPANIES",
      severity: "warning",
      message: "Arşivlenmiş partnerin aktif abonelikli firmaları var.",
    });
  }

  const needsPayout = p.status === "ACTIVE" || p.status === "PASSIVE";
  if (needsPayout && !p.iban && !p.payoutMethod) {
    issues.push({
      code: "PAYMENT_PROFILE_MISSING",
      severity: "warning",
      message: "Ödeme profili (IBAN veya yöntem) eksik.",
    });
  }

  return issues;
}

export function assertPartnerActivationAllowed(input: PartnerIssueInput) {
  const issues = detectPartnerIssues(input).filter((i) => i.severity === "error");
  if (issues.length) {
    return { ok: false as const, issues };
  }
  if (!input.partner.email?.trim()) {
    return {
      ok: false as const,
      issues: [
        {
          code: "MISSING_CONTACT" as const,
          severity: "error" as const,
          message: "Aktivasyon için e-posta zorunludur.",
        },
      ],
    };
  }
  if (!input.partner.referralCode?.trim()) {
    return {
      ok: false as const,
      issues: [
        {
          code: "REFERRAL_CODE_REQUIRED" as const,
          severity: "error" as const,
          message: "Aktivasyon için referans kodu zorunludur.",
        },
      ],
    };
  }
  if (input.referralCodeDuplicate) {
    return {
      ok: false as const,
      issues: [
        {
          code: "REFERRAL_CODE_ALREADY_EXISTS" as const,
          severity: "error" as const,
          message: "Referans kodu başka bir partnerde kayıtlı.",
        },
      ],
    };
  }
  const rate = Number(input.partner.commissionRate);
  if (!Number.isFinite(rate) || rate <= 0) {
    return {
      ok: false as const,
      issues: [
        {
          code: "ACTIVE_WITHOUT_COMMISSION_RULE" as const,
          severity: "error" as const,
          message: "Komisyon oranı zorunludur.",
        },
      ],
    };
  }
  return { ok: true as const };
}

export function isPartnerArchived(status: PartnerProfileStatus) {
  return status === "ARCHIVED";
}
