"use client";

import Link from "next/link";
import { AlertTriangle, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buildProductDeleteHelp,
  type ProductDeleteBlockCode,
} from "@/lib/product-delete-utils";

export type ProductDeleteFeedbackState = {
  open: boolean;
  productId: string;
  productName: string;
  code: ProductDeleteBlockCode | "GENERIC";
  message: string;
  saleItemCount?: number;
  transferCount?: number;
};

type ProductDeleteFeedbackDialogProps = {
  state: ProductDeleteFeedbackState | null;
  onClose: () => void;
  onSetPassive: (productId: string) => void;
  isPending?: boolean;
};

export function ProductDeleteFeedbackDialog({
  state,
  onClose,
  onSetPassive,
  isPending = false,
}: ProductDeleteFeedbackDialogProps) {
  if (!state) return null;

  const help =
    state.code === "SALE_HISTORY" || state.code === "TRANSFER_HISTORY"
      ? buildProductDeleteHelp(state.code)
      : null;

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <AlertTriangle size={22} />
          </div>
          <DialogTitle className="text-base font-black text-[#0f1f4d]">
            Ürün silinemiyor
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-6 text-slate-600">
            <span className="font-bold text-[#0f1f4d]">{state.productName}</span>{" "}
            kalıcı olarak silinemedi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-[13px] leading-6 text-slate-600">
          <p className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 font-medium text-rose-700">
            {state.message}
          </p>

          {state.saleItemCount ? (
            <p>
              <span className="font-bold text-[#0f1f4d]">
                {state.saleItemCount}
              </span>{" "}
              satış kalemi bu ürünle ilişkili.
            </p>
          ) : null}

          {state.transferCount ? (
            <p>
              <span className="font-bold text-[#0f1f4d]">
                {state.transferCount}
              </span>{" "}
              depo transfer kaydı bulunuyor.
            </p>
          ) : null}

          {help ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="font-black text-[#0f1f4d]">{help.title}</p>
              <p>{help.summary}</p>
              <ul className="list-disc space-y-2 pl-5 text-[12px]">
                {help.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-[12px] text-blue-800">
            <p className="font-black">Nasıl silebilirsiniz?</p>
            <p className="mt-2">
              Kalıcı silme yalnızca hiç satılmamış ve depo transferi yapılmamış
              ürünlerde mümkündür. Satılmış demo ürünlerde{" "}
              <strong>Pasife al</strong> kullanın; ürün listelerde görünmez,
              geçmiş kayıtlar korunur.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Kapat
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/products/${state.productId}/edit`}>Ürünü düzenle</Link>
          </Button>
          <Button
            onClick={() => onSetPassive(state.productId)}
            disabled={isPending}
            className="bg-[#0f1f4d] text-white hover:bg-[#0f1f4d]/90"
          >
            <Power size={14} className="mr-1" />
            {isPending ? "Pasife alınıyor..." : "Pasife al"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
