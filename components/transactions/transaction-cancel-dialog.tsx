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
  "Çift kayıt",
  "İşlem iptali",
  "Diğer",
] as const;

type TransactionCancelDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  recordLabel: string;
  recordSummary?: string;
  requiresReason?: boolean;
  impactWarning?: string;
  confirmLabel?: string;
  onConfirm: (input: { reason: string }) => Promise<{ ok: boolean; message?: string }>;
  onSuccess?: () => void;
};

export function TransactionCancelDialog({
  open,
  onOpenChange,
  title,
  description,
  recordLabel,
  recordSummary,
  requiresReason = true,
  impactWarning,
  confirmLabel = "İptal Et",
  onConfirm,
  onSuccess,
}: TransactionCancelDialogProps) {
  const [reason, setReason] = useState<string>(CANCEL_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const resolvedReason = reason === "Diğer" ? customReason.trim() : reason;

  function resetForm() {
    setReason(CANCEL_REASONS[0]);
    setCustomReason("");
    setMessage(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  }

  function handleSubmit() {
    if (requiresReason && !resolvedReason) {
      setMessage("İptal nedeni zorunludur.");
      return;
    }

    setMessage(null);

    startTransition(async () => {
      const result = await onConfirm({
        reason: requiresReason ? resolvedReason : resolvedReason || "İptal",
      });

      if (!result.ok) {
        setMessage(result.message ?? "İptal işlemi başarısız.");
        return;
      }

      handleOpenChange(false);
      onSuccess?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
              Kayıt
            </p>
            <p className="mt-1 text-[13px] font-black text-[#0f1f4d]">{recordLabel}</p>
            {recordSummary ? (
              <p className="mt-1 text-[12px] font-semibold text-slate-500">
                {recordSummary}
              </p>
            ) : null}
          </div>

          {impactWarning ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-700">
              {impactWarning}
            </p>
          ) : null}

          {requiresReason ? (
            <>
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
            </>
          ) : null}

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
                İşleniyor...
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
