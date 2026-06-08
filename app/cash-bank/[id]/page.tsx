import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CalendarDays,
  Landmark,
  Sparkles,
  Wallet,
} from "lucide-react";
import { AccountDetailActions } from "@/components/cash-bank/account-detail-actions";
import { AppShell } from "@/components/layout/app-shell";
import { BankLogo } from "@/components/shared/bank-logo";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { getAccountDetailData } from "@/lib/cash-bank-account-service";
import {
  formatCashMoney,
  getAccountTypeText,
} from "@/lib/cash-bank-page-utils";
import { db } from "@/lib/prisma";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ movement?: string }>;
};

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

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

export default async function CashBankAccountDetailPage({
  params,
  searchParams,
}: Props) {
  const { id } = await params;
  const query = await searchParams;

  const token = await getAuthToken();
  if (!token) redirect("/login");

  const payload = verifyToken<AuthPayload>(token);
  if (!payload?.userId || !payload.companyId) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    include: {
      companyUsers: {
        include: { company: true },
      },
    },
  });

  if (!user) redirect("/login");

  const company =
    user.companyUsers.find((item) => item.companyId === payload.companyId)
      ?.company ?? user.companyUsers[0]?.company;

  if (!company) redirect("/login");

  const detail = await getAccountDetailData(company.id, id);
  if (!detail) notFound();

  const { account, transactions, metrics, companyAccounts } = detail;
  const openMovementOnMount = query.movement === "1";

  return (
    <AppShell>
      <div className="space-y-5">
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
                  <span className="font-black text-emerald-600">
                    {formatCashMoney(account.balance)}
                  </span>
                </p>
              </div>
            </div>

            <AccountDetailActions
              accountId={account.id}
              accountName={account.name}
              currentBalance={account.balance}
              companyAccounts={companyAccounts}
              openMovementOnMount={openMovementOnMount}
            />
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

        <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
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
                        {formatDateTime(transaction.date)}
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
                    </tr>
                  );
                })}

                {transactions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
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
