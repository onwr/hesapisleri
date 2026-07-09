import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Landmark,
  ReceiptText,
  Sparkles,
  Store,
  Tag,
  Wallet,
} from "lucide-react";
import { ExpenseDetailActions } from "@/components/expenses/expense-detail-actions";
import { AppShell } from "@/components/layout/app-shell";
import { guardPageModule } from "@/lib/module-access";

import { getExpenseDisplayPaymentBadge } from "@/lib/expense-utils";
import { getExpenseFormAccounts } from "@/lib/expense-service";
import { getCachedExpenseDetailData } from "@/lib/tenant-cache/cached-tenant-page-data";
import { TenantPageSync } from "@/components/tenant-cache/tenant-page-sync";
import {
  formatExpenseDate,
  formatExpenseMoney,
  getExpenseDocumentNo,
  getExpenseStatusBadge,
  getCategoryBadge,
} from "@/lib/expenses-page-utils";
type Props = {
  params: Promise<{ id: string }>;
};

function InfoCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-orange-600 shadow-sm">
        {icon}
      </div>
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1.5 text-[15px] font-black text-[#0f1f4d]">{value}</p>
    </div>
  );
}

export default async function ExpenseDetailPage({ params }: Props) {
  const session = await guardPageModule("expenses");
  const company = session.company;
const { id } = await params;

  const expense = await getCachedExpenseDetailData({
    companyId: company.id,
    expenseId: id,
  });
  if (!expense) notFound();

  const statusBadge = getExpenseStatusBadge(expense.status);
  const paymentBadge = getExpenseDisplayPaymentBadge(expense);
  const lifecycleActions = expense.lifecycleActions;
  const canPay =
    expense.status !== "CANCELLED" && expense.paymentStatus === "UNPAID";
  const accounts = canPay ? await getExpenseFormAccounts(company.id) : [];

  return (
    <AppShell>
      <TenantPageSync />
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-3">
              <Link
                href="/expenses"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0f1f4d] transition hover:bg-slate-50"
              >
                <ArrowLeft size={16} strokeWidth={2.6} />
              </Link>

              <div>
                <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-orange-100 bg-orange-50 px-2.5 py-0.5 text-[10px] font-black text-orange-600">
                  <Sparkles size={12} strokeWidth={2.5} />
                  Gider Detayı
                </div>

                <h1 className="text-[22px] font-black tracking-tight text-[#0f1f4d]">
                  {expense.title}
                </h1>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={[
                      "inline-block rounded-md px-2 py-1 text-[10px] font-black",
                      statusBadge.className,
                    ].join(" ")}
                  >
                    {statusBadge.label}
                  </span>
                  <span
                    className={[
                      "inline-block rounded-md px-2 py-1 text-[10px] font-black",
                      paymentBadge.className,
                    ].join(" ")}
                  >
                    {paymentBadge.label}
                  </span>
                  <span
                    className={[
                      "inline-block rounded-md px-2 py-1 text-[10px] font-black",
                      getCategoryBadge(expense.category),
                    ].join(" ")}
                  >
                    {expense.category || "Diğer"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <ExpenseDetailActions
                expenseId={expense.id}
                expenseTitle={expense.title}
                amount={expense.amount}
                lifecycleActions={lifecycleActions}
                requiresCancelReason={expense.requiresCancelReason}
                accounts={accounts}
              />
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InfoCard
            label="Tutar"
            value={formatExpenseMoney(expense.amount)}
            icon={<Wallet size={18} />}
          />
          <InfoCard
            label="Tarih"
            value={formatExpenseDate(expense.date)}
            icon={<CalendarDays size={18} />}
          />
          <InfoCard
            label="Belge No"
            value={getExpenseDocumentNo(expense)}
            icon={<ReceiptText size={18} />}
          />
          <InfoCard
            label="Ödeme Hesabı"
            value={expense.account?.name ?? "Bağlı değil"}
            icon={<Landmark size={18} />}
          />
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <h2 className="text-[16px] font-black text-[#0f1f4d]">Gider Bilgileri</h2>

            <div className="mt-3 space-y-2">
              <DetailLine icon={<Tag size={14} />} label="Kategori" value={expense.category || "Diğer"} />
              {expense.supplier ? (
                <DetailLine icon={<Store size={14} />} label="Tedarikçi" value={expense.supplier} />
              ) : null}
              {expense.note ? (
                <DetailLine icon={<ReceiptText size={14} />} label="Not" value={expense.note} />
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <h2 className="text-[16px] font-black text-[#0f1f4d]">Kasa/Banka Bağlantısı</h2>

            {expense.accountTransaction ? (
              <div className="mt-4 space-y-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <p className="text-[12px] font-black text-[#0f1f4d]">
                  {expense.accountTransaction.title}
                </p>
                <p className="text-[12px] font-semibold text-rose-600">
                  -{formatExpenseMoney(expense.accountTransaction.amount)}
                </p>
                <p className="text-[11px] text-slate-500">
                  {formatExpenseDate(expense.accountTransaction.date)}
                </p>
                {expense.account ? (
                  <p className="text-[11px] font-medium text-slate-600">
                    Hesap bakiyesi: {formatExpenseMoney(expense.account.balance)}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-[13px] font-medium text-slate-500">
                Bu gider için kasa/banka hareketi oluşturulmamış.
              </p>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function DetailLine({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3 py-3">
      <div className="flex items-center gap-2 text-[12px] font-medium text-slate-500">
        {icon}
        {label}
      </div>
      <span className="text-right text-[13px] font-black text-[#0f1f4d]">{value}</span>
    </div>
  );
}
