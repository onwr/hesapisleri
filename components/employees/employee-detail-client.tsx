"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  BarChart3,
  CalendarClock,
  Check,
  Loader2,
  Star,
  Wallet,
  X,
} from "lucide-react";
import { StatCard } from "@/components/cards/stat-card";
import { EmployeeLedgerTab } from "@/components/employees/employee-ledger-tab";
import { EmployeePaymentMarkPaidModal } from "@/components/employees/employee-payment-mark-paid-modal";
import { EmployeePayrollSummaryTab } from "@/components/employees/employee-payroll-summary-tab";
import { EmployeePerformancePanel } from "@/components/employees/employee-performance-panel";
import { EmployeePosTab } from "@/components/employees/employee-pos-tab";
import { EmployeeSalaryTab } from "@/components/employees/employee-salary-tab";
import {
  EmployeeDetailBackLink,
  EmployeeProfileHeader,
} from "@/components/employees/employee-profile-header";
import { TEAM_CARD_CLASS } from "@/components/team/team-ui-tokens";
import type { EmployeePerformanceDetail } from "@/lib/employee-performance-service";
import type { SerializedEmployee } from "@/lib/employee-page-types";
import {
  buildEmployeePaymentExpenseHref,
  buildEmployeePaymentTransactionHref,
  EMPLOYEE_PAYMENT_FINANCE_BADGE_CLASS,
  shouldShowMarkPaidButton,
} from "@/lib/employee-payment-finance-utils";
import { useFinanceAccounts } from "@/hooks/use-finance-accounts";
import {
  formatEmployeeLedgerBalanceLabel,
  getEmployeeLedgerBalanceTone,
} from "@/lib/employee-ledger-utils";
import { formatEmployeeDate } from "@/lib/employee-page-utils";
import { formatMoney, formatNumber } from "@/lib/format-utils";
import {
  CreateUserFromEmployeeModal,
  ResetUserPasswordModal,
} from "@/components/settings/create-user-from-employee-modal";
import type { AssignableCompanyUserRole } from "@/lib/company-user-from-employee-utils";
import {
  getPaymentStatusBadgeClass,
  getPaymentTypeLabel,
  isEmployeeLeaveVisibleOnCalendar,
  PAYMENT_TYPE_HINTS,
} from "@/lib/employee-utils";

type DetailTab =
  | "overview"
  | "salary"
  | "ledger"
  | "performance"
  | "leaves"
  | "payments"
  | "payroll"
  | "activity"
  | "pos";

type ActivityRow = {
  id: string;
  action: string;
  message: string | null;
  createdAt: string;
};

type PerformanceData = EmployeePerformanceDetail;

type EmployeeDetailClientProps = {
  employee: SerializedEmployee;
  performance: PerformanceData;
  activities: ActivityRow[];
  canManage: boolean;
  canProcessPayments: boolean;
  initialTab?: string;
};

const TABS: { key: DetailTab; label: string }[] = [
  { key: "overview", label: "Genel Bakış" },
  { key: "salary", label: "Maaş Bilgisi" },
  { key: "ledger", label: "Cari Hareketler" },
  { key: "performance", label: "Satış Performansı" },
  { key: "leaves", label: "İzinler" },
  { key: "payments", label: "Ödemeler" },
  { key: "payroll", label: "Bordro Özeti" },
  { key: "activity", label: "Aktivite" },
  { key: "pos", label: "POS Erişimi" },
];

