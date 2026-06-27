"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { AdminCampaignActions } from "@/components/admin/admin-campaign-actions";
import {
  appInputClass,
  appOutlineButtonClass,
  appPanelClass,
  appPrimaryButtonClass,
  appSelectClass,
  appTableClass,
  appTableHeadClass,
  appTableRowClass,
} from "@/lib/admin-ui";
import { formatAdminDate, formatAdminDateTime } from "@/lib/admin-utils";
import { formatMinorToMoney } from "@/lib/billing/pricing-utils";
import {
  formatDiscountLabel,
} from "@/lib/admin/promotions/promotion-scope-utils";
import {
  getCampaignStatusBadgeClass,
  getCampaignStatusLabel,
} from "@/lib/admin/promotions/promotion-filter-utils";
import { AdminCampaignTargetingEditor } from "@/components/admin/admin-campaign-targeting-editor";
import type { getCampaignAnalytics, getCampaignDetail } from "@/lib/admin/promotions";
import type { listCampaignAffectedSubscriptions } from "@/lib/admin/promotions/campaign-query-service";

type DetailData = NonNullable<Awaited<ReturnType<typeof getCampaignDetail>>>;
type AnalyticsData = Awaited<ReturnType<typeof getCampaignAnalytics>>;
type AffectedData = Awaited<ReturnType<typeof listCampaignAffectedSubscriptions>>;
type HistoryItem = {
  id: string;
  action: string;
  message: string;
  createdAt: string;
  actorName: string;
};

const TABS = [
  { id: "overview", label: "Genel" },
  { id: "targeting", label: "Hedefleme" },
  { id: "pricing", label: "Fiyat Önizleme" },
  { id: "usage", label: "Kullanım" },
  { id: "history", label: "Geçmiş" },
  { id: "activity", label: "Aktivite" },
] as const;

type TabId = (typeof TABS)[number]["id"];

type UsageItem = {
  id: string;
  createdAt: string;
  companyName: string;
  amountMinor: number;
  status: string;
  planName: string | null;
  paymentId: string | null;
  currency: string | null;
};

type ActivityItem = {
  id: string;
  action: string;
  message: string | null;
  metadata: unknown;
  createdAt: string;
  actor: { name: string | null; email: string } | null;
};

type Pagination = { page: number; pageSize: number; total: number; totalPages: number };

