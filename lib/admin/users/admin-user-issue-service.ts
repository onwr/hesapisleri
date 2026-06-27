import type { EmailVerificationStatus, LoginTrackingStatus, Status } from "@prisma/client";

export type UserIssue =
  | "SUSPENDED"
  | "NEVER_LOGGED_IN"
  | "INACTIVE_30D"
  | "EMAIL_VERIFICATION_PENDING"
  | "HAS_PENDING_INVITE";

export function detectUserIssues(input: {
  status: Status;
  loginTrackingStatus: LoginTrackingStatus;
  lastLoginAt: Date | null;
  emailVerificationStatus: EmailVerificationStatus;
  hasPendingInvite: boolean;
}): UserIssue[] {
  const issues: UserIssue[] = [];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  if (input.status === "SUSPENDED") {
    issues.push("SUSPENDED");
  }

  if (input.loginTrackingStatus === "NEVER_LOGGED_IN") {
    issues.push("NEVER_LOGGED_IN");
  } else if (
    input.loginTrackingStatus === "LOGGED_IN" &&
    input.lastLoginAt &&
    input.lastLoginAt < thirtyDaysAgo
  ) {
    issues.push("INACTIVE_30D");
  }

  if (input.emailVerificationStatus === "PENDING") {
    issues.push("EMAIL_VERIFICATION_PENDING");
  }

  if (input.hasPendingInvite) {
    issues.push("HAS_PENDING_INVITE");
  }

  return issues;
}

export function getIssueLabel(issue: UserIssue): string {
  const labels: Record<UserIssue, string> = {
    SUSPENDED: "Askıya Alındı",
    NEVER_LOGGED_IN: "Hiç Giriş Yapılmadı",
    INACTIVE_30D: "30+ Gündür İnaktif",
    EMAIL_VERIFICATION_PENDING: "E-posta Doğrulama Bekliyor",
    HAS_PENDING_INVITE: "Bekleyen Davet Var",
  };
  return labels[issue] ?? issue;
}
