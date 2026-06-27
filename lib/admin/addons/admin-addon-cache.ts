import { revalidateTag } from "next/cache";

export function invalidateAdminAddOnCaches(addOnId?: string) {
  revalidateTag("admin-addon-list", "max");
  revalidateTag("admin-overview", "max");
  revalidateTag("checkout-plan", "max");
  revalidateTag("subscription-plan-change-options", "max");
  revalidateTag("entitlement-resolver", "max");
  revalidateTag("admin-plan-list", "max");
  if (addOnId) {
    revalidateTag(`admin-addon-detail:${addOnId}`, "max");
    revalidateTag(`admin-addon-preview:${addOnId}`, "max");
    revalidateTag(`admin-addon-subscriptions:${addOnId}`, "max");
  }
}
