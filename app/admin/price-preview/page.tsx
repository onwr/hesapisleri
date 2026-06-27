import { AdminPricePreviewClient } from "@/components/admin/price-preview/admin-price-preview-client";
import { getPricePreviewOptions } from "@/lib/admin/price-preview";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPricePreviewPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const options = await getPricePreviewOptions();

  return (
    <AdminPricePreviewClient
      options={options}
      initialParams={{
        planId: typeof params.planId === "string" ? params.planId : "",
        billingInterval:
          typeof params.billingInterval === "string" ? params.billingInterval : "MONTHLY",
        currency: typeof params.currency === "string" ? params.currency : "",
        scenario: typeof params.scenario === "string" ? params.scenario : "NEW_SUBSCRIPTION",
        companyId: typeof params.companyId === "string" ? params.companyId : "",
      }}
    />
  );
}
