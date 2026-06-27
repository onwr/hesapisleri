"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import { AdminPlanOverviewTab } from "@/components/admin/plans/admin-plan-overview-tab";
import { AdminPlanPricingTab } from "@/components/admin/plans/admin-plan-pricing-tab";
import { AdminPlanFeaturesTab } from "@/components/admin/plans/admin-plan-features-tab";
import { AdminPlanEntitlementsTab } from "@/components/admin/plans/admin-plan-entitlements-tab";
import { AdminPlanSubscriptionsTab } from "@/components/admin/plans/admin-plan-subscriptions-tab";
import { AdminPlanHistoryTab } from "@/components/admin/plans/admin-plan-history-tab";
import { AdminPlanActivityTab } from "@/components/admin/plans/admin-plan-activity-tab";
import { AdminPlanNotesTab } from "@/components/admin/plans/admin-plan-notes-tab";
import { AdminPlanPlaceholderTab } from "@/components/admin/plans/admin-plan-placeholder-tab";
import { AdminPlanEditModal } from "@/components/admin/plans/admin-plan-edit-modal";
import { AdminPlanPriceWizard } from "@/components/admin/plans/admin-plan-price-wizard";
import { AdminPlanActivateModal, AdminPlanArchiveModal } from "@/components/admin/plans/admin-plan-lifecycle-modals";
import { AdminPlanCloneModal } from "@/components/admin/plans/admin-plan-clone-modal";
import { appOutlineButtonClass, appPanelClass, appPrimaryButtonClass } from "@/lib/admin-ui";
import { formatAdminDate } from "@/lib/admin-utils";
import type { AdminPlanTab } from "@/lib/admin/plans/admin-plan-schemas";

type Header = {
  id: string;
  shortId: string;
  name: string;
  code: string;
  planStatus: string;
  planStatusLabel: string;
  planStatusClass: string;
  visibilityLabel: string;
  isActiveLegacy: boolean;
  pricingClassLabel: string;
  activeSubscriptionCount: number;
  trialSubscriptionCount: number;
  cancelAtPeriodEndCount: number;
  mrrByCurrency: Record<string, number>;
  openIssueCount: number;
  checkoutAvailable: boolean;
  updatedAt: string;
};

type Props = {
  planId: string;
  header: Header;
  activeTab: AdminPlanTab;
  initialTabData: unknown;
  planBasics: Record<string, unknown>;
};

const TABS: { key: AdminPlanTab; label: string; operational: boolean }[] = [
  { key: "overview", label: "Genel Bakış", operational: true },
  { key: "pricing", label: "Fiyatlandırma", operational: true },
  { key: "features", label: "Özellikler", operational: true },
  { key: "entitlements", label: "Yetkiler", operational: true },
  { key: "subscriptions", label: "Abonelikler", operational: true },
  { key: "history", label: "Geçmiş", operational: true },
  { key: "activity", label: "Aktivite", operational: true },
  { key: "notes", label: "Notlar", operational: true },
];

function formatMrr(mrr: Record<string, number>) {
  const parts = Object.entries(mrr).map(([c, v]) => `${v.toLocaleString("tr-TR")} ${c}`);
  return parts.length ? parts.join(" · ") : "—";
}

