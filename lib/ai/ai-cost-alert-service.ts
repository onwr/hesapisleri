import { db } from "@/lib/prisma";
import { createNotification } from "@/lib/notification-service";
import { getMonthlyAiUsageSummary } from "@/lib/ai/ai-usage-service";

export type MonthlyCostAlertStatus = {
  thresholdUsd: number | null;
  currentCostUsd: number;
  exceeded: boolean;
  autoDisableOnCostExceeded: boolean;
  aiDisabledByCost: boolean;
};

export async function getMonthlyCostAlertStatus(
  companyId: string
): Promise<MonthlyCostAlertStatus> {
  const settings = await db.companyAISettings.findUnique({
    where: { companyId },
    select: {
      monthlyCostWarningUsd: true,
      autoDisableOnCostExceeded: true,
      enabled: true,
    },
  });

  const usage = await getMonthlyAiUsageSummary(companyId);
  const thresholdUsd = settings?.monthlyCostWarningUsd
    ? Number(settings.monthlyCostWarningUsd)
    : null;
  const exceeded = thresholdUsd != null && usage.estimatedCostUsd >= thresholdUsd;

  return {
    thresholdUsd,
    currentCostUsd: usage.estimatedCostUsd,
    exceeded,
    autoDisableOnCostExceeded: settings?.autoDisableOnCostExceeded ?? false,
    aiDisabledByCost: exceeded && settings?.autoDisableOnCostExceeded === true && settings.enabled === false,
  };
}

async function getCompanyAdminUserIds(companyId: string) {
  const members = await db.companyUser.findMany({
    where: {
      companyId,
      OR: [{ isOwner: true }, { role: { in: ["OWNER", "ADMIN"] } }],
    },
    select: { userId: true },
  });
  return [...new Set(members.map((member) => member.userId))];
}

export async function checkAndNotifyMonthlyCostAlert(companyId: string) {
  const alert = await getMonthlyCostAlertStatus(companyId);
  if (!alert.thresholdUsd || !alert.exceeded) {
    return alert;
  }

  const monthKey = new Date().toISOString().slice(0, 7);
  const dedupeKey = `ai-cost-warning:${companyId}:${monthKey}`;

  const adminIds = await getCompanyAdminUserIds(companyId);
  for (const userId of adminIds) {
    await createNotification({
      companyId,
      userId,
      type: "WARNING",
      category: "SYSTEM",
      module: "ai-assistant",
      actionUrl: "/settings/ai",
      dedupeKey: `${dedupeKey}:${userId}`,
      priority: "HIGH",
      title: "AI aylık maliyet uyarısı",
      message: `Bu ayki tahmini AI maliyeti $${alert.currentCostUsd.toFixed(4)} ile belirlenen $${alert.thresholdUsd.toFixed(2)} eşiğini aştı.`,
      metadata: {
        currentCostUsd: alert.currentCostUsd,
        thresholdUsd: alert.thresholdUsd,
      },
    });
  }

  if (alert.autoDisableOnCostExceeded) {
    await db.companyAISettings.updateMany({
      where: { companyId },
      data: { enabled: false },
    });
  }

  return alert;
}
