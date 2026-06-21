import { AdminPartnerSettingsContent } from "@/components/admin/admin-partner-settings-content";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { getPartnerSettings } from "@/lib/partner-service";

export default async function AdminPartnerSettingsPage() {
  const settings = await getPartnerSettings();

  return (
    <AdminPageContainer size="default">
      <AdminPartnerSettingsContent initial={settings} />
    </AdminPageContainer>
  );
}
