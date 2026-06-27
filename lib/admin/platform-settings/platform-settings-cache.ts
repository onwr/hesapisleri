import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import { invalidateHealthCache } from "@/lib/admin/system-health/system-health-cache";
import { invalidatePlatformRuntimeCaches } from "@/lib/platform-runtime/platform-runtime-cache";

export function invalidateAdminPlatformSettingsCaches() {
  revalidateTag("platform-settings", "max");
  revalidateTag("admin-overview", "max");
  invalidateHealthCache();
  invalidatePlatformRuntimeCaches();
  revalidatePath("/admin/platform-settings");
  revalidatePath("/register");
  revalidatePath("/kvkk-aydinlatma-metni");
}
