"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CalendarDays,
  Clock3,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  Hourglass,
  ReceiptText,
  Search,
  Wallet,
} from "lucide-react";
import {
  CollectPaymentDialog,
  toCollectPaymentTarget,
  type CollectPaymentTarget,
} from "@/components/collections/collect-payment-dialog";
import {
  buildCollectionsQuery,
  parseDateParam,
} from "@/lib/collections-page-utils";
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

const QUICK_TABS = [
  {
    key: "all",
    label: "Tümü",
    paymentStatus: "ALL",
    dueStatus: "ALL",
  },
  {
    key: "unpaid",
    label: "Bekleyen",
    paymentStatus: "UNPAID",
    dueStatus: "ALL",
  },
  {
    key: "partial",
    label: "Kısmi Ödenen",
    paymentStatus: "PARTIAL",
    dueStatus: "ALL",
  },
  {
    key: "overdue",
    label: "Vadesi Geçen",
    paymentStatus: "ALL",
    dueStatus: "OVERDUE",
  },
  {
    key: "today",
    label: "Bugün Vadesi",
    paymentStatus: "ALL",
    dueStatus: "DUE_TODAY",
  },
] as const;

const AVATAR_COLORS = [
  "bg-blue-600",
  "bg-emerald-600",
  "bg-violet-600",
  "bg-orange-500",
  "bg-rose-500",
  "bg-cyan-600",
];

