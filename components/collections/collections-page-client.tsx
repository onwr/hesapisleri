"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Download,
  Search,
  Wallet,
} from "lucide-react";
import {
  CollectPaymentDialog,
  toCollectPaymentTarget,
  type CollectPaymentTarget,
} from "@/components/collections/collect-payment-dialog";
import type { CollectionAccountOption } from "@/components/sales/sale-collect-modal";
import {
  buildCollectionsQuery,
  parseDateParam,
} from "@/lib/collections-page-data";
import {
  getCollectionDocumentBadgeClass,
  getCollectionDocumentLabel,
  getCollectionPaymentBadgeClass,
  getCollectionPaymentLabel,
  type PendingCollectionItem,
  type PendingCollectionsSummary,
} from "@/lib/collections-utils";
import { formatMoney } from "@/lib/format-utils";

type CustomerOption = {
  id: string;
  name: string;
};

type CollectionsPageClientProps = {
  items: PendingCollectionItem[];
  summary: PendingCollectionsSummary;
  accounts: CollectionAccountOption[];
  customers: CustomerOption[];
  initialFilters: {
    search?: string;
    customerId?: string;
    documentType?: string;
    paymentStatus?: string;
    dueStatus?: string;
    from?: string;
    to?: string;
  };
};

const CARD_CLASS =
  "rounded-xl border border-slate-200/80 bg-white shadow-sm";

