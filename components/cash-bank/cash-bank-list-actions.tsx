"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  Banknote,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Repeat,
  Star,
  Wallet,
} from "lucide-react";
import {
  AccountFormDialog,
  type AccountFormRecord,
} from "@/components/cash-bank/account-form-dialog";
import {
  CashBankTransferModal,
  type CashBankAccountOption,
} from "@/components/cash-bank/cash-bank-transfer-modal";

type CashBankActionCardsProps = {
  accounts: CashBankAccountOption[];
  canManage?: boolean;
};

export function CashBankActionCards({
  accounts,
  canManage = false,
}: CashBankActionCardsProps) {
  const router = useRouter();
  const [transferOpen, setTransferOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [banner, setBanner] = useState("");

  const cards = [
    {
      title: "Tahsilat Al",
      description: "Müşteriden ödeme al",
      href: "/cash-bank/collections",
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
      title: "Yeni Hesap",
      description: "Kasa, banka veya POS ekle",
      icon: Plus,
      gradient: "from-rose-400 to-pink-600",
      action: "account" as const,
    },
  ];

  return (
    <>
      {banner ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {banner}
        </div>
      ) : null}

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

          if (card.action === "account") {
            return (
              <button
                key={card.title}
                type="button"
                onClick={() => {
                  if (canManage) {
                    setAccountDialogOpen(true);
                  }
                }}
                disabled={!canManage}
                className={[
                  "group flex h-[86px] w-full items-center justify-between rounded-2xl bg-linear-to-br p-4 text-left text-white shadow-[0_14px_30px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(15,23,42,0.16)] disabled:cursor-not-allowed disabled:opacity-70",
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

      <AccountFormDialog
        open={accountDialogOpen}
        onClose={() => setAccountDialogOpen(false)}
        mode="create"
        canManage={canManage}
        onSuccess={(message) => {
          setBanner(message);
          router.refresh();
        }}
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
  account?: AccountFormRecord;
  canManage?: boolean;
  isDefault?: boolean;
  status?: string;
};

export function CashBankAccountRowActions({
  accountId,
  accounts,
  account,
  canManage = false,
  isDefault = false,
  status = "ACTIVE",
}: CashBankAccountRowActionsProps) {
  const router = useRouter();
  const [transferOpen, setTransferOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  async function handleSetDefault() {
    setLoadingAction("default");
    try {
      const response = await fetch(`/api/cash-bank/accounts/${accountId}/default`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        alert(data.message || "Varsayılan hesap güncellenemedi.");
        return;
      }
      router.refresh();
    } catch {
      alert("Sunucuya bağlanırken bir hata oluştu.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleToggleStatus() {
    const nextStatus = status === "ACTIVE" ? "PASSIVE" : "ACTIVE";
    setLoadingAction("status");

    try {
      const response = await fetch(`/api/cash-bank/accounts/${accountId}`, {
        method: nextStatus === "PASSIVE" ? "DELETE" : "PATCH",
        headers:
          nextStatus === "ACTIVE"
            ? { "Content-Type": "application/json" }
            : undefined,
        body:
          nextStatus === "ACTIVE"
            ? JSON.stringify({ status: "ACTIVE" })
            : undefined,
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        alert(data.message || "Hesap durumu güncellenemedi.");
        return;
      }
      router.refresh();
    } catch {
      alert("Sunucuya bağlanırken bir hata oluştu.");
    } finally {
      setLoadingAction(null);
    }
  }

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

        {canManage && account ? (
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-black text-[#24345f] transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600"
          >
            <Pencil size={12} />
            Düzenle
          </button>
        ) : null}

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

        {canManage && !isDefault ? (
          <button
            type="button"
            onClick={handleSetDefault}
            disabled={loadingAction === "default"}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 text-[10px] font-black text-amber-700 transition hover:bg-amber-100 disabled:opacity-60"
          >
            {loadingAction === "default" ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Star size={12} />
            )}
            Varsayılan
          </button>
        ) : null}

        {canManage ? (
          <button
            type="button"
            onClick={handleToggleStatus}
            disabled={loadingAction === "status" || (isDefault && status === "ACTIVE")}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
          >
            {loadingAction === "status" ? (
              <Loader2 size={12} className="animate-spin" />
            ) : null}
            {status === "ACTIVE" ? "Pasif" : "Aktif"}
          </button>
        ) : null}
      </div>

      <CashBankTransferModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        accounts={accounts}
        defaultFromAccountId={accountId}
      />

      {account ? (
        <AccountFormDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          mode="edit"
          account={account}
          canManage={canManage}
          onSuccess={() => router.refresh()}
        />
      ) : null}
    </>
  );
}

type CashBankEmptyAccountsCtaProps = {
  canManage: boolean;
};

export function CashBankEmptyAccountsCta({ canManage }: CashBankEmptyAccountsCtaProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!canManage) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-rose-500 px-4 text-sm font-black text-white"
      >
        Yeni Hesap Ekle
      </button>

      <AccountFormDialog
        open={open}
        onClose={() => setOpen(false)}
        mode="create"
        canManage={canManage}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}