export function CollectionsPageClient({
  items,
  summary,
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

  const hasFilters =
    Boolean(search.trim()) ||
    Boolean(customerId) ||
    documentType !== "ALL" ||
    paymentStatus !== "ALL" ||
    dueStatus !== "ALL" ||
    Boolean(from) ||
    Boolean(to);

  const activeQuickTab =
    QUICK_TABS.find(
      (tab) =>
        tab.paymentStatus === paymentStatus && tab.dueStatus === dueStatus
    )?.key ?? "custom";

  function applyFilters(next?: {
    search?: string;
    customerId?: string;
    documentType?: string;
    paymentStatus?: string;
    dueStatus?: string;
    from?: string;
    to?: string;
  }) {
    const href = buildCollectionsQuery({
      search: next?.search ?? search,
      customerId: (next?.customerId ?? customerId) || undefined,
      documentType: next?.documentType ?? documentType,
      paymentStatus: next?.paymentStatus ?? paymentStatus,
      dueStatus: next?.dueStatus ?? dueStatus,
      from: parseDateParam(next?.from ?? from),
      to: parseDateParam(next?.to ?? to),
    });

    startTransition(() => {
      router.push(href);
    });
  }

  function handleFilterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyFilters();
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

  const actionCards = [
    {
      title: "Kasa & Banka",
      description: "Hesap hareketlerine dön",
      href: "/cash-bank",
      icon: Banknote,
      gradient: "from-blue-500 to-blue-600",
    },
    {
      title: "Vadesi Geçenler",
      description: "Geciken tahsilatları gör",
      href: buildCollectionsQuery({
        dueStatus: "OVERDUE",
        paymentStatus: "ALL",
      }),
      icon: AlertTriangle,
      gradient: "from-rose-400 to-pink-600",
    },
    {
      title: "Faturalar",
      description: "Fatura listesine git",
      href: "/invoices?tab=unpaid",
      icon: ReceiptText,
      gradient: "from-violet-500 to-purple-600",
    },
    {
      title: "Dışa Aktar",
      description: "Listeyi indir",
      href: exportHref,
      icon: FileSpreadsheet,
      gradient: "from-emerald-500 to-green-600",
      external: true,
    },
  ];

  const statCards = [
    {
      title: "Bekleyen Belge",
      value: String(summary.pendingCount),
      subtitle: "Tahsilat bekleyen kayıt",
      icon: Hourglass,
      color: "bg-blue-50 text-blue-600",
    },
    {
      title: "Toplam Bekleyen",
      value: formatMoney(summary.pendingTotal),
      subtitle: "Kalan tahsilat tutarı",
      icon: Wallet,
      color: "bg-emerald-50 text-emerald-600",
    },
    {
      title: "Vadesi Geçen",
      value: String(summary.overdueCount),
      subtitle: "Gecikmiş belge sayısı",
      icon: AlertTriangle,
      color: "bg-rose-50 text-rose-500",
    },
    {
      title: "Bugün Vadesi",
      value: String(summary.dueTodayCount),
      subtitle: "Bugün tahsil edilecek",
      icon: CalendarDays,
      color: "bg-orange-50 text-orange-500",
    },
    {
      title: "Kısmi Ödenen",
      value: String(summary.partialCount),
      subtitle: "Kısmi ödeme alınmış",
      icon: Clock3,
      color: "bg-violet-50 text-violet-600",
    },
  ];

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {actionCards.map((card) => {
          const Icon = card.icon;
          const className = [
            "group flex h-[86px] items-center justify-between rounded-2xl bg-linear-to-br p-4 text-white shadow-[0_14px_30px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(15,23,42,0.16)]",
            card.gradient,
          ].join(" ");

          const content = (
            <>
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/15 shadow-inner">
                  <Icon size={22} strokeWidth={2.4} />
                </div>

                <div className="min-w-0">
                  <p className="truncate text-[15px] font-black leading-tight">
                    {card.title}
                  </p>
                  <p className="mt-1 truncate text-[11px] font-medium text-white/85">
                    {card.description}
                  </p>
                </div>
              </div>

              <ArrowRight
                size={18}
                strokeWidth={3}
                className="shrink-0 opacity-90 transition group-hover:translate-x-1 group-hover:opacity-100"
              />
            </>
          );

          if (card.external) {
            return (
              <a key={card.title} href={card.href} className={className}>
                {content}
              </a>
            );
          }

          return (
            <Link key={card.title} href={card.href} className={className}>
              {content}
            </Link>
          );
        })}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {statCards.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.title}
              className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-extrabold text-[#24345f]/80">
                    {stat.title}
                  </p>
                  <p className="mt-3 text-[20px] font-black tracking-[-0.03em] text-[#0f1f4d]">
                    {stat.value}
                  </p>
                </div>

                <div
                  className={[
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                    stat.color,
                  ].join(" ")}
                >
                  <Icon size={22} strokeWidth={2.4} />
                </div>
              </div>

              <p className="mt-3 text-[11px] font-semibold text-slate-500">
                {stat.subtitle}
              </p>
            </div>
          );
        })}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4">
            <div className="grid w-full grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-3 xl:grid-cols-5">
              {QUICK_TABS.map((tab) => {
                const isActive = activeQuickTab === tab.key;

                return (
                  <Link
                    key={tab.key}
                    href={buildCollectionsQuery({
                      search,
                      customerId: customerId || undefined,
                      documentType,
                      paymentStatus: tab.paymentStatus,
                      dueStatus: tab.dueStatus,
                      from: parseDateParam(from),
                      to: parseDateParam(to),
                    })}
                    className={[
                      "flex min-h-[40px] items-center justify-center px-2 py-2.5 text-center text-[10px] font-extrabold leading-tight transition xl:text-[11px]",
                      isActive
                        ? "bg-blue-50 text-blue-600"
                        : "bg-white text-slate-500 hover:bg-slate-50 hover:text-[#0f1f4d]",
                    ].join(" ")}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>

            <form
              onSubmit={handleFilterSubmit}
              className="flex w-full flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center"
            >
              <div className="relative min-w-[220px] flex-1">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Müşteri veya belge no ara..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[12px] font-semibold text-[#0f1f4d] outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <select
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                className="h-10 min-w-[160px] rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-[#0f1f4d] outline-none"
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
                className="h-10 min-w-[140px] rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-[#0f1f4d] outline-none"
              >
                <option value="ALL">Tüm belgeler</option>
                <option value="SALE">Satış</option>
                <option value="INVOICE">Fatura</option>
              </select>

              <select
                value={dueStatus}
                onChange={(event) => setDueStatus(event.target.value)}
                className="h-10 min-w-[150px] rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-[#0f1f4d] outline-none"
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
                className="h-10 min-w-[140px] rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-[#0f1f4d] outline-none"
              />

              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="h-10 min-w-[140px] rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-[#0f1f4d] outline-none"
              />

              <button
                type="submit"
                disabled={isPending}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0f1f4d] px-4 text-[12px] font-black text-white transition hover:bg-[#16285f] disabled:opacity-60"
              >
                <Filter size={14} />
                Filtrele
              </button>
            </form>
          </div>

          {items.length === 0 ? (
            <CollectionsEmptyState hasFilters={hasFilters} />
          ) : (
            <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1080px] text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-black text-[#24345f]/80">
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
                    className="text-[12px] font-semibold text-[#24345f] transition hover:bg-slate-50/80"
                  >
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={[
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white",
                            getAvatarColor(item.customerName),
                          ].join(" ")}
                        >
                          {getInitials(item.customerName)}
                        </div>
                        <p className="truncate font-extrabold text-[#0f1f4d]">
                          {item.customerName}
                        </p>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span
                          className={[
                            "inline-flex w-fit rounded-md px-2 py-1 text-[10px] font-black",
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

                    <td className="whitespace-nowrap px-4 py-3 text-[11px] text-slate-500">
                      {formatDate(item.issueDate)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-[11px] text-slate-500">
                      {item.dueDate ? formatDate(item.dueDate) : "—"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-right font-black text-[#0f1f4d]">
                      {formatMoney(item.totalAmount)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600">
                      {formatMoney(item.paidAmount)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-right font-black text-orange-600">
                      {formatMoney(item.remainingAmount)}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={[
                          "inline-flex rounded-md px-2 py-1 text-[10px] font-black",
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
                          className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-[11px] font-black text-white transition hover:bg-emerald-700"
                        >
                          <Wallet size={13} />
                          Tahsilat
                        </button>

                        <Link
                          href={item.actionUrl}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#24345f] transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600"
                          title="Detay"
                        >
                          <Eye size={15} />
                        </Link>

                        <a
                          href={exportHref}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#24345f] transition hover:bg-slate-50"
                          title="Listeyi indir"
                        >
                          <Download size={15} />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 border-t border-slate-100 p-4 lg:hidden">
            {items.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-slate-200/80 bg-slate-50/40 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={[
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white",
                        getAvatarColor(item.customerName),
                      ].join(" ")}
                    >
                      {getInitials(item.customerName)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-extrabold text-[#0f1f4d]">
                        {item.customerName}
                      </p>
                      <p className="mt-0.5 truncate text-[12px] font-bold text-slate-600">
                        {item.documentNo}
                      </p>
                    </div>
                  </div>

                  <span
                    className={[
                      "inline-flex shrink-0 rounded-md px-2 py-1 text-[10px] font-black",
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
                    className="inline-flex h-10 flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-600 text-[12px] font-black text-white"
                  >
                    <Wallet size={14} />
                    Tahsilat Al
                  </button>
                  <Link
                    href={item.actionUrl}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-black text-[#0f1f4d]"
                  >
                    Detay
                  </Link>
                </div>
              </article>
            ))}
          </div>
            </>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <p className="text-[12px] font-extrabold text-[#24345f]/80">
              Tahsilat Özeti
            </p>

            <div className="mt-4 space-y-3">
              <SummaryRow
                label="Toplam bekleyen"
                value={formatMoney(summary.pendingTotal)}
                tone="emerald"
              />
              <SummaryRow
                label="Bekleyen belge"
                value={String(summary.pendingCount)}
              />
              <SummaryRow
                label="Vadesi geçen"
                value={String(summary.overdueCount)}
                tone="rose"
              />
              <SummaryRow
                label="Bugün vadesi gelen"
                value={String(summary.dueTodayCount)}
                tone="orange"
              />
              <SummaryRow
                label="Kısmi ödenen"
                value={String(summary.partialCount)}
                tone="violet"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-linear-to-br from-[#0f1f4d] to-[#1e3a8a] p-4 text-white shadow-[0_14px_30px_rgba(15,23,42,0.16)]">
            <p className="text-[13px] font-black">Hızlı Tahsilat</p>
            <p className="mt-2 text-[12px] leading-6 text-white/80">
              Satır üzerindeki Tahsilat butonu ile ödemeyi doğrudan kasa veya
              banka hesabına kaydedebilirsiniz.
            </p>
            <Link
              href="/cash-bank"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-[12px] font-black text-[#0f1f4d]"
            >
              Kasa & Banka
            </Link>
          </div>
        </aside>
      </div>

      <CollectPaymentDialog
        target={collectTarget}
        onClose={() => setCollectTarget(null)}
      />
    </div>
  );
}

function CollectionsEmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="px-5 py-16 text-center">
      <div className="mx-auto max-w-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600">
          <Wallet size={28} />
        </div>

        <p className="mt-4 text-lg font-black text-[#0f1f4d]">
          {hasFilters
            ? "Bu filtrede bekleyen tahsilat bulunamadı"
            : "Bekleyen tahsilat bulunmuyor"}
        </p>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          {hasFilters
            ? "Arama veya filtre kriterlerinizi değiştirerek tekrar deneyebilirsiniz."
            : "Tüm satış ve faturalarınız tahsil edilmiş görünüyor."}
        </p>

        <Link
          href={hasFilters ? "/cash-bank/collections" : "/invoices"}
          className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white"
        >
          {hasFilters ? "Filtreyi Temizle" : "Faturalara Git"}
        </Link>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "emerald" | "rose" | "orange" | "violet";
}) {
  const valueClass =
    tone === "emerald"
      ? "text-emerald-600"
      : tone === "rose"
        ? "text-rose-600"
        : tone === "orange"
          ? "text-orange-600"
          : tone === "violet"
          ? "text-violet-600"
          : "text-[#0f1f4d]";

  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
      <span className="text-[12px] font-semibold text-slate-500">{label}</span>
      <span className={["text-[13px] font-black", valueClass].join(" ")}>
        {value}
      </span>
    </div>
  );
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getAvatarColor(name: string) {
  const hash = name
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);

  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}
