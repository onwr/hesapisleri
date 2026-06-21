"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { AdminCouponActions } from "@/components/admin/admin-coupon-actions";
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
  formatCouponIntervalSummary,
  formatCouponPlanSummary,
  formatDiscountLabel,
} from "@/lib/admin/promotions/promotion-scope-utils";
import {
  getCampaignStatusBadgeClass,
  getCouponStatusLabel,
} from "@/lib/admin/promotions/promotion-filter-utils";
import type { getCouponAnalytics, getCouponDetail } from "@/lib/admin/promotions";

type DetailData = NonNullable<Awaited<ReturnType<typeof getCouponDetail>>>;
type AnalyticsData = Awaited<ReturnType<typeof getCouponAnalytics>>;
type HistoryItem = {
  id: string;
  action: string;
  message: string;
  createdAt: string;
  actorName: string;
};

const TABS = [
  { id: "overview", label: "Genel" },
  { id: "scope", label: "Kapsam" },
  { id: "usage", label: "Kullanımlar" },
  { id: "preview", label: "Fiyat Önizleme" },
  { id: "history", label: "Audit" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function AdminCouponDetailTabs({
  detail,
  analytics,
  history,
  companies,
}: {
  detail: DetailData;
  analytics: AnalyticsData;
  history: HistoryItem[];
  companies: Array<{ id: string; name: string }>;
}) {
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as TabId) || "overview";
  const { coupon, stats } = detail;

  const [previewCompanyId, setPreviewCompanyId] = useState(companies[0]?.id ?? "");
  const [previewPlanId, setPreviewPlanId] = useState(
    coupon.planScopes[0]?.plan.id ?? ""
  );
  const [previewInterval, setPreviewInterval] = useState<
    "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "YEARLY"
  >(
    (coupon.allowedIntervals[0] as "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "YEARLY") ??
      "MONTHLY"
  );
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
      const res = await fetch("/api/admin/membership-coupons/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: previewCompanyId,
          planId: previewPlanId,
          billingInterval: previewInterval,
          couponCode: coupon.code,
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
            <h1 className="font-mono text-[22px] font-extrabold text-[#0f1f4d]">
              {coupon.code}
            </h1>
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${getCampaignStatusBadgeClass(coupon.status)}`}
            >
              {getCouponStatusLabel(coupon.status)}
            </span>
          </div>
          <p className="mt-1 text-[13px] text-slate-500">{coupon.name}</p>
        </div>
        <Link href="/admin/membership-coupons" className={appOutlineButtonClass}>
          Listeye Dön
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Kullanım" value={String(stats.usageCount)} />
        <StatCard label="Toplam İndirim" value={formatMinorToMoney(stats.totalDiscountMinor)} />
        <StatCard label="Başarılı Ödeme" value={String(analytics.successfulPayments)} />
        <StatCard label="Firma Limiti" value={String(coupon.maxUsagePerCompany)} />
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <Link
            key={item.id}
            href={`/admin/membership-coupons/${coupon.id}?tab=${item.id}`}
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
        <div className={`${appPanelClass} space-y-4 p-5`}>
          <dl className="grid gap-3 md:grid-cols-2 text-[13px]">
            <Row
              label="İndirim"
              value={formatDiscountLabel(
                coupon.discountType,
                coupon.discountValue,
                formatMinorToMoney
              )}
            />
            <Row label="Başlangıç" value={formatAdminDate(coupon.startsAt)} />
            <Row label="Bitiş" value={formatAdminDate(coupon.expiresAt)} />
            <Row label="Kullanım limiti" value={String(coupon.maxUsage ?? "Sınırsız")} />
            <Row label="İlk ödeme" value={coupon.firstPaymentOnly ? "Evet" : "Hayır"} />
            <Row label="Yenileme" value={coupon.renewalAllowed ? "İzinli" : "Kapalı"} />
            <Row label="Stackable" value={coupon.stackable ? "Evet" : "Hayır"} />
          </dl>
          <div>
            <h3 className="mb-2 text-[14px] font-extrabold text-[#0f1f4d]">Analitik</h3>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-[13px]">
              <Metric label="Rezerve" value={String(analytics.reserved)} />
              <Metric label="Finalize" value={String(analytics.finalized)} />
              <Metric label="İade edilen ödeme" value={String(analytics.refundedPayments)} />
              <Metric
                label="Dönüşüm"
                value={`%${analytics.conversionRate}`}
                hint={analytics.conversionDefinition}
              />
            </dl>
          </div>
          <AdminCouponActions
            couponId={coupon.id}
            status={coupon.status}
            code={coupon.code}
          />
        </div>
      )}

      {tab === "scope" && (
        <div className={`${appPanelClass} p-5 text-[13px]`}>
          <p>
            <span className="font-bold">Planlar:</span>{" "}
            {formatCouponPlanSummary(coupon.planScopes)}
          </p>
          <p className="mt-2">
            <span className="font-bold">Dönemler:</span>{" "}
            {formatCouponIntervalSummary(coupon.allowedIntervals)}
          </p>
        </div>
      )}

      {tab === "usage" && (
        <div className={`${appPanelClass} overflow-x-auto p-4`}>
          {coupon.discountUses.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-slate-500">Henüz kullanım yok.</p>
          ) : (
            <table className={appTableClass}>
              <thead>
                <tr className={appTableHeadClass}>
                  <th className="px-3 py-2">Firma</th>
                  <th className="px-3 py-2">İndirim</th>
                  <th className="px-3 py-2">Ödeme</th>
                  <th className="px-3 py-2">Durum</th>
                </tr>
              </thead>
              <tbody>
                {coupon.discountUses.map((r) => (
                  <tr key={r.id} className={appTableRowClass}>
                    <td className="px-3 py-3">{r.company.name}</td>
                    <td className="px-3 py-3">{formatMinorToMoney(r.amountMinor)}</td>
                    <td className="px-3 py-3">
                      {r.payment?.amountMinor != null
                        ? formatMinorToMoney(r.payment.amountMinor)
                        : "—"}
                    </td>
                    <td className="px-3 py-3">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "preview" && (
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
            <input
              value={previewPlanId}
              onChange={(e) => setPreviewPlanId(e.target.value)}
              placeholder="Plan ID"
              className={appInputClass}
            />
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
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-[13px]">
              <p>Liste: {String(previewResult.listFormatted ?? previewResult.listPriceMinor)}</p>
              <p className="mt-1 font-bold text-[#0f1f4d]">
                Toplam: {String(previewResult.totalFormatted ?? previewResult.totalMinor)}
              </p>
            </div>
          ) : null}
        </div>
      )}

      {tab === "history" && (
        <div className={`${appPanelClass} p-5`}>
          {history.length === 0 ? (
            <p className="text-[13px] text-slate-500">Audit kaydı bulunamadı.</p>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-[#0f1f4d]">{value}</dd>
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
