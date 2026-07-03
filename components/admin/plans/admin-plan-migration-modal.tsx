"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { formatMinorToMoney as formatMoneyMinor } from "@/lib/billing/pricing-utils";
import { formatShortDisplayDate } from "@/lib/format-utils";
import { appOutlineButtonClass, appPrimaryButtonClass } from "@/lib/admin-ui";

type TargetPlan = {
  id: string;
  name: string;
  code: string;
  currency: string;
  activePrices: Array<{
    id: string;
    billingInterval: "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "YEARLY";
    listPriceMinor: number;
    salePriceMinor: number;
    currency: string;
  }>;
};

type Subscriber = {
  subscriptionId: string;
  companyId: string;
  companyName: string;
  status: string;
  billingInterval: "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "YEARLY" | null;
  resolvedSourcePeriod: "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "YEARLY" | null;
  sourcePeriodUnresolved: boolean;
  currentPeriodEnd: string | null;
  lockedPriceMinor: number | null;
};

type MigrationResult = {
  migrated: string[];
  skipped: Array<{
    subscriptionId: string;
    companyName?: string;
    reasonCode: string;
    reason: string;
  }>;
  summary: {
    migratedCount: number;
    skippedCount: number;
    message: string;
    skipGroups: Array<{ reason: string; count: number }>;
  };
};

const INTERVAL_LABELS: Record<string, string> = {
  MONTHLY: "Aylık",
  QUARTERLY: "3 Aylık",
  SEMI_ANNUAL: "6 Aylık",
  YEARLY: "Yıllık",
};

