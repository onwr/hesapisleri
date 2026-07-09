import Link from "next/link";
import {
  ArrowDownLeft,
  Banknote,
  Building2,
  Clock3,
  PieChart,
  Plus,
  RefreshCcw,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { guardPageModule } from "@/lib/module-access";

import { BankLogo } from "@/components/shared/bank-logo";
import {
  CashBankAccountRowActions,
  CashBankActionCards,
  CashBankEmptyAccountsCta,
} from "@/components/cash-bank/cash-bank-list-actions";
import {
  CashBankTablePagination,
  CashBankTableToolbar,
} from "@/components/cash-bank/cash-bank-table-controls";
import { CashBankSidebarWidgets } from "@/components/cash-bank/cash-bank-sidebar-widgets";
import { CashBankTransactionRowActions } from "@/components/cash-bank/cash-bank-transaction-row-actions";
import { AiPageTriggerButton } from "@/components/ai-assistant/ai-page-trigger-button";
import { getCachedCashBankPageData } from "@/lib/tenant-cache/cached-tenant-page-data";
import { TenantPageSync } from "@/components/tenant-cache/tenant-page-sync";
import {
  buildCashBankQuery,
  formatCashDate,
  formatCashMoney,
  getCashBalanceClass,
  getAccountStatusBadge,
  getAccountTypeText,
  getTransactionColor,
  getTransactionText,
  parseCashBankTab,
  parsePage,
  parseSearchQuery,
} from "@/lib/cash-bank-page-utils";
import { canManageAccounts, resolveEffectiveRole } from "@/lib/permission-utils";

type CashBankPageProps = {
  searchParams: Promise<{
    tab?: string;
    page?: string;
    q?: string;
  }>;
};

const statIconMap = {
  wallet: Wallet,
  building: Building2,
  pie: PieChart,
  clock: Clock3,
  refresh: RefreshCcw,
};

const colorClassMap = {
  emerald: "bg-emerald-50 text-emerald-600",
  blue: "bg-blue-50 text-blue-600",
  violet: "bg-violet-50 text-violet-600",
  orange: "bg-orange-50 text-orange-500",
};

const cashIconColors = ["bg-emerald-500", "bg-yellow-400", "bg-teal-500"];

export default async function CashBankPage({ searchParams }: CashBankPageProps) {
  const session = await guardPageModule("cash-bank");
  const company = session.company;
  const companyUser = session.companyUser;
  const effectiveRole = session.effectiveRole;
  const params = await searchParams;
const canManage = canManageAccounts(effectiveRole, companyUser.isOwner);

  const activeTab = parseCashBankTab(params.tab);
  const currentPage = parsePage(params.page);
  const searchQuery = parseSearchQuery(params.q);

  const {
    statCards,
    cashAccounts,
    bankAccounts,
    transactionRows,
    balanceBreakdown,
    recentTransactions,
    totalBalance,
    totalRecords,
    totalPages,
    currentPage: page,
  } = await getCachedCashBankPageData({
    companyId: company.id,
    tab: activeTab,
    page: currentPage,
    q: searchQuery,
  });

  const actionAccountOptions = [...cashAccounts, ...bankAccounts]
    .filter((account) => account.status === "ACTIVE")
    .map((account) => ({
      id: account.id,
      name: account.name,
      type: account.type,
      balance: account.balance,
    }));

  const hasFilters = Boolean(searchQuery) || activeTab !== "accounts";
  const isAccountsTab = activeTab === "accounts";

  function toAccountFormRecord(
    account: (typeof cashAccounts)[number] | (typeof bankAccounts)[number]
  ) {
    return {
      id: account.id,
      name: account.name,
      type: account.type,
      bankName: account.bankName,
      branchName: account.branchName,
      iban: account.iban,
      accountNumber: account.accountNumber,
      currency: account.currency,
      isDefault: account.isDefault,
      description: account.description,
      status: account.status === "ACTIVE" ? ("ACTIVE" as const) : ("PASSIVE" as const),
    };
  }

  return (
    <AppShell>
      <TenantPageSync />
      <div className="min-w-0 space-y-5">
        <div className="flex justify-end">
          <AiPageTriggerButton moduleKey="cash-bank" />
        </div>

        <CashBankActionCards accounts={actionAccountOptions} canManage={canManage} />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {statCards.map((stat) => {
            const Icon = statIconMap[stat.iconKey];

            return (
              <div
                key={stat.title}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-extrabold text-[#24345f]/80">
                      {stat.title}
                    </p>

                    <p className="mt-3 text-[20px] font-black tracking-[-0.03em] text-[#0f1f4d]">
                      {stat.value}
                    </p>
                  </div>

                  <div
                    className={[
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                      colorClassMap[stat.color],
                    ].join(" ")}
                  >
                    <Icon size={22} strokeWidth={2.4} />
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                  <span>{stat.subtitle}</span>
                </div>
              </div>
            );
          })}
        </section>

        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
          <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <CashBankTableToolbar
              activeTab={activeTab}
              searchQuery={searchQuery}
            />

            {isAccountsTab ? (
              <div className="space-y-5 p-4">
                <div>
                  <h3 className="mb-3 text-[14px] font-extrabold text-[#0f1f4d]">
                    Kasa Hesapları
                  </h3>

                  <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <table className="w-full min-w-[680px] text-left">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-black text-[#24345f]/80">
                          <th className="px-2 py-2.5">Hesap Adı</th>
                          <th className="px-2 py-2.5">Tür</th>
                          <th className="px-2 py-2.5 text-right">Bakiye</th>
                          <th className="px-2 py-2.5">Durum</th>
                          <th className="min-w-[220px] px-2 py-2.5 text-center">İşlem</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {cashAccounts.map((account, index) => {
                          const statusBadge = getAccountStatusBadge(account.status);

                          return (
                            <tr
                              key={account.id}
                              className="text-[12px] font-semibold text-[#24345f] transition hover:bg-slate-50/80"
                            >
                              <td className="max-w-[180px] px-2 py-2.5">
                                <div className="flex min-w-0 items-center gap-2">
                                  <div
                                    className={[
                                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white",
                                      cashIconColors[index % cashIconColors.length],
                                    ].join(" ")}
                                  >
                                    <Wallet size={14} strokeWidth={2.5} />
                                  </div>
                                  <p className="truncate text-[12px] font-extrabold text-[#0f1f4d]">
                                    {account.name}
                                  </p>
                                  {account.isDefault ? (
                                    <span className="mt-0.5 inline-block rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-black text-amber-700">
                                      Varsayılan
                                    </span>
                                  ) : null}
                                </div>
                              </td>

                              <td className="px-2 py-2.5">
                                <span className="inline-block whitespace-nowrap rounded-md bg-violet-50 px-2 py-1 text-[10px] font-black text-violet-600">
                                  {getAccountTypeText(account.type)}
                                </span>
                              </td>

                              <td
                                className={[
                                  "whitespace-nowrap px-2 py-2.5 text-right text-[12px] font-black",
                                  getCashBalanceClass(account.balance),
                                ].join(" ")}
                              >
                                {formatCashMoney(account.balance)}
                              </td>

                              <td className="px-2 py-2.5">
                                <span
                                  className={[
                                    "inline-block whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-black",
                                    statusBadge.className,
                                  ].join(" ")}
                                >
                                  {statusBadge.label}
                                </span>
                              </td>

                              <td className="px-2 py-2.5">
                                <CashBankAccountRowActions
                                  accountId={account.id}
                                  accounts={actionAccountOptions}
                                  canManage={canManage}
                                  isDefault={account.isDefault}
                                  status={account.status}
                                  balance={account.balance}
                                  accountName={account.name}
                                  account={toAccountFormRecord(account)}
                                />
                              </td>
                            </tr>
                          );
                        })}

                        {cashAccounts.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-4 py-8 text-center text-[13px] font-medium text-slate-500"
                            >
                              <div>
                                {hasFilters
                                  ? "Bu filtrede kasa hesabı bulunamadı"
                                  : "Henüz hesap eklenmedi."}
                                {!hasFilters ? (
                                  <CashBankEmptyAccountsCta canManage={canManage} />
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 text-[14px] font-extrabold text-[#0f1f4d]">
                    Banka Hesapları
                  </h3>

                  <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <table className="w-full min-w-[680px] text-left">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-black text-[#24345f]/80">
                          <th className="px-2 py-2.5">Hesap Adı</th>
                          <th className="px-2 py-2.5">Banka</th>
                          <th className="px-2 py-2.5 text-right">Bakiye</th>
                          <th className="px-2 py-2.5">Durum</th>
                          <th className="min-w-[220px] px-2 py-2.5 text-center">İşlem</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {bankAccounts.map((account) => {
                          const statusBadge = getAccountStatusBadge(account.status);
                          const bankLabel = account.bankName || account.name;

                          return (
                            <tr
                              key={account.id}
                              className="text-[12px] font-semibold text-[#24345f] transition hover:bg-slate-50/80"
                            >
                              <td className="max-w-[200px] px-2 py-2.5">
                                <div className="flex min-w-0 items-center gap-2">
                                  <BankLogo
                                    name={bankLabel}
                                    className="h-8 w-8"
                                    iconSize={14}
                                  />

                                  <div className="min-w-0">
                                    <p className="truncate text-[12px] font-extrabold text-[#0f1f4d]">
                                      {account.name}
                                    </p>
                                    {account.isDefault ? (
                                      <span className="mt-0.5 inline-block rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-black text-amber-700">
                                        Varsayılan
                                      </span>
                                    ) : null}
                                    {account.iban ? (
                                      <p className="mt-0.5 truncate text-[10px] font-medium text-slate-500">
                                        {account.iban}
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                              </td>

                              <td className="max-w-[120px] px-2 py-2.5">
                                <p className="truncate text-slate-600">
                                  {account.bankName || "-"}
                                </p>
                                <span className="mt-1 inline-block rounded-md bg-blue-50 px-1.5 py-0.5 text-[9px] font-black text-blue-600">
                                  {getAccountTypeText(account.type)}
                                </span>
                              </td>

                              <td
                                className={[
                                  "whitespace-nowrap px-2 py-2.5 text-right text-[12px] font-black",
                                  getCashBalanceClass(account.balance),
                                ].join(" ")}
                              >
                                {formatCashMoney(account.balance)}
                              </td>

                              <td className="px-2 py-2.5">
                                <span
                                  className={[
                                    "inline-block whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-black",
                                    statusBadge.className,
                                  ].join(" ")}
                                >
                                  {statusBadge.label}
                                </span>
                              </td>

                              <td className="px-2 py-2.5">
                                <CashBankAccountRowActions
                                  accountId={account.id}
                                  accounts={actionAccountOptions}
                                  canManage={canManage}
                                  isDefault={account.isDefault}
                                  status={account.status}
                                  balance={account.balance}
                                  accountName={account.name}
                                  account={toAccountFormRecord(account)}
                                />
                              </td>
                            </tr>
                          );
                        })}

                        {bankAccounts.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-4 py-8 text-center text-[13px] font-medium text-slate-500"
                            >
                              <div>
                                {hasFilters
                                  ? "Bu filtrede banka hesabı bulunamadı"
                                  : "Henüz banka hesabı yok"}
                                {!hasFilters && cashAccounts.length === 0 ? (
                                  <CashBankEmptyAccountsCta canManage={canManage} />
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-black text-[#24345f]/80">
                      <th className="whitespace-nowrap px-2 py-2.5">Tarih</th>
                      <th className="px-2 py-2.5">Açıklama</th>
                      <th className="px-2 py-2.5">Tür</th>
                      <th className="px-2 py-2.5">Hesap</th>
                      <th className="px-2 py-2.5 text-right">Tutar</th>
                      <th className="w-[72px] px-2 py-2.5 text-center">İşlem</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {transactionRows.map((transaction) => (
                      <tr
                        key={transaction.id}
                        className="text-[12px] font-semibold text-[#24345f] transition hover:bg-slate-50/80"
                      >
                        <td className="whitespace-nowrap px-2 py-2.5 text-[11px] text-slate-500">
                          {formatCashDate(transaction.date)}
                        </td>

                        <td className="max-w-[180px] px-2 py-2.5">
                          <p className="truncate text-[12px] font-extrabold text-[#0f1f4d]">
                            {transaction.title}
                          </p>
                        </td>

                        <td className="px-2 py-2.5">
                          <span
                            className={[
                              "inline-block whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-black",
                              getTransactionColor(transaction.type),
                            ].join(" ")}
                          >
                            {getTransactionText(transaction.type)}
                          </span>
                        </td>

                        <td className="max-w-[160px] px-2 py-2.5">
                          <div className="flex min-w-0 items-center gap-2">
                            {transaction.accountType === "BANK" ? (
                              <BankLogo
                                name={transaction.bankName || transaction.accountName}
                                className="h-7 w-7"
                                iconSize={12}
                              />
                            ) : (
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                                <Wallet size={12} strokeWidth={2.4} />
                              </div>
                            )}
                            <p className="truncate text-[11px] text-slate-600">
                              {transaction.accountName}
                            </p>
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-2 py-2.5 text-right text-[12px] font-black text-[#0f1f4d]">
                          {formatCashMoney(transaction.amount)}
                        </td>

                        <td className="px-2 py-2.5">
                          <CashBankTransactionRowActions
                            accountId={transaction.accountId}
                            transactionId={transaction.id}
                            title={transaction.title}
                            amount={transaction.amount}
                            direction={transaction.direction}
                            lifecycleActions={transaction.lifecycleActions}
                            isLinked={transaction.isLinked && !transaction.isTransfer}
                            isTransfer={transaction.isTransfer}
                            transferGroupId={transaction.transferGroupId}
                            linkedHref={transaction.linkedHref}
                            recordLabel={transaction.title}
                            transferCancelled={transaction.transferCancelled}
                            detailHref={`/cash-bank/transactions/${transaction.id}`}
                          />
                        </td>
                      </tr>
                    ))}

                    {transactionRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-16 text-center">
                          <div className="mx-auto max-w-sm">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-blue-600">
                              <RefreshCcw size={28} />
                            </div>

                            <p className="mt-4 text-lg font-black text-[#0f1f4d]">
                              {hasFilters
                                ? "Bu filtrede hareket bulunamadı"
                                : "Henüz hareket yok"}
                            </p>

                            <p className="mt-2 text-sm leading-6 text-slate-500">
                              {hasFilters
                                ? "Arama veya sekme filtrenizi değiştirerek tekrar deneyebilirsiniz."
                                : "İlk hareketi ekleyerek kasa ve banka takibine başlayabilirsiniz."}
                            </p>

                            <Link
                              href={
                                hasFilters
                                  ? buildCashBankQuery({ tab: activeTab })
                                  : "/cash-bank?tab=movements"
                              }
                              className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl bg-blue-600 px-5 text-sm font-black text-white"
                            >
                              {hasFilters ? "Filtreyi Temizle" : "Hareketlere Git"}
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}

            <CashBankTablePagination
              activeTab={activeTab}
              searchQuery={searchQuery}
              totalPages={totalPages}
              currentPage={page}
              totalRecords={totalRecords}
            />
          </section>

          <aside className="space-y-4">
            <CashBankSidebarWidgets
              balanceBreakdown={balanceBreakdown}
              totalBalance={totalBalance}
              recentTransactions={recentTransactions}
            />
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
