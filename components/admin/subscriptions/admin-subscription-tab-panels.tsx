"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatAdminDate } from "@/lib/admin-utils";
import {
  formatMinor,
  getBillingIntervalLabel,
  getPaymentStatusClass,
  getPaymentStatusLabel,
  getSubscriptionStatusClass,
  getSubscriptionStatusLabel,
} from "@/lib/admin/subscriptions/admin-subscription-serializers";
import type { AdminSubscriptionTab } from "@/lib/admin/subscriptions/admin-subscription-detail-service";

type TabLoader = (tab: AdminSubscriptionTab, params?: URLSearchParams) => void;

// ─── Overview ────────────────────────────────────────────────────────────────

type OverviewData = {
  subscriptionId: string;
  company: { id: string; name: string; status: string };
  plan: { id: string; name: string; code: string } | null;
  status: string;
  billingInterval: string | null;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  cancelledAt: string | null;
  startedAt?: string;
  createdAt: string;
  pricing: {
    listPriceMinor: number;
    salePriceMinor: number;
    monthlyEquivalentMinor: number;
    yearlyEquivalentMinor: number | null;
    currency: string;
    addonTotalMinor: number;
    addonCurrency: string;
    estimatedNextPaymentMinor: number | null;
  } | null;
  campaign: { code: string; name: string } | null;
  coupon: { code: string; name: string } | null;
  provider: string | null;
  providerRef: string | null;
  lastProviderSyncAt: string | null;
  lastProviderSyncStatus: string | null;
  issues: Array<{ code: string; label: string; tab: string }>;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  );
}

function na(value: React.ReactNode) {
  return value ?? <span className="text-slate-400">Bulunamadı</span>;
}

