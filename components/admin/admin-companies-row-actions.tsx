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

type AdminCompaniesRowActionsProps = {
  companyId: string;
  companyName: string;
  status: string;
};

export function AdminCompaniesRowActions({
  companyId,
  companyName,
  status,
}: AdminCompaniesRowActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function patchCompany(body: Record<string, unknown>) {
    setLoading(true);
    const response = await fetch(`/api/admin/companies/${companyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);

    if (response.ok) {
      router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <Link
        href={`/admin/companies/${companyId}`}
        className={`${appPrimaryButtonClass} !px-3 !py-1.5 !text-[12px]`}
      >
        Görüntüle
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={loading}
          className={`${appOutlineButtonClass} !px-2 !py-1.5`}
          aria-label={`${companyName} işlemleri`}
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <MoreHorizontal size={16} />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[180px]">
          <DropdownMenuItem asChild>
            <Link href={`/admin/companies/${companyId}`}>Düzenle</Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              patchCompany({
                status: status === "ACTIVE" ? "PASSIVE" : "ACTIVE",
              })
            }
          >
            {status === "ACTIVE" ? "Pasife Al" : "Aktife Al"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => patchCompany({ status: "SUSPENDED" })}>
            Askıya Al
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`/admin/companies/${companyId}#membership`}>
              Üyelik Detayı
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/admin/payments">Ödemeleri Gör</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
