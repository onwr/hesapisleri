"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  Loader2,
  Plus,
  Repeat,
  Save,
  X,
} from "lucide-react";
import {
  CashBankTransferModal,
  type CashBankAccountOption,
} from "@/components/cash-bank/cash-bank-transfer-modal";
import { useTenantMutation } from "@/hooks/use-tenant-mutation";
import { toDateTimeLocalValue } from "@/lib/cash-bank-account-utils";

type AccountDetailActionsProps = {
  accountId: string;
  accountName: string;
  currentBalance: number;
  companyAccounts: CashBankAccountOption[];
  openMovementOnMount?: boolean;
};

type MovementType = "INCOME" | "EXPENSE";

export function AccountDetailActions({
  accountId,
  accountName,
  currentBalance,
  companyAccounts,
  openMovementOnMount = false,
}: AccountDetailActionsProps) {
  const { mutate, isSubmitting } = useTenantMutation<{
    negativeBalanceWarning?: boolean;
  }>({
    refresh: false,
    onSuccess: (data) => {
      if (data?.negativeBalanceWarning) {
        setWarning("Hesap bakiyesi eksiye düştü.");
      }
      setMovementOpen(false);
      setTitle("");
      setAmount("");
      setNote("");
      setMovementDate(toDateTimeLocalValue());
    },
  });
  const [movementOpen, setMovementOpen] = useState(openMovementOnMount);
  const [transferOpen, setTransferOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [movementType, setMovementType] = useState<MovementType>("INCOME");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [movementDate, setMovementDate] = useState(() => toDateTimeLocalValue());

  useEffect(() => {
    if (openMovementOnMount) {
      setMovementOpen(true);
    }
  }, [openMovementOnMount]);

  const projectedBalance = useMemo(() => {
    const parsedAmount = Number(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return null;
    }

    const next =
      movementType === "INCOME"
        ? currentBalance + parsedAmount
        : currentBalance - parsedAmount;

    return Math.round(next * 100) / 100;
  }, [amount, currentBalance, movementType]);

  async function handleExport() {
    setExporting(true);

    try {
      const response = await fetch(`/api/cash-bank/accounts/${accountId}/export`);
      if (!response.ok) {
        setError("CSV dışa aktarılamadı.");
        return;
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `${accountName}.csv`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("CSV indirilirken bir hata oluştu.");
    } finally {
      setExporting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setWarning("");

    const parsedAmount = Number(amount);
    if (!title.trim()) {
      setError("Başlık girin.");
      return;
    }

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Geçerli bir tutar girin.");
      return;
    }

    const result = await mutate(
      `/api/cash-bank/accounts/${accountId}/transactions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: movementType,
          title: title.trim(),
          amount: parsedAmount,
          date: movementDate,
          note: note.trim() || undefined,
        }),
      }
    );

    if (!result.ok && result.error !== "duplicate_submit") {
      setError(result.error || "Hareket kaydedilemedi.");
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMovementOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-linear-to-r from-violet-500 to-purple-600 px-4 text-[12px] font-black text-white shadow-lg shadow-violet-100"
        >
          <Plus size={15} />
          Yeni Hareket
        </button>

        <button
          type="button"
          onClick={() => setTransferOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 text-[12px] font-black text-orange-700"
        >
          <Repeat size={15} />
          Transfer
        </button>

        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-black text-[#24345f] hover:bg-slate-50 disabled:opacity-60"
        >
          {exporting ? (
            <Loader2 className="animate-spin" size={15} />
          ) : (
            <Download size={15} />
          )}
          CSV İndir
        </button>
      </div>

      {error && !movementOpen ? (
        <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-bold text-rose-600">
          {error}
        </div>
      ) : null}

      {movementOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-[15px] font-black text-[#0f1f4d]">
                  Manuel Hareket
                </h3>
                <p className="text-[11px] font-medium text-slate-500">
                  {accountName} hesabına gelir veya gider kaydı ekleyin.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMovementOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMovementType("INCOME")}
                  className={[
                    "flex items-center gap-2 rounded-xl border px-3 py-3 text-left",
                    movementType === "INCOME"
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-slate-200 bg-white",
                  ].join(" ")}
                >
                  <ArrowDownLeft size={16} className="text-emerald-600" />
                  <span className="text-[12px] font-black text-[#0f1f4d]">
                    Giriş
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setMovementType("EXPENSE")}
                  className={[
                    "flex items-center gap-2 rounded-xl border px-3 py-3 text-left",
                    movementType === "EXPENSE"
                      ? "border-rose-300 bg-rose-50"
                      : "border-slate-200 bg-white",
                  ].join(" ")}
                >
                  <ArrowUpRight size={16} className="text-rose-600" />
                  <span className="text-[12px] font-black text-[#0f1f4d]">
                    Çıkış
                  </span>
                </button>
              </div>

              <InputField
                label="Başlık"
                required
                value={title}
                onChange={setTitle}
                placeholder="Örn: Ofis gideri"
              />

              <InputField
                label="Tutar"
                required
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={setAmount}
                placeholder="0.00"
              />

              <InputField
                label="Tarih"
                required
                type="datetime-local"
                value={movementDate}
                onChange={setMovementDate}
              />

              <div>
                <label className="text-[12px] font-black text-[#24345f]">
                  Not
                </label>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] font-medium text-[#24345f] outline-none focus:border-violet-200 focus:ring-4 focus:ring-violet-50"
                  placeholder="Opsiyonel açıklama"
                />
              </div>

              {projectedBalance !== null &&
              movementType === "EXPENSE" &&
              projectedBalance < 0 ? (
                <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[12px] font-bold text-amber-700">
                  Uyarı: İşlem sonrası bakiye {projectedBalance.toFixed(2)} TRY
                  olacak (eksiye düşer).
                </div>
              ) : null}

              {error ? (
                <div className="rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-bold text-rose-600">
                  {error}
                </div>
              ) : null}

              {warning ? (
                <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[12px] font-bold text-amber-700">
                  {warning}
                </div>
              ) : null}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-violet-500 to-purple-600 text-[13px] font-black text-white disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <Save size={18} />
                  )}
                  {isSubmitting ? "Kaydediliyor..." : "Kaydet"}
                </button>

                <button
                  type="button"
                  onClick={() => setMovementOpen(false)}
                  className="h-11 rounded-xl border border-slate-200 px-4 text-[13px] font-black text-slate-600 hover:bg-slate-50"
                >
                  Vazgeç
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <CashBankTransferModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        accounts={companyAccounts}
        defaultFromAccountId={accountId}
      />
    </>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  min,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  min?: string;
  step?: string;
}) {
  return (
    <div>
      <label className="text-[12px] font-black text-[#24345f]">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        min={min}
        step={step}
        placeholder={placeholder}
        className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-[13px] font-semibold text-[#24345f] outline-none focus:border-violet-200 focus:ring-4 focus:ring-violet-50"
      />
    </div>
  );
}
