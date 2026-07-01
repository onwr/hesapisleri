import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Building2,
  CalendarDays,
  FileText,
  Receipt,
  ShoppingCart,
  User,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { guardPageModule } from "@/lib/module-access";
import { TenantPageSync } from "@/components/tenant-cache/tenant-page-sync";
import { getCachedAccountTransactionDetailData } from "@/lib/tenant-cache/cached-tenant-page-data";
import { formatCashMoney } from "@/lib/cash-bank-page-utils";
import { formatDateTimeDisplay } from "@/lib/format-utils";
import type { AccountTransactionDetailLink } from "@/lib/cash-bank/get-account-transaction-detail";

type Props = {
  params: Promise<{ id: string }>;
};

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-slate-50 py-3 last:border-0">
      <span className="text-[11px] font-extrabold text-slate-500">{label}</span>
      <span className="text-[12px] font-semibold text-[#24345f]">{children}</span>
    </div>
  );
}

function EntityLink({
  href,
  label,
  icon,
}: AccountTransactionDetailLink & { href: string; icon?: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 font-extrabold text-blue-600 hover:underline"
    >
      {icon}
      {label}
    </Link>
  );
}

export default async function CashBankTransactionDetailPage({ params }: Props) {
  const session = await guardPageModule("cash-bank");
  const companyId = session.company.id;
  const { id } = await params;

  const tx = await getCachedAccountTransactionDetailData({
    companyId,
    transactionId: id,
  });
  if (!tx) notFound();

  const isIn = tx.direction === "in";

  return (
    <AppShell>
      <TenantPageSync />
      <div className="min-w-0 space-y-5">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Link
                href={`/cash-bank/${tx.account.id}`}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0f1f4d] transition hover:bg-slate-50"
              >
                <ArrowLeft size={17} strokeWidth={2.6} />
              </Link>
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                  Hareket Detayı
                </p>
                <h1 className="mt-0.5 text-[20px] font-black tracking-tight text-[#0f1f4d]">
                  {tx.title}
                </h1>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-4">
            <div
              className={[
                "flex h-14 w-14 items-center justify-center rounded-2xl",
                isIn ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600",
              ].join(" ")}
            >
              {isIn ? (
                <ArrowDownLeft size={24} strokeWidth={2.5} />
              ) : (
                <ArrowUpRight size={24} strokeWidth={2.5} />
              )}
            </div>
            <div>
              <p className="text-[12px] font-extrabold text-slate-500">{tx.typeLabel}</p>
              <p
                className={[
                  "text-[32px] font-black tracking-tight",
                  isIn ? "text-emerald-600" : "text-rose-600",
                ].join(" ")}
              >
                {isIn ? "+" : "-"}
                {formatCashMoney(tx.amount)} {tx.currency}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                {tx.directionLabel} · {tx.sourceLabel}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <h2 className="mb-2 text-[13px] font-extrabold text-[#0f1f4d]">İşlem Bilgileri</h2>
          <div>
            <DetailRow label="İşlem Türü">
              <span
                className={[
                  "inline-block rounded-md px-2 py-1 text-[10px] font-black",
                  isIn ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700",
                ].join(" ")}
              >
                {tx.typeLabel}
              </span>
            </DetailRow>
            <DetailRow label="Tutar">
              <span className={isIn ? "font-black text-emerald-600" : "font-black text-rose-600"}>
                {isIn ? "+" : "-"}
                {formatCashMoney(tx.amount)} {tx.currency}
              </span>
            </DetailRow>
            <DetailRow label="Tarih / Saat">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={12} className="text-slate-400" />
                {formatDateTimeDisplay(tx.date)}
              </span>
            </DetailRow>
            <DetailRow label="Durum">{tx.statusLabel}</DetailRow>
            {tx.paymentMethodLabel ? (
              <DetailRow label="Ödeme Yöntemi">{tx.paymentMethodLabel}</DetailRow>
            ) : null}
            {tx.reference ? <DetailRow label="Referans">{tx.reference}</DetailRow> : null}
            {tx.note ? <DetailRow label="Açıklama">{tx.note}</DetailRow> : null}
            <DetailRow label="Kayıt Tarihi">{formatDateTimeDisplay(tx.createdAt)}</DetailRow>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <h2 className="mb-2 text-[13px] font-extrabold text-[#0f1f4d]">Hesap</h2>
          <div>
            <DetailRow label="Hesap">
              <EntityLink
                href={`/cash-bank/${tx.account.id}`}
                id={tx.account.id}
                label={tx.account.name}
                icon={<Wallet size={12} />}
              />
            </DetailRow>
            <DetailRow label="Hesap Türü">
              {tx.account.type === "BANK" ? "Banka Hesabı" : "Kasa"}
            </DetailRow>
            {tx.counterAccount ? (
              <DetailRow label="Karşı Hesap">
                <EntityLink
                  href={`/cash-bank/${tx.counterAccount.id}`}
                  id={tx.counterAccount.id}
                  label={tx.counterAccount.label}
                  icon={<ArrowRightLeft size={12} />}
                />
              </DetailRow>
            ) : null}
            {tx.pairedTransaction ? (
              <DetailRow label="Karşı Transfer Hareketi">
                <EntityLink
                  href={`/cash-bank/transactions/${tx.pairedTransaction.id}`}
                  id={tx.pairedTransaction.id}
                  label={tx.pairedTransaction.label}
                  icon={<ArrowRightLeft size={12} />}
                />
              </DetailRow>
            ) : null}
          </div>
        </section>

        {(tx.createdBy ||
          tx.customer ||
          tx.sale ||
          tx.invoice ||
          tx.expense ||
          tx.supplier ||
          tx.employee ||
          tx.reversal) ? (
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <h2 className="mb-2 text-[13px] font-extrabold text-[#0f1f4d]">İlişkili Kayıtlar</h2>
            <div>
              {tx.createdBy ? (
                <DetailRow label="Oluşturan">{tx.createdBy.label}</DetailRow>
              ) : null}
              {tx.customer ? (
                <DetailRow label="Müşteri">
                  <EntityLink
                    href={`/customers/${tx.customer.id}`}
                    {...tx.customer}
                    icon={<User size={12} />}
                  />
                </DetailRow>
              ) : null}
              {tx.sale ? (
                <DetailRow label="Satış">
                  <EntityLink
                    href={`/sales/${tx.sale.id}`}
                    {...tx.sale}
                    icon={<ShoppingCart size={12} />}
                  />
                </DetailRow>
              ) : null}
              {tx.invoice ? (
                <DetailRow label="Fatura">
                  <EntityLink
                    href={`/invoices/${tx.invoice.id}`}
                    id={tx.invoice.id}
                    label={tx.invoice.label}
                    icon={<FileText size={12} />}
                  />
                </DetailRow>
              ) : null}
              {tx.expense ? (
                <DetailRow label="Gider">
                  <EntityLink
                    href={`/expenses/${tx.expense.id}`}
                    {...tx.expense}
                    icon={<Receipt size={12} />}
                  />
                </DetailRow>
              ) : null}
              {tx.supplier ? (
                <DetailRow label="Tedarikçi">
                  <EntityLink
                    href={`/suppliers/${tx.supplier.id}`}
                    {...tx.supplier}
                    icon={<Building2 size={12} />}
                  />
                </DetailRow>
              ) : null}
              {tx.employee ? (
                <DetailRow label="Çalışan">
                  <EntityLink
                    href={`/team/${tx.employee.id}`}
                    {...tx.employee}
                    icon={<User size={12} />}
                  />
                </DetailRow>
              ) : null}
              {tx.reversal ? (
                <DetailRow label="İptal / Ters Kayıt">
                  {tx.reversal.transactionId ? (
                    <EntityLink
                      href={`/cash-bank/transactions/${tx.reversal.transactionId}`}
                      id={tx.reversal.transactionId}
                      label={tx.reversal.label}
                    />
                  ) : (
                    tx.reversal.label
                  )}
                </DetailRow>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
