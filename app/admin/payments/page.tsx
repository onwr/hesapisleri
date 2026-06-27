import { AdminPaymentsListShell } from "@/components/admin/payments/admin-payments-list-shell";
import { getAdminPaymentList } from "@/lib/admin/payments/admin-payment-list-service";
import { getAdminPaymentMetrics } from "@/lib/admin/payments/admin-payment-metric-service";
import { adminPaymentListQuerySchema } from "@/lib/admin/payments/admin-payment-schemas";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPaymentsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const flatParams = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v ?? ""])
  );
  const query = adminPaymentListQuerySchema.parse(flatParams);

  const [list, metrics] = await Promise.all([
    getAdminPaymentList(query),
    getAdminPaymentMetrics(),
  ]);

  return <AdminPaymentsListShell list={list} metrics={metrics} query={query} />;
}
