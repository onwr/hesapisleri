import { AppShell } from "@/components/layout/app-shell";
import { CollectionsPageClient } from "@/components/collections/collections-page-client";
import { getCollectionsPageData } from "@/lib/collections-page-data";
import { guardPageModule } from "@/lib/module-access";
type CollectionsPageProps = {
  searchParams: Promise<{
    q?: string;
    customerId?: string;
    documentType?: string;
    paymentStatus?: string;
    dueStatus?: string;
    from?: string;
    to?: string;
  }>;
};

export default async function CollectionsPage({
  searchParams,
}: CollectionsPageProps) {
  const session = await guardPageModule("cash-bank");
  const company = session.company;
  const params = await searchParams;
  const data = await getCollectionsPageData(company.id, {
    search: params.q,
    customerId: params.customerId,
    documentType: params.documentType,
    paymentStatus: params.paymentStatus,
    dueStatus: params.dueStatus,
    from: params.from,
    to: params.to,
  });

  return (
    <AppShell>
      <CollectionsPageClient
        items={data.items}
        summary={data.summary}
        customers={data.customers}
        initialFilters={{
          search: params.q,
          customerId: params.customerId,
          documentType: params.documentType,
          paymentStatus: params.paymentStatus,
          dueStatus: params.dueStatus,
          from: params.from,
          to: params.to,
        }}
      />
    </AppShell>
  );
}
