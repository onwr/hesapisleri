import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import { invalidateHealthCache } from "@/lib/admin/system-health/system-health-cache";

export function invalidateAdminJobCaches(jobKey?: string) {
  revalidateTag("admin-jobs", "max");
  if (jobKey) {
    revalidateTag(`admin-job-${jobKey}`, "max");
  }
  revalidatePath("/admin/jobs");
  if (jobKey) {
    revalidatePath(`/admin/jobs/${jobKey}`);
  }
  invalidateHealthCache();
  revalidateTag("admin-overview", "max");
}
