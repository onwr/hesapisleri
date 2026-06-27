"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import { AdminSubscriptionTabContent } from "@/components/admin/subscriptions/admin-subscription-tab-panels";
import { appPanelClass, appPrimaryButtonClass, appOutlineButtonClass } from "@/lib/admin-ui";
const appButtonClass = appPrimaryButtonClass;
import { formatAdminDate } from "@/lib/admin-utils";
import {
  getSubscriptionStatusLabel,
  getSubscriptionStatusClass,
  getBillingIntervalLabel,
  formatMinor,
} from "@/lib/admin/subscriptions/admin-subscription-serializers";
import type {
  getAdminSubscriptionHeader,
  AdminSubscriptionTab,
} from "@/lib/admin/subscriptions/admin-subscription-detail-service";

type Header = NonNullable<Awaited<ReturnType<typeof getAdminSubscriptionHeader>>>;

type PlanInterval = {
  billingInterval: string;
  salePriceMinor: number;
  listPriceMinor: number;
  currency: string;
};

type AvailablePlan = {
  id: string;
  name: string;
  code: string;
  prices: PlanInterval[];
};

type PlanChangePreview = {
  subscriptionId: string;
  currentPlanId: string | null;
  currentInterval: string | null;
  targetPlanId: string;
  targetPlanName: string;
  targetInterval: string;
  applyAt: string;
  effectiveAt: string;
  previewExpiresAt?: string;
  previewHash: string;
  entitlementDiff?: Array<{ code: string; from: unknown; to: unknown }>;
  pricing: {
    listPriceMinor: number;
    salePriceMinor: number;
    monthlyEquivalentMinor: number;
    currency: string;
    vatRate: number | null;
    vatIncluded: boolean;
    discounts: Array<{ type: string; label: string; amount: number }>;
  };
};

type Props = {
  header: Header;
  activeTab: AdminSubscriptionTab;
  availablePlans: AvailablePlan[];
};

const TABS: { key: AdminSubscriptionTab; label: string }[] = [
  { key: "overview", label: "Genel Bakış" },
  { key: "payments", label: "Ödemeler" },
  { key: "history", label: "Geçmiş" },
  { key: "entitlements", label: "Yetkiler" },
  { key: "addons", label: "Eklentiler" },
  { key: "activity", label: "Aktivite" },
  { key: "notes", label: "Notlar" },
];

const BILLING_INTERVALS = [
  { value: "MONTHLY", label: "Aylık" },
  { value: "QUARTERLY", label: "3 Aylık" },
  { value: "SEMI_ANNUAL", label: "6 Aylık" },
  { value: "YEARLY", label: "Yıllık" },
];

