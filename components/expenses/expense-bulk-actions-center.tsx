"use client";

import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Ban,
  CheckCheck,
  Download,
  FolderInput,
  Loader2,
  Printer,
  Receipt,
  Search,
  Wallet,
  X,
} from "lucide-react";
import type {
  BulkExpenseListSummary,
  BulkExpenseRow,
  ExpenseBulkFilters,
} from "@/lib/expense-bulk-actions-service";
import { summarizeBulkSelection } from "@/lib/expense-bulk-actions-service";
import {
  buildBulkActionsPageQuery,
  buildBulkExpenseExportHref,
  buildBulkExpenseListQuery,
} from "@/lib/expense-bulk-actions-utils";
import { getExpenseDisplayPaymentBadge, isCancelledExpense } from "@/lib/expense-utils";
import { TransactionCancelDialog } from "@/components/transactions/transaction-cancel-dialog";
import {
  formatExpenseDate,
  formatExpenseMoney,
  getCategoryBadge,
  getExpenseStatusBadge,
} from "@/lib/expenses-page-utils";
import { formatDateInputValue } from "@/lib/sales-page-utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useTenantMutation } from "@/hooks/use-tenant-mutation";
import { notifyTenantCacheSync } from "@/lib/tenant-cache/client-tenant-sync";

type AccountOption = {
  id: string;
  name: string;
  type: string;
  balance: number;
};

type ExpenseBulkActionsCenterProps = {
  categories: string[];
  accounts: AccountOption[];
  initialFilters: ExpenseBulkFilters;
  initialExpenses: BulkExpenseRow[];
  initialSummary: BulkExpenseListSummary;
};

type FeedbackState = {
  message: string;
  tone: "success" | "error";
} | null;

type FilterFormState = {
  search: string;
  category: string;
  paymentStatus: ExpenseBulkFilters["paymentStatus"];
  status: ExpenseBulkFilters["status"];
  from: string;
  to: string;
};

function toFilterFormState(filters: ExpenseBulkFilters): FilterFormState {
  return {
    search: filters.q ?? "",
    category: filters.category ?? "all",
    paymentStatus: filters.paymentStatus,
    status: filters.status,
    from: filters.from ? formatDateInputValue(filters.from) : "",
    to: filters.to ? formatDateInputValue(filters.to) : "",
  };
}

