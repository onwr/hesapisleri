import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";

export type AdminCompanyIssue = {
  code: string;
  label: string;
  severity: "info" | "warning" | "danger";
  href?: string;
};

type IssueInput = {
  company: {
    id: string;
    status: string;
    archivedAt: Date | null;
  };
  subscription: {
    id: string;
    status: string;
    trialEndsAt: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    failedPaymentCount: number;
  } | null;
  owner: {
    status: string;
  } | null;
  activeUserCount: number;
  lastPayment: {
    status: string;
    failedAt: Date | null;
  } | null;
  lastLoginAt: Date | null;
  lastActivityAt: Date | null;
  integrationErrors: number;
  now?: Date;
};

function daysBetween(from: Date, to: Date) {
  return Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

export function detectCompanyIssues(input: IssueInput): AdminCompanyIssue[] {
  const now = input.now ?? new Date();
  const issues: AdminCompanyIssue[] = [];
  const companyId = input.company.id;

  if (input.company.status === "SUSPENDED") {
    issues.push({
      code: "suspended",
      label: "Firma askıya alınmış",
      severity: "danger",
      href: `/admin/companies/${companyId}?tab=overview`,
    });
  }

  if (input.company.archivedAt) {
    issues.push({
      code: "archived",
      label: "Firma arşivlenmiş",
      severity: "warning",
    });
  }

  if (!input.owner) {
    issues.push({
      code: "no_owner",
      label: "Sahip kullanıcı tanımlı değil",
      severity: "danger",
      href: `/admin/companies/${companyId}?tab=users`,
    });
  } else if (input.owner.status !== "ACTIVE") {
    issues.push({
      code: "owner_inactive",
      label: "Sahip kullanıcı pasif",
      severity: "warning",
      href: `/admin/companies/${companyId}?tab=users`,
    });
  }

  if (input.activeUserCount === 0) {
    issues.push({
      code: "no_active_users",
      label: "Aktif kullanıcı yok",
      severity: "warning",
      href: `/admin/companies/${companyId}?tab=users`,
    });
  }

  const sub = input.subscription;
  if (sub) {
    if (sub.status === "TRIAL" && sub.trialEndsAt) {
      const daysLeft = daysBetween(now, sub.trialEndsAt);
      if (daysLeft <= 7) {
        issues.push({
          code: "trial_ending",
          label: `Trial ${Math.max(daysLeft, 0)} gün içinde bitiyor`,
          severity: daysLeft <= 3 ? "danger" : "warning",
          href: `/admin/companies/${companyId}?tab=subscription`,
        });
      }
    }

    if (sub.status === "PAST_DUE" || sub.status === "GRACE_PERIOD") {
      issues.push({
        code: "payment_overdue",
        label: "Ödeme gecikmiş",
        severity: "danger",
        href: `/admin/companies/${companyId}?tab=payments`,
      });
    }

    if (sub.failedPaymentCount >= 3) {
      issues.push({
        code: "multiple_failed_payments",
        label: `Son ${sub.failedPaymentCount} ödeme başarısız`,
        severity: "danger",
        href: `/admin/companies/${companyId}?tab=payments`,
      });
    }

    if (sub.cancelAtPeriodEnd) {
      issues.push({
        code: "cancel_scheduled",
        label: "Dönem sonunda iptal planlandı",
        severity: "warning",
        href: `/admin/companies/${companyId}?tab=subscription`,
      });
    } else if (sub.currentPeriodEnd) {
      const daysLeft = daysBetween(now, sub.currentPeriodEnd);
      if (daysLeft <= 7 && ["ACTIVE", "CANCEL_AT_PERIOD_END"].includes(sub.status)) {
        issues.push({
          code: "subscription_ending",
          label: `Abonelik ${Math.max(daysLeft, 0)} gün içinde bitiyor`,
          severity: "warning",
          href: `/admin/companies/${companyId}?tab=subscription`,
        });
      }
    }
  }

  if (input.lastPayment?.status === "FAILED") {
    const days =
      input.lastPayment.failedAt != null
        ? daysBetween(input.lastPayment.failedAt, now)
        : null;
    issues.push({
      code: "last_payment_failed",
      label:
        days != null
          ? `Son ödeme ${days} gün önce başarısız`
          : "Son ödeme başarısız",
      severity: "danger",
      href: `/admin/companies/${companyId}?tab=payments`,
    });
  }

  if (input.lastLoginAt) {
    const daysSinceLogin = daysBetween(input.lastLoginAt, now);
    if (daysSinceLogin >= 14) {
      issues.push({
        code: "inactive_login",
        label: `${daysSinceLogin} gündür kullanıcı girişi yok`,
        severity: daysSinceLogin >= 30 ? "danger" : "warning",
        href: `/admin/companies/${companyId}?tab=activity`,
      });
    }
  } else if (input.lastActivityAt) {
    const daysSinceActivity = daysBetween(input.lastActivityAt, now);
    if (daysSinceActivity >= 30) {
      issues.push({
        code: "inactive",
        label: `${daysSinceActivity} gündür aktivite yok`,
        severity: "warning",
        href: `/admin/companies/${companyId}?tab=activity`,
      });
    }
  } else {
    issues.push({
      code: "never_active",
      label: "Hiç aktivite kaydı yok",
      severity: "info",
      href: `/admin/companies/${companyId}?tab=activity`,
    });
  }

  if (input.integrationErrors > 0) {
    issues.push({
      code: "integration_error",
      label: "Entegrasyon hatası mevcut",
      severity: "warning",
      href: `/admin/companies/${companyId}?tab=integrations`,
    });
  }

  return issues;
}

export async function batchLastActivityMap(companyIds: string[]) {
  if (companyIds.length === 0) return new Map<string, Date>();

  const rows = await db.activityLog.groupBy({
      by: ["companyId"],
      where: { companyId: { in: companyIds } },
      _max: { createdAt: true },
    });

  return new Map(
    rows
      .filter((row) => row.companyId && row._max.createdAt)
      .map((row) => [row.companyId!, row._max.createdAt!])
  );
}

export async function batchLastLoginMap(companyIds: string[]) {
  if (companyIds.length === 0) return new Map<string, Date>();

  const rows = await db.activityLog.groupBy({
      by: ["companyId"],
      where: {
        companyId: { in: companyIds },
        action: "LOGIN",
      },
      _max: { createdAt: true },
    });

  return new Map(
    rows
      .filter((row) => row.companyId && row._max.createdAt)
      .map((row) => [row.companyId!, row._max.createdAt!])
  );
}
