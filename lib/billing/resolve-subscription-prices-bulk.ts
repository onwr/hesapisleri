import "server-only";

import type { MembershipPeriod } from "@prisma/client";
import {
  resolveSubscriptionPrice,
  type ResolvedSubscriptionPrice,
} from "@/lib/billing/price-resolution-service";

export type BulkPriceInput = {
  key: string;
  companyId: string;
  planId: string;
  billingInterval: MembershipPeriod;
  isRenewal?: boolean;
};

export type BulkPriceResult = {
  key: string;
  paid: ResolvedSubscriptionPrice | null;
  renewal: ResolvedSubscriptionPrice | null;
};

/**
 * Liste sayfası için fiyat çözümü — plan bazlı tekrarlı çağrıları azaltır.
 * Her satır için hâlâ company-specific override/grandfathered çözülür;
 * ancak aynı plan+dönem için plan price cache kullanılır.
 */
export async function resolveSubscriptionPricesBulk(
  items: BulkPriceInput[]
): Promise<Map<string, BulkPriceResult>> {
  const results = new Map<string, BulkPriceResult>();

  await Promise.all(
    items.map(async (item) => {
      try {
        const [paid, renewal] = await Promise.all([
          resolveSubscriptionPrice({
            companyId: item.companyId,
            planId: item.planId,
            billingInterval: item.billingInterval,
            isRenewal: false,
          }),
          resolveSubscriptionPrice({
            companyId: item.companyId,
            planId: item.planId,
            billingInterval: item.billingInterval,
            isRenewal: true,
          }),
        ]);
        results.set(item.key, { key: item.key, paid, renewal });
      } catch {
        results.set(item.key, { key: item.key, paid: null, renewal: null });
      }
    })
  );

  return results;
}
