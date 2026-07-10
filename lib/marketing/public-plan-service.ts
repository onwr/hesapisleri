import "server-only";
import { db } from "@/lib/prisma";
import {
  getPlatformSettings,
  getPlatformSettingsFallback,
} from "@/lib/admin/platform-settings";
import { buildCanonicalPlanDisplay } from "@/lib/billing/canonical-plan-display";

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
  annualEquivalentMonthlyPrice: number | null;
  showAnnualDiscount: boolean;
  currency: string;
  features: string[];
  trialEnabled: boolean;
  trialDays: number;
  billingPeriods: Array<"MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "YEARLY">;
  isPurchasable: boolean;
};

export async function getPublicPlans(): Promise<PublicPlan[]> {
  try {
    const [plans, settings] = await Promise.all([
      db.membershipPlan.findMany({
        where: { planStatus: "ACTIVE", visibility: "PUBLIC", isActive: true },
        select: {
          id: true,
          name: true,
          code: true,
          slug: true,
          shortDescription: true,
          badgeText: true,
          isFeatured: true,
          currency: true,
          defaultCurrency: true,
          planStatus: true,
          features: true,
          trialEnabled: true,
          trialDays: true,
          sortOrder: true,
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      getPlatformSettings().catch(() => getPlatformSettingsFallback()),
    ]);

    const resolved = await Promise.all(
      plans.map(async (plan) => {
        const display = await buildCanonicalPlanDisplay({
          plan,
          platformTrialDays: settings.trialDays,
        });
        if (!display || !display.isPurchasable) {
          return null;
        }

        return {
          id: plan.id,
          name: display.name,
          code: display.code,
          slug: plan.slug,
          shortDescription: plan.shortDescription,
          badgeText: plan.badgeText,
          isFeatured: plan.isFeatured,
          monthlyPrice: display.monthlyPrice,
          yearlyPrice: display.annualPrice ?? 0,
          annualEquivalentMonthlyPrice: display.annualEquivalentMonthlyPrice,
          showAnnualDiscount: display.showAnnualDiscount,
          currency: display.currency,
          features: plan.features,
          trialEnabled: plan.trialEnabled,
          trialDays: display.trialDays,
          billingPeriods: display.billingPeriods,
          isPurchasable: display.isPurchasable,
        } satisfies PublicPlan;
      })
    );

    return resolved.filter((plan): plan is NonNullable<typeof plan> => plan != null);
  } catch {
    return [];
  }
}
