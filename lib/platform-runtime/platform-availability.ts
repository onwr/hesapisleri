import "server-only";

import { redirect } from "next/navigation";
import { getPlatformSettings } from "@/lib/admin/platform-settings/platform-settings-loader";
import { MaintenanceModeActiveError } from "@/lib/admin/platform-settings/platform-settings-errors";

export async function assertPlatformAvailable(input: { isSuperAdmin: boolean }) {
  if (input.isSuperAdmin) return;

  const settings = await getPlatformSettings();
  if (settings.maintenanceMode) {
    throw new MaintenanceModeActiveError(
      settings.maintenanceMessage ?? "Platform bakım modunda."
    );
  }
}

export async function redirectIfMaintenanceActive(isSuperAdmin: boolean) {
  try {
    await assertPlatformAvailable({ isSuperAdmin });
  } catch (error) {
    if (error instanceof MaintenanceModeActiveError) {
      redirect("/maintenance");
    }
    throw error;
  }
}

/** @deprecated assertPlatformAvailable kullanın */
export const assertNotInMaintenanceForUser = assertPlatformAvailable;
