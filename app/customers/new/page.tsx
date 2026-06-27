import { NewCustomerPageClient } from "@/components/customers/new-customer-page";

type NewCustomerPageProps = {
  searchParams: Promise<{ returnTo?: string }>;
};

export default async function NewCustomerPage({ searchParams }: NewCustomerPageProps) {
  const params = await searchParams;

  return <NewCustomerPageClient returnTo={params.returnTo ?? null} />;
}