export function CollectionsPageClient({
  items,
  summary,
  accounts,
  customers,
  initialFilters,
}: CollectionsPageClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [collectTarget, setCollectTarget] =
    useState<CollectPaymentTarget | null>(null);

  const [search, setSearch] = useState(initialFilters.search ?? "");
  const [customerId, setCustomerId] = useState(initialFilters.customerId ?? "");
  const [documentType, setDocumentType] = useState(
    initialFilters.documentType ?? "ALL"
  );
  const [paymentStatus, setPaymentStatus] = useState(
    initialFilters.paymentStatus ?? "ALL"
  );
  const [dueStatus, setDueStatus] = useState(initialFilters.dueStatus ?? "ALL");
  const [from, setFrom] = useState(initialFilters.from ?? "");
  const [to, setTo] = useState(initialFilters.to ?? "");

  function applyFilters() {
    const href = buildCollectionsQuery({
      search,
      customerId: customerId || undefined,
      documentType,
      paymentStatus,
      dueStatus,
      from: parseDateParam(from),
      to: parseDateParam(to),
    });

    startTransition(() => {
      router.push(href);
    });
  }

  function openCollect(item: PendingCollectionItem) {
    setCollectTarget(
      toCollectPaymentTarget({
        collectTargetType: item.collectTarget.type,
        collectTargetId: item.collectTarget.id,
        documentNo: item.documentNo,
        totalAmount: item.totalAmount,
        paidAmount: item.paidAmount,
        remainingAmount: item.remainingAmount,
        linkedInvoiceId: item.linkedInvoiceId,
      })
    );
  }

  const exportHref = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (customerId) params.set("customerId", customerId);
    if (documentType !== "ALL") params.set("documentType", documentType);
    if (paymentStatus !== "ALL") params.set("paymentStatus", paymentStatus);
    if (dueStatus !== "ALL") params.set("dueStatus", dueStatus);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const query = params.toString();
    return query
      ? `/api/collections/pending?${query}`
      : "/api/collections/pending";
  }, [search, customerId, documentType, paymentStatus, dueStatus, from, to]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-[-0.02em] text-[#0f1f4d]">
            Bekleyen Tahsilatlar
          </h1>
          <p className="text-[12px] font-medium text-slate-500">
            Müşteri satışları ve faturalar için bekleyen ödemeleri tek ekrandan
            takip edin.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/cash-bank"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-black text-[#0f1f4d] transition hover:bg-slate-50"
          >
            <ArrowLeft size={14} />
            Kasa & Banka
          </Link>
          <a
            href={exportHref}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-black text-[#0f1f4d] transition hover:bg-slate-50"
          >
            <Download size={14} />
            Dışa Aktar
          </a>
        </div>
      </div>

      <section className="flex flex-wrap items-stretch gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2 shadow-sm">
        <StatPill label="Bekleyen Belge" value={String(summary.pendingCount)} />
        <StatPill
          label="Toplam Bekleyen"
          value={formatMoney(summary.pendingTotal)}
          tone="amber"
        />
        <StatPill
          label="Vadesi Geçen"
          value={String(summary.overdueCount)}
          tone="rose"
        />
        <StatPill
          label="Bugün Vadesi Gelen"
          value={String(summary.dueTodayCount)}
          tone="blue"
        />
        <StatPill
          label="Kısmi Ödenen"
          value={String(summary.partialCount)}
          tone="violet"
        />
      </section>

      <div className={`${CARD_CLASS} p-3`}>
        <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Müşteri veya belge no ara..."
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] font-semibold text-[#0f1f4d] outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <select
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-[#0f1f4d] outline-none"
          >
            <option value="">Tüm müşteriler</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>

          <select
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-[#0f1f4d] outline-none"
          >
            <option value="ALL">Tüm belgeler</option>
            <option value="SALE">Satış</option>
            <option value="INVOICE">Fatura</option>
          </select>

          <select
            value={paymentStatus}
            onChange={(event) => setPaymentStatus(event.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-[#0f1f4d] outline-none"
          >
            <option value="ALL">Tüm durumlar</option>
            <option value="UNPAID">Bekliyor</option>
            <option value="PARTIAL">Kısmi</option>
          </select>

          <button
            type="button"
            onClick={applyFilters}
            disabled={isPending}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-[#0f1f4d] px-4 text-[12px] font-black text-white disabled:opacity-60"
          >
            Filtrele
          </button>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <select
            value={dueStatus}
            onChange={(event) => setDueStatus(event.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-[#0f1f4d] outline-none"
          >
            <option value="ALL">Tüm vadeler</option>
            <option value="OVERDUE">Vadesi geçen</option>
            <option value="DUE_TODAY">Bugün vadesi gelen</option>
            <option value="UPCOMING">Yaklaşan</option>
          </select>
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-[#0f1f4d] outline-none"
          />
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-[#0f1f4d] outline-none"
          />
        </div>
      </div>

      {items.length === 0 ? (
        <div className={`${CARD_CLASS} px-6 py-12 text-center`}>
          <p className="text-[15px] font-extrabold text-[#0f1f4d]">
            Bekleyen tahsilat bulunmuyor.
          </p>
          <p className="mx-auto mt-2 max-w-md text-[13px] font-medium text-slate-500">
            Tüm satış ve faturalarınız tahsil edilmiş görünüyor.
          </p>
        </div>
      ) : (
        <>
          <div className={`${CARD_CLASS} hidden overflow-x-auto lg:block`}>
            <table className="w-full min-w-[1080px] text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-black uppercase tracking-wide text-[#24345f]/70">
                  <th className="px-4 py-3">Müşteri</th>
                  <th className="px-4 py-3">Belge</th>
                  <th className="px-4 py-3">Tarih</th>
                  <th className="px-4 py-3">Vade</th>
                  <th className="px-4 py-3 text-right">Toplam</th>
                  <th className="px-4 py-3 text-right">Tahsil Edilen</th>
                  <th className="px-4 py-3 text-right">Kalan</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3 text-center">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="text-[12px] font-semibold text-[#24345f] hover:bg-slate-50/80"
                  >
                    <td className="px-4 py-3">{item.customerName}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span
                          className={[
                            "inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ring-inset",
                            getCollectionDocumentBadgeClass(item.documentType),
                          ].join(" ")}
                        >
                          {getCollectionDocumentLabel(item.documentType)}
                        </span>
                        <span className="font-bold text-[#0f1f4d]">
                          {item.documentNo}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatDate(item.issueDate)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {item.dueDate ? formatDate(item.dueDate) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-black">
                      {formatMoney(item.totalAmount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatMoney(item.paidAmount)}
                    </td>
                    <td className="px-4 py-3 text-right font-black text-orange-600">
                      {formatMoney(item.remainingAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ring-inset",
                          getCollectionPaymentBadgeClass(item.paymentStatus),
                        ].join(" ")}
                      >
                        {item.isOverdue
                          ? "Gecikmiş"
                          : getCollectionPaymentLabel(item.paymentStatus)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => openCollect(item)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#0f1f4d] px-2.5 text-[11px] font-black text-white"
                        >
                          <Wallet size={12} />
                          Tahsilat Al
                        </button>
                        <Link
                          href={item.actionUrl}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-black text-[#0f1f4d]"
                        >
                          Detay
                          <ChevronRight size={12} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 lg:hidden">
            {items.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-extrabold text-[#0f1f4d]">
                      {item.customerName}
                    </p>
                    <p className="mt-1 text-[12px] font-bold text-slate-600">
                      {item.documentNo}
                    </p>
                  </div>
                  <span
                    className={[
                      "inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ring-inset",
                      getCollectionDocumentBadgeClass(item.documentType),
                    ].join(" ")}
                  >
                    {getCollectionDocumentLabel(item.documentType)}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-500">
                  <span>Kalan: {formatMoney(item.remainingAmount)}</span>
                  <span>Toplam: {formatMoney(item.totalAmount)}</span>
                  <span>Tarih: {formatDate(item.issueDate)}</span>
                  <span>
                    Vade: {item.dueDate ? formatDate(item.dueDate) : "—"}
                  </span>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => openCollect(item)}
                    className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-[#0f1f4d] text-[12px] font-black text-white"
                  >
                    <Wallet size={14} />
                    Tahsilat Al
                  </button>
                  <Link
                    href={item.actionUrl}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 px-3 text-[12px] font-black text-[#0f1f4d]"
                  >
                    Detay
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      <CollectPaymentDialog
        target={collectTarget}
        accounts={accounts}
        onClose={() => setCollectTarget(null)}
      />
    </div>
  );
}

function StatPill({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "amber" | "rose" | "blue" | "violet";
}) {
  const toneClass =
    tone === "amber"
      ? "bg-amber-50 text-amber-700"
      : tone === "rose"
        ? "bg-rose-50 text-rose-700"
        : tone === "blue"
          ? "bg-blue-50 text-blue-700"
          : tone === "violet"
            ? "bg-violet-50 text-violet-700"
            : "bg-slate-50 text-slate-700";

  return (
    <div className={`rounded-lg px-2.5 py-1.5 ${toneClass}`}>
      <span className="text-[10px] font-bold uppercase tracking-wide opacity-80">
        {label}
      </span>
      <p className="text-[13px] font-black leading-tight">{value}</p>
    </div>
  );
}

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}
