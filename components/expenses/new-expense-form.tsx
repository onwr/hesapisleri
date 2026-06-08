"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeft,
  CalendarDays,
  FileText,
  Landmark,
  Loader2,
  ReceiptText,
  Save,
  Sparkles,
  Store,
  Tag,
  TurkishLira,
  Wallet,
} from "lucide-react";
import { AppLoadingScreen } from "@/components/layout/app-loading-screen";
import type { ExpensePaymentStatus } from "@/lib/expense-utils";
import { formatExpenseMoney } from "@/lib/expenses-page-utils";

type AccountOption = {
  id: string;
  name: string;
  type: string;
  balance: number;
};

type NewExpenseFormProps = {
  accounts: AccountOption[];
  categories: string[];
};

export function NewExpenseForm({ accounts, categories }: NewExpenseFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    title: "",
    category: categories.includes("Diğer")
      ? "Diğer"
      : (categories[0] ?? ""),
    supplier: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    note: "",
    paymentStatus: "UNPAID" as ExpensePaymentStatus,
    accountId: "",
  });

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === form.accountId),
    [accounts, form.accountId]
  );

  const projectedBalance = useMemo(() => {
    const parsedAmount = Number(form.amount);
    if (
      form.paymentStatus !== "PAID" ||
      !selectedAccount ||
      Number.isNaN(parsedAmount) ||
      parsedAmount <= 0
    ) {
      return null;
    }

    return Math.round((selectedAccount.balance - parsedAmount) * 100) / 100;
  }, [form.amount, form.paymentStatus, selectedAccount]);

  function updateForm<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setFieldErrors({});

    const parsedAmount = Number(form.amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Geçerli bir tutar girin.");
      setSaving(false);
      return;
    }

    if (form.paymentStatus === "PAID" && !form.accountId) {
      setFieldErrors({ accountId: "Ödenmiş gider için hesap seçin." });
      setError("Ödenmiş gider için ödeme hesabı seçilmelidir.");
      setSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/expenses/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          category: form.category.trim() || undefined,
          supplier: form.supplier.trim() || undefined,
          amount: parsedAmount,
          date: form.date,
          note: form.note.trim() || undefined,
          paymentStatus: form.paymentStatus,
          accountId: form.paymentStatus === "PAID" ? form.accountId : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setFieldErrors(data.errors ?? {});
        setError(data.message || "Gider oluşturulamadı.");
        return;
      }

      router.push(`/expenses/${data.data.id}`);
      router.refresh();
    } catch {
      setError("Sunucuya bağlanırken bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {saving ? (
        <AppLoadingScreen
          preset="expenses"
          title="Gider kaydediliyor"
          subtitle="Gider kaydı oluşturuluyor..."
        />
      ) : null}

      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <Link
                href="/expenses"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0f1f4d] transition hover:bg-slate-50"
              >
                <ArrowLeft size={18} strokeWidth={2.6} />
              </Link>

              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-[11px] font-black text-orange-600">
                  <Sparkles size={14} strokeWidth={2.5} />
                  Yeni Gider
                </div>
                <h1 className="text-[26px] font-black tracking-tighter text-[#0f1f4d]">
                  Gider Kaydı Oluştur
                </h1>
                <p className="mt-1 max-w-2xl text-[13px] font-medium leading-6 text-slate-500">
                  Ödenmiş giderler seçilen kasa/banka hesabından düşülür. Ödenmemiş
                  giderler yalnızca kayıt olarak kalır.
                </p>
              </div>
            </div>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="grid gap-5 xl:grid-cols-[1fr_340px]">
          <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <div className="border-b border-slate-100 p-4">
              <h2 className="text-[16px] font-black text-[#0f1f4d]">Gider Bilgileri</h2>
            </div>

            <div className="space-y-4 p-4">
              <Field label="Gider Başlığı" required error={fieldErrors.title}>
                <input
                  value={form.title}
                  onChange={(event) => updateForm("title", event.target.value)}
                  required
                  minLength={2}
                  className={inputClass(Boolean(fieldErrors.title))}
                  placeholder="Kira, elektrik, reklam gideri..."
                />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Kategori" error={fieldErrors.category}>
                  <select
                    value={form.category}
                    onChange={(event) => updateForm("category", event.target.value)}
                    className={inputClass(Boolean(fieldErrors.category))}
                  >
                    {categories.length === 0 ? (
                      <option value="Diğer">Diğer</option>
                    ) : (
                      categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))
                    )}
                  </select>
                </Field>

                <Field label="Tedarikçi / Firma">
                  <input
                    value={form.supplier}
                    onChange={(event) => updateForm("supplier", event.target.value)}
                    className={inputClass(false)}
                    placeholder="Opsiyonel"
                  />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Tutar" required error={fieldErrors.amount}>
                  <input
                    value={form.amount}
                    onChange={(event) => updateForm("amount", event.target.value)}
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    className={inputClass(Boolean(fieldErrors.amount))}
                    placeholder="0.00"
                  />
                </Field>

                <Field label="Tarih" required error={fieldErrors.date}>
                  <input
                    value={form.date}
                    onChange={(event) => updateForm("date", event.target.value)}
                    type="date"
                    required
                    className={inputClass(Boolean(fieldErrors.date))}
                  />
                </Field>
              </div>

              <Field label="Not">
                <textarea
                  value={form.note}
                  onChange={(event) => updateForm("note", event.target.value)}
                  className="min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-[13px] font-medium text-[#24345f] outline-none focus:border-orange-200 focus:ring-4 focus:ring-orange-50"
                  placeholder="Giderle ilgili açıklama"
                />
              </Field>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <h3 className="text-[14px] font-black text-[#0f1f4d]">Ödeme Durumu</h3>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => updateForm("paymentStatus", "PAID")}
                  className={[
                    "rounded-xl border px-3 py-3 text-left",
                    form.paymentStatus === "PAID"
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-slate-200 bg-white",
                  ].join(" ")}
                >
                  <ArrowDownLeft size={16} className="text-emerald-600" />
                  <p className="mt-2 text-[12px] font-black text-[#0f1f4d]">Ödendi</p>
                </button>

                <button
                  type="button"
                  onClick={() => updateForm("paymentStatus", "UNPAID")}
                  className={[
                    "rounded-xl border px-3 py-3 text-left",
                    form.paymentStatus === "UNPAID"
                      ? "border-orange-300 bg-orange-50"
                      : "border-slate-200 bg-white",
                  ].join(" ")}
                >
                  <ReceiptText size={16} className="text-orange-600" />
                  <p className="mt-2 text-[12px] font-black text-[#0f1f4d]">
                    Ödenmedi
                  </p>
                </button>
              </div>

              {form.paymentStatus === "PAID" ? (
                <div className="mt-4">
                  <Field label="Ödeme Hesabı" required error={fieldErrors.accountId}>
                    <select
                      value={form.accountId}
                      onChange={(event) => updateForm("accountId", event.target.value)}
                      required
                      className={inputClass(Boolean(fieldErrors.accountId))}
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
                    <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-[12px] font-semibold text-slate-600">
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
                </div>
              ) : (
                <p className="mt-4 rounded-xl border border-orange-100 bg-orange-50 px-3 py-2 text-[12px] font-medium text-orange-700">
                  Ödenmemiş giderler raporda kayıtlı gider olarak görünür; kasa/banka
                  bakiyesini etkilemez.
                </p>
              )}
            </section>

            {error ? (
              <div className="rounded-2xl bg-rose-50 px-4 py-3 text-[12px] font-bold text-rose-600">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={saving}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-orange-500 to-amber-600 text-[13px] font-black text-white shadow-lg shadow-orange-100 disabled:opacity-60"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                {saving ? "Kaydediliyor..." : "Gideri Kaydet"}
              </button>

              <Link
                href="/expenses"
                className="flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[13px] font-black text-slate-600 hover:bg-slate-50"
              >
                Vazgeç
              </Link>
            </div>
          </aside>
        </form>
      </div>
    </>
  );
}

function Field({
  label,
  required = false,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[12px] font-black text-[#24345f]">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </label>
      <div className="mt-2">{children}</div>
      {error ? (
        <p className="mt-2 text-[11px] font-bold text-rose-500">{error}</p>
      ) : null}
    </div>
  );
}

function inputClass(hasError: boolean) {
  return [
    "h-12 w-full rounded-2xl border bg-white px-4 text-[13px] font-medium text-[#24345f] outline-none transition focus:ring-4",
    hasError
      ? "border-rose-300 focus:border-rose-300 focus:ring-rose-50"
      : "border-slate-200 focus:border-orange-200 focus:ring-orange-50",
  ].join(" ");
}
