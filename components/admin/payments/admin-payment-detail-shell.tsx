"use client";

import Link from "next/link";
import { useState, useCallback, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import { AdminPaymentTabContent } from "@/components/admin/payments/admin-payment-tab-panels";
import { appOutlineButtonClass, appPanelClass } from "@/lib/admin-ui";
import { formatAdminDate } from "@/lib/admin-utils";
import { formatMinor } from "@/lib/admin/subscriptions/admin-subscription-serializers";
import type {
  getAdminPaymentHeader,
  AdminPaymentTab,
} from "@/lib/admin/payments/admin-payment-detail-service";

type Header = NonNullable<Awaited<ReturnType<typeof getAdminPaymentHeader>>>;

type Props = {
  header: Header;
  activeTab: AdminPaymentTab;
};

const TABS: { key: AdminPaymentTab; label: string }[] = [
  { key: "overview", label: "Genel Bakış" },
  { key: "provider", label: "Provider / Callback" },
  { key: "subscription", label: "Abonelik" },
  { key: "refunds", label: "İadeler" },
  { key: "events", label: "Olaylar" },
  { key: "activity", label: "Aktivite" },
  { key: "notes", label: "Notlar" },
];

export function AdminPaymentDetailShell({ header, activeTab }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeTabState, setActiveTabState] = useState<AdminPaymentTab>(activeTab);
  const [tabData, setTabData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const loadTab = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", activeTabState);
      const res = await fetch(`/api/admin/payments/${header.id}?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Yüklenemedi");
      setTabData(json.data.tabData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hata");
    } finally {
      setLoading(false);
    }
  }, [header.id, activeTabState, searchParams]);

  useEffect(() => {
    void loadTab();
  }, [loadTab]);

  function navigateTab(tab: AdminPaymentTab) {
    setActiveTabState(tab);
    const p = new URLSearchParams(searchParams.toString());
    p.set("tab", tab);
    router.push(`${pathname}?${p.toString()}`);
  }

  async function handleSyncProvider() {
    setSyncLoading(true);
    setSyncMessage(null);
    try {
      const res = await fetch(`/api/admin/payments/${header.id}/sync-provider`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: false }),
      });
      const json = await res.json();
      if (!json.success) {
        setSyncMessage(json.message ?? "Sync başarısız");
        return;
      }
      setSyncMessage(json.data.message);
      await loadTab();
      router.refresh();
    } catch {
      setSyncMessage("Sync başarısız");
    } finally {
      setSyncLoading(false);
    }
  }

  return (
    <AdminPageContainer size="full">
      <AdminPageHeader
        title={`Ödeme ${header.id.slice(0, 10)}…`}
        description={`${header.companyName} · ${formatMinor(header.amountMinor, header.currency)}`}
        meta={
          <span className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <Link href={header.companyHref} className="font-semibold text-blue-700 hover:underline">
              Firma detayı
            </Link>
            {header.refundedMinor > 0 && (
              <span className="text-violet-600">
                İade: {formatMinor(header.refundedMinor, header.currency)}
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${header.statusClass}`}
            >
              {header.statusLabel}
            </span>
          </span>
        }
        backHref="/admin/payments"
        primaryAction={
          header.providerEnum === "PAYTR" ? (
            <button
              type="button"
              disabled={syncLoading}
              onClick={() => void handleSyncProvider()}
              className={appOutlineButtonClass}
            >
              {syncLoading ? "Sync…" : "Provider Sync"}
            </button>
          ) : undefined
        }
      />

      {syncMessage && (
        <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
          {syncMessage}
        </div>
      )}

      {header.issues.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {header.issues.map((issue) => (
            <button
              key={issue.code}
              type="button"
              onClick={() => navigateTab(issue.tab as AdminPaymentTab)}
              className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
            >
              {issue.label}
            </button>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => navigateTab(t.key)}
            className={`px-4 py-2 text-sm font-semibold ${
              activeTabState === t.key
                ? "border-b-2 border-blue-600 text-blue-700"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
            {t.key === "notes" && header.noteCount > 0 && (
              <span className="ml-1 rounded-full bg-slate-200 px-1.5 text-[10px]">
                {header.noteCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className={appPanelClass}>
        {loading && <p className="py-8 text-center text-slate-500">Yükleniyor…</p>}
        {error && <p className="py-8 text-center text-rose-600">{error}</p>}
        {!loading && !error && (
          <AdminPaymentTabContent
            tab={activeTabState}
            data={tabData}
            paymentId={header.id}
            header={header}
            onReload={loadTab}
          />
        )}
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Oluşturulma: {formatAdminDate(header.createdAt)}
        {header.paidAt && ` · Ödeme: ${formatAdminDate(header.paidAt)}`}
        {header.subscriptionHref && (
          <>
            {" · "}
            <Link href={header.subscriptionHref} className="text-blue-600 hover:underline">
              Abonelik
            </Link>
          </>
        )}
      </p>
    </AdminPageContainer>
  );
}
