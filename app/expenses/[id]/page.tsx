import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Edit3,
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
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-orange-600 shadow-sm">
        {icon}
      </div>
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-[14px] font-black text-[#0f1f4d]">{value}</p>
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

  const canPay =
    expense.status !== "CANCELLED" && expense.paymentStatus === "UNPAID";
  const accounts = canPay ? await getExpenseFormAccounts(company.id) : [];

  const statusBadge = getExpenseStatusBadge(expense.status);
  const paymentBadge = getExpenseDisplayPaymentBadge(expense);
  const canCancel = expense.status !== "CANCELLED";

  return (
    <AppShell>
      <TenantPageSync />
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
                  Gider Detayı
                </div>

                <h1 className="text-[26px] font-black tracking-tighter text-[#0f1f4d]">
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

            <div className="flex flex-wrap gap-2">
              {canCancel ? (
                <Link
                  href={`/expenses/${expense.id}/edit`}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-black text-[#24345f] hover:bg-slate-50"
                >
                  <Edit3 size={15} />
                  Düzenle
                </Link>
              ) : null}

              <ExpenseDetailActions
                expenseId={expense.id}
                expenseTitle={expense.title}
                amount={expense.amount}
                canCancel={canCancel}
                canPay={canPay}
                accounts={accounts}
              />
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

            <div className="mt-4 space-y-3">
              <DetailLine icon={<Tag size={16} />} label="Kategori" value={expense.category || "Diğer"} />
              <DetailLine icon={<Store size={16} />} label="Tedarikçi" value={expense.supplier || "-"} />
              <DetailLine icon={<ReceiptText size={16} />} label="Not" value={expense.note || "-"} />
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
