"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { notifyTenantCacheSync } from "@/lib/tenant-cache/client-tenant-sync";
import {
  AlertTriangle,
  Boxes,
  Edit3,
  Loader2,
  Package,
  Plus,
  Tags,
  Trash2,
} from "lucide-react";
import { DEFAULT_CATEGORY_NAME } from "@/lib/product-form-utils";
import type {
  ProductCategoriesPageSummary,
  ProductCategoryWithStats,
} from "@/lib/product-category-service";
import {
  getProductCategoryColorClass,
  isDefaultProductCategoryName,
  PRODUCT_CATEGORY_COLORS,
  type ProductCategoryColor,
} from "@/lib/product-category-utils";
import {
  formatProductMoney,
  formatProductNumber,
} from "@/lib/products-page-utils";

type ProductCategoriesManagerProps = {
  categories: ProductCategoryWithStats[];
  summary: ProductCategoriesPageSummary;
};

type CategoryFormState = {
  name: string;
  color: ProductCategoryColor;
  note: string;
};

const emptyForm: CategoryFormState = {
  name: "",
  color: "blue",
  note: "",
};

export function ProductCategoriesManager({
  categories,
  summary,
}: ProductCategoriesManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<
    "create" | "edit" | "delete" | null
  >(null);
  const [selectedCategory, setSelectedCategory] =
    useState<ProductCategoryWithStats | null>(null);
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

  function openEditModal(category: ProductCategoryWithStats) {
    setSelectedCategory(category);
    setForm({
      name: category.name,
      color: (category.color as ProductCategoryColor) || "blue",
      note: category.note || "",
    });
    setError(null);
    setModalMode("edit");
  }

  function openDeleteModal(category: ProductCategoryWithStats) {
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
        const response = await fetch("/api/products/categories", {
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
        notifyTenantCacheSync();
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
          `/api/products/categories/${selectedCategory.id}`,
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
        notifyTenantCacheSync();
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
          `/api/products/categories/${selectedCategory.id}`,
          { method: "DELETE" }
        );
        const data = await response.json();

        if (!response.ok || !data.success) {
          setError(data.message || "Kategori silinemedi.");
          return;
        }

        closeModal();
        notifyTenantCacheSync();
      } catch {
        setError("Sunucuya bağlanırken bir hata oluştu.");
      }
    });
  }

  async function handleToggleStatus(category: ProductCategoryWithStats) {
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/products/categories/${category.id}`, {
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

        notifyTenantCacheSync();
      } catch {
        setError("Sunucuya bağlanırken bir hata oluştu.");
      }
    });
  }

  const statCards = [
    {
      label: "Toplam Kategori",
      value: formatProductNumber(summary.totalCategories),
      icon: Tags,
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "Aktif Kategori",
      value: formatProductNumber(summary.activeCategories),
      icon: Package,
      color: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Toplam Ürün",
      value: formatProductNumber(summary.totalProducts),
      icon: Boxes,
      color: "bg-violet-50 text-violet-600",
    },
    {
      label: "Düşük Stoklu Ürün",
      value: formatProductNumber(summary.lowStockProducts),
      icon: AlertTriangle,
      color: "bg-orange-50 text-orange-600",
    },
    {
      label: "Kategorisiz Ürün",
      value: formatProductNumber(summary.uncategorizedProducts),
      icon: Tags,
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
                        getProductCategoryColorClass(category.color),
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
                    {formatProductNumber(category.productCount)} ürün
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-3 text-[12px]">
                <StatLine
                  label="Toplam Stok"
                  value={formatProductNumber(category.totalStock)}
                />
                <StatLine
                  label="Stok Değeri"
                  value={formatProductMoney(category.stockValue)}
                />
                <StatLine
                  label="Düşük Stok"
                  value={formatProductNumber(category.lowStockCount)}
                  valueClass="text-orange-600"
                />
              </div>

              {category.note ? (
                <p className="mt-3 text-[11px] leading-5 text-slate-500">
                  {category.note}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/products?category=${encodeURIComponent(category.name)}`}
                  className="inline-flex h-9 items-center justify-center rounded-xl bg-blue-600 px-3 text-[11px] font-black text-white transition hover:bg-blue-700"
                >
                  Ürünleri Gör
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
                    isPending || isDefaultProductCategoryName(category.name)
                  }
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-black text-[#24345f] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {category.status === "ACTIVE" ? "Pasife Al" : "Aktife Al"}
                </button>

                <button
                  type="button"
                  onClick={() => openDeleteModal(category)}
                  disabled={
                    isPending || isDefaultProductCategoryName(category.name)
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
              Kategoriler ürün listeleme, stok takibi ve satış dağılımı için
              merkezi sözlük görevi görür.
            </li>
            <li>
              Ürün formlarında kategori seçimi bu listeden yapılır; boş bırakılırsa
              &quot;{DEFAULT_CATEGORY_NAME}&quot; kullanılır.
            </li>
            <li>
              İçinde ürün bulunan kategori silinemez; önce ürünleri taşıyın.
            </li>
            <li>
              &quot;{DEFAULT_CATEGORY_NAME}&quot; kategorisi silinemez ve pasife
              alınamaz.
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
                misiniz? Bu kategoride ürün varsa silme işlemi engellenir.
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
                    placeholder="Örn. Elektronik"
                  />
                </div>

                <div>
                  <label className="text-[12px] font-black text-[#24345f]">
                    Renk
                  </label>
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {PRODUCT_CATEGORY_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({ ...prev, color }))
                        }
                        className={[
                          "rounded-xl border px-3 py-2 text-[11px] font-black capitalize transition",
                          getProductCategoryColorClass(color),
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
