"use client";

import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Plus,
  RefreshCcw,
  Repeat,
  Wallet,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import {
  formatCashDate,
  formatCashMoney,
  getTransactionColor,
  getTransactionText,
  type BalanceBreakdownItem,
  type TransactionRow,
} from "@/lib/cash-bank-page-utils";

type CashBankSidebarWidgetsProps = {
  balanceBreakdown: BalanceBreakdownItem[];
  totalBalance: number;
  recentTransactions: TransactionRow[];
};

function getTransactionIcon(type: string) {
  if (type === "INCOME" || type === "COLLECTION") {
    return <ArrowDownLeft size={15} strokeWidth={2.6} />;
  }

  if (type === "EXPENSE" || type === "PAYMENT") {
    return <ArrowUpRight size={15} strokeWidth={2.6} />;
  }

  return <RefreshCcw size={15} strokeWidth={2.6} />;
}

export function CashBankSidebarWidgets({
  balanceBreakdown,
  totalBalance,
  recentTransactions,
}: CashBankSidebarWidgetsProps) {
  const chartData = balanceBreakdown.map((item) => ({
    name: item.name,
    value: item.total,
    color: item.color,
  }));

  const hasChartData = chartData.length > 0;

  return (
    <>
      <div className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
        <h3 className="text-[14px] font-extrabold text-[#0f1f4d]">
          Bakiye Dağılımı
        </h3>

        <div className="mt-4 grid grid-cols-[148px_minmax(0,1fr)] items-center gap-4">
          <div className="relative mx-auto h-[148px] w-[148px] shrink-0 sm:mx-0">
            {hasChartData ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="#ffffff"
                      strokeWidth={2}
                      isAnimationActive
                      animationBegin={0}
                      animationDuration={900}
                      animationEasing="ease-out"
                    >
                      {chartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
                  <p className="text-[12px] font-black leading-tight tracking-[-0.03em] text-[#0f1f4d]">
                    {formatCashMoney(totalBalance)}
                  </p>
                  <p className="mt-1 text-[10px] font-bold text-slate-500">Toplam</p>
                </div>
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-full border border-dashed border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-400">
                Veri yok
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-2.5">
            {hasChartData ? (
              chartData.map((item, index) => (
                <div
                  key={item.name}
                  className="animate-in fade-in slide-in-from-right-2 fill-mode-both duration-500"
                  style={{ animationDelay: `${120 + index * 70}ms` }}
                >
                  <div className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-start gap-x-2">
                    <span
                      className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <p className="min-w-0 text-[11px] font-bold leading-snug text-[#24345f]">
                      {item.name}
                    </p>
                    <p className="whitespace-nowrap text-[11px] font-black text-[#0f1f4d]">
                      {formatCashMoney(item.value)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-[11px] font-medium text-slate-500">
                Henüz bakiye verisi yok.
              </p>
            )}
          </div>
        </div>
      </div>

      <div
        className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)] duration-500"
        style={{ animationDelay: "120ms" }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-[14px] font-extrabold text-[#0f1f4d]">Son Hareketler</h3>
          <Link
            href="/cash-bank?tab=movements"
            className="text-[11px] font-black text-blue-600 hover:text-blue-700"
          >
            Tümünü Gör
          </Link>
        </div>

        <div className="space-y-3">
          {recentTransactions.length > 0 ? (
            recentTransactions.map((transaction, index) => (
              <Link
                key={transaction.id}
                href={`/cash-bank/transactions/${transaction.id}`}
                className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both flex items-start gap-3 rounded-xl transition hover:bg-slate-50 duration-500"
                style={{ animationDelay: `${160 + index * 50}ms` }}
              >
                <div
                  className={[
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    getTransactionColor(transaction.type),
                  ].join(" ")}
                >
                  {getTransactionIcon(transaction.type)}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-extrabold leading-snug text-[#0f1f4d]">
                    {getTransactionText(transaction.type)} - {transaction.title}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] font-medium text-slate-500">
                    {transaction.accountName}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="whitespace-nowrap text-[11px] font-black text-[#0f1f4d]">
                    {formatCashMoney(transaction.amount)}
                  </p>
                  <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                    {formatCashDate(transaction.date)}
                  </p>
                </div>
              </Link>
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-[12px] font-medium text-slate-500">
              Henüz hareket yok
            </p>
          )}
        </div>
      </div>

      <div
        className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)] duration-500"
        style={{ animationDelay: "220ms" }}
      >
        <h3 className="mb-4 text-[14px] font-extrabold text-[#0f1f4d]">Kısayollar</h3>

        <div className="grid grid-cols-4 gap-3">
          {[
            {
              label: "Tahsilat Al",
              href: "/cash-bank?tab=movements",
              icon: Wallet,
              color: "bg-emerald-50 text-emerald-600",
            },
            {
              label: "Ödeme Yap",
              href: "/cash-bank?tab=pending",
              icon: CreditCard,
              color: "bg-rose-50 text-rose-500",
            },
            {
              label: "Transfer",
              href: "/cash-bank?tab=transfers",
              icon: Repeat,
              color: "bg-blue-50 text-blue-600",
            },
            {
              label: "Hesap Ekle",
              href: "/cash-bank",
              icon: Plus,
              color: "bg-violet-50 text-violet-600",
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.label}
                href={item.href}
                className="group flex flex-col items-center gap-2 text-center"
              >
                <span
                  className={[
                    "flex h-12 w-12 items-center justify-center rounded-2xl transition group-hover:scale-105",
                    item.color,
                  ].join(" ")}
                >
                  <Icon size={20} strokeWidth={2.4} />
                </span>

                <span className="text-[10px] font-bold leading-tight text-[#24345f]">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
