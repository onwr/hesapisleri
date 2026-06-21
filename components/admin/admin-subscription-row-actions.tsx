"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { appOutlineButtonClass, appPrimaryButtonClass } from "@/lib/admin-ui";
import type { SubscriptionStatus } from "@prisma/client";

type RowItem = {
  id: string;
  companyId: string;
  companyName: string;
  status: SubscriptionStatus;
  updatedAt: string;
  hasPaymentMethod: boolean;
  autoRenew: boolean;
};

async function postAction(
  subscriptionId: string,
  path: string,
  body: Record<string, unknown>
) {
  const res = await fetch(`/api/admin/subscriptions/${subscriptionId}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || "İşlem başarısız.");
  }
}

async function patchAction(
  subscriptionId: string,
  path: string,
  body: Record<string, unknown>
) {
  const res = await fetch(`/api/admin/subscriptions/${subscriptionId}/${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || "İşlem başarısız.");
  }
}

export function AdminSubscriptionRowActions({ item }: { item: RowItem }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run(action: () => Promise<void>) {
    setLoading(true);
    setError("");
    try {
      await action();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "İşlem başarısız.");
    } finally {
      setLoading(false);
    }
  }

  const reason = "Admin panel işlemi";

  return (
    <div className="flex items-center gap-1.5">
      <Link
        href={`/admin/subscriptions/${item.id}`}
        className={`${appPrimaryButtonClass} !px-3 !py-1.5 !text-[12px]`}
      >
        Görüntüle
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={loading}
          className={`${appOutlineButtonClass} !px-2 !py-1.5`}
          aria-label={`${item.companyName} abonelik işlemleri`}
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <MoreHorizontal size={16} />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[200px]">
          <DropdownMenuItem asChild>
            <Link href={`/admin/subscriptions/${item.id}`}>Abonelik Detayı</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/admin/companies/${item.companyId}`}>Firma Detayı</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/admin/subscriptions/${item.id}?tab=payments`}>
              Ödeme Geçmişi
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {item.status === "TRIAL" ? (
            <DropdownMenuItem
              onClick={() =>
                run(() =>
                  postAction(item.id, "extend-trial", {
                    mode: "PLUS_7",
                    reason,
                    expectedUpdatedAt: item.updatedAt,
                  })
                )
              }
            >
              Trial +7 Gün
            </DropdownMenuItem>
          ) : null}
          {["PAST_DUE", "GRACE_PERIOD"].includes(item.status) ? (
            <DropdownMenuItem
              onClick={() =>
                run(() =>
                  postAction(item.id, "extend-grace", {
                    extraDays: 7,
                    reason,
                    expectedUpdatedAt: item.updatedAt,
                  })
                )
              }
            >
              Grace +7 Gün
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem asChild>
            <Link href={`/admin/subscriptions/${item.id}?tab=pricing&action=plan`}>
              Plan Değiştir
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/admin/subscriptions/${item.id}?tab=pricing&action=interval`}>
              Dönem Değiştir
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/admin/subscriptions/${item.id}?tab=pricing&action=special`}>
              Özel Fiyat Tanımla
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() =>
              run(() =>
                patchAction(item.id, "auto-renew", {
                  enabled: !item.autoRenew,
                  reason,
                  expectedUpdatedAt: item.updatedAt,
                })
              )
            }
            disabled={!item.autoRenew && !item.hasPaymentMethod}
          >
            {item.autoRenew ? "Auto-renew Kapat" : "Auto-renew Aç"}
          </DropdownMenuItem>
          {!["CANCELLED", "CANCEL_AT_PERIOD_END"].includes(item.status) ? (
            <DropdownMenuItem
              onClick={() =>
                run(() =>
                  postAction(item.id, "cancel", {
                    reason,
                    expectedUpdatedAt: item.updatedAt,
                  })
                )
              }
            >
              Dönem Sonunda İptal
            </DropdownMenuItem>
          ) : null}
          {["CANCEL_AT_PERIOD_END", "CANCELLED"].includes(item.status) ? (
            <DropdownMenuItem
              onClick={() =>
                run(() =>
                  postAction(item.id, "reactivate", {
                    reason,
                    expectedUpdatedAt: item.updatedAt,
                  })
                )
              }
            >
              İptali Geri Al
            </DropdownMenuItem>
          ) : null}
          {item.status !== "SUSPENDED" ? (
            <DropdownMenuItem
              onClick={() =>
                run(() =>
                  postAction(item.id, "suspend", {
                    reason,
                    expectedUpdatedAt: item.updatedAt,
                  })
                )
              }
            >
              Askıya Al
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() =>
                run(() =>
                  postAction(item.id, "activate", {
                    reason,
                    expectedUpdatedAt: item.updatedAt,
                  })
                )
              }
            >
              Aktifleştir
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link href={`/admin/subscriptions/${item.id}?tab=overview&action=extend`}>
              Manuel Uzat
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {error ? (
        <span className="text-[10px] font-medium text-rose-500">{error}</span>
      ) : null}
    </div>
  );
}
