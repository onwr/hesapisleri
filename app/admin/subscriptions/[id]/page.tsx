import { notFound } from "next/navigation";
import { db } from "@/lib/prisma";
import { AdminSubscriptionDetailShell } from "@/components/admin/subscriptions/admin-subscription-detail-shell";
import {
  getAdminSubscriptionHeader,
  resolveSubscriptionTab,
} from "@/lib/admin/subscriptions/admin-subscription-detail-service";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminSubscriptionDetailPage({ params, searchParams }: PageProps) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const rawTab = typeof sp.tab === "string" ? sp.tab : undefined;
  const tab = resolveSubscriptionTab(rawTab);

  const [header, plans] = await Promise.all([
    getAdminSubscriptionHeader(id),
    db.membershipPlan.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        prices: {
          where: { status: "ACTIVE" },
          select: {
            billingInterval: true,
            salePriceMinor: true,
            listPriceMinor: true,
            currency: true,
          },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!header) notFound();

  return <AdminSubscriptionDetailShell header={header} activeTab={tab} availablePlans={plans} />;
}
