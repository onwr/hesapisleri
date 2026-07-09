import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CalendarDays,
  Eye,
  Landmark,
  Sparkles,
  Wallet,
} from "lucide-react";
import { AccountArchiveActions } from "@/components/cash-bank/account-archive-actions";
import { AccountDetailActions } from "@/components/cash-bank/account-detail-actions";
import { CashBankTransactionRowActions } from "@/components/cash-bank/cash-bank-transaction-row-actions";
import { AppShell } from "@/components/layout/app-shell";
import { guardPageModule } from "@/lib/module-access";

import { BankLogo } from "@/components/shared/bank-logo";
import { getCachedCashBankAccountDetailData } from "@/lib/tenant-cache/cached-tenant-page-data";
import { TenantPageSync } from "@/components/tenant-cache/tenant-page-sync";
import { formatDateTimeDisplay } from "@/lib/format-utils";
import {
  formatCashMoney,
  getCashBalanceClass,
  getAccountTypeText,
} from "@/lib/cash-bank-page-utils";
import { canManageAccounts } from "@/lib/permission-utils";
type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ movement?: string }>;
};

function MetricCard({
  title,
  value,
  icon,
  tone = "default",
}: {
  title: string;
  value: string;
  icon: ReactNode;
  tone?: "default" | "in" | "out";
}) {
  const toneClass =
    tone === "in"
      ? "text-emerald-600"
      : tone === "out"
        ? "text-rose-600"
        : "text-[#0f1f4d]";

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold text-[#24345f]/80">{title}</p>
          <p className={["mt-3 text-[20px] font-black tracking-[-0.03em]", toneClass].join(" ")}>
            {value}
          </p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-[#24345f]">
          {icon}
        </div>
      </div>
    </div>
  );
}

export default async function CashBankAccountDetailPage({ params,
  searchParams,
}: Props) {
  const session = await guardPageModule("cash-bank");
  const company = session.company;
  const companyUser = session.companyUser;
  const effectiveRole = session.effectiveRole;
  const canManage = canManageAccounts(effectiveRole, companyUser.isOwner);
  const { id } = await params;
  const query = await searchParams;

  const detail = await getCachedCashBankAccountDetailData({
    companyId: company.id,
    accountId: id,
  });
  if (!detail) notFound();

  const { account, transactions, metrics, companyAccounts } = detail;
  const openMovementOnMount = query.movement === "1";

  return (
    <AppShell>
      <TenantPageSync />
      <div className="min-w-0 space-y-5">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <Link
                href="/cash-bank"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0f1f4d] transition hover:bg-slate-50"
              >
                <ArrowLeft size={18} strokeWidth={2.6} />
              </Link>

              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-black text-blue-600">
                  <Sparkles size={14} strokeWidth={2.5} />
                  {getAccountTypeText(account.type)}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {account.type === "BANK" ? (
                    <BankLogo
                      name={account.bankName || account.name}
                      className="h-10 w-10"
                      iconSize={16}
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white">
                      <Wallet size={18} />
                    </div>
                  )}

                  <div>
                    <h1 className="text-[26px] font-black tracking-tighter text-[#0f1f4d]">
                      {account.name}
                    </h1>
                    {account.iban ? (
                      <p className="mt-1 text-[12px] font-medium text-slate-500">
                        {account.iban}
                      </p>
                    ) : null}
                  </div>
                </div>

                <p className="mt-3 text-[13px] font-medium text-slate-500">
                  Güncel bakiye:{" "}
                  <span
                    className={[
                      "font-black",
                      getCashBalanceClass(account.balance),
                    ].join(" ")}
                  >
                    {formatCashMoney(account.balance)}
                  </span>
                </p>
                {Number(account.balance) < 0 ? (
                  <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700">
                    Hesap bakiyesi ekside. Yetkiniz varsa manuel düzeltme ile dengeleyebilirsiniz.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
              <AccountArchiveActions
                accountId={account.id}
                accountName={account.name}
                balance={account.balance}
                status={account.status}
                isDefault={account.isDefault}
                canManage={canManage}
              />
              <AccountDetailActions
              accountId={account.id}
              accountName={account.name}
              currentBalance={account.balance}
              companyAccounts={companyAccounts}
              openMovementOnMount={openMovementOnMount}
            />
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            title="Güncel Bakiye"
            value={formatCashMoney(metrics.currentBalance)}
            icon={<Landmark size={20} />}
          />
          <MetricCard
            title="Toplam Giriş"
            value={formatCashMoney(metrics.totalIn)}
            icon={<ArrowDownLeft size={20} />}
            tone="in"
          />
          <MetricCard
            title="Toplam Çıkış"
            value={formatCashMoney(metrics.totalOut)}
            icon={<ArrowUpRight size={20} />}
            tone="out"
          />
          <MetricCard
            title="Bu Ay Giriş"
            value={formatCashMoney(metrics.monthIn)}
            icon={<CalendarDays size={20} />}
            tone="in"
          />
          <MetricCard
            title="Bu Ay Çıkış"
            value={formatCashMoney(metrics.monthOut)}
            icon={<Building2 size={20} />}
            tone="out"
          />
        </section>

        <section
          id="movements"
          className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
        >
          <div className="border-b border-slate-100 px-4 py-4">
            <h2 className="text-[16px] font-black text-[#0f1f4d]">
              Hesap Hareketleri
            </h2>
            <p className="mt-1 text-[12px] font-medium text-slate-500">
              Satış tahsilatları, manuel işlemler, transferler ve iptaller.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-black text-[#24345f]/80">
                  <th className="px-3 py-3">Tarih</th>
                  <th className="px-3 py-3">İşlem Başlığı</th>
                  <th className="px-3 py-3">Açıklama / Not</th>
                  <th className="px-3 py-3 text-right">Tutar</th>
                  <th className="px-3 py-3">Tip</th>
                  <th className="px-3 py-3">Kaynak</th>
                  <th className="px-3 py-3">Referans</th>
                  <th className="px-3 py-3 text-right">Bakiye</th>
                  <th className="px-3 py-3 text-center">Detay</th>
                  <th className="px-3 py-3 text-center">İşlem</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {transactions.map((transaction) => {
                  const signed =
                    transaction.direction === "in"
                      ? transaction.amount
                      : -transaction.amount;

                  return (
                    <tr
                      key={transaction.id}
                      className="text-[12px] font-semibold text-[#24345f] transition hover:bg-slate-50/80"
                    >
                      <td className="whitespace-nowrap px-3 py-3 text-[11px] text-slate-500">
                        {formatDateTimeDisplay(transaction.date)}
                      </td>

                      <td className="max-w-[180px] px-3 py-3">
                        <p className="truncate text-[12px] font-extrabold text-[#0f1f4d]">
                          {transaction.title}
                        </p>
                      </td>

                      <td className="max-w-[180px] px-3 py-3">
                        <p className="truncate text-[11px] text-slate-500">
                          {transaction.note || "-"}
                        </p>
                      </td>

                      <td
                        className={[
                          "whitespace-nowrap px-3 py-3 text-right text-[12px] font-black",
                          signed >= 0 ? "text-emerald-600" : "text-rose-600",
                        ].join(" ")}
                      >
                        {signed >= 0 ? "+" : ""}
                        {formatCashMoney(signed)}
                      </td>

                      <td className="px-3 py-3">
                        <span
                          className={[
                            "inline-block whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-black",
                            transaction.direction === "in"
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-rose-50 text-rose-600",
                          ].join(" ")}
                        >
                          {transaction.directionLabel}
                        </span>
                      </td>

                      <td className="px-3 py-3">
                        <span className="inline-block whitespace-nowrap rounded-md bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">
                          {transaction.sourceLabel}
                        </span>
                      </td>

                      <td className="px-3 py-3 text-[11px] text-slate-500">
                        {transaction.reference || "-"}
                      </td>

                      <td className="whitespace-nowrap px-3 py-3 text-right text-[12px] font-black text-[#0f1f4d]">
                        {formatCashMoney(transaction.balanceAfter)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <Link
                          href={`/cash-bank/transactions/${transaction.id}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-[#24345f] transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600"
                          title="Detay"
                        >
                          <Eye size={13} />
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <CashBankTransactionRowActions
                          accountId={account.id}
                          transactionId={transaction.id}
                          title={transaction.title}
                          amount={transaction.amount}
                          direction={transaction.direction}
                          lifecycleActions={transaction.lifecycleActions}
                          isLinked={transaction.isLinked}
                          isTransfer={transaction.isTransfer}
                          transferGroupId={transaction.transferGroupId}
                          linkedHref={transaction.linkedHref}
                          recordLabel={transaction.title}
                        />
                      </td>
                    </tr>
                  );
                })}

                {transactions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-16 text-center text-[13px] font-medium text-slate-500"
                    >
                      Bu hesapta henüz hareket yok. Yeni hareket ekleyerek
                      başlayabilirsiniz.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