export function AdminCampaignDetailTabs({
  detail,
  analytics,
  affected,
  history,
  historyPagination,
  activity,
  activityPagination,
  usage,
  usagePagination,
  usageTotals,
  companies,
  plans,
}: {
  detail: DetailData;
  analytics: AnalyticsData;
  affected: AffectedData;
  history: HistoryItem[];
  historyPagination?: Pagination;
  activity: ActivityItem[];
  activityPagination?: Pagination;
  usage: UsageItem[];
  usagePagination?: Pagination;
  usageTotals?: { successfulUsage: number };
  companies: Array<{ id: string; name: string }>;
  plans: Array<{ id: string; name: string }>;
}) {
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const tab: TabId =
    rawTab === "scope"
      ? "targeting"
      : rawTab === "preview"
        ? "pricing"
        : (rawTab as TabId) || "overview";
  const { campaign, stats, issues } = detail;

  const [previewCompanyId, setPreviewCompanyId] = useState(companies[0]?.id ?? "");
  const [previewPlanId, setPreviewPlanId] = useState(
    campaign.scopes.find((s) => s.planId)?.planId ?? ""
  );
  const [previewInterval, setPreviewInterval] = useState<
    "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "YEARLY"
  >("MONTHLY");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<Record<string, unknown> | null>(null);
  const [previewError, setPreviewError] = useState("");

  async function runPreview() {
    if (!previewCompanyId || !previewPlanId) {
      setPreviewError("Firma ve plan seçin.");
      return;
    }
    setPreviewLoading(true);
    setPreviewError("");
    try {
      const res = await fetch(`/api/admin/campaigns/${campaign.id}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: previewCompanyId,
          planId: previewPlanId,
          billingInterval: previewInterval,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Önizleme başarısız.");
      setPreviewResult(json.data);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Önizleme başarısız.");
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[22px] font-extrabold text-[#0f1f4d]">{campaign.name}</h1>
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${getCampaignStatusBadgeClass(campaign.status)}`}
            >
              {getCampaignStatusLabel(campaign.status)}
            </span>
          </div>
          {campaign.description ? (
            <p className="mt-1 text-[13px] text-slate-500">{campaign.description}</p>
          ) : null}
        </div>
        <Link href="/admin/campaigns" className={appOutlineButtonClass}>
          Listeye Dön
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Kullanım" value={String(stats.usageCount)} />
        <StatCard label="Toplam İndirim" value={formatMinorToMoney(stats.totalDiscountMinor)} />
        <StatCard label="Toplam Tahsilat" value={formatMinorToMoney(analytics.totalRevenueMinor)} />
        <StatCard label="Öncelik" value={String(campaign.priority)} />
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <Link
            key={item.id}
            href={`/admin/campaigns/${campaign.id}?tab=${item.id}`}
            className={`rounded-2xl px-4 py-2 text-[13px] font-bold transition ${
              tab === item.id
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {tab === "overview" && (
        <div className={`${appPanelClass} grid gap-4 p-5 md:grid-cols-2`}>
          <InfoBlock
            title="Temel Bilgiler"
            rows={[
              ["Kod", campaign.code ?? "—"],
              ["Durum", getCampaignStatusLabel(campaign.status)],
              ["Başlangıç", formatAdminDate(campaign.startsAt)],
              ["Bitiş", formatAdminDate(campaign.endsAt)],
              ["Yayınlanma", formatAdminDate(campaign.publishedAt)],
            ]}
          />
          <InfoBlock
            title="İndirim ve Kurallar"
            rows={[
              [
                "İndirim",
                formatDiscountLabel(
                  campaign.discountType,
                  campaign.discountValue,
                  formatMinorToMoney
                ),
              ],
              ["Otomatik uygula", campaign.autoApply ? "Evet" : "Hayır"],
              ["Stackable", campaign.stackable ? "Evet" : "Hayır"],
              ["İlk ödeme", campaign.firstPaymentOnly ? "Evet" : "Hayır"],
              ["Yenileme", campaign.renewalAllowed ? "İzinli" : "Kapalı"],
            ]}
          />
          <div className="md:col-span-2">
            <h3 className="mb-2 text-[14px] font-extrabold text-[#0f1f4d]">Analitik</h3>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-[13px]">
              <Metric label="Rezerve" value={String(analytics.reserved)} />
              <Metric label="Finalize" value={String(analytics.finalized)} />
              <Metric label="Serbest" value={String(analytics.released)} />
              <Metric label="İade" value={String(analytics.refunded)} />
              <Metric label="Firma sayısı" value={String(analytics.companyCount)} />
              <Metric
                label="Dönüşüm"
                value={`%${analytics.conversionRate}`}
                hint={analytics.conversionDefinition}
              />
              <Metric
                label="Ort. ödeme"
                value={formatMinorToMoney(analytics.averagePaymentMinor)}
              />
            </dl>
          </div>
          {issues?.length ? (
            <div className="md:col-span-2">
              <h3 className="mb-2 text-[14px] font-extrabold text-[#0f1f4d]">Sorunlar</h3>
              <ul className="space-y-1 text-[12px]">
                {issues.map((issue) => (
                  <li key={issue.code} className="text-amber-800">
                    <span className="font-bold">{issue.code}</span>: {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="md:col-span-2">
            <AdminCampaignActions campaignId={campaign.id} status={campaign.status} />
          </div>
        </div>
      )}

      {tab === "targeting" && (
        <AdminCampaignTargetingEditor
          campaignId={campaign.id}
          plans={plans}
          archived={campaign.status === "ARCHIVED"}
        />
      )}

      {tab === "usage" && (
        <div className={`${appPanelClass} overflow-x-auto p-4`}>
          <p className="mb-3 text-[12px] text-slate-500">
            Başarılı kullanım: {usageTotals?.successfulUsage ?? stats.usageCount} (yalnızca
            FINALIZED)
          </p>
          {usage.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-slate-500">Henüz kullanım yok.</p>
          ) : (
            <table className={appTableClass}>
              <thead>
                <tr className={appTableHeadClass}>
                  <th className="px-3 py-2">Tarih</th>
                  <th className="px-3 py-2">Firma</th>
                  <th className="px-3 py-2">Plan</th>
                  <th className="px-3 py-2">İndirim</th>
                  <th className="px-3 py-2">Para Birimi</th>
                  <th className="px-3 py-2">Durum</th>
                </tr>
              </thead>
              <tbody>
                {usage.map((r) => (
                  <tr key={r.id} className={appTableRowClass}>
                    <td className="px-3 py-3">{formatAdminDateTime(r.createdAt)}</td>
                    <td className="px-3 py-3">{r.companyName}</td>
                    <td className="px-3 py-3">{r.planName ?? "—"}</td>
                    <td className="px-3 py-3">{formatMinorToMoney(r.amountMinor)}</td>
                    <td className="px-3 py-3">{r.currency ?? "—"}</td>
                    <td className="px-3 py-3">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {usagePagination && usagePagination.totalPages > 1 ? (
            <p className="mt-3 text-[12px] text-slate-500">
              Sayfa {usagePagination.page} / {usagePagination.totalPages}
            </p>
          ) : null}
        </div>
      )}

      {tab === "pricing" && (
        <div className={`${appPanelClass} space-y-4 p-5`}>
          <div className="grid gap-3 md:grid-cols-3">
            <select
              value={previewCompanyId}
              onChange={(e) => setPreviewCompanyId(e.target.value)}
              className={appSelectClass}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={previewPlanId}
              onChange={(e) => setPreviewPlanId(e.target.value)}
              className={appSelectClass}
            >
              <option value="">Plan seçin</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              value={previewInterval}
              onChange={(e) =>
                setPreviewInterval(e.target.value as typeof previewInterval)
              }
              className={appSelectClass}
            >
              <option value="MONTHLY">Aylık</option>
              <option value="QUARTERLY">3 Aylık</option>
              <option value="SEMI_ANNUAL">6 Aylık</option>
              <option value="YEARLY">Yıllık</option>
            </select>
          </div>
          <button
            type="button"
            disabled={previewLoading}
            onClick={runPreview}
            className={appPrimaryButtonClass}
          >
            {previewLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Hesaplanıyor…
              </>
            ) : (
              "Fiyat Hesapla"
            )}
          </button>
          {previewError ? (
            <p className="text-[13px] font-semibold text-red-600">{previewError}</p>
          ) : null}
          {previewResult ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-[13px] space-y-2">
              <p className="font-bold">
                Uygunluk:{" "}
                {previewResult.eligible === true ? (
                  <span className="text-emerald-700">Uygun</span>
                ) : (
                  <span className="text-red-600">Uygun değil</span>
                )}
              </p>
              {Array.isArray(previewResult.ineligibleReasons) &&
              previewResult.ineligibleReasons.length ? (
                <ul className="list-disc pl-4 text-red-700">
                  {(previewResult.ineligibleReasons as string[]).map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              ) : null}
              <p>Liste: {String(previewResult.listFormatted ?? previewResult.listPriceMinor)}</p>
              <p>Kampanya indirimi: {String(previewResult.campaignDiscountMinor ?? "—")}</p>
              <p className="font-bold text-[#0f1f4d]">
                Toplam: {String(previewResult.totalFormatted ?? previewResult.totalMinor)}
              </p>
            </div>
          ) : null}
        </div>
      )}

      {tab === "history" && (
        <div className={`${appPanelClass} p-5`}>
          {history.length === 0 ? (
            <p className="text-[13px] text-slate-500">Geçmiş kaydı bulunamadı.</p>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-100 px-4 py-3 text-[13px]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-[#0f1f4d]">{item.action}</p>
                    <p className="text-[11px] text-slate-400">
                      {formatAdminDateTime(item.createdAt)}
                    </p>
                  </div>
                  <p className="mt-1 text-slate-600">{item.message}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{item.actorName}</p>
                </div>
              ))}
            </div>
          )}
          {historyPagination && historyPagination.totalPages > 1 ? (
            <p className="mt-3 text-[12px] text-slate-500">
              Sayfa {historyPagination.page} / {historyPagination.totalPages}
            </p>
          ) : null}
        </div>
      )}

      {tab === "activity" && (
        <div className={`${appPanelClass} p-5`}>
          {activity.length === 0 ? (
            <p className="text-[13px] text-slate-500">Aktivite kaydı bulunamadı.</p>
          ) : (
            <div className="space-y-3">
              {activity.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-100 px-4 py-3 text-[13px]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-[#0f1f4d]">{item.action}</p>
                    <p className="text-[11px] text-slate-400">
                      {formatAdminDateTime(item.createdAt)}
                    </p>
                  </div>
                  {item.message ? <p className="mt-1 text-slate-600">{item.message}</p> : null}
                  <p className="mt-1 text-[11px] text-slate-400">
                    {item.actor?.name ?? item.actor?.email ?? "Sistem"}
                  </p>
                </div>
              ))}
            </div>
          )}
          {activityPagination && activityPagination.totalPages > 1 ? (
            <p className="mt-3 text-[12px] text-slate-500">
              Sayfa {activityPagination.page} / {activityPagination.totalPages}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${appPanelClass} p-4`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-extrabold text-[#0f1f4d]">{value}</p>
    </div>
  );
}

function InfoBlock({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string]>;
}) {
  return (
    <div>
      <h3 className="mb-3 text-[15px] font-extrabold text-[#0f1f4d]">{title}</h3>
      <dl className="space-y-2 text-[13px]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-slate-500">{label}</dt>
            <dd className="font-semibold text-[#0f1f4d]">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <dt className="text-slate-400">{label}</dt>
      <dd className="font-bold text-[#0f1f4d]">{value}</dd>
      {hint ? <p className="text-[10px] text-slate-400">{hint}</p> : null}
    </div>
  );
}
