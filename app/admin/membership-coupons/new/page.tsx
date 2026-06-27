import { redirect } from "next/navigation";

export default function LegacyMembershipCouponNewRedirect() {
  redirect("/admin/coupons/new");
}
