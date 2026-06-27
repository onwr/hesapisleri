import type { PartnerApplication, PartnerProfile } from "@prisma/client";

export type ApplicationIssueCode =
  | "EMAIL_MISSING"
  | "PHONE_MISSING"
  | "EXISTING_PARTNER_PROFILE"
  | "DUPLICATE_EMAIL"
  | "USER_NOT_FOUND"
  | "INVALID_STATUS_TRANSITION"
  | "APPLICATION_ALREADY_PROCESSED";

export type ApplicationIssue = {
  code: ApplicationIssueCode;
  severity: "info" | "warning" | "error";
  message: string;
};

export type ApplicationIssueInput = {
  application: Pick<
    PartnerApplication,
    "id" | "email" | "phone" | "status" | "fullName"
  >;
  linkedProfile?: Pick<PartnerProfile, "id" | "email" | "applicationId"> | null;
  matchingProfileByEmail?: Pick<PartnerProfile, "id" | "email" | "applicationId"> | null;
  duplicateEmailCount?: number;
  matchedUserId?: string | null;
};

export function detectApplicationIssues(input: ApplicationIssueInput): ApplicationIssue[] {
  const issues: ApplicationIssue[] = [];
  const app = input.application;

  if (!app.email?.trim()) {
    issues.push({
      code: "EMAIL_MISSING",
      severity: "error",
      message: "E-posta eksik.",
    });
  }

  if (!app.phone?.trim()) {
    issues.push({
      code: "PHONE_MISSING",
      severity: "warning",
      message: "Telefon eksik.",
    });
  }

  if (app.status !== "PENDING") {
    issues.push({
      code: "APPLICATION_ALREADY_PROCESSED",
      severity: "info",
      message: "Başvuru zaten sonuçlandırılmış.",
    });
  }

  const profile = input.linkedProfile ?? input.matchingProfileByEmail;
  if (profile && profile.applicationId !== app.id) {
    issues.push({
      code: "EXISTING_PARTNER_PROFILE",
      severity: "warning",
      message: "Aynı e-posta ile kayıtlı partner profili var.",
    });
  } else if (profile?.applicationId === app.id) {
    issues.push({
      code: "EXISTING_PARTNER_PROFILE",
      severity: "info",
      message: "Başvuru mevcut partner profiline bağlı.",
    });
  }

  if ((input.duplicateEmailCount ?? 0) > 1) {
    issues.push({
      code: "DUPLICATE_EMAIL",
      severity: "warning",
      message: "Aynı e-posta ile birden fazla başvuru var.",
    });
  }

  if (app.email?.trim() && input.matchedUserId === null) {
    issues.push({
      code: "USER_NOT_FOUND",
      severity: "info",
      message: "E-posta ile eşleşen kullanıcı hesabı yok.",
    });
  }

  return issues;
}

export function assertApplicationPending(status: string) {
  if (status === "PENDING") return { ok: true as const };
  return {
    ok: false as const,
    issues: [
      {
        code: "APPLICATION_ALREADY_PROCESSED" as const,
        severity: "error" as const,
        message: "Yalnızca bekleyen başvurular işlenebilir.",
      },
    ],
  };
}

export function assertValidStatusTransition(from: string, to: "APPROVED" | "REJECTED") {
  if (from !== "PENDING") {
    return {
      ok: false as const,
      issues: [
        {
          code: "INVALID_STATUS_TRANSITION" as const,
          severity: "error" as const,
          message: `PENDING dışındaki başvuru ${to} yapılamaz.`,
        },
      ],
    };
  }
  return { ok: true as const };
}
