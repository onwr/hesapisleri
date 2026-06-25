"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Download, Loader2, Pencil, Printer } from "lucide-react";
import { TEAM_CARD_CLASS } from "@/components/team/team-ui-tokens";
import { PayrollItemEditModal } from "@/components/payroll/payroll-item-edit-modal";
import { FinanceAccountSelect } from "@/components/cash-bank/finance-account-select";
import { useFinanceAccounts } from "@/hooks/use-finance-accounts";
import { EMPLOYEE_PAYMENT_ACCOUNT_EMPTY_LINK_LABEL, EMPLOYEE_PAYMENT_ACCOUNT_EMPTY_MESSAGE } from "@/lib/finance-account-utils";
import { formatMoney } from "@/lib/format-utils";
import type {
  SerializedPayrollPeriodPayment,
  SerializedPayrollRun,
} from "@/lib/payroll-service";
import {
  formatPayrollPeriodLabel,
  getPayrollItemStatusBadgeClass,
  getPayrollRunActions,
  getPayrollRunStatusBadgeClass,
} from "@/lib/payroll-utils";
import { formatEmployeeDate } from "@/lib/employee-page-utils";

type DetailTab = "summary" | "items" | "adjustments" | "payments";

type PayrollDetailClientProps = {
  initialRun: SerializedPayrollRun;
  initialPeriodPayments: SerializedPayrollPeriodPayment[];
  canManagePayroll: boolean;
  canProcessPayments: boolean;
};