export function EmployeeDetailClient({
  employee: initialEmployee,
  performance: initialPerformance,
  activities,
  canManage,
  canProcessPayments,
  initialTab,
}: EmployeeDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = (searchParams.get("tab") ?? initialTab ?? "overview") as DetailTab;

  const [employee, setEmployee] = useState(initialEmployee);
  const [performance, setPerformance] = useState(initialPerformance);
  const [tab, setTab] = useState<DetailTab>(
    TABS.some((t) => t.key === tabParam) ? tabParam : "overview"
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [salaryAmount, setSalaryAmount] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentType, setPaymentType] = useState("SALARY");
  const [paymentDueDate, setPaymentDueDate] = useState("");
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveType, setLeaveType] = useState("ANNUAL");

  const [markPaidPaymentId, setMarkPaidPaymentId] = useState<string | null>(null);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [passwordResetOpen, setPasswordResetOpen] = useState(false);
  const [markPaidAt, setMarkPaidAt] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [markPaidAccountId, setMarkPaidAccountId] = useState("");
  const [markPaidNotes, setMarkPaidNotes] = useState("");
  const [markPaidFormError, setMarkPaidFormError] = useState("");
  const { accounts: financeAccounts, loading: accountsLoading } =
    useFinanceAccounts();

  async function reload() {
    const res = await fetch(`/api/employees/${employee.id}`);
    const json = await res.json();
    if (json.success) {
      setEmployee(json.employee);
      setPerformance(json.performance);
    }
  }

  async function handleCreateSystemUser(payload: {
    employeeId: string;
    email: string;
    password: string;
    passwordConfirm: string;
    role: AssignableCompanyUserRole;
    status: "ACTIVE" | "PASSIVE";
  }) {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/settings/users/from-employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Kullanıcı oluşturulamadı.");
      }

      setSuccess("Kullanıcı oluşturuldu.");
      setCreateUserOpen(false);
      await reload();
    } catch (createError) {
      const message =
        createError instanceof Error
          ? createError.message
          : "Kullanıcı oluşturulurken bir hata oluştu.";
      setError(message);
      throw createError;
    } finally {
      setSaving(false);
    }
  }

  async function handleResetSystemUserPassword(payload: {
    password: string;
    passwordConfirm: string;
  }) {
    if (!employee.linkedUser?.companyUserId) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(
        `/api/settings/users/${employee.linkedUser.companyUserId}/password`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Şifre güncellenemedi.");
      }

      setSuccess("Kullanıcı şifresi güncellendi.");
      setPasswordResetOpen(false);
    } catch (resetError) {
      const message =
        resetError instanceof Error
          ? resetError.message
          : "Şifre güncellenirken bir hata oluştu.";
      setError(message);
      throw resetError;
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleSystemUserStatus() {
    if (!employee.linkedUser?.companyUserId) return;

    const nextStatus =
      employee.linkedUser.status === "ACTIVE" ? "PASSIVE" : "ACTIVE";

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(
        `/api/settings/users/${employee.linkedUser.companyUserId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        }
      );
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || "Kullanıcı durumu güncellenemedi.");
        return;
      }

      setSuccess(
        nextStatus === "ACTIVE" ? "Kullanıcı aktif yapıldı." : "Kullanıcı pasif yapıldı."
      );
      await reload();
    } catch {
      setError("Kullanıcı durumu güncellenirken bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        "Bu pasif çalışan kaydı kalıcı olarak sonlandırılacak. Devam etmek istiyor musunuz?"
      )
    ) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message);
        return;
      }
      setSuccess("Çalışan kaydı sonlandırıldı.");
      router.push("/team?tab=passive");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/employees/${employee.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message);
        return;
      }
      setSuccess("Çalışan aktif yapıldı.");
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function handlePassivate() {
    if (!window.confirm("Bu çalışanı pasif yapmak istiyor musunuz?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/employees/${employee.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PASSIVE" }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message);
        return;
      }
      setSuccess("Çalışan pasif yapıldı.");
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function handleSalarySubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/employees/${employee.id}/salary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(salaryAmount) }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message);
        return;
      }
      setSuccess("Maaş güncellendi.");
      setSalaryAmount("");
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function handlePaymentSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/employees/${employee.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: paymentType,
          amount: Number(paymentAmount),
          dueDate: paymentDueDate || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message);
        return;
      }
      setSuccess("Ödeme kaydı oluşturuldu.");
      setPaymentAmount("");
      setPaymentDueDate("");
      await reload();
    } finally {
      setSaving(false);
    }
  }

  function openMarkPaidModal(paymentId: string) {
    setMarkPaidPaymentId(paymentId);
    setMarkPaidAt(new Date().toISOString().slice(0, 10));
    setMarkPaidAccountId("");
    setMarkPaidNotes("");
    setMarkPaidFormError("");
    setError("");
    setSuccess("");
  }

  function closeMarkPaidModal() {
    setMarkPaidPaymentId(null);
    setMarkPaidFormError("");
  }

  async function submitMarkPaymentPaid() {
    if (!markPaidPaymentId) return;

    setSaving(true);
    setMarkPaidFormError("");
    try {
      const res = await fetch(
        `/api/employees/${employee.id}/payments/${markPaidPaymentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "PAID",
            paidAt: markPaidAt || undefined,
            relatedAccountId: markPaidAccountId,
            notes: markPaidNotes || undefined,
          }),
        }
      );
      const json = await res.json();
      if (!json.success) {
        setMarkPaidFormError(json.message ?? "İşlem başarısız.");
        return;
      }
      setSuccess("Ödeme tamamlandı olarak işaretlendi.");
      closeMarkPaidModal();
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function handleLeaveSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/employees/${employee.id}/leaves`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: leaveType,
          startAt: leaveStart,
          endAt: leaveEnd,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message);
        return;
      }
      setSuccess("İzin kaydı oluşturuldu.");
      setLeaveStart("");
      setLeaveEnd("");
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function handleLeaveAction(leaveId: string, action: "approve" | "reject") {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/employees/${employee.id}/leaves/${leaveId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      const json = await res.json();
      if (!json.success) {
        setError(json.message);
        return;
      }
      setSuccess(action === "approve" ? "İzin onaylandı." : "İzin reddedildi.");
      await reload();
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100";

  const markPaidPayment = (employee.payments ?? []).find(
    (payment) => payment.id === markPaidPaymentId
  );

  return (
    <div className="space-y-4">
      <EmployeeDetailBackLink />

      <EmployeeProfileHeader
        employee={employee}
        canManage={canManage}
        saving={saving}
        onAddPayment={() => setTab("payments")}
        onAddLeave={() => setTab("leaves")}
        onManagePos={() => setTab("pos")}
        onCreateSystemUser={() => setCreateUserOpen(true)}
        onResetSystemUserPassword={() => setPasswordResetOpen(true)}
        onToggleSystemUserStatus={handleToggleSystemUserStatus}
        onPassivate={handlePassivate}
        onActivate={handleActivate}
        onDelete={handleDelete}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Bu Ay Satış"
          value={formatMoney(performance.thisMonthSalesAmount ?? performance.totalSalesAmount ?? 0)}
          subtitle={`${performance.thisMonthSalesCount ?? performance.totalSalesCount ?? 0} satış`}
          icon={<BarChart3 size={18} />}
          color="green"
        />
        <StatCard
          title="Performans Skoru"
          value={String(performance.performanceScore ?? 0)}
          subtitle="Bu dönem"
          icon={<Star size={18} />}
          color="purple"
        />
        <StatCard
          title="Cari Bakiye"
          value={formatEmployeeLedgerBalanceLabel(employee.currentBalance ?? 0)}
          subtitle="Şirketin çalışana borcu"
          icon={<Wallet size={18} />}
          color={
            getEmployeeLedgerBalanceTone(employee.currentBalance ?? 0) === "credit"
              ? "orange"
              : "green"
          }
        />
        <StatCard
          title="Kullanılan İzin"
          value={String(performance.leaveSummary.totalDaysUsed)}
          subtitle={`${performance.leaveSummary.pending} bekleyen talep`}
          icon={<CalendarClock size={18} />}
          color="blue"
        />
        <StatCard
          title="Son Ödeme"
          value={
            (employee.payments ?? []).find((p) => p.status === "PAID")
              ? formatMoney(
                  (employee.payments ?? []).find((p) => p.status === "PAID")!
                    .amount
                )
              : "—"
          }
          subtitle="Ödenen kayıt"
          icon={<Wallet size={18} />}
          color="red"
        />
      </section>

      {error ? (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-2xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
          {success}
        </div>
      ) : null}

      <div className={[TEAM_CARD_CLASS, "overflow-hidden"].join(" ")}>
        <div className="flex flex-wrap gap-2 border-b border-slate-100 p-4">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setTab(item.key);
                router.replace(`/team/${employee.id}?tab=${item.key}`);
              }}
              className={[
                "rounded-full px-4 py-2 text-xs font-black transition",
                tab === item.key
                  ? "bg-[#0f1f4d] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200/80",
              ].join(" ")}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === "overview" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <InfoCard title="İletişim">
                <p>E-posta: {employee.email ?? "—"}</p>
                <p>Telefon: {employee.phone ?? "—"}</p>
                <p>Adres: {employee.address ?? "—"}</p>
              </InfoCard>
              <InfoCard title="İş Bilgisi">
                <p>İstihdam: {employee.employmentTypeLabel}</p>
                <p>Departman: {employee.department ?? "—"}</p>
                <p>Görev: {employee.jobTitle ?? "—"}</p>
              </InfoCard>
              <InfoCard title="Maaş Bilgisi">
                {employee.activeSalary ? (
                  <>
                    <p>
                      Net: {formatMoney(employee.activeSalary.amount)} /{" "}
                      {employee.activeSalary.periodLabel}
                    </p>
                    {employee.activeSalary.grossAmount != null ? (
                      <p>Brüt: {formatMoney(employee.activeSalary.grossAmount)}</p>
                    ) : null}
                    <p>
                      Ödeme günü:{" "}
                      {employee.activeSalary.paymentDay
                        ? `Her ayın ${employee.activeSalary.paymentDay}. günü`
                        : "—"}
                    </p>
                    <p>IBAN: {employee.activeSalary.iban ?? "—"}</p>
                    <p>Banka: {employee.activeSalary.bankName ?? "—"}</p>
                  </>
                ) : (
                  <p className="text-slate-500">Tanımlı maaş yok</p>
                )}
              </InfoCard>
              <InfoCard title="Ödeme Özeti">
                <p>Bekleyen: {formatMoney(employee.balance.totalPending)}</p>
                <p>Ödenen: {formatMoney(employee.balance.totalPaid)}</p>
                <p>Kesinti: {formatMoney(employee.balance.totalDeductions)}</p>
                <p className="font-black text-[#0f1f4d]">
                  Net ödenecek: {formatMoney(employee.balance.netPayable)}
                </p>
              </InfoCard>
              <InfoCard title="İzin Özeti">
                <p>Bekleyen talep: {performance.leaveSummary.pending}</p>
                <p>Onaylı: {performance.leaveSummary.approved}</p>
                <p>Kullanılan gün: {performance.leaveSummary.totalDaysUsed}</p>
              </InfoCard>
            </div>
          ) : null}

          {tab === "salary" ? (
            <EmployeeSalaryTab
              employee={employee}
              canManage={canManage}
              onUpdated={(nextEmployee) => setEmployee(nextEmployee)}
            />
          ) : null}

          {tab === "ledger" ? (
            <EmployeeLedgerTab
              employeeId={employee.id}
              canProcessPayments={canProcessPayments}
              onReloadEmployee={reload}
            />
          ) : null}

          {tab === "performance" ? (
            <EmployeePerformancePanel
              employeeId={employee.id}
              initialPerformance={performance}
            />
          ) : null}

          {tab === "payments" ? (
            <div className="space-y-6">
              <p className="text-xs font-semibold text-slate-500">
                Maaş bilgileri sadece yetkili kişiler tarafından görüntülenir.
              </p>
              <InfoCard title="Aktif Maaş">
                {employee.activeSalary ? (
                  <p className="text-lg font-black text-[#0f1f4d]">
                    {formatMoney(employee.activeSalary.amount)}{" "}
                    <span className="text-sm font-bold text-slate-400">
                      / {employee.activeSalary.periodLabel}
                    </span>
                  </p>
                ) : (
                  <p className="text-slate-500">Tanımlı maaş yok</p>
                )}
              </InfoCard>

              {canManage ? (
                <form
                  onSubmit={handleSalarySubmit}
                  className="flex flex-wrap items-end gap-3 rounded-2xl bg-slate-50 p-4"
                >
                  <label className="space-y-1">
                    <span className="text-xs font-bold text-slate-500">
                      Yeni maaş (TRY)
                    </span>
                    <input
                      type="number"
                      min="0"
                      required
                      value={salaryAmount}
                      onChange={(e) => setSalaryAmount(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={saving}
                    className="h-10 rounded-xl bg-[#0f1f4d] px-4 text-xs font-black text-white disabled:opacity-50"
                  >
                    Maaş Güncelle
                  </button>
                </form>
              ) : null}

              {canManage ? (
                <form
                  onSubmit={handlePaymentSubmit}
                  className="space-y-3 rounded-2xl border border-slate-100 p-4"
                >
                  <p className="text-xs font-semibold text-slate-500">
                    Bekleyen ödemeleri ödendi işaretlerken ödeme hesabı
                    seçimi zorunludur; gider ve kasa/banka hareketi seçilen
                    hesap üzerinde oluşturulur.
                  </p>
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="space-y-1">
                      <span className="text-xs font-bold text-slate-500">
                        Tip
                      </span>
                      <select
                        value={paymentType}
                        onChange={(e) => setPaymentType(e.target.value)}
                        className={inputClass}
                      >
                        <option value="SALARY">Maaş</option>
                        <option value="ADVANCE">Avans</option>
                        <option value="BONUS">Prim</option>
                        <option value="DEDUCTION">Kesinti</option>
                        <option value="EXPENSE_REIMBURSEMENT">
                          Masraf iadesi
                        </option>
                        <option value="OTHER">Diğer</option>
                      </select>
                      <span className="text-[10px] font-semibold text-slate-400">
                        {
                          PAYMENT_TYPE_HINTS[
                            paymentType as keyof typeof PAYMENT_TYPE_HINTS
                          ]
                        }
                      </span>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-bold text-slate-500">
                        Tutar
                      </span>
                      <input
                        type="number"
                        min="0"
                        required
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className={inputClass}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-bold text-slate-500">
                        Vade tarihi
                      </span>
                      <input
                        type="date"
                        value={paymentDueDate}
                        onChange={(e) => setPaymentDueDate(e.target.value)}
                        className={inputClass}
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={saving}
                      className="h-10 rounded-xl bg-blue-600 px-4 text-xs font-black text-white disabled:opacity-50"
                    >
                      Ödeme Ekle
                    </button>
                  </div>
                </form>
              ) : null}

              <div className="overflow-x-auto">
                <table className="min-w-[720px] w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-[11px] font-black uppercase text-slate-400">
                      <th className="py-2 pr-4">Tip</th>
                      <th className="py-2 pr-4">Tutar</th>
                      <th className="py-2 pr-4">Vade</th>
                      <th className="py-2 pr-4">Durum</th>
                      <th className="py-2 pr-4">Ödeme tarihi</th>
                      <th className="py-2 pr-4">Ödeme hesabı</th>
                      <th className="py-2 pr-4">Yöntem</th>
                      <th className="py-2 pr-4">İşlemi yapan</th>
                      <th className="py-2 pr-4">Finans</th>
                      <th className="py-2">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(employee.payments ?? []).map((p) => (
                      <tr key={p.id} className="border-b border-slate-50">
                        <td className="py-3 pr-4 font-semibold">
                          {getPaymentTypeLabel(
                            p.type as Parameters<typeof getPaymentTypeLabel>[0]
                          )}
                        </td>
                        <td className="py-3 pr-4 font-black text-[#0f1f4d]">
                          {formatMoney(p.amount)}
                        </td>
                        <td className="py-3 pr-4 text-slate-500">
                          {formatEmployeeDate(p.dueDate)}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="space-y-1">
                            <span
                              className={[
                                "inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ring-inset",
                                getPaymentStatusBadgeClass(
                                  p.status as Parameters<
                                    typeof getPaymentStatusBadgeClass
                                  >[0]
                                ),
                              ].join(" ")}
                            >
                              {p.statusLabel}
                            </span>
                            {p.status === "OVERDUE" ? (
                              <p className="text-[10px] font-bold text-red-600">
                                Vadesi geçti
                              </p>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-slate-500">
                          {p.paidAt ? formatEmployeeDate(p.paidAt) : "—"}
                        </td>
                        <td className="py-3 pr-4 text-slate-600">
                          {p.paymentAccount?.name ?? "—"}
                        </td>
                        <td className="py-3 pr-4 text-slate-500">
                          {p.paymentMethodLabel ?? "—"}
                        </td>
                        <td className="py-3 pr-4 text-slate-500">
                          {p.createdByName ?? "—"}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex flex-wrap gap-1.5">
                            {p.relatedExpenseId ? (
                              <Link
                                href={buildEmployeePaymentExpenseHref(
                                  p.relatedExpenseId
                                )}
                                className={
                                  EMPLOYEE_PAYMENT_FINANCE_BADGE_CLASS.expense
                                }
                              >
                                Gider kaydı
                              </Link>
                            ) : null}
                            {p.relatedTransactionId ? (
                              <Link
                                href={buildEmployeePaymentTransactionHref({
                                  transactionId: p.relatedTransactionId,
                                  accountId: p.relatedAccountId,
                                })}
                                className={
                                  EMPLOYEE_PAYMENT_FINANCE_BADGE_CLASS.transaction
                                }
                              >
                                Kasa/Banka hareketi
                              </Link>
                            ) : null}
                            {!p.relatedExpenseId && !p.relatedTransactionId ? (
                              <span className="text-slate-400">—</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-3">
                          {canProcessPayments &&
                          shouldShowMarkPaidButton(
                            p.status as Parameters<
                              typeof shouldShowMarkPaidButton
                            >[0]
                          ) ? (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => openMarkPaidModal(p.id)}
                              className="text-xs font-black text-emerald-600 hover:underline disabled:opacity-50"
                            >
                              Ödendi işaretle
                            </button>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {tab === "leaves" ? (
            <div className="space-y-6">
              {canManage ? (
                <form
                  onSubmit={handleLeaveSubmit}
                  className="flex flex-wrap items-end gap-3 rounded-2xl bg-slate-50 p-4"
                >
                  <label className="space-y-1">
                    <span className="text-xs font-bold text-slate-500">Tip</span>
                    <select
                      value={leaveType}
                      onChange={(e) => setLeaveType(e.target.value)}
                      className={inputClass}
                    >
                      <option value="ANNUAL">Yıllık izin</option>
                      <option value="SICK">Hastalık</option>
                      <option value="UNPAID">Ücretsiz</option>
                      <option value="EXCUSE">Mazeret</option>
                      <option value="REMOTE">Uzaktan</option>
                      <option value="OTHER">Diğer</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-bold text-slate-500">
                      Başlangıç
                    </span>
                    <input
                      type="date"
                      required
                      value={leaveStart}
                      onChange={(e) => setLeaveStart(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-bold text-slate-500">Bitiş</span>
                    <input
                      type="date"
                      required
                      value={leaveEnd}
                      onChange={(e) => setLeaveEnd(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={saving}
                    className="h-10 rounded-xl bg-[#0f1f4d] px-4 text-xs font-black text-white disabled:opacity-50"
                  >
                    İzin Ekle
                  </button>
                </form>
              ) : null}

              <p className="text-xs text-slate-500">
                Onaylanan izinler takvimde sistem kaydı olarak görüntülenir.
              </p>

              <div className="space-y-3">
                {(employee.leaveRequests ?? []).map((leave) => (
                  <div
                    key={leave.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 p-4"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-[#0f1f4d]">{leave.type}</p>
                        {isEmployeeLeaveVisibleOnCalendar(
                          leave.status as Parameters<
                            typeof isEmployeeLeaveVisibleOnCalendar
                          >[0]
                        ) ? (
                          <span className="inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-black text-violet-700 ring-1 ring-violet-100">
                            Takvimde görünür
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-slate-500">
                        {formatEmployeeDate(leave.startAt)} —{" "}
                        {formatEmployeeDate(leave.endAt)} · {leave.totalDays}{" "}
                        gün
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-600">
                        {leave.statusLabel}
                      </p>
                    </div>
                    {canManage && leave.status === "PENDING" ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleLeaveAction(leave.id, "approve")}
                          className="inline-flex h-9 items-center gap-1 rounded-xl bg-emerald-50 px-3 text-xs font-black text-emerald-700"
                        >
                          <Check size={14} /> Onayla
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleLeaveAction(leave.id, "reject")}
                          className="inline-flex h-9 items-center gap-1 rounded-xl bg-red-50 px-3 text-xs font-black text-red-600"
                        >
                          <X size={14} /> Reddet
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {tab === "activity" ? (
            <div className="space-y-3">
              {activities.length === 0 ? (
                <p className="text-sm text-slate-500">Aktivite kaydı yok.</p>
              ) : (
                activities.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-2xl border border-slate-100 px-4 py-3 text-sm"
                  >
                    <p className="font-semibold text-[#0f1f4d]">{a.message}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {formatEmployeeDate(a.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {tab === "payroll" ? (
            <EmployeePayrollSummaryTab employee={employee} />
          ) : null}

          {tab === "pos" ? (
            <EmployeePosTab
              employee={employee}
              canManage={canManage}
              onUpdated={setEmployee}
            />
          ) : null}
        </div>
      </div>

      <EmployeePaymentMarkPaidModal
        open={Boolean(markPaidPaymentId)}
        saving={saving}
        paymentLabel={
          markPaidPayment
            ? getPaymentTypeLabel(
                markPaidPayment.type as Parameters<
                  typeof getPaymentTypeLabel
                >[0]
              )
            : ""
        }
        paymentAmount={markPaidPayment?.amount ?? 0}
        accounts={financeAccounts}
        accountsLoading={accountsLoading}
        paidAt={markPaidAt}
        relatedAccountId={markPaidAccountId}
        notes={markPaidNotes}
        formError={markPaidFormError}
        onPaidAtChange={setMarkPaidAt}
        onRelatedAccountIdChange={setMarkPaidAccountId}
        onNotesChange={setMarkPaidNotes}
        onClose={closeMarkPaidModal}
        onSubmit={submitMarkPaymentPaid}
      />

      <CreateUserFromEmployeeModal
        open={createUserOpen}
        saving={saving}
        onClose={() => setCreateUserOpen(false)}
        onSubmit={handleCreateSystemUser}
        preselectedEmployeeId={employee.id}
        preselectedEmail={employee.email ?? undefined}
      />

      <ResetUserPasswordModal
        open={passwordResetOpen}
        saving={saving}
        userLabel={employee.fullName}
        onClose={() => setPasswordResetOpen(false)}
        onSubmit={handleResetSystemUserPassword}
      />
    </div>
  );
}

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {title}
      </p>
      <div className="mt-2 space-y-1 text-sm font-semibold text-[#24345f]">
        {children}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 p-4">
      <p className="text-[11px] font-black uppercase text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-black text-[#0f1f4d]">{value}</p>
      {sub ? (
        <p className="mt-1 text-xs font-bold text-slate-500">{sub}</p>
      ) : null}
    </div>
  );
}
