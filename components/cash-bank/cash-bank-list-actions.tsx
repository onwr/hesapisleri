"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Banknote,
  Eye,
  Plus,
  Repeat,
  Wallet,
} from "lucide-react";
import {
  CashBankTransferModal,
  type CashBankAccountOption,
} from "@/components/cash-bank/cash-bank-transfer-modal";

type CashBankActionCardsProps = {
  accounts: CashBankAccountOption[];
};

export function CashBankActionCards({ accounts }: CashBankActionCardsProps) {
  const [transferOpen, setTransferOpen] = useState(false);

  const cards = [
    {
      title: "Tahsilat Al",
      description: "Müşteriden ödeme al",
      href: "/sales",
      icon: Wallet,
      gradient: "from-emerald-500 to-green-600",
      action: "link" as const,
    },
    {
      title: "Ödeme Yap",
      description: "Tedarikçiye ödeme yap",
      href: "/expenses",
      icon: Wallet,
      gradient: "from-blue-500 to-blue-600",
      action: "link" as const,
    },
    {
      title: "Para Transferi",
      description: "Hesaplar arası transfer",
      icon: Repeat,
      gradient: "from-orange-400 to-orange-600",
      action: "transfer" as const,
    },
    {
      title: "Kasa İşlemi",
      description: "Hesap seçerek hareket ekle",
      href: accounts[0] ? `/cash-bank/${accounts[0].id}?movement=1` : "/cash-bank?tab=accounts",
      icon: Banknote,
      gradient: "from-violet-500 to-purple-600",
      action: "link" as const,
    },
    {
      title: "Hesap Ekle",
      description: "Yeni kasa veya banka ekle",
      href: "/cash-bank?tab=accounts",
      icon: Plus,
      gradient: "from-rose-400 to-pink-600",
      action: "link" as const,
    },
  ];

  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;

          if (card.action === "transfer") {
            return (
              <button
                key={card.title}
                type="button"
                onClick={() => setTransferOpen(true)}
                className={[
                  "group flex h-[86px] w-full items-center justify-between rounded-2xl bg-linear-to-br p-4 text-left text-white shadow-[0_14px_30px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(15,23,42,0.16)]",
                  card.gradient,
                ].join(" ")}
              >
                <CardContent icon={Icon} title={card.title} description={card.description} />
              </button>
            );
          }

          return (
            <Link
              key={card.title}
              href={card.href!}
              className={[
                "group flex h-[86px] items-center justify-between rounded-2xl bg-linear-to-br p-4 text-white shadow-[0_14px_30px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(15,23,42,0.16)]",
                card.gradient,
              ].join(" ")}
            >
              <CardContent icon={Icon} title={card.title} description={card.description} />
            </Link>
          );
        })}
      </section>

      <CashBankTransferModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        accounts={accounts}
      />
    </>
  );
}

function CardContent({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Wallet;
  title: string;
  description: string;
}) {
  return (
    <>
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/15 shadow-inner">
          <Icon size={22} strokeWidth={2.4} />
        </div>

        <div className="min-w-0">
          <p className="truncate text-[15px] font-black leading-tight">{title}</p>
          <p className="mt-1 truncate text-[11px] font-medium text-white/85">
            {description}
          </p>
        </div>
      </div>

      <ArrowRight
        size={18}
        strokeWidth={3}
        className="shrink-0 opacity-90 transition group-hover:translate-x-1 group-hover:opacity-100"
      />
    </>
  );
}

type CashBankAccountRowActionsProps = {
  accountId: string;
  accounts: CashBankAccountOption[];
};

export function CashBankAccountRowActions({
  accountId,
  accounts,
}: CashBankAccountRowActionsProps) {
  const [transferOpen, setTransferOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-1">
        <Link
          href={`/cash-bank/${accountId}`}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-black text-[#24345f] transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600"
        >
          <Eye size={12} />
          Detay
        </Link>

        <Link
          href={`/cash-bank/${accountId}?movement=1`}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 text-[10px] font-black text-violet-700 transition hover:bg-violet-100"
        >
          <Plus size={12} />
          Hareket
        </Link>

        <button
          type="button"
          onClick={() => setTransferOpen(true)}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-orange-200 bg-orange-50 px-2 text-[10px] font-black text-orange-700 transition hover:bg-orange-100"
        >
          <Repeat size={12} />
          Transfer
        </button>
      </div>

      <CashBankTransferModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        accounts={accounts}
        defaultFromAccountId={accountId}
      />
    </>
  );
}
