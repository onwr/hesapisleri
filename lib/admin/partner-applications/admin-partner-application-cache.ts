import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";

export function invalidateAdminPartnerApplicationCaches(partnerId?: string) {
  revalidateTag("admin-partner-applications", "max");
  revalidateTag("admin-partners", "max");
  revalidateTag("admin-overview", "max");
  revalidatePath("/admin/partners/applications");
  if (partnerId) {
    revalidateTag(`admin-partner-${partnerId}`, "max");
    revalidatePath(`/admin/partners/${partnerId}`);
  }
  revalidatePath("/admin/partners");
}
