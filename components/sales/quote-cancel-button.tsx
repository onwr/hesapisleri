"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, XCircle } from "lucide-react";

type QuoteCancelButtonProps = {
  saleId: string;
  saleNo: string;
  variant?: "button" | "destructive";
};

export function QuoteCancelButton({
  saleId,
  saleNo,
  variant = "button",
}: QuoteCancelButtonProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    const confirmed = window.confirm(
      `${saleNo} numaralı teklifi iptal etmek istediğinize emin misiniz?`
    );

    if (!confirmed) return;

    setMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/sales/${saleId}/cancel-quote`, {
          method: "POST",
        });

        const result = (await response.json()) as {
          success?: boolean;
          message?: string;
        };

        if (!response.ok || !result.success) {
          setMessage(result.message ?? "İptal işlemi başarısız.");
          return;
        }

        router.push("/sales?tab=offers");
        router.refresh();
      } catch {
        setMessage("İptal işlemi sırasında bir hata oluştu.");
      }
    });
  }

  const className =
    variant === "destructive"
      ? "inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-5 text-sm font-black text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
      : "flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className={variant === "destructive" ? "flex flex-col gap-1" : undefined}>
      <button
        type="button"
        onClick={() => void handleCancel()}
        disabled={isPending}
        className={className}
        title="Teklifi İptal Et"
      >
        {isPending ? (
          <Loader2 className="animate-spin" size={variant === "destructive" ? 18 : 15} />
        ) : (
          <XCircle size={variant === "destructive" ? 20 : 15} />
        )}
        {variant === "destructive" ? (
          isPending ? "İptal ediliyor..." : "İptal Et"
        ) : null}
      </button>

      {message ? (
        <p className="text-[10px] font-semibold text-rose-500">{message}</p>
      ) : null}
    </div>
  );
}