export function PayrollDetailClient({
  initialRun,
  initialPeriodPayments,
  canManagePayroll,
  canProcessPayments,
}: PayrollDetailClientProps) {
  const [run, setRun] = useState(initialRun);
  const [periodPayments] = useState(initialPeriodPayments);
  const [tab, setTab] = useState<DetailTab>("summary");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [editItem, setEditItem] = useState<SerializedPayrollRun["items"][number] | null>(
    null
  );
  const [editError, setEditError] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [accountId, setAccountId] = useState("");
  const [notes, setNotes] = useState("");
  const { accounts, loading: accountsLoading } = useFinanceAccounts();

  const actions = getPayrollRunActions(run.status);

  async function reload() {
    const res = await fetch(`/api/payroll/runs/${run.id}`);
    const json = await res.json();
    if (json.success) setRun(json.payrollRun);
  }

  async function callAction(path: string, body?: Record<string, unknown>) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/payroll/runs/${run.id}/${path}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message ?? "İşlem başarısız.");
        return false;
      }
      if (json.payrollRun) setRun(json.payrollRun);
      await reload();
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkPaid() {
    if (!accountId.trim()) {
      setError("Ödeme hesabı seçilmelidir.");
      return;
    }

    const ok = await callAction("mark-paid", {
      paidAt,
      relatedAccountId: accountId,
      notes: notes || undefined,
    });

    if (ok) {
      setSuccess("Bordro toplu ödendi olarak işaretlendi.");
      setMarkPaidOpen(false);
    }
  }

  async function handleSaveItem(payload: {
    bonusAmount: number;
    deductionAmount: number;
    advanceDeduction: number;
    notes: string;
  }) {
    if (!editItem) return;

    setSaving(true);
    setEditError("");
    try {
      const res = await fetch(
        `/api/payroll/runs/${run.id}/items/${editItem.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();
      if (!json.success) {
        setEditError(json.message ?? "Kalem güncellenemedi.");
        return;
      }

      if (json.payrollRun) setRun(json.payrollRun);
      setSuccess(
        json.warning
          ? `Kalem güncellendi. ${json.warning}`
          : "Bordro kalemi güncellendi."
      );
      setEditItem(null);
    } finally {
      setSaving(false);
    }
  }

  const tabs: Array<{ key: DetailTab; label: string }> = [
    { key: "summary", label: "Özet" },
    { key: "items", label: "Çalışan Kalemleri" },
    { key: "adjustments", label: "Prim & Kesinti" },
    { key: "payments", label: "Oluşan Ödemeler" },
  ];

  return (
    <div className="space-y-5">
      <Link
        href="/team/payroll"
        className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#0f1f4d]"
      >
        <ArrowLeft size={16} />
        Bordrolara dön
      </Link>

      <section className={TEAM_CARD_CLASS}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <span
              className={[
                "inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ring-inset",
                getPayrollRunStatusBadgeClass(run.status),
              ].join(" ")}
            >
              {run.statusLabel}
            </span>
            <h1 className="mt-3 text-2xl font-black text-[#0f1f4d]">{run.title}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {formatPayrollPeriodLabel(
                new Date(run.periodStart),
                new Date(run.periodEnd)
              )}
              {run.payDate ? ` · Ödeme: ${formatEmployeeDate(run.payDate)}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/payroll/runs/${run.id}/export?format=csv`}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-black text-[#0f1f4d]"
            >
              <Download className="h-4 w-4" />
              CSV indir
            </a>
            <Link
              href={`/team/payroll/${run.id}/print`}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-black text-[#0f1f4d]"
            >
              <Printer className="h-4 w-4" />
              Yazdır / PDF
            </Link>
            {canManagePayroll && actions.canRecalculate ? (
              <ActionButton
                disabled={saving}
                onClick={() => callAction("recalculate")}
                label="Yeniden hesapla"
              />
            ) : null}
            {canManagePayroll && actions.canApprove ? (
              <ActionButton
                disabled={saving}
                onClick={() => callAction("approve")}
                label="Onayla"
                primary
              />
            ) : null}
            {canManagePayroll && actions.canGeneratePayments ? (
              <ActionButton
                disabled={saving}
                onClick={() => callAction("generate-payments")}
                label="Ödeme kayıtlarını oluştur"
              />
            ) : null}
            {canProcessPayments && actions.canMarkPaid ? (
              <ActionButton
                disabled={saving}
                onClick={() => setMarkPaidOpen(true)}
                label="Toplu ödendi işaretle"
                primary
              />
            ) : null}
            {canManagePayroll && actions.canCancel ? (
              <ActionButton
                disabled={saving}
                onClick={() => callAction("cancel")}
                label="İptal et"
                danger
              />
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          {[
            { label: "Brüt toplam", value: formatMoney(run.grossTotal) },
            { label: "Prim", value: formatMoney(run.bonusTotal) },
            { label: "Kesinti", value: formatMoney(run.deductionTotal) },
            { label: "Net toplam", value: formatMoney(run.netTotal) },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl bg-slate-50 p-4">
              <p className="text-[11px] font-black uppercase text-slate-400">
                {stat.label}
              </p>
              <p className="mt-2 text-lg font-black text-[#0f1f4d]">{stat.value}</p>
            </div>
          ))}
        </div>
      </section>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {success}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={[
              "rounded-xl px-4 py-2 text-xs font-black",
              tab === item.key
                ? "bg-[#0f1f4d] text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "summary" ? (
        <section className={TEAM_CARD_CLASS}>
          <p className="text-sm text-slate-600">
            {run.employeeCount} çalışan · Onay:{" "}
            {run.approvedAt ? formatEmployeeDate(run.approvedAt) : "—"} · Ödeme:{" "}
            {run.paidAt ? formatEmployeeDate(run.paidAt) : "—"}
          </p>
          {run.notes ? (
            <p className="mt-3 text-sm text-slate-500">{run.notes}</p>
          ) : null}
        </section>
      ) : null}

      {tab === "items" ? (
        <section className="space-y-3">
          {!actions.canEditItems ? (
            <p className="text-sm font-semibold text-slate-500">
              Onaylanmış bordro kalemleri düzenlenemez.
            </p>
          ) : null}
          <div className={[TEAM_CARD_CLASS, "overflow-x-auto"].join(" ")}>
            <table className="min-w-[1100px] w-full text-left text-sm">
              <thead>
                <tr className="border-b text-[11px] font-black uppercase text-slate-400">
                  <th className="py-2 pr-4">Çalışan</th>
                  <th className="py-2 pr-4">Baz maaş</th>
                  <th className="py-2 pr-4">Prim</th>
                  <th className="py-2 pr-4">Kesinti</th>
                  <th className="py-2 pr-4">Avans</th>
                  <th className="py-2 pr-4">Net</th>
                  <th className="py-2 pr-4">Not</th>
                  <th className="py-2 pr-4">Durum</th>
                  {canManagePayroll && actions.canEditItems ? (
                    <th className="py-2">İşlem</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {run.items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-50">
                    <td className="py-3 pr-4">
                      <Link
                        href={`/team/${item.employeeId}?tab=payments`}
                        className="font-black text-[#0f1f4d] hover:underline"
                      >
                        {item.employeeName}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">{formatMoney(item.baseSalary)}</td>
                    <td className="py-3 pr-4">{formatMoney(item.bonusAmount)}</td>
                    <td className="py-3 pr-4">{formatMoney(item.deductionAmount)}</td>
                    <td className="py-3 pr-4">{formatMoney(item.advanceDeduction)}</td>
                    <td className="py-3 pr-4 font-black">
                      {formatMoney(item.netPayable)}
                    </td>
                    <td className="py-3 pr-4 text-slate-500">
                      {item.notes ?? "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={[
                          "inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ring-inset",
                          getPayrollItemStatusBadgeClass(item.status),
                        ].join(" ")}
                      >
                        {item.statusLabel}
                      </span>
                    </td>
                    {canManagePayroll && actions.canEditItems ? (
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={() => {
                            setEditError("");
                            setEditItem(item);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-black text-[#0f1f4d] hover:bg-slate-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Düzenle
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === "adjustments" ? (
        <section className={[TEAM_CARD_CLASS, "overflow-x-auto"].join(" ")}>
          <p className="mb-4 text-sm text-slate-500">
            Dönem içinde bordro hesaplamasına dahil edilen prim, kesinti ve avans
            kayıtları.
          </p>
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead>
              <tr className="border-b text-[11px] font-black uppercase text-slate-400">
                <th className="py-2 pr-4">Çalışan</th>
                <th className="py-2 pr-4">Tür</th>
                <th className="py-2 pr-4">Tutar</th>
                <th className="py-2 pr-4">Tarih</th>
                <th className="py-2 pr-4">Durum</th>
                <th className="py-2">Açıklama</th>
              </tr>
            </thead>
            <tbody>
              {periodPayments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    Bu dönem için prim/kesinti/avans kaydı bulunamadı.
                  </td>
                </tr>
              ) : (
                periodPayments.map((payment) => (
                  <tr key={payment.id} className="border-b border-slate-50">
                    <td className="py-3 pr-4">
                      <Link
                        href={`/team/${payment.employeeId}?tab=payments`}
                        className="font-black text-[#0f1f4d] hover:underline"
                      >
                        {payment.employeeName}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">{payment.typeLabel}</td>
                    <td className="py-3 pr-4 font-black">
                      {formatMoney(payment.amount)}
                    </td>
                    <td className="py-3 pr-4">
                      {payment.dueDate
                        ? formatEmployeeDate(payment.dueDate)
                        : formatEmployeeDate(payment.createdAt)}
                    </td>
                    <td className="py-3 pr-4">{payment.statusLabel}</td>
                    <td className="py-3 text-slate-500">
                      {payment.description ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      ) : null}

      {tab === "payments" ? (
        <section className={[TEAM_CARD_CLASS, "overflow-x-auto"].join(" ")}>
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead>
              <tr className="border-b text-[11px] font-black uppercase text-slate-400">
                <th className="py-2 pr-4">Çalışan</th>
                <th className="py-2 pr-4">Net</th>
                <th className="py-2 pr-4">Durum</th>
                <th className="py-2">Ödeme kaydı</th>
              </tr>
            </thead>
            <tbody>
              {run.items.map((item) => (
                <tr key={item.id} className="border-b border-slate-50">
                  <td className="py-3 pr-4">
                    <Link
                      href={`/team/${item.employeeId}?tab=payments`}
                      className="font-black text-[#0f1f4d] hover:underline"
                    >
                      {item.employeeName}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 font-black">
                    {formatMoney(item.netPayable)}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={[
                        "inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ring-inset",
                        getPayrollItemStatusBadgeClass(item.status),
                      ].join(" ")}
                    >
                      {item.statusLabel}
                    </span>
                  </td>
                  <td className="py-3">
                    {item.employeePayment ? (
                      <Link
                        href={`/team/${item.employeeId}?tab=payments`}
                        className="text-xs font-black text-emerald-600 hover:underline"
                      >
                        {item.employeePayment.status} ·{" "}
                        {formatMoney(item.employeePayment.amount)}
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <PayrollItemEditModal
        open={Boolean(editItem)}
        item={editItem}
        saving={saving}
        error={editError}
        onClose={() => setEditItem(null)}
        onSave={handleSaveItem}
      />

      {markPaidOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className={[TEAM_CARD_CLASS, "w-full max-w-lg space-y-4 p-6"].join(" ")}>
            <h3 className="text-lg font-black text-[#0f1f4d]">
              Toplu ödendi işaretle
            </h3>
            <p className="text-xs font-semibold text-slate-500">
              Bu işlem tüm bordro kalemleri için çalışan ödeme kayıtlarını ödendi
              yapar.
            </p>
            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-500">Ödeme tarihi</span>
              <input
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
              />
            </label>
            <FinanceAccountSelect
              accounts={accounts}
              value={accountId}
              onChange={setAccountId}
              disabled={accountsLoading}
              required
              emptyMessage={EMPLOYEE_PAYMENT_ACCOUNT_EMPTY_MESSAGE}
              emptyLinkLabel={EMPLOYEE_PAYMENT_ACCOUNT_EMPTY_LINK_LABEL}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
            <p className="text-xs font-semibold text-slate-500">
              Tüm çalışan ödemeleri seçilen hesaptan tek transaction içinde
              işlenir.
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Not"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setMarkPaidOpen(false)}
                className="h-10 rounded-xl border px-4 text-xs font-black"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={
                  saving ||
                  accountsLoading ||
                  accounts.length === 0 ||
                  !accountId.trim()
                }
                onClick={handleMarkPaid}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Toplu ödendi işaretle
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  primary,
  danger,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "h-10 rounded-xl px-4 text-xs font-black disabled:opacity-50",
        primary
          ? "bg-emerald-600 text-white"
          : danger
            ? "bg-red-50 text-red-600 ring-1 ring-red-100"
            : "border border-slate-200 text-[#0f1f4d]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
