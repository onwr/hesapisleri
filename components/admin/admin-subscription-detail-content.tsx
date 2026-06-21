"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { AdminSubscriptionRowActions } from "@/components/admin/admin-subscription-row-actions";
import {
  appOutlineButtonClass,
  appPanelClass,
  appPrimaryButtonClass,
  appTableClass,
  appTableHeadClass,
  appTableRowClass,
} from "@/lib/admin-ui";
import { formatAdminDate, formatAdminDateTime } from "@/lib/admin-utils";
import {
  formatBillingInterval,
  getAdminPriceSourceLabel,
  getSubscriptionStatusBadgeClass,
  getSubscriptionStatusUiLabel,
} from "@/lib/admin-subscription-utils";
import { getMembershipPaymentStatusLabel } from "@/lib/membership-utils";
import { formatMinorToMoney } from "@/lib/billing/pricing-utils";
import type { getAdminSubscriptionDetail } from "@/lib/admin-subscription-service";

type DetailData = Awaited<ReturnType<typeof getAdminSubscriptionDetail>>;

const TABS = [
  { id: "overview", label: "Genel Bakış" },
  { id: "billing", label: "Faturalandırma" },
  { id: "payments", label: "Ödemeler" },
  { id: "pricing", label: "Fiyat ve İndirim" },
  { id: "usage", label: "Özellikler ve Kullanım" },
  { id: "history", label: "Değişiklik Geçmişi" },
  { id: "audit", label: "Audit Log" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function AdminSubscriptionDetailContent({ data }: { data: DetailData }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = (searchParams.get("tab") as TabId) || "overview";
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const { subscription, company, plan, pricing, paymentMethod, partner } = data;

  async function submitComplimentaryExtension(mode: string) {
    setActionLoading(true);
    setActionMessage("");
    try {
      const res = await fetch(
        `/api/admin/subscriptions/${subscription.id}/manual-extension`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            extensionType: "COMPLIMENTARY",
            mode,
            reason: "Admin ücretsiz süre tanımı",
            expectedUpdatedAt: subscription.updatedAt,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        setActionMessage(json.message || "Uzatma başarısız.");
        return;
      }
      setActionMessage("Ücretsiz süre tanımlandı.");
      router.refresh();
    } finally {
      setActionLoading(false);
    }
  }

  async function cancelPendingChange() {
    if (!data.pendingChange) return;
    setActionLoading(true);
    setActionMessage("");
    try {
      const res = await fetch(
        `/api/admin/subscriptions/${subscription.id}/cancel-pending-change`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "Admin iptal",
            expectedUpdatedAt: subscription.updatedAt,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        setActionMessage(json.message || "İptal başarısız.");
        return;
      }
      setActionMessage("Planlanan değişiklik iptal edildi.");
      router.refresh();
    } finally {
      setActionLoading(false);
    }
  }

  async function submitPriceLock(action: string) {
    setActionLoading(true);
    setActionMessage("");
    try {
      const res = await fetch(
        `/api/admin/subscriptions/${subscription.id}/price-lock`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            reason: "Admin fiyat kilidi",
            expectedUpdatedAt: subscription.updatedAt,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        setActionMessage(json.message || "Fiyat kilidi başarısız.");
        return;
      }
      setActionMessage("Fiyat kilidi güncellendi.");
      router.refresh();
    } finally {
      setActionLoading(false);
    }
  }

  async function submitManualExtension(mode: string) {
    setActionLoading(true);
    setActionMessage("");
    try {
      const res = await fetch(
        `/api/admin/subscriptions/${subscription.id}/manual-extension`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            extensionType: "COMPLIMENTARY",
            mode,
            reason: "Admin manuel uzatma",
            expectedUpdatedAt: subscription.updatedAt,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        setActionMessage(json.message || "Uzatma başarısız.");
        return;
      }
      setActionMessage("Abonelik uzatıldı.");
      router.refresh();
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((item) => (
          <Link
            key={item.id}
            href={`/admin/subscriptions/${subscription.id}?tab=${item.id}`}
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

      {data.pendingChange ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-900">
          <p className="font-bold">Planlanan değişiklik ({data.pendingChange.status})</p>
          <p className="mt-1">
            {data.pendingChange.currentPlanName} ({formatBillingInterval(data.pendingChange.currentInterval)}) →{" "}
            {data.pendingChange.targetPlanName} ({formatBillingInterval(data.pendingChange.targetInterval)})
          </p>
          <p className="mt-1">
            Uygulanma: {formatAdminDate(data.pendingChange.effectiveAt)}
            {data.pendingChange.estimatedPriceMinor != null
              ? ` · Tahmini fiyat: ${formatMinorToMoney(data.pendingChange.estimatedPriceMinor)}`
              : null}
          </p>
          {data.pendingChange.requestedBy ? (
            <p className="mt-1 text-amber-800">
              Talep eden: {data.pendingChange.requestedBy.name ?? data.pendingChange.requestedBy.email}
            </p>
          ) : null}
          {data.pendingChange.reason ? (
            <p className="mt-1">Sebep: {data.pendingChange.reason}</p>
          ) : null}
          <button
            type="button"
            disabled={actionLoading}
            onClick={cancelPendingChange}
            className={`${appOutlineButtonClass} mt-3`}
          >
            Planlanan Değişikliği İptal Et
          </button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <SummaryCard label="Aktif Plan" value={plan?.name ?? "—"} />
        <SummaryCard
          label="Dönem"
          value={formatBillingInterval(subscription.billingInterval)}
        />
        <SummaryCard
          label="Ödenen Fiyat"
          value={
            pricing
              ? formatMinorToMoney(pricing.paid.totalMinor)
              : data.lastSuccessfulPayment?.amountMinor
                ? formatMinorToMoney(data.lastSuccessfulPayment.amountMinor)
                : "—"
          }
        />
        <SummaryCard
          label="Yenileme Fiyatı"
          value={pricing ? formatMinorToMoney(pricing.renewal.totalMinor) : "—"}
        />
        <SummaryCard
          label="Bitiş Tarihi"
          value={formatAdminDate(subscription.currentPeriodEnd)}
        />
        <SummaryCard
          label="Sonraki Tahsilat"
          value={formatAdminDate(subscription.nextBillingAt)}
        />
      </div>

      {tab === "overview" ? (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className={`${appPanelClass} space-y-4 p-5 xl:col-span-2`}>
            <h2 className="text-[16px] font-extrabold text-[#0f1f4d]">Genel Bilgiler</h2>
            <InfoGrid
              rows={[
                ["Subscription ID", subscription.id],
                ["Firma", company.name],
                ["Sahip", `${company.ownerName} · ${company.ownerEmail}`],
                ["Plan", plan ? `${plan.name} (${plan.code})` : "—"],
                ["Durum", getSubscriptionStatusUiLabel(subscription.status)],
                [
                  "Trial",
                  `${formatAdminDate(subscription.trialStartedAt)} → ${formatAdminDate(subscription.trialEndsAt)}`,
                ],
                [
                  "Dönem",
                  `${formatAdminDate(subscription.currentPeriodStart)} → ${formatAdminDate(subscription.currentPeriodEnd)}`,
                ],
                ["Sonraki faturalandırma", formatAdminDate(subscription.nextBillingAt)],
                ["Grace bitiş", formatAdminDate(subscription.graceEndsAt)],
                ["Auto-renew", subscription.autoRenew ? "Açık" : "Kapalı"],
                [
                  "Dönem sonunda iptal",
                  subscription.cancelAtPeriodEnd ? "Evet" : "Hayır",
                ],
                [
                  "Ödeme yöntemi",
                  paymentMethod
                    ? `${paymentMethod.brand ?? "Kart"} ·••• ${paymentMethod.last4 ?? "—"}`
                    : "Tanımlı değil",
                ],
                [
                  "Partner",
                  partner ? `${partner.name} (${partner.code})` : "—",
                ],
              ]}
            />
          </div>
          <div className="space-y-4">
            <div className={`${appPanelClass} p-5`}>
              <h2 className="mb-3 text-[15px] font-extrabold text-[#0f1f4d]">
                Hızlı İşlemler
              </h2>
              <AdminSubscriptionRowActions
                item={{
                  id: subscription.id,
                  companyId: company.id,
                  companyName: company.name,
                  status: subscription.status,
                  updatedAt: subscription.updatedAt,
                  hasPaymentMethod: Boolean(paymentMethod),
                  autoRenew: subscription.autoRenew,
                }}
              />
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => submitComplimentaryExtension("MONTH_1")}
                  className={`${appOutlineButtonClass} w-full`}
                >
                  {actionLoading ? <Loader2 className="animate-spin" size={14} /> : null}
                  Ücretsiz +1 Ay Uzat
                </button>
              </div>
              {actionMessage ? (
                <p className="mt-2 text-[12px] font-semibold text-emerald-700">
                  {actionMessage}
                </p>
              ) : null}
            </div>
            {!paymentMethod && subscription.autoRenew ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[13px] font-semibold text-amber-800">
                Auto-renew açık ancak kayıtlı ödeme yöntemi yok.
              </div>
            ) : null}
            {subscription.nextBillingAt ? (
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-[13px] text-blue-800">
                Yaklaşan yenileme: {formatAdminDate(subscription.nextBillingAt)}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "billing" ? (
        <div className={`${appPanelClass} space-y-4 p-5`}>
          <h2 className="text-[16px] font-extrabold text-[#0f1f4d]">Faturalandırma</h2>
          {pricing ? (
            <InfoGrid
              rows={[
                ["Liste fiyatı", formatMinorToMoney(pricing.renewal.listPriceMinor)],
                ["İndirim", formatMinorToMoney(pricing.renewal.discountMinor)],
                ["KDV", formatMinorToMoney(pricing.renewal.vatMinor)],
                ["Toplam", formatMinorToMoney(pricing.renewal.totalMinor)],
                ["Fiyat versiyonu", `v${pricing.renewal.priceVersion}`],
                [
                  "Grandfathered",
                  subscription.priceLockType === "GRANDFATHERED" ? "Evet" : "Hayır",
                ],
                ["Kilitli fiyat", subscription.lockedPriceMinor != null ? formatMinorToMoney(subscription.lockedPriceMinor) : "—"],
                ["Auto-renew", subscription.autoRenew ? "Açık" : "Kapalı"],
                ["Başarısız ödeme", String(subscription.failedPaymentCount)],
                ["Grace bitiş", formatAdminDate(subscription.graceEndsAt)],
              ]}
            />
          ) : (
            <p className="text-slate-500">Fiyat bilgisi hesaplanamadı.</p>
          )}
        </div>
      ) : null}

      {tab === "payments" ? (
        <div className={`${appPanelClass} overflow-x-auto p-4`}>
          <table className={appTableClass}>
            <thead>
              <tr className={appTableHeadClass}>
                <th className="px-3 py-2">Tarih</th>
                <th className="px-3 py-2">Merchant OID</th>
                <th className="px-3 py-2">Tip</th>
                <th className="px-3 py-2">Dönem</th>
                <th className="px-3 py-2">Tutar</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">Provider</th>
                <th className="px-3 py-2">Test</th>
                <th className="px-3 py-2">Detay</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((payment) => (
                <tr key={payment.id} className={appTableRowClass}>
                  <td className="px-3 py-3">{formatAdminDate(payment.paidAt ?? payment.createdAt)}</td>
                  <td className="px-3 py-3 font-mono text-[11px]">{payment.merchantOid ?? "—"}</td>
                  <td className="px-3 py-3">{payment.type}</td>
                  <td className="px-3 py-3">{formatBillingInterval(payment.period)}</td>
                  <td className="px-3 py-3 font-bold">
                    {payment.amountMinor != null
                      ? formatMinorToMoney(payment.amountMinor)
                      : "—"}
                  </td>
                  <td className="px-3 py-3">
                    {getMembershipPaymentStatusLabel(payment.status)}
                    {payment.refundedAmountMinor ? " · İade" : null}
                  </td>
                  <td className="px-3 py-3">{payment.provider ?? "—"}</td>
                  <td className="px-3 py-3">{payment.testMode ? "Test" : "Canlı"}</td>
                  <td className="px-3 py-3">
                    <Link href={payment.adminUrl} className="text-blue-600 hover:underline">
                      {payment.isReconciled ? "Mutabık" : "Görüntüle"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "pricing" ? (
        <div className={`${appPanelClass} space-y-4 p-5`}>
          <h2 className="text-[16px] font-extrabold text-[#0f1f4d]">Fiyat ve İndirim</h2>
          {pricing ? (
            <>
              <p className="text-[13px] text-slate-600">
                Kaynak: {getAdminPriceSourceLabel(pricing.priceSource)} —{" "}
                {pricing.priceSourceDescription}
              </p>
              <InfoGrid
                rows={[
                  ["Liste", formatMinorToMoney(pricing.renewal.listPriceMinor)],
                  ["Satış", formatMinorToMoney(pricing.renewal.salePriceMinor)],
                  ["Aylık eşdeğer", formatMinorToMoney(pricing.renewal.monthlyEquivalentMinor)],
                  ["Sonraki fiyat etkin", formatAdminDate(subscription.nextPriceEffectiveAt)],
                  [
                    "Fiyat kilidi",
                    subscription.priceLockType === "GRANDFATHERED"
                      ? "Grandfathered"
                      : subscription.lockedPriceMinor != null
                        ? formatMinorToMoney(subscription.lockedPriceMinor)
                        : "Yok",
                  ],
                  ["Kilit bitiş", formatAdminDate(subscription.priceLockedUntil)],
                ]}
              />
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => submitPriceLock("LOCK_CURRENT")}
                  className={appOutlineButtonClass}
                >
                  Mevcut Fiyatı Kilitle
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => submitPriceLock("GRANDFATHERED")}
                  className={appOutlineButtonClass}
                >
                  Süresiz Grandfathered
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => submitPriceLock("UNLOCK")}
                  className={appOutlineButtonClass}
                >
                  Kilidi Kaldır
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => submitPriceLock("SWITCH_TO_ACTIVE_AT_RENEWAL")}
                  className={appOutlineButtonClass}
                >
                  Sonraki Yenilemede Aktif Fiyata Geç
                </button>
              </div>
            </>
          ) : null}
          {data.overrides.length > 0 ? (
            <div className="mt-4">
              <h3 className="mb-2 text-[14px] font-bold text-slate-700">Özel fiyatlar</h3>
              <ul className="space-y-2 text-[13px]">
                {data.overrides.map((o) => (
                  <li key={o.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    {formatBillingInterval(o.billingInterval)} ·{" "}
                    {formatMinorToMoney(o.priceMinor)} · {o.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "usage" ? (
        <div className={`${appPanelClass} p-5 space-y-6`}>
          <div>
            <h2 className="mb-4 text-[16px] font-extrabold text-[#0f1f4d]">
              Gerçek Kullanım
            </h2>
            <InfoGrid
              rows={[
                ["Kullanıcı", String(data.usage.users)],
                ["Depo", String(data.usage.warehouses)],
                ["Ürün", String(data.usage.products)],
                ["Pazar yeri entegrasyonu", String(data.usage.marketplaceIntegrations)],
                ["OCR", "Takip edilmiyor"],
                ["E-belge", "Kullanım verisi yok"],
                ["Depolama", "Kullanım verisi yok"],
              ]}
            />
          </div>
          <div>
            <h2 className="mb-4 text-[16px] font-extrabold text-[#0f1f4d]">
              Efektif Limitler
            </h2>
            {!data.resolvedEntitlements?.length ? (
              <p className="text-slate-500">Limit tanımı yok.</p>
            ) : (
              <div className="space-y-2">
                {data.resolvedEntitlements.map((e) => {
                  if (!e) return null;
                  return (
                  <div
                    key={e.code}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-4 py-3"
                  >
                    <div>
                      <p className="font-bold text-[#0f1f4d]">{e.label}</p>
                      <p className="text-[12px] text-slate-500">
                        Plan: {e.breakdown.plan} · Add-on: {e.breakdown.addon} · Override:{" "}
                        {e.breakdown.override}
                      </p>
                    </div>
                    <div className="text-right text-[13px]">
                      <p className="font-semibold text-slate-700">
                        {e.isUnlimited
                          ? "Sınırsız"
                          : `${e.usage} / ${e.value ?? "—"} (kalan: ${e.remaining ?? "—"})`}
                      </p>
                      {e.isOverLimit ? (
                        <p className="text-amber-600">Over-limit (+{e.overBy})</p>
                      ) : null}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
          {data.addOnSubscriptions?.length ? (
            <div>
              <h2 className="mb-4 text-[16px] font-extrabold text-[#0f1f4d]">
                Aktif Ek Paketler
              </h2>
              <div className="space-y-2">
                {data.addOnSubscriptions.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-xl border border-slate-100 px-4 py-3 text-sm"
                  >
                    {s.name} · x{s.quantity} · {s.entitlementCode}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div>
            <h2 className="mb-4 text-[16px] font-extrabold text-[#0f1f4d]">
              Plan Entitlement (Ham)
            </h2>
          {data.entitlements.length === 0 ? (
            <p className="text-slate-500">Bu plan için entitlement tanımı yok.</p>
          ) : (
            <div className="space-y-2">
              {data.entitlements.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"
                >
                  <div>
                    <p className="font-bold text-[#0f1f4d]">{e.code}</p>
                    {e.description ? (
                      <p className="text-[12px] text-slate-500">{e.description}</p>
                    ) : null}
                  </div>
                  <span className="text-[13px] font-semibold text-slate-700">
                    {e.isUnlimited
                      ? "Sınırsız"
                      : e.valueType === "BOOLEAN"
                        ? e.booleanValue
                          ? "Açık"
                          : "Kapalı"
                        : String(e.numberValue ?? e.stringValue ?? "—")}
                  </span>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      ) : null}

      {tab === "history" ? (
        <div className={`${appPanelClass} p-5`}>
          <h2 className="mb-4 text-[16px] font-extrabold text-[#0f1f4d]">
            Değişiklik Geçmişi
          </h2>
          <Timeline items={data.history} />
        </div>
      ) : null}

      {tab === "audit" ? (
        <div className={`${appPanelClass} p-5`}>
          <h2 className="mb-4 text-[16px] font-extrabold text-[#0f1f4d]">Audit Log</h2>
          <Timeline items={data.auditLogs} />
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${appPanelClass} p-4`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-[15px] font-extrabold text-[#0f1f4d]">{value}</p>
    </div>
  );
}

function InfoGrid({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
          <dt className="text-[11px] font-bold uppercase text-slate-400">{label}</dt>
          <dd className="mt-1 text-[13px] font-semibold text-[#0f1f4d]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Timeline({
  items,
}: {
  items: Array<{
    id: string;
    action: string;
    message: string | null;
    createdAt: string;
    actorName: string;
  }>;
}) {
  if (items.length === 0) {
    return <p className="text-slate-500">Kayıt bulunamadı.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        let parsed: { reason?: string; before?: unknown; after?: unknown } = {};
        try {
          parsed = item.message ? JSON.parse(item.message) : {};
        } catch {
          parsed = {};
        }
        return (
          <div
            key={item.id}
            className="rounded-xl border border-slate-100 bg-white px-4 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] font-bold text-[#0f1f4d]">{item.action}</p>
              <p className="text-[11px] text-slate-400">
                {formatAdminDateTime(item.createdAt)}
              </p>
            </div>
            <p className="text-[12px] text-slate-500">{item.actorName}</p>
            {parsed.reason ? (
              <p className="mt-1 text-[12px] text-slate-600">Sebep: {parsed.reason}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
