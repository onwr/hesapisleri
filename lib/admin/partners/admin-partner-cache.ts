import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";

export function invalidateAdminPartnerCaches(partnerId?: string) {
  revalidateTag("admin-partners", "max");
  revalidateTag("admin-overview", "max");
  if (partnerId) {
    revalidateTag(`admin-partner-${partnerId}`, "max");
    revalidatePath(`/admin/partners/${partnerId}`);
  }
  revalidatePath("/admin/partners");
}
