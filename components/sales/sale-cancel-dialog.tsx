"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const CANCEL_REASONS = [
  "Yanlış kayıt",
  "Müşteri iptali",
  "Stok veya fiyat hatası",
  "Çift kayıt",
  "Diğer",
] as const;

type SaleCancelDialogProps = {
  saleId: string;
  saleNo: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function SaleCancelDialog({
  saleId,
  saleNo,
  open,
  onOpenChange,
  onSuccess,
}: SaleCancelDialogProps) {
  const [reason, setReason] = useState<string>(CANCEL_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const resolvedReason = reason === "Diğer" ? customReason.trim() : reason;

  function resetForm() {
    setReason(CANCEL_REASONS[0]);
    setCustomReason("");
    setNote("");
    setMessage(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  }

  function handleSubmit() {
    if (!resolvedReason) {
      setMessage("İptal nedeni zorunludur.");
      return;
    }

    setMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/sales/${saleId}/cancel`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reason: resolvedReason,
            note: note.trim() || null,
          }),
        });

        const result = (await response.json()) as {
          success?: boolean;
          message?: string;
        };

        if (!response.ok || !result.success) {
          setMessage(result.message ?? "İptal işlemi başarısız.");
          return;
        }

        handleOpenChange(false);
        onSuccess?.();
      } catch {
        setMessage("İptal işlemi sırasında bir hata oluştu.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Satışı İptal Et</DialogTitle>
          <DialogDescription>
            {saleNo} numaralı satış iptal edilecek. Stok iade edilir, tahsilat
            geri alınır ve cari bakiye düzeltilir. Bu işlem geri alınamaz.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-[12px] font-bold text-slate-600">
              İptal Nedeni
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-[#24345f] outline-none focus:border-rose-200 focus:ring-4 focus:ring-rose-50"
            >
              {CANCEL_REASONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          {reason === "Diğer" ? (
            <div>
              <label className="mb-2 block text-[12px] font-bold text-slate-600">
                Açıklama
              </label>
              <input
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="İptal nedenini yazın"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-[#24345f] outline-none focus:border-rose-200 focus:ring-4 focus:ring-rose-50"
              />
            </div>
          ) : null}

          <div>
            <label className="mb-2 block text-[12px] font-bold text-slate-600">
              Ek Not (isteğe bağlı)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="İptal ile ilgili ek açıklama..."
              className="min-h-[88px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-[#24345f] outline-none focus:border-rose-200 focus:ring-4 focus:ring-rose-50"
            />
          </div>

          {message ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-600">
              {message}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Vazgeç
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleSubmit()}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                İptal ediliyor...
              </>
            ) : (
              "Satışı İptal Et"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
