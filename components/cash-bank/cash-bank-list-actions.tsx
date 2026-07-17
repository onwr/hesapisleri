"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Archive,
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  Loader2,
  MoreHorizontal,
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
import {
  CompactActionCard,
} from "@/components/cards/compact-action-card";
import { CompactActionCardGrid } from "@/components/cards/compact-action-card-grid";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTenantMutation } from "@/hooks/use-tenant-mutation";
import { TransactionCancelDialog } from "@/components/transactions/transaction-cancel-dialog";
import { notifyTenantCacheSync } from "@/lib/tenant-cache/client-tenant-sync";

type CashBankActionCardsProps = {
  accounts: CashBankAccountOption[];
  canManage?: boolean;
};

export function CashBankActionCards({
  accounts,
  canManage = false,
}: CashBankActionCardsProps) {
  const [transferOpen, setTransferOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [banner, setBanner] = useState("");

  return (
    <>
      {banner ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {banner}
        </div>
      ) : null}

      <CompactActionCardGrid columns="6">
        <CompactActionCard
          title="Tahsilat Al"
          description="Müşteriden ödeme al"
          href="/cash-bank/collections"
          iconName="wallet"
          color="emerald"
        />
        <CompactActionCard
          title="Gün Sonu"
          description="Kasa kapanış kontrolü"
          href="/cash-bank/daily-close"
          iconName="banknote"
          color="orange"
        />
        <CompactActionCard
          title="Ödeme Yap"
          description="Tedarikçiye ödeme yap"
          href="/expenses"
          iconName="wallet"
          color="blue"
        />
        <CompactActionCard
          title="Para Transferi"
          description="Hesaplar arası transfer"
          iconName="repeat"
          color="orange"
          onClick={() => setTransferOpen(true)}
        />
        <CompactActionCard
          title="Kasa İşlemi"
          description="Hesap seçerek hareket ekle"
          href={
            accounts[0]
              ? `/cash-bank/${accounts[0].id}?movement=1`
              : "/cash-bank?tab=accounts"
          }
          iconName="banknote"
          color="violet"
        />
        <CompactActionCard
          title="Yeni Hesap"
          description="Kasa, banka veya POS ekle"
          iconName="plus"
          color="rose"
          onClick={() => {
            if (canManage) {
              setAccountDialogOpen(true);
            }
          }}
          disabled={!canManage}
        />
      </CompactActionCardGrid>

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
          notifyTenantCacheSync();
        }}
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
  balance?: number;
  accountName?: string;
};

