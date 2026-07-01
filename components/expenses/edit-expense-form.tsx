"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { AppLoadingScreen } from "@/components/layout/app-loading-screen";
import { useTenantMutation } from "@/hooks/use-tenant-mutation";

type EditExpenseFormProps = {
  expense: {
    id: string;
    title: string;
    category: string | null;
    supplier: string | null;
    amount: number;
    paymentStatus: string;
    date: string;
    note: string | null;
    status: string;
  };
  categories: string[];
};

export function EditExpenseForm({ expense, categories }: EditExpenseFormProps) {
  const router = useRouter();
  const { mutate, isSubmitting } = useTenantMutation({ refresh: false });
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    title: expense.title,
    category: expense.category?.trim() || "Diğer",
    supplier: expense.supplier ?? "",
    amount: String(expense.amount),
    date: expense.date,
    note: expense.note ?? "",
  });

  const isPaid = expense.paymentStatus === "PAID";

  const categoryOptions = useMemo(() => {
    const currentCategory = form.category.trim();

    if (!currentCategory || categories.includes(currentCategory)) {
      return categories;
    }

    return [currentCategory, ...categories];
  }, [categories, form.category]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      category: form.category.trim() || undefined,
      supplier: form.supplier.trim() || undefined,
      date: form.date,
      note: form.note.trim() || undefined,
    };

    if (!isPaid) {
      const parsedAmount = Number(form.amount);
      if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        setError("Geçerli bir tutar girin.");
        return;
      }
      payload.amount = parsedAmount;
    }

    const result = await mutate(`/api/expenses/${expense.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!result.ok) {
      if (result.error !== "duplicate_submit") {
        setError(result.error || "Gider güncellenemedi.");
      }
      return;
    }

    router.push(`/expenses/${expense.id}`);
  }

  return (
    <>
      {isSubmitting ? (
        <AppLoadingScreen
          preset="expenses"
          title="Gider güncelleniyor"
          subtitle="Değişiklikler kaydediliyor..."
        />
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        {isPaid ? (
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-[12px] font-medium text-amber-800">
            Ödenmiş giderlerde tutar ve ödeme hesabı değiştirilemez. Yalnızca
            başlık, kategori, tarih ve not güncellenebilir.
          </div>
        ) : (
          <div className="rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-[12px] font-medium text-orange-800">
            Ödenmemiş giderlerde tutar düzenlenebilir. Ödeme hesabı bağlantısı
            henüz sonradan eklenemez; ödeme için yeni gider kaydı oluşturun.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Gider Başlığı" required>
            <input
              value={form.title}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, title: event.target.value }))
              }
              required
              className={inputClass}
            />
          </Field>

          <Field label="Kategori">
            <select
              value={form.category}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, category: event.target.value }))
              }
              className={inputClass}
            >
              {categoryOptions.length === 0 ? (
                <option value="Diğer">Diğer</option>
              ) : (
                categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))
              )}
            </select>
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Tedarikçi / Firma">
            <input
              value={form.supplier}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, supplier: event.target.value }))
              }
              className={inputClass}
            />
          </Field>

          {!isPaid ? (
            <Field label="Tutar" required>
              <input
                value={form.amount}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, amount: event.target.value }))
                }
                type="number"
                min="0.01"
                step="0.01"
                required
                className={inputClass}
              />
            </Field>
          ) : (
            <Field label="Tutar">
              <input
                value={form.amount}
                readOnly
                disabled
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-[13px] font-medium text-slate-500"
              />
            </Field>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Tarih" required>
            <input
              value={form.date}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, date: event.target.value }))
              }
              type="date"
              required
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Not">
          <textarea
            value={form.note}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, note: event.target.value }))
            }
            className="min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-[13px] font-medium text-[#24345f] outline-none focus:border-orange-200 focus:ring-4 focus:ring-orange-50"
          />
        </Field>

        {error ? (
          <div className="rounded-2xl bg-rose-50 px-4 py-3 text-[12px] font-bold text-rose-600">
            {error}
          </div>
        ) : null}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-linear-to-r from-orange-500 to-amber-600 px-5 text-[13px] font-black text-white disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Kaydet
          </button>

          <Link
            href={`/expenses/${expense.id}`}
            className="inline-flex h-11 items-center rounded-xl border border-slate-200 px-5 text-[13px] font-black text-slate-600 hover:bg-slate-50"
          >
            Vazgeç
          </Link>
        </div>
      </form>
    </>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
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
