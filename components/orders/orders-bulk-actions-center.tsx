"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { notifyTenantCacheSync } from "@/lib/tenant-cache/client-tenant-sync";
import {
  Ban,
  CheckCheck,
  Download,
  Loader2,
  Search,
  Truck,
} from "lucide-react";
import type {
  BulkOrderListSummary,
  BulkOrderRow,
  OrderBulkFilters,
} from "@/lib/orders-bulk-actions-service";
import { summarizeBulkOrderSelection } from "@/lib/orders-bulk-actions-service";
import {
  buildBulkActionsPageQuery,
  buildBulkOrderExportHref,
  ORDER_CHANNEL_OPTIONS,
} from "@/lib/orders-bulk-actions-utils";
import { formatOrderMoney } from "@/lib/orders-page-utils";
import { formatDateInputValue } from "@/lib/sales-page-utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { getMarketplaceName } from "@/lib/marketplace-logos";

type OrdersBulkActionsCenterProps = {
  initialFilters: OrderBulkFilters;
  initialRows: BulkOrderRow[];
  initialSummary: BulkOrderListSummary;
};

export function OrdersBulkActionsCenter({
  initialFilters,
  initialRows,
  initialSummary,
}: OrdersBulkActionsCenterProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rows] = useState(initialRows);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [shippingCarrier, setShippingCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    q: initialFilters.q ?? "",
    channel: initialFilters.channel ?? "all",
    orderStatus: initialFilters.orderStatus,
    from: initialFilters.from ? formatDateInputValue(initialFilters.from) : "",
    to: initialFilters.to ? formatDateInputValue(initialFilters.to) : "",
  });

  const selection = useMemo(
    () => summarizeBulkOrderSelection(rows, selectedIds),
    [rows, selectedIds]
  );

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? rows.map((row) => row.id) : []);
  }

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? [...current, id] : current.filter((item) => item !== id)
    );
  }

  function applyFilters() {
    startTransition(() => {
      router.push(
        buildBulkActionsPageQuery({
          q: filters.q.trim() || null,
          channel:
            filters.channel === "all"
              ? null
              : (filters.channel as OrderBulkFilters["channel"]),
          orderStatus:
            filters.orderStatus === "all" ? "all" : filters.orderStatus,
          from: filters.from ? new Date(filters.from) : null,
          to: filters.to ? new Date(filters.to) : null,
        })
      );
    });
  }

  async function runBulkStatus(orderStatus: "APPROVED" | "CANCELLED") {
    if (selectedIds.length === 0) {
      setError("En az bir sipariş seçin.");
      return;
    }

    setError(null);
    setMessage(null);

    const response = await fetch("/api/orders/bulk/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds, orderStatus }),
    });
    const result = await response.json();

    if (!response.ok || !result.success) {
      setError(result.message ?? "Toplu işlem başarısız.");
      return;
    }

    setMessage(result.message);
    notifyTenantCacheSync();
  }

  async function runBulkShipping() {
    if (selectedIds.length === 0) {
      setError("En az bir sipariş seçin.");
      return;
    }

    setError(null);
    setMessage(null);

    const response = await fetch("/api/orders/bulk/shipping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: selectedIds,
        shippingCarrier,
        trackingNumber,
      }),
    });
    const result = await response.json();

    if (!response.ok || !result.success) {
      setError(result.message ?? "Kargo güncellemesi başarısız.");
      return;
    }

    setMessage(result.message);
    notifyTenantCacheSync();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/orders"
            className="text-[12px] font-bold text-blue-600 hover:text-blue-700"
          >
            ← Siparişlere Dön
          </Link>
          <h1 className="mt-2 text-2xl font-black text-[#0f1f4d]">Toplu İşlemler</h1>
        </div>
        <a
          href={selectedIds.length > 0 ? buildBulkOrderExportHref(selectedIds) : "#"}
          className={[
            "inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-[12px] font-black",
            selectedIds.length > 0
              ? "border-slate-200 text-[#24345f] hover:bg-slate-50"
              : "pointer-events-none border-slate-100 text-slate-300",
          ].join(" ")}
        >
          <Download size={14} />
          Seçili CSV İndir
        </a>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <label className="relative flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3">
            <Search size={14} className="text-slate-400" />
            <input
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder="Ara..."
              className="w-full bg-transparent text-[12px] outline-none"
            />
          </label>
          <select
            value={filters.channel}
            onChange={(e) => setFilters((f) => ({ ...f, channel: e.target.value }))}
            className="h-10 rounded-xl border border-slate-200 px-3 text-[12px] font-bold"
          >
            {ORDER_CHANNEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={filters.orderStatus}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                orderStatus: e.target.value as OrderBulkFilters["orderStatus"],
              }))
            }
            className="h-10 rounded-xl border border-slate-200 px-3 text-[12px] font-bold"
          >
            <option value="all">Tüm Durumlar</option>
            <option value="WAITING">Beklemede</option>
            <option value="APPROVED">Onaylandı</option>
            <option value="SHIPPING">Kargoda</option>
            <option value="DELIVERED">Teslim Edildi</option>
            <option value="RETURN_REQUESTED">İade Talebi</option>
            <option value="RETURNED">İade Edildi</option>
            <option value="CANCELLED">İptal</option>
          </select>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            className="h-10 rounded-xl border border-slate-200 px-3 text-[12px]"
          />
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            className="h-10 rounded-xl border border-slate-200 px-3 text-[12px]"
          />
        </div>
        <Button
          type="button"
          onClick={applyFilters}
          disabled={isPending}
          className="mt-3 h-10 rounded-xl font-black"
        >
          {isPending ? <Loader2 size={14} className="animate-spin" /> : null}
          Filtrele
        </Button>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <Stat label="Toplam" value={String(initialSummary.totalCount)} />
        <Stat label="Beklemede" value={String(initialSummary.waitingCount)} />
        <Stat label="Onaylandı" value={String(initialSummary.approvedCount)} />
        <Stat label="Seçili" value={String(selection.selectedCount)} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => runBulkStatus("APPROVED")}
            className="h-10 rounded-xl bg-emerald-600 font-black hover:bg-emerald-700"
          >
            <CheckCheck size={14} />
            Seçilileri Onayla
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => runBulkStatus("CANCELLED")}
            className="h-10 rounded-xl border-rose-200 font-black text-rose-600"
          >
            <Ban size={14} />
            Seçilileri İptal Et
          </Button>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <input
            value={shippingCarrier}
            onChange={(e) => setShippingCarrier(e.target.value)}
            placeholder="Kargo firması"
            className="h-10 rounded-xl border border-slate-200 px-3 text-[12px]"
          />
          <input
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="Takip no"
            className="h-10 rounded-xl border border-slate-200 px-3 text-[12px]"
          />
          <Button
            type="button"
            onClick={runBulkShipping}
            className="h-10 rounded-xl bg-orange-500 font-black hover:bg-orange-600"
          >
            <Truck size={14} />
            Kargo Bilgisi Gir
          </Button>
        </div>

        {message ? (
          <p className="mt-3 text-[12px] font-semibold text-emerald-600">{message}</p>
        ) : null}
        {error ? (
          <p className="mt-3 text-[12px] font-semibold text-rose-500">{error}</p>
        ) : null}
      </section>

      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-black text-slate-500">
              <th className="px-3 py-2">
                <Checkbox
                  checked={selectedIds.length === rows.length && rows.length > 0}
                  onCheckedChange={(checked) => toggleAll(Boolean(checked))}
                />
              </th>
              <th className="px-3 py-2">Sipariş</th>
              <th className="px-3 py-2">Müşteri</th>
              <th className="px-3 py-2">Kanal</th>
              <th className="px-3 py-2">Durum</th>
              <th className="px-3 py-2">Kargo</th>
              <th className="px-3 py-2 text-right">Tutar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id} className="font-semibold text-[#24345f]">
                <td className="px-3 py-2">
                  <Checkbox
                    checked={selectedIds.includes(row.id)}
                    onCheckedChange={(checked) => toggleOne(row.id, Boolean(checked))}
                  />
                </td>
                <td className="px-3 py-2">
                  <Link href={`/orders/${row.id}`} className="font-black text-blue-600">
                    {row.orderNo}
                  </Link>
                </td>
                <td className="px-3 py-2">{row.customerName}</td>
                <td className="px-3 py-2">{getMarketplaceName(row.channel)}</td>
                <td className="px-3 py-2">{row.status}</td>
                <td className="px-3 py-2">
                  {row.cargo}
                  {row.cargoCode ? (
                    <span className="block text-[10px] text-slate-400">
                      {row.cargoCode}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right font-black">
                  {formatOrderMoney(row.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-bold text-slate-500">{label}</p>
      <p className="mt-2 text-[20px] font-black text-[#0f1f4d]">{value}</p>
    </div>
  );
}
