"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type BulkFailItem = {
  productId: string;
  message: string;
  code?: string;
};

type ProductsBulkResultDialogProps = {
  open: boolean;
  title: string;
  summary: string;
  successCount: number;
  failed: BulkFailItem[];
  productNameById: Record<string, string>;
  onClose: () => void;
};

export function ProductsBulkResultDialog({
  open,
  title,
  summary,
  successCount,
  failed,
  productNameById,
  onClose,
}: ProductsBulkResultDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-black text-[#0f1f4d]">
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-[13px]">
          <p className="text-slate-600">{summary}</p>

          {successCount > 0 ? (
            <p className="flex items-center gap-2 font-bold text-emerald-700">
              <CheckCircle2 size={16} />
              {successCount} ürün işlendi
            </p>
          ) : null}

          {failed.length > 0 ? (
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-rose-100 bg-rose-50 p-3">
              <p className="flex items-center gap-2 font-black text-rose-700">
                <XCircle size={16} />
                {failed.length} ürün işlenemedi
              </p>
              <ul className="space-y-2 text-[12px] text-rose-800">
                {failed.map((item) => (
                  <li key={item.productId}>
                    <span className="font-bold">
                      {productNameById[item.productId] ?? item.productId}
                    </span>
                    : {item.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Tamam</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
