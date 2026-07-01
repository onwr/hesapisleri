"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { XCircle } from "lucide-react";
import { SaleCancelDialog } from "@/components/sales/sale-cancel-dialog";
import { notifyTenantCacheSync } from "@/lib/tenant-cache/client-tenant-sync";

type SaleCancelButtonProps = {
  saleId: string;
  saleNo: string;
  variant?: "button" | "destructive";
  redirectTo?: string;
};

export function SaleCancelButton({
  saleId,
  saleNo,
  variant = "button",
  redirectTo,
}: SaleCancelButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const className =
    variant === "destructive"
      ? "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-[12px] font-black text-rose-700 transition hover:bg-rose-100"
      : "flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50";

  function handleSuccess() {
    if (redirectTo) {
      router.push(redirectTo);
    }
    notifyTenantCacheSync();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
        title="Satışı İptal Et"
      >
        <XCircle size={variant === "destructive" ? 17 : 15} />
        {variant === "destructive" ? "Satışı İptal Et" : null}
      </button>

      <SaleCancelDialog
        saleId={saleId}
        saleNo={saleNo}
        open={open}
        onOpenChange={setOpen}
        onSuccess={handleSuccess}
      />
    </>
  );
}