export function CashBankAccountRowActions({
  accountId,
  accounts,
  account,
  canManage = false,
  isDefault = false,
  status = "ACTIVE",
  balance = 0,
  accountName = "",
}: CashBankAccountRowActionsProps) {
  const { mutate, isSubmitting } = useTenantMutation({ refresh: false });
  const [transferOpen, setTransferOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  async function handleSetDefault() {
    setLoadingAction("default");
    const result = await mutate(`/api/cash-bank/accounts/${accountId}/default`, {
      method: "POST",
    });
    if (!result.ok && result.error !== "duplicate_submit") {
      alert(result.error || "Varsayılan hesap güncellenemedi.");
    }
    setLoadingAction(null);
  }

  async function handleToggleStatus() {
    const nextStatus = status === "ACTIVE" ? "PASSIVE" : "ACTIVE";

    if (nextStatus === "PASSIVE") {
      if (isDefault) {
        window.alert("Varsayılan hesap arşivlenemez. Önce başka bir hesabı varsayılan yapın.");
        return;
      }
      setArchiveOpen(true);
      return;
    }

    setLoadingAction("status");

    const result = await mutate(`/api/cash-bank/accounts/${accountId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ACTIVE" }),
    });
    if (!result.ok && result.error !== "duplicate_submit") {
      alert(result.error || "Hesap durumu güncellenemedi.");
    }
    setLoadingAction(null);
  }

  async function confirmArchive() {
    setLoadingAction("status");

    const result = await mutate(`/api/cash-bank/accounts/${accountId}`, {
      method: "DELETE",
    });
    if (!result.ok && result.error !== "duplicate_submit") {
      setLoadingAction(null);
      return { ok: false, message: result.error || "Hesap arşivlenemedi." };
    }

    setLoadingAction(null);
    return { ok: true };
  }

  const name = accountName || account?.name || "Hesap";
  const archiveWarning =
    balance !== 0
      ? `${name} hesabının bakiyesi ${balance.toFixed(2)} TRY. Arşivleme geçmiş hareketleri korur.`
      : `${name} hesabı arşivlenecek ve yeni işlem seçimlerinde görünmez.`;

  const busy = isSubmitting || loadingAction !== null;
  const isActive = status === "ACTIVE";
  const menuLabel = accountName?.trim()
    ? `${accountName.trim()} işlemleri`
    : "Hesap işlemleri";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600"
            aria-label={menuLabel}
            onClick={(event) => event.stopPropagation()}
          >
            {busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <MoreHorizontal size={14} />
            )}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-52 rounded-xl p-1"
          onClick={(event) => event.stopPropagation()}
        >
          <DropdownMenuItem asChild>
            <Link
              href={`/cash-bank/${accountId}`}
              className="cursor-pointer gap-2"
              onClick={(event) => event.stopPropagation()}
            >
              <Eye size={14} />
              Hesabı Görüntüle
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link
              href={`/cash-bank/${accountId}#movements`}
              className="cursor-pointer gap-2"
              onClick={(event) => event.stopPropagation()}
            >
              <Wallet size={14} />
              Hareketleri Görüntüle
            </Link>
          </DropdownMenuItem>

          {canManage && account && isActive ? (
            <DropdownMenuItem
              className="cursor-pointer gap-2"
              onClick={(event) => {
                event.stopPropagation();
                setEditOpen(true);
              }}
            >
              <Pencil size={14} />
              Hesabı Düzenle
            </DropdownMenuItem>
          ) : null}

          {canManage && isActive ? (
            <>
              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="cursor-pointer gap-2"
                disabled={busy}
                onClick={(event) => {
                  event.stopPropagation();
                  setTransferOpen(true);
                }}
              >
                <Repeat size={14} />
                Transfer Yap
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <Link
                  href={`/cash-bank/${accountId}?movement=1`}
                  className="cursor-pointer gap-2"
                  onClick={(event) => event.stopPropagation()}
                >
                  <ArrowDownLeft size={14} />
                  Tahsilat Al
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <Link
                  href="/expenses"
                  className="cursor-pointer gap-2"
                  onClick={(event) => event.stopPropagation()}
                >
                  <ArrowUpRight size={14} />
                  Ödeme Yap
                </Link>
              </DropdownMenuItem>
            </>
          ) : null}

          {canManage && !isDefault && isActive ? (
            <DropdownMenuItem
              className="cursor-pointer gap-2"
              disabled={busy}
              onClick={(event) => {
                event.stopPropagation();
                void handleSetDefault();
              }}
            >
              <Star size={14} />
              Varsayılan Yap
            </DropdownMenuItem>
          ) : null}

          {canManage ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-rose-600 focus:text-rose-600"
                disabled={busy || (isDefault && isActive)}
                onClick={(event) => {
                  event.stopPropagation();
                  void handleToggleStatus();
                }}
              >
                <Archive size={14} />
                {isActive ? "Arşivle" : "Aktifleştir"}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

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
          onSuccess={() => notifyTenantCacheSync()}
        />
      ) : null}

      <TransactionCancelDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Hesabı Arşivle"
        description={archiveWarning}
        recordLabel={name}
        requiresReason={false}
        confirmLabel="Arşivle"
        onConfirm={confirmArchive}
      />
    </>
  );
}

type CashBankEmptyAccountsCtaProps = {
  canManage: boolean;
};

export function CashBankEmptyAccountsCta({ canManage }: CashBankEmptyAccountsCtaProps) {
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
        onSuccess={() => notifyTenantCacheSync()}
      />
    </>
  );
}
