"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Edit3,
  Loader2,
  Plus,
  Receipt,
  Tags,
  Trash2,
  Wallet,
} from "lucide-react";
import type {
  ExpenseCategoriesPageSummary,
  ExpenseCategoryWithStats,
} from "@/lib/expense-category-service";
import {
  DEFAULT_EXPENSE_CATEGORY_NAME,
  EXPENSE_CATEGORY_COLORS,
  getExpenseCategoryColorClass,
  isDefaultExpenseCategoryName,
  type ExpenseCategoryColor,
} from "@/lib/expense-category-utils";
import {
  formatExpenseDate,
  formatExpenseMoney,
} from "@/lib/expenses-page-utils";

type ExpenseCategoriesManagerProps = {
  categories: ExpenseCategoryWithStats[];
  summary: ExpenseCategoriesPageSummary;
};

type CategoryFormState = {
  name: string;
  color: ExpenseCategoryColor;
  note: string;
};

const emptyForm: CategoryFormState = {
  name: "",
  color: "blue",
  note: "",
};

function formatCount(value: number) {
  return new Intl.NumberFormat("tr-TR").format(value);
}

export function ExpenseCategoriesManager({
  categories,
  summary,
}: ExpenseCategoriesManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<
    "create" | "edit" | "delete" | null
  >(null);
  const [selectedCategory, setSelectedCategory] =
    useState<ExpenseCategoryWithStats | null>(null);
  const [form, setForm] = useState<CategoryFormState>(emptyForm);

  const sortedCategories = useMemo(
    () =>
      [...categories].sort(
        (a, b) =>
          a.sortOrder - b.sortOrder ||
          a.name.localeCompare(b.name, "tr-TR")
      ),
    [categories]
  );

  function openCreateModal() {
    setSelectedCategory(null);
    setForm(emptyForm);
    setError(null);
    setModalMode("create");
  }

  function openEditModal(category: ExpenseCategoryWithStats) {
    setSelectedCategory(category);
    setForm({
      name: category.name,
      color: (category.color as ExpenseCategoryColor) || "blue",
      note: category.note || "",
    });
    setError(null);
    setModalMode("edit");
  }

  function openDeleteModal(category: ExpenseCategoryWithStats) {
    setSelectedCategory(category);
    setError(null);
    setModalMode("delete");
  }

  function closeModal() {
    setModalMode(null);
    setSelectedCategory(null);
    setError(null);
  }

  async function handleCreate() {
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/expenses/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          setError(data.message || "Kategori oluşturulamadı.");
          return;
        }

        closeModal();
        router.refresh();
      } catch {
        setError("Sunucuya bağlanırken bir hata oluştu.");
      }
    });
  }

  async function handleUpdate() {
    if (!selectedCategory) return;
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/expenses/categories/${selectedCategory.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          }
        );
        const data = await response.json();

        if (!response.ok || !data.success) {
          setError(data.message || "Kategori güncellenemedi.");
          return;
        }

        closeModal();
        router.refresh();
      } catch {
        setError("Sunucuya bağlanırken bir hata oluştu.");
      }
    });
  }

  async function handleDelete() {
    if (!selectedCategory) return;
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/expenses/categories/${selectedCategory.id}`,
          { method: "DELETE" }
        );
        const data = await response.json();

        if (!response.ok || !data.success) {
          setError(data.message || "Kategori silinemedi.");
          return;
        }

        closeModal();
        router.refresh();
      } catch {
        setError("Sunucuya bağlanırken bir hata oluştu.");
      }
    });
  }

  async function handleToggleStatus(category: ExpenseCategoryWithStats) {
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/expenses/categories/${category.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: category.status === "ACTIVE" ? "PASSIVE" : "ACTIVE",
          }),
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          setError(data.message || "Kategori durumu güncellenemedi.");
          return;
        }

        router.refresh();
      } catch {
        setError("Sunucuya bağlanırken bir hata oluştu.");
      }
    });
  }

  const statCards = [
    {
      label: "Toplam Kategori",
      value: formatCount(summary.totalCategories),
      icon: Tags,
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "Aktif Kategori",
      value: formatCount(summary.activeCategories),
      icon: Receipt,
      color: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Toplam Gider",
      value: formatExpenseMoney(summary.totalExpenseAmount),
      icon: Wallet,
      color: "bg-violet-50 text-violet-600",
    },
    {
      label: "Bu Ay Gider",
      value: formatExpenseMoney(summary.thisMonthAmount),
      icon: CalendarDays,
      color: "bg-orange-50 text-orange-600",
    },
    {
      label: "Ödenmemiş Gider",
      value: formatExpenseMoney(summary.unpaidAmount),
      icon: AlertTriangle,
      color: "bg-rose-50 text-rose-600",
    },
  ];

  return (
    <>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-linear-to-r from-blue-600 to-violet-600 px-5 text-[13px] font-black text-white shadow-lg shadow-blue-100 transition hover:opacity-95"
        >
          <Plus size={16} />
          Yeni Kategori
        </button>
      </div>

      {error && !modalMode ? (
        <div className="rounded-2xl bg-rose-50 px-4 py-3 text-[12px] font-bold text-rose-600">
          {error}
        </div>
      ) : null}

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

      <section className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="grid gap-4 md:grid-cols-2">
          {sortedCategories.map((category) => (
            <article
              key={category.id}
              className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={[
                        "rounded-md px-2 py-1 text-[10px] font-black",
                        getExpenseCategoryColorClass(category.color),
                      ].join(" ")}
                    >
                      {category.name}
                    </span>
                    <span
                      className={[
                        "rounded-md px-2 py-1 text-[10px] font-black",
                        category.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600",
                      ].join(" ")}
                    >
                      {category.status === "ACTIVE" ? "Aktif" : "Pasif"}
                    </span>
                  </div>
                  <p className="mt-3 text-[13px] font-medium text-slate-500">
                    {formatCount(category.expenseCount)} gider
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-3 text-[12px]">
                <StatLine
                  label="Toplam Tutar"
                  value={formatExpenseMoney(category.totalAmount)}
                />
                <StatLine
                  label="Ödenen"
                  value={formatExpenseMoney(category.paidAmount)}
                  valueClass="text-emerald-600"
                />
                <StatLine
                  label="Ödenmemiş"
                  value={formatExpenseMoney(category.unpaidAmount)}
                  valueClass="text-rose-600"
                />
                <StatLine
                  label="Bu Ay"
                  value={formatExpenseMoney(category.thisMonthAmount)}
                />
                <StatLine
                  label="Son Gider"
                  value={
                    category.lastExpenseDate
                      ? formatExpenseDate(new Date(category.lastExpenseDate))
                      : "—"
                  }
                />
              </div>

              {category.note ? (
                <p className="mt-3 text-[11px] leading-5 text-slate-500">
                  {category.note}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/expenses?category=${encodeURIComponent(category.name)}`}
                  className="inline-flex h-9 items-center justify-center rounded-xl bg-blue-600 px-3 text-[11px] font-black text-white transition hover:bg-blue-700"
                >
                  Giderleri Gör
                </Link>

                <button
                  type="button"
                  onClick={() => openEditModal(category)}
                  className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-black text-[#24345f] transition hover:bg-slate-50"
                >
                  <Edit3 size={14} />
                  Düzenle
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleStatus(category)}
                  disabled={
                    isPending || isDefaultExpenseCategoryName(category.name)
                  }
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-black text-[#24345f] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {category.status === "ACTIVE" ? "Pasife Al" : "Aktife Al"}
                </button>

                <button
                  type="button"
                  onClick={() => openDeleteModal(category)}
                  disabled={
                    isPending || isDefaultExpenseCategoryName(category.name)
                  }
                  className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 text-[11px] font-black text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  Sil
                </button>
              </div>
            </article>
          ))}
        </div>

        <aside className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
          <h2 className="text-[16px] font-black text-[#0f1f4d]">
            Kategori yönetimi ipuçları
          </h2>
          <ul className="mt-4 space-y-3 text-[12px] leading-6 text-slate-600">
            <li>
              Gider kategorileri harcama takibi, raporlama ve bütçe analizi için
              merkezi sözlük görevi görür.
            </li>
            <li>
              Gider formlarında kategori seçimi bu listeden yapılır; boş
              bırakılırsa &quot;{DEFAULT_EXPENSE_CATEGORY_NAME}&quot; kullanılır.
            </li>
            <li>
              İçinde gider bulunan kategori silinemez; önce giderleri taşıyın
              veya kategoriyi pasife alın.
            </li>
            <li>
              &quot;{DEFAULT_EXPENSE_CATEGORY_NAME}&quot; kategorisi silinemez ve
              pasife alınamaz.
            </li>
          </ul>
        </aside>
      </section>

      {modalMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-black text-[#0f1f4d]">
              {modalMode === "create"
                ? "Yeni Kategori Oluştur"
                : modalMode === "edit"
                  ? "Kategoriyi Düzenle"
                  : "Kategoriyi Sil"}
            </h3>

            {modalMode === "delete" ? (
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {selectedCategory?.name} kategorisini silmek istediğinize emin
                misiniz? Bu kategoride gider varsa silme işlemi engellenir.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="text-[12px] font-black text-[#24345f]">
                    Kategori Adı
                  </label>
                  <input
                    value={form.name}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-4 text-[13px] font-bold text-[#0f1f4d] outline-none focus:border-blue-200 focus:ring-4 focus:ring-blue-50"
                    placeholder="Örn. Kira"
                  />
                </div>

                <div>
                  <label className="text-[12px] font-black text-[#24345f]">
                    Renk
                  </label>
                  <div className="mt-2 grid grid-cols-5 gap-2">
                    {EXPENSE_CATEGORY_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({ ...prev, color }))
                        }
                        className={[
                          "rounded-xl border px-2 py-2 text-[10px] font-black capitalize transition",
                          getExpenseCategoryColorClass(color),
                          form.color === color
                            ? "ring-2 ring-blue-300 ring-offset-2"
                            : "border-transparent",
                        ].join(" ")}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[12px] font-black text-[#24345f]">
                    Not
                  </label>
                  <textarea
                    value={form.note}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, note: event.target.value }))
                    }
                    className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 px-4 py-3 text-[13px] font-medium text-[#24345f] outline-none focus:border-blue-200 focus:ring-4 focus:ring-blue-50"
                    placeholder="Opsiyonel açıklama"
                  />
                </div>
              </div>
            )}

            {error ? (
              <p className="mt-4 text-[12px] font-bold text-rose-600">{error}</p>
            ) : null}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={closeModal}
                disabled={isPending}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-black text-[#24345f]"
              >
                Vazgeç
              </button>

              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  if (modalMode === "create") void handleCreate();
                  else if (modalMode === "edit") void handleUpdate();
                  else void handleDelete();
                }}
                className={[
                  "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-black text-white",
                  modalMode === "delete"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-blue-600 hover:bg-blue-700",
                ].join(" ")}
              >
                {isPending ? <Loader2 className="animate-spin" size={16} /> : null}
                {modalMode === "create"
                  ? "Oluştur"
                  : modalMode === "edit"
                    ? "Kaydet"
                    : "Sil"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function StatLine({
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