export function SubscriptionOverviewTab({
  data,
  onNavigateTab,
}: {
  data: OverviewData;
  onNavigateTab: TabLoader;
}) {
  const currency = data.pricing?.currency ?? "TRY";
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Abonelik Bilgileri">
        <Row label="Firma" value={<Link href={`/admin/companies/${data.company.id}`} className="text-blue-600 hover:underline">{data.company.name}</Link>} />
        <Row label="Abonelik ID" value={<span className="font-mono text-xs">{data.subscriptionId}</span>} />
        <Row label="Plan" value={na(data.plan?.name)} />
        <Row label="Durum" value={
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${getSubscriptionStatusClass(data.status as never)}`}>
            {getSubscriptionStatusLabel(data.status as never)}
          </span>
        } />
        <Row label="Faturalama" value={getBillingIntervalLabel(data.billingInterval as never)} />
        <Row label="Başlangıç" value={formatAdminDate(data.startedAt ?? data.createdAt)} />
        <Row label="Mevcut dönem başlangıcı" value={data.currentPeriodStart ? formatAdminDate(data.currentPeriodStart) : na(null)} />
        <Row label="Mevcut dönem sonu" value={data.currentPeriodEnd ? formatAdminDate(data.currentPeriodEnd) : na(null)} />
        <Row label="Trial bitişi" value={data.trialEndsAt ? formatAdminDate(data.trialEndsAt) : na(null)} />
        <Row label="İptal planı" value={data.cancelAtPeriodEnd ? "Dönem sonunda iptal" : data.cancelledAt ? `İptal: ${formatAdminDate(data.cancelledAt)}` : "Yok"} />
      </Section>

      <Section title="Finansal Özet">
        {data.pricing ? (
          <>
            <Row label="Liste fiyatı" value={formatMinor(data.pricing.listPriceMinor, currency)} />
            <Row label="Uygulanan fiyat" value={formatMinor(data.pricing.salePriceMinor, currency)} />
            <Row label="Para birimi" value={currency} />
            <Row label="Aylık karşılık" value={formatMinor(data.pricing.monthlyEquivalentMinor, currency)} />
            <Row label="Yıllık karşılık" value={data.pricing.yearlyEquivalentMinor != null ? formatMinor(data.pricing.yearlyEquivalentMinor, currency) : na(null)} />
            <Row label="Kampanya/kupon" value={
              data.campaign || data.coupon
                ? [data.campaign?.name, data.coupon?.code].filter(Boolean).join(" · ")
                : na(null)
            } />
            <Row label="Add-on toplamı" value={formatMinor(data.pricing.addonTotalMinor, data.pricing.addonCurrency)} />
            <Row label="Tahmini sonraki ödeme" value={
              data.pricing.estimatedNextPaymentMinor != null
                ? formatMinor(data.pricing.estimatedNextPaymentMinor, currency)
                : na(null)
            } />
          </>
        ) : (
          <p className="text-sm text-slate-500">Fiyat yapılandırılmadı</p>
        )}
      </Section>

      <Section title="Provider">
        <Row label="Ödeme sağlayıcısı" value={data.provider ?? <span className="text-slate-400">Yapılandırılmadı</span>} />
        <Row label="Provider referansı" value={data.providerRef ?? na(null)} />
        <Row label="Son sync" value={data.lastProviderSyncAt ? formatAdminDate(data.lastProviderSyncAt) : na(null)} />
        <Row label="Sync durumu" value={data.lastProviderSyncStatus ?? na(null)} />
      </Section>

      <Section title="Açık Sorunlar">
        {data.issues.length === 0 ? (
          <p className="text-sm text-emerald-600">Açık sorun yok</p>
        ) : (
          <ul className="space-y-2">
            {data.issues.map((issue) => (
              <li key={issue.code} className="flex items-start justify-between gap-2 text-sm">
                <span className="rounded bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">{issue.label}</span>
                <button
                  type="button"
                  onClick={() => onNavigateTab(issue.tab as AdminSubscriptionTab)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  İlgili sekmeye git →
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

// ─── Payments ────────────────────────────────────────────────────────────────

type PaymentItem = {
  id: string;
  merchantOid: string;
  amount: number;
  currency: string;
  status: string;
  provider: string | null;
  failedReasonMessage: string | null;
  refundedAmountMinor: number | null;
  callbackReceivedAt: string | null;
  paidAt: string | null;
  createdAt: string;
};

type PaymentsData = {
  items: PaymentItem[];
  total: number;
  page: number;
  totalPages: number;
};

export function SubscriptionPaymentsTab({
  data,
  subscriptionId,
  filters,
  onFilterChange,
  onPageChange,
}: {
  data: PaymentsData;
  subscriptionId: string;
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  onPageChange: (page: number) => void;
}) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = data.items.find((p) => p.id === detailId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select value={filters.status ?? ""} onChange={(e) => onFilterChange("status", e.target.value)} className="rounded border border-slate-200 px-2 py-1 text-sm">
          <option value="">Tüm durumlar</option>
          {["PAID", "FAILED", "PENDING", "REFUNDED", "PARTIALLY_REFUNDED"].map((s) => (
            <option key={s} value={s}>{getPaymentStatusLabel(s as never)}</option>
          ))}
        </select>
        <select value={filters.provider ?? ""} onChange={(e) => onFilterChange("provider", e.target.value)} className="rounded border border-slate-200 px-2 py-1 text-sm">
          <option value="">Tüm providerlar</option>
          {["PAYTR", "MANUAL"].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input type="date" value={filters.dateFrom ?? ""} onChange={(e) => onFilterChange("dateFrom", e.target.value)} className="rounded border border-slate-200 px-2 py-1 text-sm" />
        <input type="date" value={filters.dateTo ?? ""} onChange={(e) => onFilterChange("dateTo", e.target.value)} className="rounded border border-slate-200 px-2 py-1 text-sm" />
        <select value={filters.refundStatus ?? ""} onChange={(e) => onFilterChange("refundStatus", e.target.value)} className="rounded border border-slate-200 px-2 py-1 text-sm">
          <option value="">İade durumu</option>
          <option value="refunded">İade var</option>
          <option value="none">İade yok</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="px-2 py-2">Ödeme ID</th>
              <th className="px-2 py-2">Merchant OID</th>
              <th className="px-2 py-2">Tarih</th>
              <th className="px-2 py-2">Tutar</th>
              <th className="px-2 py-2">Provider</th>
              <th className="px-2 py-2">Durum</th>
              <th className="px-2 py-2">İade</th>
              <th className="px-2 py-2">Callback</th>
              <th className="px-2 py-2">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 ? (
              <tr><td colSpan={9} className="px-2 py-8 text-center text-slate-400">Ödeme kaydı yok</td></tr>
            ) : data.items.map((p) => (
              <tr key={p.id} className="border-b border-slate-100">
                <td className="px-2 py-2 font-mono text-xs">{p.id.slice(0, 10)}…</td>
                <td className="px-2 py-2 font-mono text-xs">{p.merchantOid}</td>
                <td className="px-2 py-2">{formatAdminDate(p.paidAt ?? p.createdAt)}</td>
                <td className="px-2 py-2">{formatMinor(Math.round(p.amount * 100), p.currency)}</td>
                <td className="px-2 py-2">{p.provider ?? "—"}</td>
                <td className="px-2 py-2">
                  <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${getPaymentStatusClass(p.status as never)}`}>
                    {getPaymentStatusLabel(p.status as never)}
                  </span>
                </td>
                <td className="px-2 py-2">{p.refundedAmountMinor ? formatMinor(p.refundedAmountMinor, p.currency) : "—"}</td>
                <td className="px-2 py-2">{p.callbackReceivedAt ? formatAdminDate(p.callbackReceivedAt) : "—"}</td>
                <td className="px-2 py-2">
                  <button type="button" onClick={() => setDetailId(p.id)} className="text-xs text-blue-600 hover:underline">Detay</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button type="button" disabled={data.page <= 1} onClick={() => onPageChange(data.page - 1)} className="rounded border px-3 py-1 text-sm disabled:opacity-40">Önceki</button>
          <span className="px-2 py-1 text-sm text-slate-500">{data.page} / {data.totalPages}</span>
          <button type="button" disabled={data.page >= data.totalPages} onClick={() => onPageChange(data.page + 1)} className="rounded border px-3 py-1 text-sm disabled:opacity-40">Sonraki</button>
        </div>
      )}

      {detail && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
          <h4 className="mb-2 font-semibold">Ödeme Detayı</h4>
          <p><span className="text-slate-500">ID:</span> {detail.id}</p>
          <p><span className="text-slate-500">Durum:</span> {getPaymentStatusLabel(detail.status as never)}</p>
          {detail.failedReasonMessage && (
            <p className="mt-2 text-rose-600"><span className="font-medium">Hata:</span> {detail.failedReasonMessage}</p>
          )}
          <Link href={`/admin/companies/${subscriptionId}`} className="mt-2 inline-block text-xs text-blue-600 hover:underline">
            Billing kaydına git (firma)
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── History ─────────────────────────────────────────────────────────────────

type HistoryEvent = {
  id: string;
  type: string;
  date: string;
  label: string;
  detail: string | null;
  oldValue: string | null;
  newValue: string | null;
  source: string;
  actor: string | null;
  relatedId: string | null;
};

export function SubscriptionHistoryTab({
  events,
  filters,
  onFilterChange,
}: {
  events: HistoryEvent[];
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
}) {
  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (filters.eventType && !e.type.includes(filters.eventType)) return false;
      if (filters.source && e.source !== filters.source) return false;
      if (filters.dateFrom && new Date(e.date) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && new Date(e.date) > new Date(filters.dateTo)) return false;
      return true;
    });
  }, [events, filters]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input placeholder="Olay tipi" value={filters.eventType ?? ""} onChange={(e) => onFilterChange("eventType", e.target.value)} className="rounded border border-slate-200 px-2 py-1 text-sm" />
        <select value={filters.source ?? ""} onChange={(e) => onFilterChange("source", e.target.value)} className="rounded border border-slate-200 px-2 py-1 text-sm">
          <option value="">Tüm kaynaklar</option>
          <option value="SYSTEM">Sistem</option>
          <option value="ADMIN">Admin</option>
        </select>
        <input type="date" value={filters.dateFrom ?? ""} onChange={(e) => onFilterChange("dateFrom", e.target.value)} className="rounded border border-slate-200 px-2 py-1 text-sm" />
        <input type="date" value={filters.dateTo ?? ""} onChange={(e) => onFilterChange("dateTo", e.target.value)} className="rounded border border-slate-200 px-2 py-1 text-sm" />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="px-2 py-2">Tarih</th>
              <th className="px-2 py-2">Olay</th>
              <th className="px-2 py-2">Eski</th>
              <th className="px-2 py-2">Yeni</th>
              <th className="px-2 py-2">Kaynak</th>
              <th className="px-2 py-2">Yapan</th>
              <th className="px-2 py-2">Neden</th>
              <th className="px-2 py-2">Kayıt</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className="border-b border-slate-100">
                <td className="px-2 py-2 whitespace-nowrap">{formatAdminDate(e.date)}</td>
                <td className="px-2 py-2">{e.label}</td>
                <td className="px-2 py-2 text-slate-500">{e.oldValue ?? "—"}</td>
                <td className="px-2 py-2">{e.newValue ?? "—"}</td>
                <td className="px-2 py-2">{e.source}</td>
                <td className="px-2 py-2">{e.actor ?? "—"}</td>
                <td className="px-2 py-2 max-w-[200px] truncate">{e.detail ?? "—"}</td>
                <td className="px-2 py-2 font-mono text-xs">{e.relatedId?.slice(0, 8) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Entitlements ────────────────────────────────────────────────────────────

type EntitlementRow = {
  code: string;
  label: string;
  type: string;
  planValue: unknown;
  addOnBonus: number | null;
  overrideValue: unknown;
  resolvedValue: unknown;
  source: string;
};

type EntitlementsData = {
  planEntitlements: EntitlementRow[];
  disclaimer: string;
};

function formatEntitlementValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Evet" : "Hayır";
  return String(value);
}

