"use client";

import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCheck,
  Copy,
  Download,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Search,
  Users,
  Wallet,
} from "lucide-react";
import type {
  BulkActionCustomer,
  BulkActionsFilters,
  BulkActionsSummary,
} from "@/lib/customer-bulk-actions-service";
import { summarizeBulkActions } from "@/lib/customer-bulk-actions-service";
import {
  buildBulkExportHref,
  buildBulkListQuery,
  copyTextToClipboard,
  extractEmailList,
  extractPhoneList,
  formatCopyList,
  formatWhatsAppLinks,
} from "@/lib/customer-bulk-actions-utils";
import {
  formatCustomerMoney,
  getBalanceStatus,
  getCustomerStatusBadge,
  getGroupBadge,
} from "@/lib/customers-page-utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

type CustomerBulkActionsPanelProps = {
  groups: string[];
  initialFilters: BulkActionsFilters;
  initialCustomers: BulkActionCustomer[];
  initialSummary: BulkActionsSummary;
};

type FeedbackState = {
  message: string;
  tone: "success" | "error";
} | null;

export function CustomerBulkActionsPanel({
  groups,
  initialFilters,
  initialCustomers,
  initialSummary,
}: CustomerBulkActionsPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState(initialFilters);
  const [searchInput, setSearchInput] = useState(initialFilters.search ?? "");
  const [customers, setCustomers] = useState(initialCustomers);
  const [listSummary, setListSummary] = useState(initialSummary);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initialCustomers.map((customer) => customer.id))
  );
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  useEffect(() => {
    setCustomers(initialCustomers);
    setListSummary(initialSummary);
    setSelectedIds(new Set(initialCustomers.map((customer) => customer.id)));
  }, [initialCustomers, initialSummary]);

  useEffect(() => {
    if (!feedback) return;

    const timer = window.setTimeout(() => setFeedback(null), 2400);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const selectedCustomers = useMemo(
    () => customers.filter((customer) => selectedIds.has(customer.id)),
    [customers, selectedIds]
  );

  const selectionSummary = useMemo(
    () => summarizeBulkActions(customers, selectedIds),
    [customers, selectedIds]
  );

  const allSelected =
    customers.length > 0 && selectedCustomers.length === customers.length;
  const someSelected =
    selectedCustomers.length > 0 && selectedCustomers.length < customers.length;

  const statCards = [
    {
      label: "Toplam Müşteri",
      value: listSummary.totalCustomers,
      icon: Users,
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "Seçili Müşteri",
      value: selectionSummary.selectedCustomers,
      icon: CheckCheck,
      color: "bg-violet-50 text-violet-600",
    },
    {
      label: "Telefonu Olan",
      value: listSummary.withPhone,
      icon: Phone,
      color: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "E-postası Olan",
      value: listSummary.withEmail,
      icon: Mail,
      color: "bg-cyan-50 text-cyan-600",
    },
    {
      label: "Borçlu Müşteri",
      value: listSummary.debtorCount,
      icon: AlertTriangle,
      color: "bg-rose-50 text-rose-600",
    },
  ];

  async function fetchCustomers(nextFilters: BulkActionsFilters) {
    const response = await fetch(
      `/api/customers/bulk-list${buildBulkListQuery(nextFilters)}`
    );
    const result = (await response.json()) as {
      success?: boolean;
      data?: {
        customers: BulkActionCustomer[];
        summary: BulkActionsSummary;
      };
    };

    if (!response.ok || !result.success || !result.data) {
      throw new Error("Müşteri listesi alınamadı.");
    }

    setCustomers(result.data.customers);
    setListSummary(result.data.summary);
    setSelectedIds(
      new Set(result.data.customers.map((customer) => customer.id))
    );
  }

  function applyFilters(nextFilters: BulkActionsFilters) {
    setFilters(nextFilters);

    startTransition(async () => {
      try {
        router.replace(`/customers/bulk-actions${buildBulkListQuery(nextFilters)}`);
        await fetchCustomers(nextFilters);
      } catch {
        setFeedback({
          message: "Filtreler uygulanırken bir hata oluştu.",
          tone: "error",
        });
      }
    });
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyFilters({
      ...filters,
      search: searchInput.trim() || null,
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(
      checked ? new Set(customers.map((customer) => customer.id)) : new Set()
    );
  }

  function toggleCustomer(customerId: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(customerId);
      } else {
        next.delete(customerId);
      }

      return next;
    });
  }

  async function handleCopyPhones() {
    const phones = extractPhoneList(selectedCustomers);

    if (phones.length === 0) {
      setFeedback({
        message: "Seçili müşterilerde kopyalanacak telefon bulunamadı.",
        tone: "error",
      });
      return;
    }

    await copyTextToClipboard(formatCopyList(phones));
    setFeedback({
      message: `${phones.length} telefon numarası panoya kopyalandı.`,
      tone: "success",
    });
  }

  async function handleCopyEmails(commaSeparated = false) {
    const emails = extractEmailList(selectedCustomers);

    if (emails.length === 0) {
      setFeedback({
        message: "Seçili müşterilerde kopyalanacak e-posta bulunamadı.",
        tone: "error",
      });
      return;
    }

    await copyTextToClipboard(
      formatCopyList(emails, commaSeparated ? ", " : "\n")
    );
    setFeedback({
      message: `${emails.length} e-posta adresi panoya kopyalandı.`,
      tone: "success",
    });
  }

  async function handleCopyWhatsAppLinks() {
    const phones = extractPhoneList(selectedCustomers);
    const links = formatWhatsAppLinks(phones);

    if (links.length === 0) {
      setFeedback({
        message: "Seçili müşterilerde WhatsApp linki oluşturulacak telefon yok.",
        tone: "error",
      });
      return;
    }

    await copyTextToClipboard(formatCopyList(links));
    setFeedback({
      message: `${links.length} WhatsApp linki panoya kopyalandı.`,
      tone: "success",
    });
  }

  function handleDownloadCsv() {
    if (selectedCustomers.length === 0) {
      setFeedback({
        message: "CSV indirmek için en az bir müşteri seçin.",
        tone: "error",
      });
      return;
    }

    const href = buildBulkExportHref(
      filters,
      selectedCustomers.map((customer) => customer.id)
    );

    window.location.href = href;
    setFeedback({
      message: `${selectedCustomers.length} müşteri CSV olarak indiriliyor.`,
      tone: "success",
    });
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {statCards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.label}
              className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
            >
              <div className="flex items-center gap-3">
                <div
                  className={[
                    "flex h-10 w-10 items-center justify-center rounded-xl",
                    card.color,
                  ].join(" ")}
                >
                  <Icon size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                    {card.label}
                  </p>
                  <p className="text-[20px] font-black text-[#0f1f4d]">
                    {card.value}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <p className="text-[15px] font-black text-[#0f1f4d]">Filtreler</p>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FilterSelect
                label="Grup"
                value={filters.group ?? "all"}
                disabled={isPending}
                onChange={(value) =>
                  applyFilters({
                    ...filters,
                    group: value === "all" ? null : value,
                  })
                }
                options={[
                  { value: "all", label: "Tüm Gruplar" },
                  ...groups.map((group) => ({ value: group, label: group })),
                ]}
              />

              <FilterSelect
                label="Durum"
                value={filters.status}
                disabled={isPending}
                onChange={(value) =>
                  applyFilters({
                    ...filters,
                    status: value as BulkActionsFilters["status"],
                  })
                }
                options={[
                  { value: "all", label: "Tümü" },
                  { value: "ACTIVE", label: "Aktif" },
                  { value: "PASSIVE", label: "Pasif" },
                ]}
              />

              <FilterSelect
                label="Cari Durum"
                value={filters.balanceType}
                disabled={isPending}
                onChange={(value) =>
                  applyFilters({
                    ...filters,
                    balanceType: value as BulkActionsFilters["balanceType"],
                  })
                }
                options={[
                  { value: "all", label: "Tümü" },
                  { value: "debtor", label: "Borçlu" },
                  { value: "creditor", label: "Alacaklı" },
                  { value: "zero", label: "Borç Yok" },
                ]}
              />

              <form onSubmit={handleSearchSubmit}>
                <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.08em] text-slate-500">
                  Arama
                </label>
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Ad, telefon, e-posta, vergi no"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-[13px] font-semibold text-[#0f1f4d] outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </form>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[15px] font-black text-[#0f1f4d]">
                  Müşteri Listesi
                </p>
                <p className="mt-1 text-[12px] font-medium text-slate-500">
                  Toplu işlem yapmak istediğiniz müşterileri işaretleyin.
                </p>
              </div>

              <label className="inline-flex items-center gap-2 text-[12px] font-bold text-[#24345f]">
                <Checkbox
                  checked={
                    allSelected ? true : someSelected ? "indeterminate" : false
                  }
                  onCheckedChange={(value) => toggleAll(value === true)}
                />
                Tümünü Seç
              </label>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-black text-[#24345f]/80">
                    <th className="px-4 py-3">Seç</th>
                    <th className="px-4 py-3">Müşteri Adı</th>
                    <th className="px-4 py-3">Grup</th>
                    <th className="px-4 py-3">Telefon</th>
                    <th className="px-4 py-3">E-Posta</th>
                    <th className="px-4 py-3">Bakiye</th>
                    <th className="px-4 py-3">Durum</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {customers.map((customer) => {
                    const statusBadge = getCustomerStatusBadge(customer.status);
                    const balanceStatus = getBalanceStatus(customer.balance);
                    const isSelected = selectedIds.has(customer.id);

                    return (
                      <tr
                        key={customer.id}
                        className={[
                          "text-[12px] font-semibold text-[#24345f] transition",
                          isSelected ? "bg-blue-50/40" : "hover:bg-slate-50/80",
                        ].join(" ")}
                      >
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(value) =>
                              toggleCustomer(customer.id, value === true)
                            }
                            aria-label={`${customer.name} seç`}
                          />
                        </td>

                        <td className="px-4 py-3">
                          <Link
                            href={`/customers/${customer.id}`}
                            className="font-extrabold text-[#0f1f4d] hover:text-blue-600"
                          >
                            {customer.name}
                          </Link>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={[
                              "rounded-md px-2 py-1 text-[10px] font-black",
                              getGroupBadge(customer.group, customer.groupColor),
                            ].join(" ")}
                          >
                            {customer.group}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-slate-600">
                          {customer.phone || "-"}
                        </td>

                        <td className="px-4 py-3 text-slate-600">
                          {customer.email || "-"}
                        </td>

                        <td className="px-4 py-3">
                          <div>
                            <p
                              className={[
                                "font-black",
                                balanceStatus.amountClass,
                              ].join(" ")}
                            >
                              {formatCustomerMoney(customer.balance)}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {balanceStatus.subLabel}
                            </p>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={[
                              "rounded-md px-2 py-1 text-[10px] font-black",
                              statusBadge.className,
                            ].join(" ")}
                          >
                            {statusBadge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {customers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-16 text-center">
                        <div className="mx-auto max-w-sm">
                          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-orange-50 text-orange-500">
                            <Users size={28} />
                          </div>

                          <p className="mt-4 text-lg font-black text-[#0f1f4d]">
                            Filtreye uygun müşteri bulunamadı
                          </p>

                          <p className="mt-2 text-sm leading-6 text-slate-500">
                            Farklı filtreler deneyebilir veya yeni müşteri
                            ekleyebilirsiniz.
                          </p>

                          <Link
                            href="/customers/new"
                            className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl bg-blue-600 px-5 text-sm font-black text-white"
                          >
                            Yeni Müşteri Ekle
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <p className="text-[15px] font-black text-[#0f1f4d]">
              Seçili Müşteriler Özeti
            </p>

            <div className="mt-4 space-y-3 rounded-2xl bg-slate-50 p-4 text-[12px]">
              <SummaryLine
                label="Seçili müşteri"
                value={String(selectionSummary.selectedCustomers)}
              />
              <SummaryLine
                label="Telefonu olan"
                value={String(selectionSummary.selectedWithPhone)}
              />
              <SummaryLine
                label="E-postası olan"
                value={String(selectionSummary.selectedWithEmail)}
              />
              <SummaryLine
                label="Toplam borç"
                value={formatCustomerMoney(selectionSummary.totalDebt)}
                valueClass="text-rose-500"
              />
              <SummaryLine
                label="Toplam alacak"
                value={formatCustomerMoney(selectionSummary.totalCredit)}
                valueClass="text-emerald-600"
              />
            </div>

            <div className="mt-4 space-y-2">
              <ActionButton
                icon={<Phone size={16} />}
                label="Telefon listesini kopyala"
                onClick={() => void handleCopyPhones()}
                disabled={selectedCustomers.length === 0}
              />
              <ActionButton
                icon={<Copy size={16} />}
                label="E-posta listesini kopyala"
                onClick={() => void handleCopyEmails(false)}
                disabled={selectedCustomers.length === 0}
              />
              <ActionButton
                icon={<Mail size={16} />}
                label="E-postaları virgüllü kopyala"
                onClick={() => void handleCopyEmails(true)}
                disabled={selectedCustomers.length === 0}
              />
              <ActionButton
                icon={<MessageCircle size={16} />}
                label="WhatsApp listesi kopyala"
                onClick={() => void handleCopyWhatsAppLinks()}
                disabled={selectedCustomers.length === 0}
              />
              <ActionButton
                icon={<Download size={16} />}
                label="CSV indir"
                onClick={handleDownloadCsv}
                disabled={selectedCustomers.length === 0}
              />
            </div>

            {feedback ? (
              <p
                className={[
                  "mt-4 rounded-xl px-3 py-2 text-[12px] font-semibold",
                  feedback.tone === "success"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-rose-50 text-rose-700",
                ].join(" ")}
              >
                {feedback.message}
              </p>
            ) : null}
          </section>

          <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-orange-500 shadow-sm">
                <MessageSquare size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[14px] font-black text-[#0f1f4d]">
                    Toplu SMS
                  </p>
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-black uppercase text-orange-700">
                    Yakında
                  </span>
                </div>
                <p className="mt-2 text-[12px] leading-5 text-slate-500">
                  SMS gönderimi bir sonraki aşamada eklenecek.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
                <Wallet size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[14px] font-black text-[#0f1f4d]">
                    Toplu E-posta
                  </p>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black uppercase text-blue-700">
                    Yakında
                  </span>
                </div>
                <p className="mt-2 text-[12px] leading-5 text-slate-500">
                  Kampanya e-postası gönderimi yakında aktif olacak.
                </p>
              </div>
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.08em] text-slate-500">
        {label}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-[#0f1f4d] outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SummaryLine({
  label,
  value,
  valueClass = "text-[#0f1f4d]",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className={["font-black", valueClass].join(" ")}>{value}</span>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 w-full justify-start rounded-xl border-slate-200 text-[#0f1f4d]"
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
      {label}
    </Button>
  );
}