export function AdminPlanDetailShell({
  planId,
  header,
  activeTab,
  initialTabData,
  planBasics,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<AdminPlanTab>(activeTab);
  const [tabData, setTabData] = useState(initialTabData);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadTab = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams(searchParams.toString());
      p.set("tab", tab);
      const res = await fetch(`/api/admin/plans/${planId}?${p.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setTabData(json.data.tabData);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [planId, tab, searchParams]);

  useEffect(() => {
    if (tab !== activeTab) void loadTab();
  }, [tab, activeTab, loadTab]);

  function navigateTab(next: AdminPlanTab) {
    setTab(next);
    const p = new URLSearchParams(searchParams.toString());
    p.set("tab", next);
    router.push(`${pathname}?${p.toString()}`);
  }

  function onMutationSuccess(msg: string) {
    setMessage(msg);
    void loadTab();
    router.refresh();
  }

  return (
    <AdminPageContainer size="full">
      <AdminPageHeader
        title={header.name}
        description={`${header.code} · ${header.shortId}…`}
        backHref="/admin/plans"
      />

      <div className={`${appPanelClass} mb-4 p-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2 text-[12px] text-slate-600">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${header.planStatusClass}`}>
                {header.planStatusLabel}
              </span>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                {header.visibilityLabel}
              </span>
              <span className="text-slate-500">
                legacy isActive: {header.isActiveLegacy ? "true" : "false"}
              </span>
              <span className="font-medium text-slate-800">{header.pricingClassLabel}</span>
            </div>
            <div className="flex flex-wrap gap-4">
              <span>Aktif abonelik: {header.activeSubscriptionCount}</span>
              <span>Trial: {header.trialSubscriptionCount}</span>
              <span>İptal bekleyen: {header.cancelAtPeriodEndCount}</span>
              <span>MRR: {formatMrr(header.mrrByCurrency)}</span>
              <span>Açık sorun: {header.openIssueCount}</span>
              <span>
                Checkout: {header.checkoutAvailable ? (
                  <span className="font-bold text-emerald-700">Açık</span>
                ) : (
                  <span className="text-slate-500">Kapalı</span>
                )}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Son güncelleme: {formatAdminDate(header.updatedAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={appOutlineButtonClass} onClick={() => setCloneOpen(true)}>
              Planı Kopyala
            </button>
            <button type="button" className={appOutlineButtonClass} onClick={() => setEditOpen(true)}>
              Planı düzenle
            </button>
            <button
              type="button"
              className={appOutlineButtonClass}
              onClick={() => setPriceOpen(true)}
              disabled={header.planStatus === "ARCHIVED"}
            >
              Yeni fiyat
            </button>
            {header.planStatus !== "ACTIVE" && header.planStatus !== "ARCHIVED" ? (
              <button type="button" className={appPrimaryButtonClass} onClick={() => setActivateOpen(true)}>
                Aktif et
              </button>
            ) : null}
            {header.planStatus !== "ARCHIVED" ? (
              <button type="button" className={appOutlineButtonClass} onClick={() => setArchiveOpen(true)}>
                Arşivle
              </button>
            ) : null}
          </div>
        </div>
        {message ? <p className="mt-2 text-[12px] text-slate-700">{message}</p> : null}
      </div>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200 pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => navigateTab(t.key)}
            className={[
              "rounded-md px-3 py-1.5 text-[12px] font-bold",
              tab === t.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-[12px] text-slate-500">Yükleniyor…</p>
      ) : tab === "overview" ? (
        <AdminPlanOverviewTab data={tabData as Parameters<typeof AdminPlanOverviewTab>[0]["data"]} planId={planId} />
      ) : tab === "pricing" ? (
        <AdminPlanPricingTab
          data={tabData as Parameters<typeof AdminPlanPricingTab>[0]["data"]}
          planId={planId}
          onCreatePrice={() => setPriceOpen(true)}
        />
      ) : tab === "features" ? (
        <AdminPlanFeaturesTab
          planId={planId}
          data={tabData as Parameters<typeof AdminPlanFeaturesTab>[0]["data"]}
          onRefresh={() => void loadTab()}
        />
      ) : tab === "entitlements" ? (
        <AdminPlanEntitlementsTab
          planId={planId}
          data={tabData as Parameters<typeof AdminPlanEntitlementsTab>[0]["data"]}
          onRefresh={() => void loadTab()}
        />
      ) : tab === "subscriptions" ? (
        <AdminPlanSubscriptionsTab
          planId={planId}
          data={tabData as Parameters<typeof AdminPlanSubscriptionsTab>[0]["data"]}
        />
      ) : tab === "history" ? (
        <AdminPlanHistoryTab
          planId={planId}
          data={tabData as Parameters<typeof AdminPlanHistoryTab>[0]["data"]}
        />
      ) : tab === "activity" ? (
        <AdminPlanActivityTab
          planId={planId}
          data={tabData as Parameters<typeof AdminPlanActivityTab>[0]["data"]}
        />
      ) : tab === "notes" ? (
        <AdminPlanNotesTab
          planId={planId}
          data={tabData as Parameters<typeof AdminPlanNotesTab>[0]["data"]}
          onRefresh={() => void loadTab()}
        />
      ) : (
        <AdminPlanPlaceholderTab tab={tab} />
      )}

      <AdminPlanEditModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        planId={planId}
        plan={planBasics}
        onSuccess={(msg) => {
          setEditOpen(false);
          onMutationSuccess(msg);
        }}
      />
      <AdminPlanPriceWizard
        open={priceOpen}
        onClose={() => setPriceOpen(false)}
        planId={planId}
        defaultCurrency={(planBasics.defaultCurrency as string) ?? "TRY"}
        onSuccess={(msg) => {
          setPriceOpen(false);
          onMutationSuccess(msg);
        }}
      />
      <AdminPlanCloneModal
        open={cloneOpen}
        onClose={() => setCloneOpen(false)}
        planId={planId}
        sourceName={header.name}
        onSuccess={(msg) => {
          setCloneOpen(false);
          onMutationSuccess(msg);
        }}
      />
      <AdminPlanActivateModal
        open={activateOpen}
        onClose={() => setActivateOpen(false)}
        planId={planId}
        onSuccess={(msg) => {
          setActivateOpen(false);
          onMutationSuccess(msg);
        }}
      />
      <AdminPlanArchiveModal
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        planId={planId}
        activeCount={header.activeSubscriptionCount}
        trialCount={header.trialSubscriptionCount}
        onSuccess={(msg) => {
          setArchiveOpen(false);
          onMutationSuccess(msg);
        }}
      />
    </AdminPageContainer>
  );
}
