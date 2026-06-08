import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { OrdersBulkActionsCenter } from "@/components/orders/orders-bulk-actions-center";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { getOrderBulkActionsPageData } from "@/lib/orders-bulk-actions-data";
import { db } from "@/lib/prisma";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

type Props = {
  searchParams: Promise<{
    q?: string;
    channel?: string;
    orderStatus?: string;
    from?: string;
    to?: string;
    tab?: string;
  }>;
};

export default async function OrdersBulkActionsPage({ searchParams }: Props) {
  const params = await searchParams;
  const token = await getAuthToken();
  if (!token) redirect("/login");

  const payload = verifyToken<AuthPayload>(token);
  if (!payload?.companyId) redirect("/login");

  const company = await db.company.findUnique({
    where: { id: payload.companyId },
    select: { id: true },
  });

  if (!company) redirect("/login");

  const { filters, rows, summary } = await getOrderBulkActionsPageData(
    company.id,
    params
  );

  return (
    <AppShell>
      <OrdersBulkActionsCenter
        initialFilters={filters}
        initialRows={rows}
        initialSummary={summary}
      />
    </AppShell>
  );
}
