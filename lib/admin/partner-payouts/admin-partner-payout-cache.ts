import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";

export function invalidateAdminPartnerPayoutCaches(partnerId?: string) {
  revalidateTag("admin-partner-payouts", "max");
  revalidateTag("admin-partners", "max");
  revalidateTag("admin-overview", "max");
  revalidatePath("/admin/partners/payouts");
  if (partnerId) {
    revalidateTag(`admin-partner-${partnerId}`, "max");
    revalidatePath(`/admin/partners/${partnerId}`);
  }
  revalidatePath("/admin/partners");
}
