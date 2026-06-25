import { AppShell } from "@/components/layout/app-shell";
import { AiSettingsPanel } from "@/components/settings/ai-settings-panel";
import { guardPageModule } from "@/lib/module-access";

export default async function AiSettingsPage() {
  await guardPageModule("settings");

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
        <div>
          <h1 className="text-[24px] font-black text-[#0f1f4d]">Yapay Zekâ</h1>
          <p className="mt-1 text-[13px] font-medium text-slate-500">
            Asistan bağlantısı, model ve güvenlik tercihleri
          </p>
        </div>
        <AiSettingsPanel />
      </div>
    </AppShell>
  );
}
