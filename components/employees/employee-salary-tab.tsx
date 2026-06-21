"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { TEAM_CARD_CLASS } from "@/components/team/team-ui-tokens";
import { formatEmployeeDate } from "@/lib/employee-page-utils";
import {
  formatEmployeeLedgerBalanceLabel,
  getEmployeeLedgerBalanceTone,
} from "@/lib/employee-ledger-utils";
import type { SerializedEmployee } from "@/lib/employee-page-types";
import { formatMoney } from "@/lib/format-utils";

type EmployeeSalaryTabProps = {
  employee: SerializedEmployee;
  canManage: boolean;
  onUpdated: (employee: SerializedEmployee) => void;
};

const inputClass =
  "h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100";

export function EmployeeSalaryTab({
  employee,
  canManage,
  onUpdated,
}: EmployeeSalaryTabProps) {
  const salary = employee.activeSalary;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [amount, setAmount] = useState(() => String(salary?.amount ?? ""));
  const [grossAmount, setGrossAmount] = useState(() =>
    salary?.grossAmount != null ? String(salary.grossAmount) : ""
  );
  const [period, setPeriod] = useState<string>(salary?.period ?? "MONTHLY");
  const [currency, setCurrency] = useState(salary?.currency ?? "TRY");
  const [paymentDay, setPaymentDay] = useState(
    salary?.paymentDay != null ? String(salary.paymentDay) : ""
  );
  const [iban, setIban] = useState(salary?.iban ?? "");
  const [bankName, setBankName] = useState(salary?.bankName ?? "");
  const [effectiveFrom, setEffectiveFrom] = useState(
    salary?.effectiveFrom ? salary.effectiveFrom.slice(0, 10) : ""
  );
  const [notes, setNotes] = useState(salary?.notes ?? "");

  const balanceTone = getEmployeeLedgerBalanceTone(employee.currentBalance ?? 0);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        amount: Number(amount),
        grossAmount: grossAmount ? Number(grossAmount) : null,
        period,
        currency,
        paymentDay: paymentDay ? Number(paymentDay) : null,
        iban: iban || null,
        bankName: bankName || null,
        effectiveFrom: effectiveFrom || null,
        notes: notes || null,
      };

      const res = await fetch(`/api/employees/${employee.id}/salary`, {
        method: salary ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message ?? "Maaş kaydedilemedi.");
        return;
      }
      onUpdated(json.employee);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Net Maaş"
          value={salary ? formatMoney(salary.amount) : "—"}
          hint={salary?.periodLabel ?? "Tanımlı değil"}
        />
        <SummaryCard
          label="Brüt Maaş"
          value={
            salary?.grossAmount != null ? formatMoney(salary.grossAmount) : "—"
          }
          hint="Opsiyonel"
        />
        <SummaryCard
          label="Ödeme Günü"
          value={salary?.paymentDay ? `Her ayın ${salary.paymentDay}. günü` : "—"}
          hint={salary?.bankName ?? "Banka bilgisi yok"}
        />
        <SummaryCard
          label="Cari Bakiye"
          value={formatEmployeeLedgerBalanceLabel(employee.currentBalance ?? 0)}
          hint="Şirketin çalışana borcu"
          tone={balanceTone}
        />
      </div>

      <section className={[TEAM_CARD_CLASS, "p-4"].join(" ")}>
        <h3 className="text-sm font-black text-[#0f1f4d]">Aktif Maaş Dönemi</h3>
        {salary ? (
          <div className="mt-3 grid gap-2 text-sm font-medium text-slate-600 sm:grid-cols-2">
            <p>Para birimi: {salary.currency}</p>
            <p>IBAN: {salary.iban ?? "—"}</p>
            <p>
              Başlangıç: {formatEmployeeDate(salary.effectiveFrom)}
            </p>
            <p>
              Bitiş: {salary.effectiveTo ? formatEmployeeDate(salary.effectiveTo) : "Devam ediyor"}
            </p>
            {salary.notes ? <p className="sm:col-span-2">Not: {salary.notes}</p> : null}
          </div>
        ) : (
          <p className="mt-2 text-sm font-medium text-slate-500">
            Bu çalışan için henüz maaş bilgisi tanımlanmamış.
          </p>
        )}
      </section>

      {canManage ? (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
          <h3 className="text-sm font-black text-[#0f1f4d]">Maaş Bilgisi</h3>

          {error ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {error}
            </p>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Maaş Tipi">
              <select
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                className={inputClass}
              >
                <option value="MONTHLY">Aylık</option>
                <option value="WEEKLY">Haftalık</option>
                <option value="DAILY">Günlük</option>
                <option value="HOURLY">Saatlik</option>
              </select>
            </Field>
            <Field label="Para Birimi">
              <input
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Net Maaş">
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Brüt Maaş">
              <input
                type="number"
                min="0"
                step="0.01"
                value={grossAmount}
                onChange={(event) => setGrossAmount(event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Maaş Ödeme Günü">
              <input
                type="number"
                min="1"
                max="31"
                value={paymentDay}
                onChange={(event) => setPaymentDay(event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Maaş Başlangıç Tarihi">
              <input
                type="date"
                value={effectiveFrom}
                onChange={(event) => setEffectiveFrom(event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="IBAN">
              <input
                value={iban}
                onChange={(event) => setIban(event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Banka">
              <input
                value={bankName}
                onChange={(event) => setBankName(event.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Not">
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            />
          </Field>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0f1f4d] px-4 text-xs font-black text-white disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            Maaş Bilgisini Kaydet
          </button>
        </form>
      ) : null}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "debt" | "credit";
}) {
  const toneClass =
    tone === "debt"
      ? "text-emerald-700"
      : tone === "credit"
        ? "text-amber-700"
        : "text-[#0f1f4d]";

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className={["mt-1 text-lg font-black", toneClass].join(" ")}>{value}</p>
      <p className="mt-1 text-[11px] font-semibold text-slate-500">{hint}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      {children}
    </label>
  );
}
