import { AppShell } from "@/components/layout/app-shell";
import { SettingsCenter } from "@/components/settings/settings-center";
import { getAppSession } from "@/lib/app-session";
import {
  canManageSettings,
  canManageUsers,
} from "@/lib/permission-utils";
import { getSettingsBundle } from "@/lib/settings-service";

export default async function SettingsPage() {
  const session = await getAppSession();
  const settingsData = await getSettingsBundle(
    session.company.id,
    session.user.id
  );

  return (
    <AppShell>
      <SettingsCenter
        initialData={settingsData}
        canManageUsers={canManageUsers(
          session.effectiveRole,
          session.companyUser.isOwner
        )}
        canManageSettings={canManageSettings(
          session.effectiveRole,
          session.companyUser.isOwner
        )}
      />
    </AppShell>
  );
}
