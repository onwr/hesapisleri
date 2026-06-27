import "server-only";
import { db } from "@/lib/prisma";

export type PublicPlan = {
  id: string;
  name: string;
  code: string;
  slug: string;
  shortDescription: string | null;
  badgeText: string | null;
  isFeatured: boolean;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  features: string[];
  trialEnabled: boolean;
  trialDays: number;
};

export async function getPublicPlans(): Promise<PublicPlan[]> {
  try {
    const plans = await db.membershipPlan.findMany({
      where: { planStatus: "ACTIVE", visibility: "PUBLIC", isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        slug: true,
        shortDescription: true,
        badgeText: true,
        isFeatured: true,
        monthlyPrice: true,
        yearlyPrice: true,
        currency: true,
        features: true,
        trialEnabled: true,
        trialDays: true,
        sortOrder: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return plans.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      slug: p.slug,
      shortDescription: p.shortDescription,
      badgeText: p.badgeText,
      isFeatured: p.isFeatured,
      monthlyPrice: Number(p.monthlyPrice),
      yearlyPrice: Number(p.yearlyPrice),
      currency: p.currency,
      features: p.features,
      trialEnabled: p.trialEnabled,
      trialDays: p.trialDays,
    }));
  } catch {
    return [];
  }
}
