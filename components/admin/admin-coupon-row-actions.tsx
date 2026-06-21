"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, Loader2, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { appOutlineButtonClass, appPrimaryButtonClass } from "@/lib/admin-ui";

type Action = "pause" | "activate" | "archive";

export function AdminCouponCopyButton({ code }: { code: string }) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    setLoading(true);
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copyCode}
      className={`${appOutlineButtonClass} !px-2 !py-1.5`}
      aria-label={`${code} kodunu kopyala`}
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : copied ? (
        <span className="text-[10px]">OK</span>
      ) : (
        <Copy size={14} />
      )}
    </button>
  );
}

export function AdminCouponRowActions({
  couponId,
  status,
  code,
  showCopy = false,
}: {
  couponId: string;
  status: string;
  code: string;
  showCopy?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<Action | "copy" | null>(null);
  const [copied, setCopied] = useState(false);

  async function run(action: Action) {
    setLoading(action);
    try {
      const res = await fetch(`/api/admin/membership-coupons/${couponId}/${action}`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "İşlem başarısız.");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "İşlem başarısız.");
    } finally {
      setLoading(null);
    }
  }

  async function copyCode() {
    setLoading("copy");
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      {showCopy ? (
        <button
          type="button"
          onClick={copyCode}
          className={`${appOutlineButtonClass} !px-2 !py-1.5`}
          aria-label={`${code} kodunu kopyala`}
        >
          {loading === "copy" ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Copy size={14} />
          )}
        </button>
      ) : null}
      <Link
        href={`/admin/membership-coupons/${couponId}`}
        className={`${appPrimaryButtonClass} !px-3 !py-1.5 !text-[12px]`}
      >
        Detay
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={loading !== null}
          className={`${appOutlineButtonClass} !px-2 !py-1.5`}
          aria-label="Kupon işlemleri"
        >
          {loading && loading !== "copy" ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <MoreHorizontal size={16} />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[180px]">
          <DropdownMenuItem onClick={copyCode}>Kodu Kopyala</DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/admin/membership-coupons/${couponId}?tab=preview`}>
              Fiyat Önizleme
            </Link>
          </DropdownMenuItem>
          {status === "ACTIVE" && (
            <DropdownMenuItem onClick={() => run("pause")}>Duraklat</DropdownMenuItem>
          )}
          {status === "PAUSED" && (
            <DropdownMenuItem onClick={() => run("activate")}>Aktifleştir</DropdownMenuItem>
          )}
          {status !== "ARCHIVED" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  if (confirm("Kupon arşivlensin mi?")) run("archive");
                }}
              >
                Arşivle
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {copied ? (
        <span className="text-[10px] font-semibold text-emerald-600">Kopyalandı</span>
      ) : null}
    </div>
  );
}
