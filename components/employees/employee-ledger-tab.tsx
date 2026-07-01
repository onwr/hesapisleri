"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { FinanceAccountSelect } from "@/components/cash-bank/finance-account-select";
import { TEAM_CARD_CLASS } from "@/components/team/team-ui-tokens";
import { buildEmployeePaymentTransactionHref } from "@/lib/employee-payment-finance-utils";
import {
  EMPLOYEE_PAYMENT_ACCOUNT_EMPTY_MESSAGE,
  type FinanceAccountOption,
} from "@/lib/finance-account-utils";
import { useFinanceAccounts } from "@/hooks/use-finance-accounts";
import {
  formatEmployeeLedgerBalanceLabel,
  getEmployeeLedgerBalanceTone,
  type EmployeeLedgerRow,
} from "@/lib/employee-ledger-utils";
import { formatEmployeeDate } from "@/lib/employee-page-utils";
import { formatMoney } from "@/lib/format-utils";

type LedgerActionType =
  | "SALARY_ACCRUAL"
  | "SALARY_PAYMENT"
  | "ADVANCE"
  | "BONUS"
  | "DEDUCTION"
  | "ADJUSTMENT";

type EmployeeLedgerTabProps = {
  employeeId: string;
  canProcessPayments: boolean;
  onReloadEmployee: () => Promise<void>;
};

type AccountOption = FinanceAccountOption;

const ACTION_LABELS: Record<LedgerActionType, string> = {
  SALARY_ACCRUAL: "Maaş Tahakkuk Et",
  SALARY_PAYMENT: "Ödeme Yap",
  ADVANCE: "Çalışana Avans Ver",
  BONUS: "Prim Öde",
  DEDUCTION: "Kesinti Ekle",
  ADJUSTMENT: "Düzeltme Ekle",
};

