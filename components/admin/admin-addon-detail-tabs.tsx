"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { AdminAddonActions } from "@/components/admin/admin-addon-actions";
import { AdminAddonEditModal } from "@/components/admin/admin-addon-edit-modal";
import { AdminAddonNewPriceModal } from "@/components/admin/admin-addon-new-price-modal";
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
import type { getAddOnDetail } from "@/lib/admin/addons";

type DetailData = NonNullable<Awaited<ReturnType<typeof getAddOnDetail>>>;
type HistoryItem = {
  id: string;
  action: string;
  message: string;
  createdAt: string;
  actorName: string;
};
type ActivityItem = {
  id: string;
  action: string;
  message: string | null;
  metadata: unknown;
  createdAt: string;
  actor: { name: string | null; email: string } | null;
};
type SubscriptionItem = {
  id: string;
  companyName: string;
  quantity: number;
  status: string;
  billingInterval: string | null;
  currency: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  subscriptionId: string | null;
  priceVersion: number | null;
  issues: Array<{ code: string; message: string }>;
  createdAt: string;
};
type Pagination = { page: number; pageSize: number; total: number; totalPages: number };

const TABS = [
  { id: "overview", label: "Genel" },
  { id: "pricing", label: "Fiyatlandırma" },
  { id: "entitlements", label: "Entitlement" },
  { id: "subscriptions", label: "Abonelikler" },
  { id: "history", label: "Geçmiş" },
  { id: "activity", label: "Aktivite" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const TYPE_LABELS: Record<string, string> = {
  RECURRING: "Yinelenen",
  ONE_TIME: "Tek Seferlik",
  USAGE_PACK: "Kullanım Paketi",
};

export function AdminAddonDetailTabs({
  detail,
  history,
  historyPagination,
  activity,
  activityPagination,
  subscriptions,
  subscriptionsPagination,
}: {
  detail: DetailData;
  history: HistoryItem[];
  historyPagination?: Pagination;
  activity: ActivityItem[];
  activityPagination?: Pagination;
  subscriptions: SubscriptionItem[];
  subscriptionsPagination?: Pagination;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const tab: TabId =
    rawTab === "prices" ? "pricing" : rawTab === "companies" ? "subscriptions" : (rawTab as TabId) || "overview";

  const { addOn, entitlement, prices, stats, issues } = detail;

  const [editOpen, setEditOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const [previewQty, setPreviewQty] = useState(1);
  const [previewInterval, setPreviewInterval] = useState<string>("MONTHLY");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<Record<string, unknown> | null>(null);
  const [previewError, setPreviewError] = useState("");

  function handleSuccess(message: string) {
    setFlash(message);
    setEditOpen(false);
    setPriceOpen(false);
    router.refresh();
  }

  async function runPreview() {
    setPreviewLoading(true);
    setPreviewError("");
    try {
      const res = await fetch(`/api/admin/add-ons/${addOn.id}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: previewQty,
          billingInterval: addOn.type === "RECURRING" ? previewInterval : null,
          currency: addOn.currency,
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
          <h1 className="text-[22px] font-extrabold text-[#0f1f4d]">{addOn.name}</h1>
          <p className="mt-1 font-mono text-[13px] text-slate-500">{addOn.code}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={appOutlineButtonClass} onClick={() => setEditOpen(true)}>
            Düzenle
          </button>
          <Link href="/admin/add-ons" className={appOutlineButtonClass}>
            Listeye Dön
          </Link>
        </div>
      </div>

      {flash ? (
        <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-[13px] text-emerald-800">
          {flash}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Durum" value={addOn.status} />
        <StatCard label="Tür" value={TYPE_LABELS[addOn.type] ?? addOn.type} />
        <StatCard label="Aktif Abonelik" value={String(stats.activeSubscriptionCount)} />
        <StatCard label="Para Birimi" value={addOn.currency} />
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <Link
            key={item.id}
            href={`/admin/add-ons/${addOn.id}?tab=${item.id}`}
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
            title="Temel"
            rows={[
              ["Açıklama", addOn.description ?? "—"],
              ["Herkese açık", addOn.isPublic ? "Evet" : "Hayır"],
              ["Sıra", String(addOn.sortOrder)],
              ["Oluşturulma", formatAdminDate(addOn.createdAt)],
            ]}
          />
          <InfoBlock
            title="Faturalama"
            rows={[
              ["Yinelenen", addOn.recurringAllowed ? "Evet" : "Hayır"],
              ["Proration", addOn.prorationAllowed ? "Evet" : "Hayır"],
              ["KDV", `%${addOn.vatRate} ${addOn.vatIncluded ? "(dahil)" : "(hariç)"}`],
            ]}
          />
          {issues.length ? (
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
            <AdminAddonActions addOnId={addOn.id} status={addOn.status} />
          </div>
        </div>
      )}

      {tab === "pricing" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              className={appPrimaryButtonClass}
              disabled={addOn.status === "ARCHIVED"}
              onClick={() => setPriceOpen(true)}
            >
              Yeni Fiyat
            </button>
          </div>
          <div className={`${appPanelClass} overflow-x-auto p-4`}>
            {prices.length === 0 ? (
              <p className="text-[13px] text-slate-500">Fiyat tanımı yok.</p>
            ) : (
              <table className={appTableClass}>
                <thead>
                  <tr className={appTableHeadClass}>
                    <th className="px-3 py-2">v</th>
                    <th className="px-3 py-2">Dönem</th>
                    <th className="px-3 py-2">Liste</th>
                    <th className="px-3 py-2">Satış</th>
                    <th className="px-3 py-2">PB</th>
                    <th className="px-3 py-2">Durum</th>
                    <th className="px-3 py-2">Başlangıç</th>
                    <th className="px-3 py-2">Bitiş</th>
                    <th className="px-3 py-2">Kullanım</th>
                  </tr>
                </thead>
                <tbody>
                  {prices.map((p) => (
                    <tr key={p.id} className={appTableRowClass}>
                      <td className="px-3 py-3">{p.version}</td>
                      <td className="px-3 py-3">{p.billingInterval ?? "—"}</td>
                      <td className="px-3 py-3">{formatMinorToMoney(p.listPriceMinor, p.currency)}</td>
                      <td className="px-3 py-3">{formatMinorToMoney(p.salePriceMinor, p.currency)}</td>
                      <td className="px-3 py-3">{p.currency}</td>
                      <td className="px-3 py-3">{p.status}</td>
                      <td className="px-3 py-3">{formatAdminDate(p.effectiveFrom)}</td>
                      <td className="px-3 py-3">{formatAdminDate(p.effectiveUntil)}</td>
                      <td className="px-3 py-3">{p.subscriptionCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className={`${appPanelClass} space-y-3 p-5`}>
            <h3 className="text-[14px] font-extrabold text-[#0f1f4d]">Fiyat Önizleme</h3>
            <div className="flex flex-wrap gap-3">
              <input
                type="number"
                min={1}
                max={100}
                value={previewQty}
                onChange={(e) => setPreviewQty(Number(e.target.value))}
                className={`${appInputClass} w-24`}
                aria-label="Miktar"
              />
              {addOn.type === "RECURRING" ? (
                <select
                  value={previewInterval}
                  onChange={(e) => setPreviewInterval(e.target.value)}
                  className={appSelectClass}
                >
                  <option value="MONTHLY">Aylık</option>
                  <option value="QUARTERLY">3 Aylık</option>
                  <option value="SEMI_ANNUAL">6 Aylık</option>
                  <option value="YEARLY">Yıllık</option>
                </select>
              ) : null}
              <button
                type="button"
                disabled={previewLoading}
                onClick={runPreview}
                className={appPrimaryButtonClass}
              >
                {previewLoading ? <Loader2 size={16} className="animate-spin" /> : "Hesapla"}
              </button>
            </div>
            {previewError ? <p className="text-[13px] text-red-600">{previewError}</p> : null}
            {previewResult ? (
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-[13px] space-y-1">
                <p>
                  Uygunluk:{" "}
                  {previewResult.eligible ? (
                    <span className="text-emerald-700">Uygun</span>
                  ) : (
                    <span className="text-red-600">Uygun değil</span>
                  )}
                </p>
                <p>Toplam: {formatMinorToMoney(Number(previewResult.totalMinor ?? 0))}</p>
                <p className="text-slate-500">{String(previewResult.stackingNote ?? "")}</p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {tab === "entitlements" && (
        <div className={`${appPanelClass} space-y-4 p-5 text-[13px]`}>
          <dl className="grid gap-3 md:grid-cols-2">
            <Row label="Kod" value={entitlement.code} />
            <Row label="Etiket" value={entitlement.label} />
            <Row label="Tip" value={entitlement.kind ?? "—"} />
            <Row label="Value type" value={entitlement.valueType ?? "—"} />
            <Row label="Birim başına katkı" value={String(entitlement.quantityPerUnit)} />
            <Row
              label="Miktar ile çarpılır"
              value={entitlement.multipliedByQuantity ? "Evet" : "Hayır"}
            />
            <Row label="Enforcement" value={entitlement.enforcement} />
            <Row
              label="Örnek (qty=2)"
              value={
                entitlement.kind === "LIMIT"
                  ? String(entitlement.quantityPerUnit * 2)
                  : entitlement.kind === "FEATURE"
                    ? "true"
                    : "—"
              }
            />
          </dl>
        </div>
      )}

      {tab === "subscriptions" && (
        <div className={`${appPanelClass} overflow-x-auto p-4`}>
          {subscriptions.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-slate-500">Abonelik kaydı yok.</p>
          ) : (
            <table className={appTableClass}>
              <thead>
                <tr className={appTableHeadClass}>
                  <th className="px-3 py-2">Firma</th>
                  <th className="px-3 py-2">Durum</th>
                  <th className="px-3 py-2">Miktar</th>
                  <th className="px-3 py-2">Dönem</th>
                  <th className="px-3 py-2">PB</th>
                  <th className="px-3 py-2">Ana Abonelik</th>
                  <th className="px-3 py-2">Sorun</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((s) => (
                  <tr key={s.id} className={appTableRowClass}>
                    <td className="px-3 py-3">{s.companyName}</td>
                    <td className="px-3 py-3">{s.status}</td>
                    <td className="px-3 py-3">{s.quantity}</td>
                    <td className="px-3 py-3">{s.billingInterval ?? "—"}</td>
                    <td className="px-3 py-3">{s.currency ?? "—"}</td>
                    <td className="px-3 py-3 font-mono text-[10px]">{s.subscriptionId ?? "—"}</td>
                    <td className="px-3 py-3">
                      {s.issues[0] ? (
                        <span className="text-[11px] font-bold text-amber-800">
                          {s.issues[0].code}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {subscriptionsPagination && subscriptionsPagination.totalPages > 1 ? (
            <p className="mt-3 text-[12px] text-slate-500">
              Sayfa {subscriptionsPagination.page} / {subscriptionsPagination.totalPages}
            </p>
          ) : null}
        </div>
      )}

      {tab === "history" && (
        <div className={`${appPanelClass} p-5`}>
          {history.length === 0 ? (
            <p className="text-[13px] text-slate-500">Geçmiş kaydı yok.</p>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-100 px-4 py-3 text-[13px]">
                  <div className="flex justify-between gap-2">
                    <p className="font-bold">{item.action}</p>
                    <p className="text-[11px] text-slate-400">
                      {formatAdminDateTime(item.createdAt)}
                    </p>
                  </div>
                  <p className="mt-1 text-slate-600">{item.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "activity" && (
        <div className={`${appPanelClass} p-5`}>
          {activity.length === 0 ? (
            <p className="text-[13px] text-slate-500">Aktivite kaydı yok.</p>
          ) : (
            <div className="space-y-3">
              {activity.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-100 px-4 py-3 text-[13px]">
                  <div className="flex justify-between gap-2">
                    <p className="font-bold">{item.action}</p>
                    <p className="text-[11px] text-slate-400">
                      {formatAdminDateTime(item.createdAt)}
                    </p>
                  </div>
                  {item.message ? <p className="mt-1 text-slate-600">{item.message}</p> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <AdminAddonEditModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        addOn={{
          id: addOn.id,
          name: addOn.name,
          description: addOn.description,
          status: addOn.status,
          type: addOn.type,
          sortOrder: addOn.sortOrder,
          entitlementCode: addOn.entitlementCode,
          entitlementQuantity: addOn.entitlementQuantity,
        }}
        onSuccess={handleSuccess}
      />
      <AdminAddonNewPriceModal
        open={priceOpen}
        onClose={() => setPriceOpen(false)}
        addOnId={addOn.id}
        addOnType={addOn.type}
        defaultCurrency={addOn.currency}
        defaultVatRate={addOn.vatRate}
        defaultVatIncluded={addOn.vatIncluded}
        isArchived={addOn.status === "ARCHIVED"}
        onSuccess={handleSuccess}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${appPanelClass} p-4`}>
      <p className="text-[11px] font-bold uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-extrabold text-[#0f1f4d]">{value}</p>
    </div>
  );
}

function InfoBlock({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <div>
      <h3 className="mb-2 text-[14px] font-extrabold text-[#0f1f4d]">{title}</h3>
      <dl className="space-y-2 text-[13px]">
        {rows.map(([label, value]) => (
          <Row key={label} label={label} value={value} />
        ))}
      </dl>
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
