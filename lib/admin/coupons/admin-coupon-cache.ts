import { revalidateTag } from "next/cache";

export function invalidateAdminCouponCaches(couponId?: string) {
  revalidateTag("admin-coupon-list", "max");
  revalidateTag("admin-overview", "max");
  revalidateTag("checkout-plan", "max");
  revalidateTag("subscription-plan-change-options", "max");
  revalidateTag("admin-campaign-list", "max");
  if (couponId) {
    revalidateTag(`admin-coupon-detail:${couponId}`, "max");
    revalidateTag(`admin-coupon-usage:${couponId}`, "max");
    revalidateTag(`admin-coupon-preview:${couponId}`, "max");
  }
}