export function SubscriptionEntitlementsTab({ data }: { data: EntitlementsData }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">{data.disclaimer}</div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="px-2 py-2">Hak/Limit</th>
              <th className="px-2 py-2">Plan</th>
              <th className="px-2 py-2">Add-on</th>
              <th className="px-2 py-2">Override</th>
              <th className="px-2 py-2">Çözümlenen</th>
              <th className="px-2 py-2">Kaynak</th>
              <th className="px-2 py-2">Enforcement</th>
            </tr>
          </thead>
          <tbody>
            {data.planEntitlements.map((row) => (
              <tr key={row.code} className="border-b border-slate-100">
                <td className="px-2 py-2">
                  <div className="font-medium">{row.label}</div>
                  <div className="text-xs text-slate-400">{row.code}</div>
                </td>
                <td className="px-2 py-2">{formatEntitlementValue(row.planValue)}</td>
                <td className="px-2 py-2">{row.addOnBonus ?? "—"}</td>
                <td className="px-2 py-2">{formatEntitlementValue(row.overrideValue)}</td>
                <td className="px-2 py-2 font-medium">{formatEntitlementValue(row.resolvedValue)}</td>
                <td className="px-2 py-2">{row.source}</td>
                <td className="px-2 py-2 text-slate-400">Analitik</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Add-ons ─────────────────────────────────────────────────────────────────

type AddonRow = {
  id: string;
  name: string;
  code: string;
  status: string;
  quantity: number;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  pricePerUnit: number | null;
  currency: string;
  entitlementCode: string | null;
};

const ACTIVE_ADDON_STATUSES = new Set(["ACTIVE", "PENDING"]);

export function SubscriptionAddonsTab({ addons }: { addons: AddonRow[] }) {
  const active = addons.filter((a) => ACTIVE_ADDON_STATUSES.has(a.status));
  const historical = addons.filter((a) => !ACTIVE_ADDON_STATUSES.has(a.status));

  function AddonTable({ rows, title }: { rows: AddonRow[]; title: string }) {
    return (
      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">{title}</h3>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-400">Kayıt yok</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="px-2 py-2">Paket</th>
                <th className="px-2 py-2">Kod</th>
                <th className="px-2 py-2">Durum</th>
                <th className="px-2 py-2">Miktar</th>
                <th className="px-2 py-2">Başlangıç</th>
                <th className="px-2 py-2">Bitiş</th>
                <th className="px-2 py-2">Fiyat</th>
                <th className="px-2 py-2">Entitlement</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-b border-slate-100">
                  <td className="px-2 py-2">{a.name}</td>
                  <td className="px-2 py-2 font-mono text-xs">{a.code}</td>
                  <td className="px-2 py-2">{a.status}</td>
                  <td className="px-2 py-2">{a.quantity}</td>
                  <td className="px-2 py-2">{a.currentPeriodStart ? formatAdminDate(a.currentPeriodStart) : "—"}</td>
                  <td className="px-2 py-2">{a.currentPeriodEnd ? formatAdminDate(a.currentPeriodEnd) : "—"}</td>
                  <td className="px-2 py-2">{a.pricePerUnit != null ? formatMinor(a.pricePerUnit, a.currency) : "—"}</td>
                  <td className="px-2 py-2">{a.entitlementCode ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AddonTable rows={active} title="Aktif Eklentiler" />
      <AddonTable rows={historical} title="Geçmiş Eklentiler" />
    </div>
  );
}

// ─── Activity ────────────────────────────────────────────────────────────────

type ActivityItem = {
  id: string;
  action: string;
  module: string;
  message: string;
  user: { name: string | null; email: string } | null;
  source: string;
  success: boolean;
  ip: string | null;
  createdAt: string;
};

type ActivityData = { items: ActivityItem[]; page: number; totalPages: number };

export function SubscriptionActivityTab({
  data,
  filters,
  onFilterChange,
  onPageChange,
}: {
  data: ActivityData;
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input type="date" value={filters.dateFrom ?? ""} onChange={(e) => onFilterChange("dateFrom", e.target.value)} className="rounded border border-slate-200 px-2 py-1 text-sm" />
        <input placeholder="Aksiyon" value={filters.action ?? ""} onChange={(e) => onFilterChange("action", e.target.value)} className="rounded border border-slate-200 px-2 py-1 text-sm" />
        <select value={filters.success ?? ""} onChange={(e) => onFilterChange("success", e.target.value)} className="rounded border border-slate-200 px-2 py-1 text-sm">
          <option value="">Tümü</option>
          <option value="success">Başarılı</option>
          <option value="error">Hatalı</option>
        </select>
      </div>
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
            <th className="px-2 py-2">Tarih</th>
            <th className="px-2 py-2">Aksiyon</th>
            <th className="px-2 py-2">Modül</th>
            <th className="px-2 py-2">Yapan</th>
            <th className="px-2 py-2">Kaynak</th>
            <th className="px-2 py-2">Sonuç</th>
            <th className="px-2 py-2">IP</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((log) => (
            <tr key={log.id} className="border-b border-slate-100">
              <td className="px-2 py-2">{formatAdminDate(log.createdAt)}</td>
              <td className="px-2 py-2">{log.action}</td>
              <td className="px-2 py-2">{log.module}</td>
              <td className="px-2 py-2">{log.user?.name ?? log.user?.email ?? "—"}</td>
              <td className="px-2 py-2">{log.source}</td>
              <td className="px-2 py-2">{log.success ? <span className="text-emerald-600">Başarılı</span> : <span className="text-rose-600">Hatalı</span>}</td>
              <td className="px-2 py-2 font-mono text-xs">{log.ip ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button type="button" disabled={data.page <= 1} onClick={() => onPageChange(data.page - 1)} className="rounded border px-3 py-1 text-sm disabled:opacity-40">Önceki</button>
          <span className="px-2 py-1 text-sm text-slate-500">{data.page} / {data.totalPages}</span>
          <button type="button" disabled={data.page >= data.totalPages} onClick={() => onPageChange(data.page + 1)} className="rounded border px-3 py-1 text-sm disabled:opacity-40">Sonraki</button>
        </div>
      )}
    </div>
  );
}

// ─── Notes ───────────────────────────────────────────────────────────────────

type NoteRow = {
  id: string;
  content: string;
  category: string;
  priority: string;
  isPinned: boolean;
  author: { name: string | null; email: string } | null;
  createdAt: string;
  updatedAt: string;
};

const NOTE_CATEGORIES = ["GENERAL", "BILLING", "SUPPORT", "RISK", "SALES", "TECHNICAL", "CANCELLATION", "PROVIDER"];
const NOTE_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"];

export function SubscriptionNotesTab({
  subscriptionId,
  notes: initialNotes,
  onRefresh,
}: {
  subscriptionId: string;
  notes: NoteRow[];
  onRefresh: () => void;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [priority, setPriority] = useState("NORMAL");
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  async function createNote() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/subscriptions/${subscriptionId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, category, priority, isPinned: false }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setContent("");
      onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Not eklenemedi");
    } finally {
      setLoading(false);
    }
  }

  async function updateNote(noteId: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/admin/subscriptions/${subscriptionId}/notes/${noteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const json = await res.json();
    if (!json.success) alert(json.message ?? "Güncellenemedi");
    else onRefresh();
  }

  async function deleteNote(noteId: string) {
    if (!confirm("Notu silmek istediğinize emin misiniz?")) return;
    const res = await fetch(`/api/admin/subscriptions/${subscriptionId}/notes/${noteId}`, { method: "DELETE" });
    const json = await res.json();
    if (!json.success) alert(json.message ?? "Silinemedi");
    else onRefresh();
  }

  const sorted = [...notes].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        Notlar yalnız platform adminlerine görünür. Tenant tarafında görünmez.
      </div>
      <div className="space-y-2 rounded-lg border border-slate-200 p-4">
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Yeni not…" className="min-h-[80px] w-full rounded border border-slate-200 p-2 text-sm" />
        <div className="flex flex-wrap gap-2">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded border px-2 py-1 text-sm">
            {NOTE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="rounded border px-2 py-1 text-sm">
            {NOTE_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <button type="button" disabled={loading || content.trim().length < 2} onClick={() => void createNote()} className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white disabled:opacity-50">Ekle</button>
        </div>
      </div>
      <div className="space-y-2">
        {sorted.length === 0 ? <p className="text-sm text-slate-400">Henüz not yok</p> : sorted.map((note) => (
          <div key={note.id} className={`rounded-lg border p-3 ${note.isPinned ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>{note.category} · {note.priority} {note.isPinned && "· 📌"}</span>
              <span>{note.author?.name ?? note.author?.email ?? "—"} · {new Date(note.createdAt).toLocaleString("tr-TR")}</span>
            </div>
            {editId === note.id ? (
              <div className="mt-2 space-y-2">
                <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full rounded border p-2 text-sm" />
                <div className="flex gap-2">
                  <button type="button" onClick={() => void updateNote(note.id, { content: editContent }).then(() => setEditId(null))} className="text-xs text-blue-600">Kaydet</button>
                  <button type="button" onClick={() => setEditId(null)} className="text-xs text-slate-500">İptal</button>
                </div>
              </div>
            ) : (
              <p className="mt-2 whitespace-pre-wrap text-sm">{note.content}</p>
            )}
            <div className="mt-2 flex gap-3 text-xs">
              <button type="button" onClick={() => { setEditId(note.id); setEditContent(note.content); }} className="text-blue-600 hover:underline">Düzenle</button>
              <button type="button" onClick={() => void updateNote(note.id, { isPinned: !note.isPinned })} className="text-slate-600 hover:underline">{note.isPinned ? "Sabitlemeyi kaldır" : "Sabitle"}</button>
              <button type="button" onClick={() => void deleteNote(note.id)} className="text-rose-600 hover:underline">Sil</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Router ──────────────────────────────────────────────────────────────────

export function AdminSubscriptionTabContent({
  tab,
  data,
  subscriptionId,
  companyId,
  filters,
  onFilterChange,
  onPageChange,
  onNavigateTab,
  onRefresh,
}: {
  tab: AdminSubscriptionTab;
  data: unknown;
  subscriptionId: string;
  companyId: string;
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  onPageChange: (page: number) => void;
  onNavigateTab: TabLoader;
  onRefresh: () => void;
}) {
  if (!data) return <p className="py-8 text-center text-sm text-slate-400">Veri yok</p>;

  switch (tab) {
    case "overview":
      return <SubscriptionOverviewTab data={data as OverviewData} onNavigateTab={onNavigateTab} />;
    case "payments":
      return (
        <SubscriptionPaymentsTab
          data={data as PaymentsData}
          subscriptionId={companyId}
          filters={filters}
          onFilterChange={onFilterChange}
          onPageChange={onPageChange}
        />
      );
    case "history":
      return <SubscriptionHistoryTab events={data as HistoryEvent[]} filters={filters} onFilterChange={onFilterChange} />;
    case "entitlements":
      return <SubscriptionEntitlementsTab data={data as EntitlementsData} />;
    case "addons":
      return <SubscriptionAddonsTab addons={data as AddonRow[]} />;
    case "activity":
      return <SubscriptionActivityTab data={data as ActivityData} filters={filters} onFilterChange={onFilterChange} onPageChange={onPageChange} />;
    case "notes":
      return <SubscriptionNotesTab subscriptionId={subscriptionId} notes={data as NoteRow[]} onRefresh={onRefresh} />;
    default:
      return null;
  }
}
