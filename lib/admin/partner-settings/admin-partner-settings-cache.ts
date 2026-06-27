import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";

export function invalidateAdminPartnerSettingsCaches() {
  revalidateTag("admin-partner-settings", "max");
  revalidateTag("partner-settings", "max");
  revalidateTag("admin-partner-applications", "max");
  revalidateTag("admin-partners", "max");
  revalidateTag("admin-partner-payouts", "max");
  revalidateTag("admin-overview", "max");
  revalidatePath("/admin/partners/settings");
  revalidatePath("/admin/partners");
  revalidatePath("/partnership/apply");
  revalidatePath("/partnership/status");
}