export function EmployeeLedgerTab({
  employeeId,
  canProcessPayments,
  onReloadEmployee,
}: EmployeeLedgerTabProps) {
  const [entries, setEntries] = useState<EmployeeLedgerRow[]>([]);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modalType, setModalType] = useState<LedgerActionType | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [accountId, setAccountId] = useState("");
  const [description, setDescription] = useState("");
  const [direction, setDirection] = useState<"DEBIT" | "CREDIT">("DEBIT");
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const { accounts: financeAccounts, loading: financeAccountsLoading } =
    useFinanceAccounts();

  async function loadLedger() {
    setLoading(true);
    try {
      const res = await fetch(`/api/employees/${employeeId}/ledger`);
      const json = await res.json();
      if (json.success) {
        setEntries(json.entries ?? []);
        setCurrentBalance(json.currentBalance ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }

  const needsAccount =
    modalType === "SALARY_PAYMENT" ||
    modalType === "ADVANCE" ||
    modalType === "BONUS";

  useEffect(() => {
    void loadLedger();
  }, [employeeId]);

  useEffect(() => {
    if (!canProcessPayments || !modalType || !needsAccount) return;
    setAccounts(financeAccounts);
  }, [canProcessPayments, modalType, needsAccount, financeAccounts]);

  function openModal(type: LedgerActionType) {
    setModalType(type);
    setAmount("");
    setDate(new Date().toISOString().slice(0, 10));
    setAccountId("");
    setDescription("");
    setDirection("DEBIT");
    setError("");
  }

  async function submitMovement() {
    if (!modalType) return;
    if (needsAccount && !accountId.trim()) {
      setError("Ödeme yapılacak kasa veya banka hesabını seçin.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/employees/${employeeId}/ledger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: modalType,
          amount: Number(amount),
          date,
          accountId: needsAccount ? accountId : undefined,
          description: description || undefined,
          direction: modalType === "ADJUSTMENT" ? direction : undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message ?? "İşlem kaydedilemedi.");
        return;
      }

      setEntries(json.ledger?.entries ?? []);
      setCurrentBalance(json.ledger?.currentBalance ?? 0);
      setModalType(null);
      await onReloadEmployee();
    } finally {
      setSaving(false);
    }
  }

  const balanceTone = getEmployeeLedgerBalanceTone(currentBalance);
  const balanceClass =
    balanceTone === "debt"
      ? "text-emerald-700 bg-emerald-50 ring-emerald-100"
      : balanceTone === "credit"
        ? "text-amber-700 bg-amber-50 ring-amber-100"
        : "text-slate-700 bg-slate-50 ring-slate-200";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          className={[
            "inline-flex rounded-full px-3 py-1.5 text-xs font-black ring-1 ring-inset",
            balanceClass,
          ].join(" ")}
        >
          Güncel Cari: {formatEmployeeLedgerBalanceLabel(currentBalance)}
        </div>

        {canProcessPayments ? (
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ACTION_LABELS) as LedgerActionType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => openModal(type)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-black text-[#0f1f4d] transition hover:bg-slate-50"
              >
                <Plus size={13} />
                {ACTION_LABELS[type]}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <section className={[TEAM_CARD_CLASS, "overflow-hidden"].join(" ")}>
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm font-semibold text-slate-500">
            <Loader2 size={16} className="animate-spin" />
            Cari hareketler yükleniyor...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[880px] w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-[11px] font-black uppercase text-slate-400">
                  <th className="px-4 py-3">Tarih</th>
                  <th className="px-4 py-3">Hareket Tipi</th>
                  <th className="px-4 py-3">Açıklama</th>
                  <th className="px-4 py-3">Şirket Borcu</th>
                  <th className="px-4 py-3">Mahsup</th>
                  <th className="px-4 py-3">Bakiye</th>
                  <th className="px-4 py-3">Hesap</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-sm font-medium text-slate-500"
                    >
                      Henüz cari hareket kaydı yok.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-slate-50">
                      <td className="px-4 py-3 text-slate-500">
                        {formatEmployeeDate(entry.date)}
                      </td>
                      <td className="px-4 py-3 font-bold text-[#0f1f4d]">
                        {entry.typeLabel}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {entry.description}
                      </td>
                      <td className="px-4 py-3 font-semibold text-emerald-700">
                        {entry.debit > 0 ? formatMoney(entry.debit) : "—"}
                      </td>
                      <td className="px-4 py-3 font-semibold text-amber-700">
                        {entry.credit > 0 ? formatMoney(entry.credit) : "—"}
                      </td>
                      <td className="px-4 py-3 font-black text-[#0f1f4d]">
                        {formatMoney(entry.balance)}
                      </td>
                      <td className="px-4 py-3">
                        {entry.relatedTransactionId ? (
                          <Link
                            href={buildEmployeePaymentTransactionHref({
                              transactionId: entry.relatedTransactionId,
                              accountId: entry.accountId,
                            })}
                            className="text-xs font-bold text-blue-600 hover:underline"
                          >
                            Kasa/Banka
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modalType ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
          <div className={[TEAM_CARD_CLASS, "w-full max-w-md p-5"].join(" ")}>
            <h3 className="text-base font-black text-[#0f1f4d]">
              {ACTION_LABELS[modalType]}
            </h3>

            <div className="mt-4 space-y-3">
              <label className="block space-y-1">
                <span className="text-xs font-bold text-slate-500">Tutar</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-bold text-slate-500">Tarih</span>
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold"
                />
              </label>

              {needsAccount ? (
                <FinanceAccountSelect
                  accounts={accounts}
                  value={accountId}
                  onChange={setAccountId}
                  disabled={financeAccountsLoading}
                  required
                  showSetupLink={false}
                  emptyMessage={EMPLOYEE_PAYMENT_ACCOUNT_EMPTY_MESSAGE}
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold"
                />
              ) : null}

              {modalType === "ADJUSTMENT" ? (
                <label className="block space-y-1">
                  <span className="text-xs font-bold text-slate-500">Yön</span>
                  <select
                    value={direction}
                    onChange={(event) =>
                      setDirection(event.target.value as "DEBIT" | "CREDIT")
                    }
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold"
                  >
                    <option value="DEBIT">Şirket borcu artır</option>
                    <option value="CREDIT">Mahsup / ödeme</option>
                  </select>
                </label>
              ) : null}

              <label className="block space-y-1">
                <span className="text-xs font-bold text-slate-500">Açıklama</span>
                <input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold"
                />
              </label>

              {error ? (
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                  {error}
                </p>
              ) : null}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-600"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={saving || !amount}
                onClick={() => void submitMovement()}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0f1f4d] px-4 text-xs font-black text-white disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                Kaydet
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
