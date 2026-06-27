import { AdminPartnerSettingsContent } from "@/components/admin/admin-partner-settings-content";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import {
  AdminPartnerSettingsServiceError,
  getAdminPartnerSettings,
  listPartnerSettingsHistory,
} from "@/lib/admin/partner-settings";

export default async function AdminPartnerSettingsPage() {
  try {
    const [detail, history] = await Promise.all([
      getAdminPartnerSettings(),
      listPartnerSettingsHistory(15),
    ]);

    return (
      <AdminPageContainer size="default">
        <AdminPartnerSettingsContent initial={detail} history={history} />
      </AdminPageContainer>
    );
  } catch (error) {
    if (
      error instanceof AdminPartnerSettingsServiceError &&
      error.code === "SETTINGS_SINGLETON_CONFLICT"
    ) {
      return (
        <AdminPageContainer size="default">
          <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-6 text-[14px] text-rose-800">
            Partner ayar kaydı çakışması tespit edildi. Veritabanında birden fazla PartnerSettings
            kaydı var; lütfen yöneticinize başvurun.
          </div>
        </AdminPageContainer>
      );
    }
    throw error;
  }
}
