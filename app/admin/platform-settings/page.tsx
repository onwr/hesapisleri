import { AdminPlatformSettingsContent } from "@/components/admin/admin-platform-settings-content";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import {
  AdminPlatformSettingsServiceError,
  getAdminPlatformEnvironment,
  getAdminPlatformSettings,
  listPlatformSettingsHistory,
} from "@/lib/admin/platform-settings";

export default async function AdminPlatformSettingsPage() {
  try {
    const [detail, history, environment] = await Promise.all([
      getAdminPlatformSettings(),
      listPlatformSettingsHistory(15),
      getAdminPlatformEnvironment(),
    ]);

    return (
      <AdminPageContainer size="default">
        <AdminPlatformSettingsContent
          initial={detail}
          history={history}
          environment={environment}
        />
      </AdminPageContainer>
    );
  } catch (error) {
    if (
      error instanceof AdminPlatformSettingsServiceError &&
      error.code === "PLATFORM_SETTINGS_SINGLETON_CONFLICT"
    ) {
      return (
        <AdminPageContainer size="default">
          <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-6 text-[14px] text-rose-800">
            Platform ayar kaydı çakışması tespit edildi. Veritabanında birden fazla
            PlatformSettings kaydı var; lütfen yöneticinize başvurun.
          </div>
        </AdminPageContainer>
      );
    }
    throw error;
  }
}
