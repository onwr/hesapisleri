"use client";

import Link from "next/link";
import { useState } from "react";
import { MoreVertical, ReceiptText, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTenantMutation } from "@/hooks/use-tenant-mutation";

type SuppliersRowActionsProps = {
  supplierId: string;
  supplierName: string;
  canManage: boolean;
};

export function SuppliersRowActions({
  supplierId,
  supplierName,
  canManage,
}: SuppliersRowActionsProps) {
  const { mutate, isSubmitting } = useTenantMutation({ refresh: false });
  const [message, setMessage] = useState<string | null>(null);

  async function handleDelete() {
    const confirmed = window.confirm(
      `"${supplierName}" tedarikçisini kalıcı olarak silmek istediğinize emin misiniz?\n\nGider veya stok hareketi varsa silme engellenir.`
    );

    if (!confirmed) return;

    setMessage(null);

    const result = await mutate(`/api/suppliers/${supplierId}`, {
      method: "DELETE",
    });

    if (!result.ok) {
      setMessage(result.error ?? "Tedarikçi silinemedi.");
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={isSubmitting}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#24345f] transition hover:bg-slate-50 disabled:opacity-60"
            title="Diğer işlemler"
          >
            <MoreVertical size={15} />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link href={`/expenses/new?supplierId=${supplierId}`}>
              <ReceiptText size={14} />
              Gider ekle
            </Link>
          </DropdownMenuItem>
          {canManage ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={isSubmitting}
                onClick={() => void handleDelete()}
              >
                <Trash2 size={14} />
                Sil
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {message ? (
        <p className="max-w-[140px] text-center text-[10px] font-bold text-rose-600">
          {message}
        </p>
      ) : null}
    </div>
  );
}
