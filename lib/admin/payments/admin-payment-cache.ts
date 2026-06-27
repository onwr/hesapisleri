import { revalidateTag } from "next/cache";

export function invalidateAdminPaymentCaches(paymentId?: string, companyId?: string, subscriptionId?: string) {
  revalidateTag("admin-payment-list-metrics", "max");
  revalidateTag("admin-overview", "max");
  if (paymentId) {
    revalidateTag(`admin-payment-detail:${paymentId}`, "max");
  }
  if (companyId) {
    revalidateTag(`admin-company-detail:${companyId}`, "max");
    revalidateTag(`company-billing:${companyId}`, "max");
  }
  if (subscriptionId) {
    revalidateTag(`admin-subscription-detail:${subscriptionId}`, "max");
    revalidateTag(`subscription-payments:${subscriptionId}`, "max");
  }
}
