import Link from "next/link";
import { ArrowLeft, PlugZap } from "lucide-react";
import { formatDateTimeDisplay } from "@/lib/format-utils";

type IntegrationsHeroProps = {
  connectedCount: number;
  errorCount: number;
  lastSyncAt: string | null;
  autoSyncEnabled: boolean;
  marketplaceFeatureEnabled?: boolean;
};

export function IntegrationsHero({
  connectedCount,
  errorCount,
  lastSyncAt,
  autoSyncEnabled,
  marketplaceFeatureEnabled = false,
}: IntegrationsHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#0f1f4d] via-blue-700 to-violet-700 p-6 text-white shadow-[0_24px_60px_rgba(15,23,42,0.22)] lg:p-8">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-violet-300/20 blur-2xl" />

      <div className="relative grid gap-6 lg:grid-cols-[1fr_280px] lg:items-end">
        <div>
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 text-xs font-bold text-white/80 hover:text-white"
          >
            <ArrowLeft size={14} />
            Ayarlara Dön
          </Link>

          <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-white/90">
            <PlugZap size={12} />
            {marketplaceFeatureEnabled
              ? "Pazaryeri Bağlantıları"
              : "e-Fatura Bağlantısı"}
          </span>

          <h1 className="mt-4 text-3xl font-black tracking-[-0.03em] lg:text-4xl">
            Entegrasyonlar
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80 lg:text-[15px]">
            {marketplaceFeatureEnabled
              ? "Pazaryeri bağlantılarınızı yönetin, siparişleri içeri aktarın ve stok operasyonlarınızı tek merkezden takip edin."
              : "e-Fatura / e-Arşiv bağlantınızı yönetin; faturalarınızı güvenli şekilde oluşturup gönderin."}
          </p>
        </div>

        <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/70">
            Genel Durum
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <Stat label="Bağlı Kanal" value={String(connectedCount)} />
            {marketplaceFeatureEnabled ? (
              <>
                <Stat
                  label="Son Sync"
                  value={
                    lastSyncAt ? formatDateTimeDisplay(lastSyncAt) : "—"
                  }
                />
                <Stat label="Hatalı Sync" value={String(errorCount)} />
                <Stat
                  label="Otomatik Sync"
                  value={autoSyncEnabled ? "Aktif" : "Kapalı"}
                />
              </>
            ) : (
              <Stat
                label="e-Fatura"
                value={connectedCount > 0 ? "Hazır" : "Kurulum"}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/10 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-white/60">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-black text-white">{value}</p>
    </div>
  );
}
