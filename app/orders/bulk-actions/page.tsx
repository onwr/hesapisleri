import { AppShell } from "@/components/layout/app-shell";
import { guardPageModule } from "@/lib/module-access";

import { OrdersBulkActionsCenter } from "@/components/orders/orders-bulk-actions-center";
import { getOrderBulkActionsPageData } from "@/lib/orders-bulk-actions-data";

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
  const session = await guardPageModule("orders");
  const company = session.company;
  const params = await searchParams;

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