export function AdminPlanMigrationModal({
  planId,
  planName,
  onClose,
  onMigrated,
}: {
  planId: string;
  planName: string;
  onClose: () => void;
  onMigrated?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState<TargetPlan[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetPlanId, setTargetPlanId] = useState<string>("");
  const [timing, setTiming] = useState<"AT_RENEWAL" | "IMMEDIATE">("IMMEDIATE");
  const [confirmImmediate, setConfirmImmediate] = useState(false);
  const [periodMapping, setPeriodMapping] = useState<Record<string, string>>({});
  const [fallbackTargetPeriod, setFallbackTargetPeriod] = useState<string>("MONTHLY");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MigrationResult | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [targetsRes, subsRes] = await Promise.all([
          fetch(`/api/admin/plans/${planId}/migration/targets`),
          fetch(`/api/admin/plans/${planId}/migration/subscribers`),
        ]);
        const targetsJson = await targetsRes.json();
        const subsJson = await subsRes.json();
        if (targetsJson.success) setTargets(targetsJson.data);
        if (subsJson.success) {
          setSubscribers(subsJson.data);
          setSelected(new Set(subsJson.data.map((s: Subscriber) => s.subscriptionId)));
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [planId]);

  const selectedSubscribers = useMemo(
    () => subscribers.filter((s) => selected.has(s.subscriptionId)),
    [subscribers, selected]
  );

  const filteredSubscribers = useMemo(() => {
    if (!search.trim()) return subscribers;
    const q = search.trim().toLowerCase();
    return subscribers.filter((s) => s.companyName.toLowerCase().includes(q));
  }, [subscribers, search]);

  const sourcePeriodStats = useMemo(() => {
    const counts = new Map<string, number>();
    let unresolved = 0;
    for (const s of selectedSubscribers) {
      if (s.resolvedSourcePeriod) {
        counts.set(
          s.resolvedSourcePeriod,
          (counts.get(s.resolvedSourcePeriod) ?? 0) + 1
        );
      } else {
        unresolved += 1;
      }
    }
    return { counts, unresolved };
  }, [selectedSubscribers]);

  const distinctResolvedIntervals = useMemo(
    () => [...sourcePeriodStats.counts.keys()],
    [sourcePeriodStats.counts]
  );

  const targetPlan = targets.find((t) => t.id === targetPlanId) ?? null;
  const targetIntervals = useMemo(
    () =>
      targetPlan
        ? Array.from(new Set(targetPlan.activePrices.map((p) => p.billingInterval)))
        : [],
    [targetPlan]
  );

  const fallbackPriceAvailable =
    !fallbackTargetPeriod || targetIntervals.includes(fallbackTargetPeriod as TargetPlan["activePrices"][0]["billingInterval"]);

  const preview = useMemo(() => {
    if (!targetPlan || selected.size === 0) {
      return { wouldMigrate: 0, wouldSkip: 0 };
    }
    let wouldMigrate = 0;
    for (const s of selectedSubscribers) {
      const source = s.resolvedSourcePeriod;
      const targetPeriod = source
        ? periodMapping[source] || source
        : fallbackTargetPeriod;
      if (!targetPeriod || !targetIntervals.includes(targetPeriod as typeof targetIntervals[number])) {
        continue;
      }
      wouldMigrate += 1;
    }
    return { wouldMigrate, wouldSkip: selected.size - wouldMigrate };
  }, [
    targetPlan,
    selected.size,
    selectedSubscribers,
    periodMapping,
    fallbackTargetPeriod,
    targetIntervals,
  ]);

  const timingLabel = timing === "IMMEDIATE" ? "Hemen" : "Yenilemede";

  const disabledReason = useMemo(() => {
    if (!targetPlanId) return null;
    if (selected.size === 0) return "Taşınacak abonelik seçin.";
    if (targetIntervals.length === 0) {
      return `${targetPlan?.name ?? "Hedef"} planında aktif fiyat bulunmuyor.`;
    }
    if (sourcePeriodStats.unresolved > 0 && !fallbackTargetPeriod) {
      return "Belirlenemeyen dönemler için hedef dönem seçin.";
    }
    if (sourcePeriodStats.unresolved > 0 && !fallbackPriceAvailable) {
      return `${targetPlan?.name ?? "Hedef"} planında aktif ${INTERVAL_LABELS[fallbackTargetPeriod] ?? fallbackTargetPeriod} fiyat bulunmuyor.`;
    }
    if (
      distinctResolvedIntervals.some(
        (interval) => !periodMapping[interval] && !targetIntervals.includes(interval as typeof targetIntervals[number])
      )
    ) {
      return "Tüm kaynak dönemler için hedef eşlemesi yapın.";
    }
    if (timing === "IMMEDIATE" && !confirmImmediate) {
      return "Hemen geçiş için onay kutusunu işaretleyin.";
    }
    if (preview.wouldMigrate === 0) {
      return "Taşınabilecek abonelik bulunamadı.";
    }
    return null;
  }, [
    targetPlanId,
    selected.size,
    targetIntervals,
    targetPlan?.name,
    sourcePeriodStats.unresolved,
    fallbackTargetPeriod,
    fallbackPriceAvailable,
    distinctResolvedIntervals,
    periodMapping,
    timing,
    confirmImmediate,
    preview.wouldMigrate,
  ]);

  const canSubmit = !disabledReason && !submitting;

  useEffect(() => {
    if (!targetPlan) return;
    setPeriodMapping((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const interval of distinctResolvedIntervals) {
        if (!next[interval] && targetIntervals.includes(interval as typeof targetIntervals[number])) {
          next[interval] = interval;
          changed = true;
        }
      }
      // Aynı referansı döndür — React değişiklik yoksa re-render/efekti tekrar
      // tetiklememeli (aksi halde targetIntervals/distinctResolvedIntervals
      // her render'da yeni referans üretirse sonsuz döngü oluşur).
      return changed ? next : prev;
    });
  }, [targetPlan, distinctResolvedIntervals, targetIntervals]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/plans/${planId}/migration/migrate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetPlanId,
          subscriptionIds: Array.from(selected),
          timing,
          periodMapping,
          confirmImmediate: timing === "IMMEDIATE" ? confirmImmediate : undefined,
          fallbackTargetPeriod:
            sourcePeriodStats.unresolved > 0 ? fallbackTargetPeriod : undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message ?? "Taşıma başarısız.");
        return;
      }
      setResult(json.data as MigrationResult);
      router.refresh();
      onMigrated?.();
    } catch {
      setError("Taşıma işlemi sırasında bir hata oluştu.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h4 className="text-[14px] font-bold text-slate-900">
            {planName} — Aboneleri Yeni Plana Taşı
          </h4>
          <button type="button" onClick={onClose} aria-label="Kapat">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-[12px] text-slate-500">
            <Loader2 size={16} className="animate-spin" /> Yükleniyor…
          </div>
        ) : result ? (
          <div className="mt-3 space-y-2">
            <p className="text-[12px] font-bold text-emerald-700">{result.summary.message}</p>
            {result.summary.skipGroups.length > 0 ? (
              <ul className="mt-1 space-y-1 text-[11px] text-slate-600">
                {result.summary.skipGroups.map((g) => (
                  <li key={g.reason}>
                    {g.count} abonelik: {g.reason}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-3 flex justify-end">
              <button type="button" className={appPrimaryButtonClass} onClick={onClose}>
                Kapat
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-4">
            <section>
              <h5 className="text-[12px] font-bold text-slate-700">1. Hedef Plan</h5>
              <select
                className="mt-1 h-9 w-full rounded border px-2 text-[12px]"
                value={targetPlanId}
                onChange={(e) => setTargetPlanId(e.target.value)}
              >
                <option value="">Seçin…</option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
              {targetPlan ? (
                <div className="mt-2 grid gap-1 sm:grid-cols-2">
                  {targetPlan.activePrices.map((p) => (
                    <p key={p.id} className="text-[11px] text-slate-600">
                      {INTERVAL_LABELS[p.billingInterval]}:{" "}
                      {formatMoneyMinor(p.salePriceMinor, p.currency)}
                    </p>
                  ))}
                </div>
              ) : null}
            </section>

            <section>
              <h5 className="text-[12px] font-bold text-slate-700">2. Zamanlama</h5>
              <div className="mt-1 space-y-2">
                <label className="flex items-start gap-2 text-[12px]">
                  <input
                    type="radio"
                    checked={timing === "AT_RENEWAL"}
                    onChange={() => setTiming("AT_RENEWAL")}
                  />
                  <span>Yenileme tarihinde geçir — önerilen</span>
                </label>
                <label className="flex items-start gap-2 text-[12px]">
                  <input
                    type="radio"
                    checked={timing === "IMMEDIATE"}
                    onChange={() => setTiming("IMMEDIATE")}
                  />
                  <span>Hemen geçir</span>
                </label>
                {timing === "IMMEDIATE" ? (
                  <div className="rounded border border-amber-200 bg-amber-50 p-2">
                    <p className="text-[11px] font-semibold text-amber-800">
                      Mevcut dönem ve ödeme geçmişi değişmez; plan hemen güncellenir.
                    </p>
                    <label className="mt-1 flex items-center gap-2 text-[11px]">
                      <input
                        type="checkbox"
                        checked={confirmImmediate}
                        onChange={(e) => setConfirmImmediate(e.target.checked)}
                      />
                      Bu işlemin geri dönüşü olmadığını anlıyorum
                    </label>
                  </div>
                ) : null}
              </div>
            </section>

            <section>
              <h5 className="text-[12px] font-bold text-slate-700">3. Dönem Eşleme</h5>
              <div className="mt-1 space-y-2 text-[11px] text-slate-600">
                <p className="font-semibold text-slate-700">Kaynak dönemler</p>
                {sourcePeriodStats.counts.size === 0 && sourcePeriodStats.unresolved === 0 ? (
                  <p>Seçili abonelik yok.</p>
                ) : (
                  <ul className="space-y-0.5">
                    {[...sourcePeriodStats.counts.entries()].map(([interval, count]) => (
                      <li key={interval}>
                        {count} {INTERVAL_LABELS[interval]}
                      </li>
                    ))}
                    {sourcePeriodStats.unresolved > 0 ? (
                      <li className="text-amber-700">
                        {sourcePeriodStats.unresolved} aboneliğin dönemi eski kayıtlardan
                        belirlenemedi.
                      </li>
                    ) : null}
                  </ul>
                )}

                {distinctResolvedIntervals.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {distinctResolvedIntervals.map((interval) => (
                      <div key={interval} className="flex items-center gap-2 text-[12px]">
                        <span className="w-24">{INTERVAL_LABELS[interval]}</span>
                        <span>→</span>
                        <select
                          className="h-8 rounded border px-2 text-[12px]"
                          value={periodMapping[interval] ?? ""}
                          onChange={(e) =>
                            setPeriodMapping((prev) => ({
                              ...prev,
                              [interval]: e.target.value,
                            }))
                          }
                        >
                          <option value="">Seçin…</option>
                          {targetIntervals.map((ti) => (
                            <option key={ti} value={ti}>
                              {INTERVAL_LABELS[ti]}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                ) : null}

                {sourcePeriodStats.unresolved > 0 ? (
                  <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2">
                    <p className="text-[11px] font-semibold text-slate-700">
                      Tüm eşleşmeyen abonelikleri şu döneme geçir
                    </p>
                    <select
                      className="mt-1 h-8 w-full rounded border px-2 text-[12px]"
                      value={fallbackTargetPeriod}
                      onChange={(e) => setFallbackTargetPeriod(e.target.value)}
                    >
                      {targetIntervals.map((ti) => (
                        <option key={ti} value={ti}>
                          {INTERVAL_LABELS[ti]}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
            </section>

            {targetPlan && selected.size > 0 ? (
              <section className="rounded border border-blue-100 bg-blue-50/50 p-3 text-[11px] text-slate-700">
                <p className="font-bold text-[#0f1f4d]">Önizleme</p>
                <p>Taşınacak: {preview.wouldMigrate}</p>
                <p>Atlanacak: {preview.wouldSkip}</p>
                <p>
                  Hedef plan: {targetPlan.name} · Geçiş: {timingLabel}
                </p>
                {sourcePeriodStats.unresolved > 0 ? (
                  <p>
                    Belirlenemeyen dönemler →{" "}
                    {INTERVAL_LABELS[fallbackTargetPeriod] ?? fallbackTargetPeriod}
                  </p>
                ) : null}
              </section>
            ) : null}

            <section>
              <h5 className="text-[12px] font-bold text-slate-700">Abone Listesi</h5>
              <input
                className="mt-1 h-8 w-full rounded border px-2 text-[12px]"
                placeholder="Firma ara…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="mt-2 max-h-64 overflow-y-auto rounded border">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 text-left">
                      <th className="px-2 py-1"></th>
                      <th className="px-2 py-1">Firma</th>
                      <th className="px-2 py-1">Durum</th>
                      <th className="px-2 py-1">Dönem</th>
                      <th className="px-2 py-1">Fiyat</th>
                      <th className="px-2 py-1">Yenileme</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubscribers.map((s) => (
                      <tr key={s.subscriptionId} className="border-t">
                        <td className="px-2 py-1">
                          <input
                            type="checkbox"
                            checked={selected.has(s.subscriptionId)}
                            onChange={() => toggleSelect(s.subscriptionId)}
                          />
                        </td>
                        <td className="px-2 py-1">{s.companyName}</td>
                        <td className="px-2 py-1">{s.status}</td>
                        <td className="px-2 py-1">
                          {s.resolvedSourcePeriod
                            ? INTERVAL_LABELS[s.resolvedSourcePeriod]
                            : "Belirlenemedi"}
                        </td>
                        <td className="px-2 py-1">
                          {s.lockedPriceMinor != null
                            ? formatMoneyMinor(s.lockedPriceMinor, "TRY")
                            : "—"}
                        </td>
                        <td className="px-2 py-1">
                          {formatShortDisplayDate(s.currentPeriodEnd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {disabledReason ? (
              <p className="text-[11px] text-amber-800">{disabledReason}</p>
            ) : null}
            {error ? <p className="text-[11px] text-red-700">{error}</p> : null}

            <div className="flex justify-end gap-2">
              <button type="button" className={appOutlineButtonClass} onClick={onClose}>
                İptal
              </button>
              <button
                type="button"
                className={appPrimaryButtonClass}
                disabled={!canSubmit}
                onClick={handleSubmit}
              >
                {submitting ? "Taşınıyor…" : `${preview.wouldMigrate || selected.size} Aboneyi Taşı`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