export function AdminSubscriptionDetailShell({ header, activeTab, availablePlans }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeTabState, setActiveTabState] = useState<AdminSubscriptionTab>(activeTab);
  const [tabData, setTabData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tabFilters, setTabFilters] = useState<Record<string, string>>({});
  const [tabPage, setTabPage] = useState(1);

  // Trial extend modal state
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extendDays, setExtendDays] = useState(7);
  const [extendReason, setExtendReason] = useState("");
  const [extendLoading, setExtendLoading] = useState(false);

  // Cancellation modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelNote, setCancelNote] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

  // Plan change modal — 3-step flow: select → preview → confirm
  const [showPlanChangeModal, setShowPlanChangeModal] = useState(false);
  const [planChangeStep, setPlanChangeStep] = useState<"select" | "preview" | "confirm">("select");
  const [targetPlanId, setTargetPlanId] = useState(header.planId ?? "");
  type BillingIntervalValue = "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "YEARLY";
  const validInterval = (v: string | null | undefined): BillingIntervalValue =>
    (["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"] as const).includes(v as BillingIntervalValue)
      ? (v as BillingIntervalValue)
      : "MONTHLY";
  const [targetInterval, setTargetInterval] = useState<BillingIntervalValue>(
    validInterval(header.billingInterval)
  );
  const [applyAt, setApplyAt] = useState<"IMMEDIATELY" | "NEXT_PERIOD">("NEXT_PERIOD");
  const [planChangePreview, setPlanChangePreview] = useState<PlanChangePreview | null>(null);
  const [planChangeReason, setPlanChangeReason] = useState("");
  const [planChangeLoading, setPlanChangeLoading] = useState(false);
  const [applySubmitting, setApplySubmitting] = useState(false);

  const loadTab = useCallback(async (
    tab: AdminSubscriptionTab,
    opts?: { page?: number; filters?: Record<string, string> }
  ) => {
    setActiveTabState(tab);
    setLoading(true);
    setError(null);
    const page = opts?.page ?? tabPage;
    const filters = opts?.filters ?? tabFilters;
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (page > 1) params.set("page", String(page));
    for (const [k, v] of Object.entries(filters)) {
      if (v) params.set(k, v);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });

    try {
      const res = await fetch(`/api/admin/subscriptions/${header.id}?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setTabData(json.data.tabData);
      } else {
        setError(json.message ?? "Veri yüklenemedi");
      }
    } catch {
      setError("Sunucu hatası");
    } finally {
      setLoading(false);
    }
  }, [header.id, pathname, router, tabFilters, tabPage]);

  useEffect(() => {
    const tab = (searchParams.get("tab") as AdminSubscriptionTab) || activeTab;
    const filters: Record<string, string> = {};
    for (const key of ["status", "provider", "dateFrom", "dateTo", "refundStatus", "eventType", "source", "action", "success"]) {
      const v = searchParams.get(key);
      if (v) filters[key] = v;
    }
    const page = Number(searchParams.get("page") ?? "1");
    setTabFilters(filters);
    setTabPage(page);
    setActiveTabState(tab);
    void loadTab(tab, { page, filters });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [header.id]);

  useEffect(() => {
    setPlanChangePreview(null);
    setPlanChangeStep("select");
  }, [targetPlanId, targetInterval, applyAt]);

  function handleFilterChange(key: string, value: string) {
    const next = { ...tabFilters, [key]: value };
    if (!value) delete next[key];
    setTabFilters(next);
    setTabPage(1);
    void loadTab(activeTabState, { page: 1, filters: next });
  }

  function handlePageChange(page: number) {
    setTabPage(page);
    void loadTab(activeTabState, { page, filters: tabFilters });
  }

  async function handleExtendTrial() {
    if (!extendReason.trim()) return;
    setExtendLoading(true);
    try {
      const res = await fetch(`/api/admin/subscriptions/${header.id}/trial-extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: extendDays, reason: extendReason }),
      });
      const json = await res.json();
      if (json.success) {
        setShowExtendModal(false);
        setExtendReason("");
        router.refresh();
      } else {
        alert(json.message ?? "Hata oluştu");
      }
    } finally {
      setExtendLoading(false);
    }
  }

  async function handleScheduleCancel() {
    if (!cancelReason.trim()) return;
    setCancelLoading(true);
    try {
      const res = await fetch(`/api/admin/subscriptions/${header.id}/cancellation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason, internalNote: cancelNote, notifyUser: false }),
      });
      const json = await res.json();
      if (json.success) {
        setShowCancelModal(false);
        setCancelReason("");
        router.refresh();
      } else {
        alert(json.message ?? "Hata oluştu");
      }
    } finally {
      setCancelLoading(false);
    }
  }

  async function handleRevokeCancellation() {
    const reason = prompt("İptali geri alma sebebi:");
    if (!reason) return;
    const res = await fetch(`/api/admin/subscriptions/${header.id}/cancellation`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const json = await res.json();
    if (json.success) {
      router.refresh();
    } else {
      alert(json.message ?? "Hata oluştu");
    }
  }

  async function handleSyncProvider() {
    const res = await fetch(`/api/admin/subscriptions/${header.id}/sync-provider`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: false }),
    });
    const json = await res.json();
    alert(json.data?.message ?? (json.success ? "Sync tamamlandı" : (json.message ?? "Hata")));
    if (json.success) router.refresh();
  }

  // Plan change: step 1 → 2 (preview)
  async function handlePlanChangePreview() {
    if (!targetPlanId) return;
    setPlanChangeLoading(true);
    try {
      const res = await fetch(`/api/admin/subscriptions/${header.id}/plan-change/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlanId, targetBillingInterval: targetInterval, applyAt }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setPlanChangePreview(json.data);
        setPlanChangeStep("preview");
      } else {
        alert(json.message ?? "Önizleme yüklenemedi");
      }
    } finally {
      setPlanChangeLoading(false);
    }
  }

  // Plan change: step 2 → apply
  async function handlePlanChangeApply() {
    if (!planChangePreview || !planChangeReason.trim() || applySubmitting) return;
    if (planChangePreview.previewExpiresAt && new Date(planChangePreview.previewExpiresAt) < new Date()) {
      alert("Önizleme süresi doldu. Lütfen önizlemeyi yenileyin.");
      setPlanChangePreview(null);
      setPlanChangeStep("select");
      return;
    }
    setApplySubmitting(true);
    setPlanChangeLoading(true);
    try {
      const res = await fetch(`/api/admin/subscriptions/${header.id}/plan-change/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previewHash: planChangePreview.previewHash,
          targetPlanId: planChangePreview.targetPlanId,
          targetBillingInterval: planChangePreview.targetInterval,
          applyAt: planChangePreview.applyAt,
          reason: planChangeReason,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowPlanChangeModal(false);
        setPlanChangeStep("select");
        setPlanChangePreview(null);
        setPlanChangeReason("");
        router.refresh();
      } else {
        alert(json.message ?? "Uygulama başarısız");
        if (res.status === 409) {
          setPlanChangePreview(null);
          setPlanChangeStep("select");
        }
      }
    } finally {
      setPlanChangeLoading(false);
      setApplySubmitting(false);
    }
  }

  function openPlanChangeModal() {
    setTargetPlanId(header.planId ?? "");
    setTargetInterval(validInterval(header.billingInterval));
    setApplyAt("NEXT_PERIOD");
    setPlanChangeStep("select");
    setPlanChangePreview(null);
    setPlanChangeReason("");
    setShowPlanChangeModal(true);
  }

  const selectedPlan = availablePlans.find((p) => p.id === targetPlanId);
  const selectedIntervalPrice = selectedPlan?.prices.find(
    (p) => p.billingInterval === targetInterval
  );

  return (
    <AdminPageContainer size="full">
      <AdminPageHeader
        title={header.companyName}
        description={
          header.planName
            ? `${header.planName} · ${getBillingIntervalLabel(header.billingInterval)}`
            : "Abonelik Detayı"
        }
        backHref="/admin/subscriptions"
        badge={
          <span
            className={`rounded-full px-3 py-1 text-[11px] font-bold ${getSubscriptionStatusClass(header.status)}`}
          >
            {getSubscriptionStatusLabel(header.status)}
          </span>
        }
        primaryAction={
          <div className="flex flex-wrap gap-2">
            {header.status === "TRIAL" && (
              <button onClick={() => setShowExtendModal(true)} className={appOutlineButtonClass}>
                Trial Uzat
              </button>
            )}
            {!["CANCELLED", "EXPIRED"].includes(header.status) && availablePlans.length > 0 && (
              <button onClick={openPlanChangeModal} className={appOutlineButtonClass}>
                Plan Değiştir
              </button>
            )}
            {!header.cancelAtPeriodEnd && !["CANCELLED", "EXPIRED"].includes(header.status) && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="rounded-md border border-orange-300 bg-orange-50 px-3 py-1.5 text-sm text-orange-700 hover:bg-orange-100"
              >
                İptal Planla
              </button>
            )}
            {header.cancelAtPeriodEnd && (
              <button
                onClick={handleRevokeCancellation}
                className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-100"
              >
                İptali Geri Al
              </button>
            )}
            <button onClick={handleSyncProvider} className={appOutlineButtonClass}>
              Provider Sync
            </button>
          </div>
        }
      />

      {/* Header Info Bar */}
      <div className={`${appPanelClass} mb-4 flex flex-wrap gap-6 px-5 py-3 text-sm`}>
        <div>
          <span className="text-slate-400">Firma:</span>{" "}
          <Link href={`/admin/companies/${header.companyId}`} className="text-blue-600 hover:underline">
            {header.companyName}
          </Link>
        </div>
        {header.owner && (
          <div>
            <span className="text-slate-400">Sahip:</span>{" "}
            <span className="text-slate-700">{header.owner.name ?? header.owner.email}</span>
          </div>
        )}
        {header.currentPeriodEnd && (
          <div>
            <span className="text-slate-400">Dönem Sonu:</span>{" "}
            <span className="font-medium">{formatAdminDate(header.currentPeriodEnd)}</span>
          </div>
        )}
        {header.trialEndsAt && (
          <div>
            <span className="text-slate-400">Trial Bitiş:</span>{" "}
            <span className="font-medium">{formatAdminDate(header.trialEndsAt)}</span>
          </div>
        )}
        {header.monthlyRevenue != null && (
          <div>
            <span className="text-slate-400">Aylık Gelir:</span>{" "}
            <span className="font-semibold text-emerald-700">
              {formatMinor(header.monthlyRevenue, header.currency)}
            </span>
          </div>
        )}
        {header.issueDetails && header.issueDetails.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {header.issueDetails.map((issue) => (
              <span key={issue.code} className="rounded bg-rose-50 px-2 py-0.5 text-[11px] text-rose-600">
                {issue.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-4 border-b border-slate-200">
        <nav className="-mb-px flex gap-0 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => void loadTab(t.key)}
              className={[
                "whitespace-nowrap px-5 py-2.5 text-sm font-medium transition-colors",
                activeTabState === t.key
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-500 hover:text-slate-700",
              ].join(" ")}
            >
              {t.label}
              {t.key === "notes" && header.noteCount > 0 && (
                <span className="ml-1.5 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                  {header.noteCount}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className={appPanelClass}>
        {loading && <div className="py-16 text-center text-sm text-slate-400">Yükleniyor…</div>}
        {error && !loading && (
          <div className="py-16 text-center text-sm text-rose-500">{error}</div>
        )}
        {!loading && !error && !tabData && activeTabState !== "overview" && (
          <div className="py-10 text-center text-sm text-slate-400">
            Yükleniyor…
          </div>
        )}
        {!loading && tabData != null && (
          <AdminSubscriptionTabContent
            tab={activeTabState}
            data={tabData}
            subscriptionId={header.id}
            companyId={header.companyId}
            filters={tabFilters}
            onFilterChange={handleFilterChange}
            onPageChange={handlePageChange}
            onNavigateTab={(tab) => void loadTab(tab)}
            onRefresh={() => void loadTab(activeTabState, { page: tabPage, filters: tabFilters })}
          />
        )}
      </div>

      {/* ── Trial Extend Modal ─────────────────────────────────────── */}
      {showExtendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className={`${appPanelClass} w-full max-w-md p-6`}>
            <h2 className="mb-4 text-base font-semibold text-slate-800">Trial Süresini Uzat</h2>
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Uzatma süresi (gün)
              </label>
              <div className="flex gap-2">
                {[3, 7, 14].map((d) => (
                  <button
                    key={d}
                    onClick={() => setExtendDays(d)}
                    className={[
                      "rounded-md border px-4 py-1.5 text-sm font-medium",
                      extendDays === d
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-slate-300 text-slate-600 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    +{d} gün
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={extendDays}
                  onChange={(e) => setExtendDays(Number(e.target.value))}
                  className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-slate-600">Sebep *</label>
              <textarea
                className="w-full rounded-md border border-slate-300 p-2 text-sm"
                rows={3}
                value={extendReason}
                onChange={(e) => setExtendReason(e.target.value)}
                placeholder="Uzatma sebebini açıklayın…"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowExtendModal(false)} className={appOutlineButtonClass}>
                İptal
              </button>
              <button
                onClick={handleExtendTrial}
                disabled={extendLoading || !extendReason.trim()}
                className={appButtonClass}
              >
                {extendLoading ? "Kaydediliyor…" : "Uzat"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Plan Change Modal ──────────────────────────────────────── */}
      {showPlanChangeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className={`${appPanelClass} w-full max-w-lg p-6`}>
            {planChangeStep === "select" && (
              <>
                <h2 className="mb-4 text-base font-semibold text-slate-800">Plan Değiştir</h2>
                <div className="mb-3">
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Hedef plan
                  </label>
                  <select
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={targetPlanId}
                    onChange={(e) => setTargetPlanId(e.target.value)}
                  >
                    <option value="">Plan seçin…</option>
                    {availablePlans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Faturalama dönemi
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {BILLING_INTERVALS.map((bi) => {
                      const price = selectedPlan?.prices.find(
                        (p) => p.billingInterval === bi.value
                      );
                      return (
                        <button
                          key={bi.value}
                          onClick={() => setTargetInterval(bi.value as BillingIntervalValue)}
                          disabled={!price}
                          className={[
                            "rounded-md border px-3 py-1.5 text-sm",
                            targetInterval === bi.value
                              ? "border-blue-600 bg-blue-50 text-blue-700 font-medium"
                              : "border-slate-300 text-slate-600 hover:bg-slate-50",
                            !price ? "opacity-40 cursor-not-allowed" : "",
                          ].join(" ")}
                        >
                          {bi.label}
                          {price && (
                            <span className="ml-1 text-xs text-slate-400">
                              {formatMinor(price.salePriceMinor, price.currency)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="mb-4">
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Ne zaman uygulanacak?
                  </label>
                  <div className="flex gap-3">
                    {(["NEXT_PERIOD", "IMMEDIATELY"] as const).map((opt) => (
                      <label key={opt} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="applyAt"
                          value={opt}
                          checked={applyAt === opt}
                          onChange={() => setApplyAt(opt)}
                        />
                        {opt === "NEXT_PERIOD" ? "Dönem sonunda" : "Hemen"}
                      </label>
                    ))}
                  </div>
                  {applyAt === "IMMEDIATELY" && (
                    <p className="mt-1 text-xs text-amber-600">
                      Hemen uygulama mevcut faturalama dönemini değiştirir.
                    </p>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowPlanChangeModal(false)}
                    className={appOutlineButtonClass}
                  >
                    İptal
                  </button>
                  <button
                    onClick={handlePlanChangePreview}
                    disabled={planChangeLoading || !targetPlanId || !selectedIntervalPrice}
                    className={appButtonClass}
                  >
                    {planChangeLoading ? "Yükleniyor…" : "Önizle →"}
                  </button>
                </div>
              </>
            )}

            {planChangeStep === "preview" && planChangePreview && (
              <>
                <h2 className="mb-4 text-base font-semibold text-slate-800">Plan Değişikliği Önizlemesi</h2>
                <div className="mb-4 rounded-md bg-slate-50 p-4 text-sm">
                  <div className="mb-2 flex justify-between">
                    <span className="text-slate-500">Mevcut plan</span>
                    <span className="font-medium">{getBillingIntervalLabel(validInterval(planChangePreview.currentInterval))} / {planChangePreview.currentPlanId}</span>
                  </div>
                  <div className="mb-2 flex justify-between">
                    <span className="text-slate-500">Yeni plan</span>
                    <span className="font-semibold text-blue-700">
                      {planChangePreview.targetPlanName} — {getBillingIntervalLabel(validInterval(planChangePreview.targetInterval))}
                    </span>
                  </div>
                  <div className="mb-2 flex justify-between">
                    <span className="text-slate-500">Liste fiyatı</span>
                    <span>{formatMinor(planChangePreview.pricing.listPriceMinor, planChangePreview.pricing.currency)}</span>
                  </div>
                  <div className="mb-2 flex justify-between">
                    <span className="text-slate-500">Fiyat</span>
                    <span className="font-semibold">
                      {formatMinor(planChangePreview.pricing.salePriceMinor, planChangePreview.pricing.currency)}
                    </span>
                  </div>
                  <div className="mb-2 flex justify-between">
                    <span className="text-slate-500">Aylık eşdeğer</span>
                    <span>
                      {formatMinor(planChangePreview.pricing.monthlyEquivalentMinor, planChangePreview.pricing.currency)}
                    </span>
                  </div>
                  {planChangePreview.entitlementDiff && planChangePreview.entitlementDiff.length > 0 && (
                    <div className="mb-2 border-t border-slate-200 pt-2">
                      <span className="text-slate-500">Yetki farkları:</span>
                      <ul className="mt-1 space-y-1 text-xs">
                        {planChangePreview.entitlementDiff.map((d) => (
                          <li key={d.code}>
                            <span className="font-mono">{d.code}</span>: {String(d.from ?? "—")} → {String(d.to ?? "—")}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {planChangePreview.previewExpiresAt && (
                    <p className="mb-2 text-xs text-slate-400">
                      Önizleme geçerlilik: {new Date(planChangePreview.previewExpiresAt).toLocaleString("tr-TR")}
                    </p>
                  )}
                  {planChangePreview.pricing.discounts.length > 0 && (
                    <div className="mb-2">
                      <span className="text-slate-500">İndirimler:</span>
                      <ul className="mt-1 list-inside list-disc text-xs text-emerald-700">
                        {planChangePreview.pricing.discounts.map((d, i) => (
                          <li key={i}>{d.label} (−{formatMinor(d.amount, planChangePreview.pricing.currency)})</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-slate-200 pt-2">
                    <span className="text-slate-500">Uygulama zamanı</span>
                    <span className="text-xs">
                      {planChangePreview.applyAt === "IMMEDIATELY" ? "Hemen" : "Dönem sonunda"} —{" "}
                      {new Date(planChangePreview.effectiveAt).toLocaleDateString("tr-TR")}
                    </span>
                  </div>
                </div>
                <div className="mb-4">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Değişiklik sebebi *</label>
                  <textarea
                    className="w-full rounded-md border border-slate-300 p-2 text-sm"
                    rows={3}
                    value={planChangeReason}
                    onChange={(e) => setPlanChangeReason(e.target.value)}
                    placeholder="Plan değişikliği sebebini açıklayın…"
                  />
                </div>
                <div className="flex justify-between gap-2">
                  <button
                    onClick={() => setPlanChangeStep("select")}
                    className={appOutlineButtonClass}
                  >
                    ← Geri
                  </button>
                  <button
                    onClick={handlePlanChangeApply}
                    disabled={planChangeLoading || applySubmitting || !planChangeReason.trim() || !planChangePreview}
                    className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {planChangeLoading ? "Uygulanıyor…" : "Planı Değiştir"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Schedule Cancellation Modal ───────────────────────────── */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className={`${appPanelClass} w-full max-w-md p-6`}>
            <h2 className="mb-4 text-base font-semibold text-slate-800">Dönem Sonu İptali Planla</h2>
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-slate-600">İptal sebebi *</label>
              <textarea
                className="w-full rounded-md border border-slate-300 p-2 text-sm"
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="İptal sebebini açıklayın…"
              />
            </div>
            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-slate-600">İç not (opsiyonel)</label>
              <textarea
                className="w-full rounded-md border border-slate-300 p-2 text-sm"
                rows={2}
                value={cancelNote}
                onChange={(e) => setCancelNote(e.target.value)}
                placeholder="Sadece admin ekibine görünür…"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCancelModal(false)} className={appOutlineButtonClass}>
                İptal
              </button>
              <button
                onClick={handleScheduleCancel}
                disabled={cancelLoading || !cancelReason.trim()}
                className="rounded-md bg-orange-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {cancelLoading ? "Kaydediliyor…" : "İptali Planla"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPageContainer>
  );
}