function parseFilterDate(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function toExpenseDate(date: Date | string) {
  return date instanceof Date ? date : new Date(date);
}

export function ExpenseBulkActionsCenter({
  categories,
  accounts,
  initialFilters,
  initialExpenses,
  initialSummary,
}: ExpenseBulkActionsCenterProps) {
  const router = useRouter();
  const { mutate, isSubmitting: actionLoading } = useTenantMutation({ refresh: false });
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState(initialFilters);
  const [filterForm, setFilterForm] = useState(() => toFilterFormState(initialFilters));
  const [expenses, setExpenses] = useState(initialExpenses);
  const [listSummary, setListSummary] = useState(initialSummary);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initialExpenses.map((expense) => expense.id))
  );
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [bulkCancelOpen, setBulkCancelOpen] = useState(false);
  const [categoryValue, setCategoryValue] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [payAccountId, setPayAccountId] = useState("");

  useEffect(() => {
    setExpenses(initialExpenses);
    setListSummary(initialSummary);
    setFilters(initialFilters);
    setFilterForm(toFilterFormState(initialFilters));
    setSelectedIds(new Set(initialExpenses.map((expense) => expense.id)));
  }, [initialExpenses, initialSummary, initialFilters]);

  useEffect(() => {
    if (!feedback) return;

    const timer = window.setTimeout(() => setFeedback(null), 2400);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const selectedExpenses = useMemo(
    () => expenses.filter((expense) => selectedIds.has(expense.id)),
    [expenses, selectedIds]
  );

  const selectionSummary = useMemo(
    () => summarizeBulkSelection(expenses, selectedIds),
    [expenses, selectedIds]
  );

  const payableSelectedIds = useMemo(
    () =>
      selectedExpenses
        .filter(
          (expense) =>
            !isCancelledExpense(expense.status) && expense.paymentStatus === "UNPAID"
        )
        .map((expense) => expense.id),
    [selectedExpenses]
  );

  const allSelected =
    expenses.length > 0 && selectedExpenses.length === expenses.length;
  const someSelected =
    selectedExpenses.length > 0 && selectedExpenses.length < expenses.length;

  const statCards = [
    {
      label: "Toplam Gider",
      value: String(listSummary.totalCount),
      icon: Receipt,
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "Seçili Gider",
      value: String(selectionSummary.selectedCount),
      icon: CheckCheck,
      color: "bg-violet-50 text-violet-600",
    },
    {
      label: "Ödenmiş",
      value: String(listSummary.paidCount),
      icon: Wallet,
      color: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Ödenmemiş",
      value: String(listSummary.unpaidCount),
      icon: Ban,
      color: "bg-orange-50 text-orange-600",
    },
    {
      label: "Toplam Tutar",
      value: formatExpenseMoney(listSummary.totalAmount),
      icon: Receipt,
      color: "bg-rose-50 text-rose-600",
    },
    {
      label: "Seçili Tutar",
      value: formatExpenseMoney(selectionSummary.selectedAmount),
      icon: CheckCheck,
      color: "bg-cyan-50 text-cyan-600",
    },
  ];

  async function fetchExpenses(nextFilters: ExpenseBulkFilters) {
    const response = await fetch(buildBulkExpenseListQuery(nextFilters));
    const result = (await response.json()) as {
      success?: boolean;
      data?: {
        expenses: BulkExpenseRow[];
        summary: BulkExpenseListSummary;
      };
    };

    if (!response.ok || !result.success || !result.data) {
      throw new Error("Gider listesi alınamadı.");
    }

    setExpenses(result.data.expenses);
    setListSummary(result.data.summary);
    setSelectedIds(new Set(result.data.expenses.map((expense) => expense.id)));
  }

  function applyFilters(nextFilters: ExpenseBulkFilters) {
    setFilters(nextFilters);

    startTransition(async () => {
      try {
        router.replace(buildBulkActionsPageQuery(nextFilters));
        await fetchExpenses(nextFilters);
      } catch {
        setFeedback({
          message: "Filtreler uygulanırken bir hata oluştu.",
          tone: "error",
        });
      }
    });
  }

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextFilters: ExpenseBulkFilters = {
      q: filterForm.search.trim() || null,
      category: filterForm.category === "all" ? null : filterForm.category,
      paymentStatus: filterForm.paymentStatus,
      status: filterForm.status,
      from: parseFilterDate(filterForm.from),
      to: parseFilterDate(filterForm.to),
    };

    applyFilters(nextFilters);
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(
      checked ? new Set(expenses.map((expense) => expense.id)) : new Set()
    );
  }

  function toggleExpense(expenseId: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(expenseId);
      } else {
        next.delete(expenseId);
      }

      return next;
    });
  }

  function handleDownloadCsv() {
    if (selectedExpenses.length === 0) {
      setFeedback({
        message: "CSV indirmek için en az bir gider seçin.",
        tone: "error",
      });
      return;
    }

    const href = buildBulkExpenseExportHref({
      ids: selectedExpenses.map((expense) => expense.id),
    });

    window.location.href = href;
    setFeedback({
      message: `${selectedExpenses.length} gider CSV olarak indiriliyor.`,
      tone: "success",
    });
  }

  async function refreshAfterAction(message: string) {
    setFeedback({ message, tone: "success" });
    notifyTenantCacheSync();

    try {
      await fetchExpenses(filters);
    } catch {
      setFeedback({
        message: "Liste yenilenirken bir hata oluştu.",
        tone: "error",
      });
    }
  }

  async function handleBulkCancel() {
    if (selectedExpenses.length === 0) {
      setFeedback({
        message: "İptal etmek için en az bir gider seçin.",
        tone: "error",
      });
      return;
    }

    setBulkCancelOpen(true);
  }

  async function confirmBulkCancel() {
    const result = await mutate("/api/expenses/bulk/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: selectedExpenses.map((expense) => expense.id),
      }),
    });

    if (!result.ok) {
      if (result.error !== "duplicate_submit") {
        setFeedback({
          message: result.error || "Toplu iptal başarısız.",
          tone: "error",
        });
      }
      return { ok: false, message: result.error || "Toplu iptal başarısız." };
    }

    await refreshAfterAction(
      result.message || `${selectedExpenses.length} gider iptal edildi.`
    );
    return { ok: true };
  }

  function openCategoryModal() {
    if (selectedExpenses.length === 0) {
      setFeedback({
        message: "Kategori değiştirmek için en az bir gider seçin.",
        tone: "error",
      });
      return;
    }

    setCategoryValue(categories[0] ?? "");
    setCustomCategory("");
    setCategoryModalOpen(true);
  }

  async function handleBulkChangeCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const category = (customCategory.trim() || categoryValue).trim();

    if (!category) {
      setFeedback({
        message: "Kategori adı girin.",
        tone: "error",
      });
      return;
    }

    const result = await mutate("/api/expenses/bulk/change-category", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: selectedExpenses.map((expense) => expense.id),
        category,
      }),
    });

    if (!result.ok) {
      if (result.error !== "duplicate_submit") {
        setFeedback({
          message: result.error || "Kategori güncelleme başarısız.",
          tone: "error",
        });
      }
      return;
    }

    setCategoryModalOpen(false);
    await refreshAfterAction(
      result.message || "Seçili giderlerin kategorisi güncellendi."
    );
  }

  function openPayModal() {
    if (payableSelectedIds.length === 0) {
      setFeedback({
        message: "Ödenecek ödenmemiş gider bulunamadı.",
        tone: "error",
      });
      return;
    }

    setPayAccountId(accounts[0]?.id ?? "");
    setPayModalOpen(true);
  }

  async function handleBulkPay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!payAccountId) {
      setFeedback({
        message: "Ödeme hesabı seçin.",
        tone: "error",
      });
      return;
    }

    const result = await mutate("/api/expenses/bulk/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: payableSelectedIds,
        accountId: payAccountId,
      }),
    });

    if (!result.ok) {
      if (result.error !== "duplicate_submit") {
        setFeedback({
          message: result.error || "Toplu ödeme başarısız.",
          tone: "error",
        });
      }
      return;
    }

    setPayModalOpen(false);
    await refreshAfterAction(result.message || "Seçili giderler ödendi.");
  }

  function handlePrint() {
    if (selectedExpenses.length === 0) {
      setFeedback({
        message: "Yazdırmak için en az bir gider seçin.",
        tone: "error",
      });
      return;
    }

    window.print();
  }

  const selectedPayTotal = useMemo(
    () =>
      selectedExpenses
        .filter(
          (expense) =>
            !isCancelledExpense(expense.status) && expense.paymentStatus === "UNPAID"
        )
        .reduce((sum, expense) => sum + expense.amount, 0),
    [selectedExpenses]
  );

  const selectedPayAccount = useMemo(
    () => accounts.find((account) => account.id === payAccountId),
    [accounts, payAccountId]
  );

  const projectedBalance = useMemo(() => {
    if (!selectedPayAccount) {
      return null;
    }

    return Math.round((selectedPayAccount.balance - selectedPayTotal) * 100) / 100;
  }, [selectedPayAccount, selectedPayTotal]);

  return (
    <>
      <div className="space-y-5 print:hidden">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
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
                    <p className="text-[18px] font-black text-[#0f1f4d]">{card.value}</p>
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

              <form
                onSubmit={handleFilterSubmit}
                className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
              >
                <div className="md:col-span-2 xl:col-span-3">
                  <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.08em] text-slate-500">
                    Arama
                  </label>
                  <div className="relative">
                    <Search
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      value={filterForm.search}
                      onChange={(event) =>
                        setFilterForm((current) => ({
                          ...current,
                          search: event.target.value,
                        }))
                      }
                      placeholder="Başlık, kategori, not"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-[13px] font-semibold text-[#0f1f4d] outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <FilterSelect
                  label="Kategori"
                  value={filterForm.category}
                  disabled={isPending}
                  onChange={(value) =>
                    setFilterForm((current) => ({ ...current, category: value }))
                  }
                  options={[
                    { value: "all", label: "Tüm Kategoriler" },
                    ...categories.map((category) => ({
                      value: category,
                      label: category,
                    })),
                  ]}
                />

                <FilterSelect
                  label="Ödeme Durumu"
                  value={filterForm.paymentStatus}
                  disabled={isPending}
                  onChange={(value) =>
                    setFilterForm((current) => ({
                      ...current,
                      paymentStatus: value as ExpenseBulkFilters["paymentStatus"],
                    }))
                  }
                  options={[
                    { value: "all", label: "Tümü" },
                    { value: "PAID", label: "Ödendi" },
                    { value: "UNPAID", label: "Ödenmedi" },
                    { value: "CANCELLED", label: "İptal" },
                  ]}
                />

                <FilterSelect
                  label="Durum"
                  value={filterForm.status}
                  disabled={isPending}
                  onChange={(value) =>
                    setFilterForm((current) => ({
                      ...current,
                      status: value as ExpenseBulkFilters["status"],
                    }))
                  }
                  options={[
                    { value: "all", label: "Tümü" },
                    { value: "ACTIVE", label: "Aktif" },
                    { value: "CANCELLED", label: "İptal" },
                  ]}
                />

                <div>
                  <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.08em] text-slate-500">
                    Başlangıç Tarihi
                  </label>
                  <input
                    type="date"
                    value={filterForm.from}
                    disabled={isPending}
                    onChange={(event) =>
                      setFilterForm((current) => ({
                        ...current,
                        from: event.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-[#0f1f4d] outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.08em] text-slate-500">
                    Bitiş Tarihi
                  </label>
                  <input
                    type="date"
                    value={filterForm.to}
                    disabled={isPending}
                    onChange={(event) =>
                      setFilterForm((current) => ({
                        ...current,
                        to: event.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-[#0f1f4d] outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                  />
                </div>

                <div className="flex items-end md:col-span-2 xl:col-span-3">
                  <Button
                    type="submit"
                    disabled={isPending}
                    className="h-11 rounded-xl bg-blue-600 px-5 text-[13px] font-black text-white hover:bg-blue-700"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Filtreleniyor...
                      </>
                    ) : (
                      "Filtrele"
                    )}
                  </Button>
                </div>
              </form>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[15px] font-black text-[#0f1f4d]">Gider Listesi</p>
                  <p className="mt-1 text-[12px] font-medium text-slate-500">
                    Toplu işlem yapmak istediğiniz giderleri işaretleyin.
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
                <table className="w-full min-w-[1080px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-black text-[#24345f]/80">
                      <th className="px-4 py-3">Seç</th>
                      <th className="px-4 py-3">Tarih</th>
                      <th className="px-4 py-3">Başlık</th>
                      <th className="px-4 py-3">Kategori</th>
                      <th className="px-4 py-3">Tutar</th>
                      <th className="px-4 py-3">Ödeme</th>
                      <th className="px-4 py-3">Hesap</th>
                      <th className="px-4 py-3">Durum</th>
                      <th className="px-4 py-3">Detay</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {expenses.map((expense) => {
                      const statusBadge = getExpenseStatusBadge(expense.status);
                      const paymentBadge = getExpenseDisplayPaymentBadge(expense);
                      const isSelected = selectedIds.has(expense.id);

                      return (
                        <tr
                          key={expense.id}
                          className={[
                            "text-[12px] font-semibold text-[#24345f] transition",
                            isSelected ? "bg-blue-50/40" : "hover:bg-slate-50/80",
                          ].join(" ")}
                        >
                          <td className="px-4 py-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(value) =>
                                toggleExpense(expense.id, value === true)
                              }
                              aria-label={`${expense.title} seç`}
                            />
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                            {formatExpenseDate(toExpenseDate(expense.date))}
                          </td>

                          <td className="px-4 py-3">
                            <p className="font-extrabold text-[#0f1f4d]">{expense.title}</p>
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={[
                                "rounded-md px-2 py-1 text-[10px] font-black",
                                getCategoryBadge(expense.category),
                              ].join(" ")}
                            >
                              {expense.category}
                            </span>
                          </td>

                          <td className="px-4 py-3 font-black text-rose-500">
                            {formatExpenseMoney(expense.amount)}
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={[
                                "rounded-md px-2 py-1 text-[10px] font-black",
                                paymentBadge.className,
                              ].join(" ")}
                            >
                              {paymentBadge.label}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-slate-600">
                            {expense.accountName || "-"}
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

                          <td className="px-4 py-3">
                            <Link
                              href={`/expenses/${expense.id}`}
                              className="font-extrabold text-blue-600 hover:text-blue-700"
                            >
                              Görüntüle
                            </Link>
                          </td>
                        </tr>
                      );
                    })}

                    {expenses.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-5 py-16 text-center">
                          <div className="mx-auto max-w-sm">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-orange-50 text-orange-500">
                              <Receipt size={28} />
                            </div>

                            <p className="mt-4 text-lg font-black text-[#0f1f4d]">
                              Filtreye uygun gider bulunamadı
                            </p>

                            <p className="mt-2 text-sm leading-6 text-slate-500">
                              Farklı filtreler deneyebilir veya yeni gider ekleyebilirsiniz.
                            </p>

                            <Link
                              href="/expenses/new"
                              className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl bg-blue-600 px-5 text-sm font-black text-white"
                            >
                              Yeni Gider Ekle
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
                Seçili Giderler Özeti
              </p>

              <div className="mt-4 space-y-3 rounded-2xl bg-slate-50 p-4 text-[12px]">
                <SummaryLine
                  label="Seçili gider"
                  value={String(selectionSummary.selectedCount)}
                />
                <SummaryLine
                  label="Seçili tutar"
                  value={formatExpenseMoney(selectionSummary.selectedAmount)}
                  valueClass="text-rose-500"
                />
                <SummaryLine
                  label="Ödenmiş tutar"
                  value={formatExpenseMoney(selectionSummary.paidSelectedAmount)}
                  valueClass="text-emerald-600"
                />
                <SummaryLine
                  label="Ödenmemiş tutar"
                  value={formatExpenseMoney(selectionSummary.unpaidSelectedAmount)}
                  valueClass="text-orange-600"
                />
                <SummaryLine
                  label="Önde gelen kategori"
                  value={selectionSummary.topCategory || "-"}
                />
              </div>

              <div className="mt-4 space-y-2">
                <ActionButton
                  icon={<Download size={16} />}
                  label="Seçili CSV indir"
                  onClick={handleDownloadCsv}
                  disabled={selectedExpenses.length === 0 || actionLoading}
                />
                <ActionButton
                  icon={<Ban size={16} />}
                  label="Seçili giderleri iptal et"
                  onClick={() => void handleBulkCancel()}
                  disabled={selectedExpenses.length === 0 || actionLoading}
                />
                <ActionButton
                  icon={<FolderInput size={16} />}
                  label="Seçili kategori değiştir"
                  onClick={openCategoryModal}
                  disabled={selectedExpenses.length === 0 || actionLoading}
                />
                <ActionButton
                  icon={<Wallet size={16} />}
                  label="Seçili ödenmemişleri öde"
                  onClick={openPayModal}
                  disabled={payableSelectedIds.length === 0 || actionLoading}
                />
                <ActionButton
                  icon={<Printer size={16} />}
                  label="Seçili listeyi yazdır"
                  onClick={handlePrint}
                  disabled={selectedExpenses.length === 0}
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
          </aside>
        </section>
      </div>

      <section className="hidden print:block">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-[#0f1f4d]">Seçili Gider Listesi</h1>
          <p className="mt-1 text-sm text-slate-600">
            {selectedExpenses.length} gider · Toplam{" "}
            {formatExpenseMoney(selectionSummary.selectedAmount)}
          </p>
        </div>

        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-300">
              <th className="py-2 pr-3">Tarih</th>
              <th className="py-2 pr-3">Başlık</th>
              <th className="py-2 pr-3">Kategori</th>
              <th className="py-2 pr-3">Tutar</th>
              <th className="py-2 pr-3">Ödeme</th>
              <th className="py-2 pr-3">Hesap</th>
              <th className="py-2">Durum</th>
            </tr>
          </thead>
          <tbody>
            {selectedExpenses.map((expense) => {
              const paymentBadge = getExpenseDisplayPaymentBadge(expense);
              const statusBadge = getExpenseStatusBadge(expense.status);

              return (
                <tr key={expense.id} className="border-b border-slate-200">
                  <td className="py-2 pr-3">
                    {formatExpenseDate(toExpenseDate(expense.date))}
                  </td>
                  <td className="py-2 pr-3">{expense.title}</td>
                  <td className="py-2 pr-3">{expense.category}</td>
                  <td className="py-2 pr-3">{formatExpenseMoney(expense.amount)}</td>
                  <td className="py-2 pr-3">{paymentBadge.label}</td>
                  <td className="py-2 pr-3">{expense.accountName || "-"}</td>
                  <td className="py-2">{statusBadge.label}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {categoryModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 print:hidden">
          <div
            className="absolute inset-0"
            onClick={actionLoading ? undefined : () => setCategoryModalOpen(false)}
            aria-hidden="true"
          />

          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-[16px] font-black text-[#0f1f4d]">
                  Kategori Değiştir
                </h2>
                <p className="mt-1 text-[12px] font-medium text-slate-500">
                  {selectedExpenses.length} gider güncellenecek
                </p>
              </div>

              <button
                type="button"
                onClick={() => setCategoryModalOpen(false)}
                disabled={actionLoading}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-60"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleBulkChangeCategory} className="space-y-4 p-5">
              <Field label="Kategori Seç">
                <select
                  value={categoryValue}
                  onChange={(event) => setCategoryValue(event.target.value)}
                  className={inputClass}
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="veya Yeni Kategori">
                <input
                  value={customCategory}
                  onChange={(event) => setCustomCategory(event.target.value)}
                  placeholder="Yeni kategori adı"
                  className={inputClass}
                />
              </Field>

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 text-[13px] font-black text-white disabled:opacity-60"
                >
                  {actionLoading ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <FolderInput size={16} />
                  )}
                  {actionLoading ? "Kaydediliyor..." : "Kategoriyi Güncelle"}
                </button>

                <button
                  type="button"
                  onClick={() => setCategoryModalOpen(false)}
                  disabled={actionLoading}
                  className="inline-flex h-11 items-center rounded-xl border border-slate-200 px-4 text-[13px] font-black text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                >
                  Vazgeç
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {payModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 print:hidden">
          <div
            className="absolute inset-0"
            onClick={actionLoading ? undefined : () => setPayModalOpen(false)}
            aria-hidden="true"
          />

          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-[16px] font-black text-[#0f1f4d]">
                  Seçili Giderleri Öde
                </h2>
                <p className="mt-1 text-[12px] font-medium text-slate-500">
                  {payableSelectedIds.length} ödenmemiş gider
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPayModalOpen(false)}
                disabled={actionLoading}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-60"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleBulkPay} className="space-y-4 p-5">
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                  Toplam Ödenecek Tutar
                </p>
                <p className="mt-1 text-[20px] font-black text-rose-600">
                  {formatExpenseMoney(selectedPayTotal)}
                </p>
              </div>

              <Field label="Ödeme Hesabı" required>
                <select
                  value={payAccountId}
                  onChange={(event) => setPayAccountId(event.target.value)}
                  required
                  className={inputClass}
                >
                  <option value="">Hesap seçin</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({formatExpenseMoney(account.balance)})
                    </option>
                  ))}
                </select>
              </Field>

              {projectedBalance !== null ? (
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-[12px] font-semibold text-slate-600">
                  İşlem sonrası bakiye:{" "}
                  <span
                    className={
                      projectedBalance < 0
                        ? "font-black text-amber-700"
                        : "font-black text-[#0f1f4d]"
                    }
                  >
                    {formatExpenseMoney(projectedBalance)}
                  </span>
                </div>
              ) : null}

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={actionLoading || accounts.length === 0}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-emerald-500 to-teal-600 text-[13px] font-black text-white disabled:opacity-60"
                >
                  {actionLoading ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <Wallet size={16} />
                  )}
                  {actionLoading ? "Ödeniyor..." : "Ödemeyi Kaydet"}
                </button>

                <button
                  type="button"
                  onClick={() => setPayModalOpen(false)}
                  disabled={actionLoading}
                  className="inline-flex h-11 items-center rounded-xl border border-slate-200 px-4 text-[13px] font-black text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                >
                  Vazgeç
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <TransactionCancelDialog
        open={bulkCancelOpen}
        onOpenChange={setBulkCancelOpen}
        title="Toplu Gider İptali"
        description={`${selectedExpenses.length} gider iptal edilecek.`}
        recordLabel={`${selectedExpenses.length} gider`}
        requiresReason={false}
        confirmLabel="Giderleri İptal Et"
        onConfirm={confirmBulkCancel}
      />
    </>
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

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="text-[12px] font-black text-[#24345f]">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

const inputClass =
  "h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[13px] font-medium text-[#24345f] outline-none focus:border-orange-200 focus:ring-4 focus:ring-orange-50";
