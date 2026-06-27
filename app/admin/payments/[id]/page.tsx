import { notFound } from "next/navigation";
import { AdminPaymentDetailShell } from "@/components/admin/payments/admin-payment-detail-shell";
import {
  getAdminPaymentHeader,
  resolvePaymentTab,
} from "@/lib/admin/payments/admin-payment-detail-service";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPaymentDetailPage({ params, searchParams }: PageProps) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const rawTab = typeof sp.tab === "string" ? sp.tab : undefined;
  const tab = resolvePaymentTab(rawTab);

  const header = await getAdminPaymentHeader(id);
  if (!header) notFound();

  return <AdminPaymentDetailShell header={header} activeTab={tab} />;
}
