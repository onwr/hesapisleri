import "server-only";

import type { CampaignScopeInput, CampaignConflict } from "@/lib/admin/promotions/promotion-types";
import { db } from "@/lib/prisma";

export async function detectCampaignConflicts(input: {
  campaignId?: string;
  discountType: string;
  priority: number;
  autoApply: boolean;
  stackable: boolean;
  startsAt: Date;
  endsAt: Date | null;
  scopes: CampaignScopeInput[];
}): Promise<CampaignConflict[]> {
  const conflicts: CampaignConflict[] = [];
  const candidates = await db.membershipCampaign.findMany({
    where: {
      status: { in: ["ACTIVE", "SCHEDULED"] },
      id: input.campaignId ? { not: input.campaignId } : undefined,
      autoApply: true,
      OR: [
        { endsAt: null },
        { endsAt: { gt: input.startsAt } },
      ],
      startsAt: input.endsAt ? { lt: input.endsAt } : undefined,
    },
    include: { scopes: true },
  });

  for (const other of candidates) {
    const scopeOverlap = scopesOverlap(input.scopes, other.scopes);
    if (!scopeOverlap) continue;

    if (
      input.autoApply &&
      other.autoApply &&
      !input.stackable &&
      !other.stackable &&
      input.priority === other.priority
    ) {
      conflicts.push({
        severity: "BLOCKING",
        campaignId: other.id,
        campaignName: other.name,
        message: `Bu kampanya, ${other.name} ile aynı öncelik ve çakışan kapsamda otomatik uygulanıyor.`,
        priority: other.priority,
        stackable: other.stackable,
        autoApply: other.autoApply,
        startsAt: other.startsAt.toISOString(),
        endsAt: other.endsAt?.toISOString() ?? null,
      });
      continue;
    }

    if (input.autoApply && other.autoApply && scopeOverlap) {
      conflicts.push({
        severity: "WARNING",
        campaignId: other.id,
        campaignName: other.name,
        message: `Bu kampanya, ${other.name} ile çakışan tarih ve kapsamda.`,
        priority: other.priority,
        stackable: other.stackable,
        autoApply: other.autoApply,
        startsAt: other.startsAt.toISOString(),
        endsAt: other.endsAt?.toISOString() ?? null,
      });
    } else {
      conflicts.push({
        severity: "INFO",
        campaignId: other.id,
        campaignName: other.name,
        message: `İlgili dönemde aktif kampanya: ${other.name}`,
        priority: other.priority,
        stackable: other.stackable,
        autoApply: other.autoApply,
        startsAt: other.startsAt.toISOString(),
        endsAt: other.endsAt?.toISOString() ?? null,
      });
    }
  }

  return conflicts;
}

function scopesOverlap(
  a: CampaignScopeInput[],
  b: Array<{
    planId: string | null;
    billingInterval: string | null;
    companyId: string | null;
    partnerId: string | null;
  }>
) {
  const left = a.length
    ? a
    : [{ planId: null, billingInterval: null, companyId: null, partnerId: null }];
  const right = b.length
    ? b
    : [{ planId: null, billingInterval: null, companyId: null, partnerId: null }];

  return left.some((sa) =>
    right.some((sb) => {
      if (sa.planId && sb.planId && sa.planId !== sb.planId) return false;
      if (sa.billingInterval && sb.billingInterval && sa.billingInterval !== sb.billingInterval) {
        return false;
      }
      if (sa.companyId && sb.companyId && sa.companyId !== sb.companyId) return false;
      if (sa.partnerId && sb.partnerId && sa.partnerId !== sb.partnerId) return false;
      return true;
    })
  );
}
