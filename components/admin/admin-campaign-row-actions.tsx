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

type Action = "publish" | "pause" | "activate" | "archive";

export function AdminCampaignRowActions({
  campaignId,
  status,
}: {
  campaignId: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<Action | null>(null);

  async function run(action: Action) {
    setLoading(action);
    try {
      const res = await fetch(`/api/admin/membership-campaigns/${campaignId}/${action}`, {
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

  return (
    <div className="flex items-center gap-1.5">
      <Link
        href={`/admin/membership-campaigns/${campaignId}`}
        className={`${appPrimaryButtonClass} !px-3 !py-1.5 !text-[12px]`}
      >
        Görüntüle
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={loading !== null}
          className={`${appOutlineButtonClass} !px-2 !py-1.5`}
          aria-label="Kampanya işlemleri"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <MoreHorizontal size={16} />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[180px]">
          <DropdownMenuItem asChild>
            <Link href={`/admin/membership-campaigns/${campaignId}?tab=preview`}>
              Önizle
            </Link>
          </DropdownMenuItem>
          {(status === "DRAFT" || status === "SCHEDULED") && (
            <DropdownMenuItem onClick={() => run("publish")}>Yayınla</DropdownMenuItem>
          )}
          {(status === "ACTIVE" || status === "SCHEDULED") && (
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
                  if (confirm("Kampanya arşivlensin mi?")) run("archive");
                }}
              >
                Arşivle
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
