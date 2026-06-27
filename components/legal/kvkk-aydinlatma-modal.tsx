"use client";

import { KvkkAydinlatmaContent } from "@/components/legal/kvkk-aydinlatma-content";
import type { CompanyLegalInfo } from "@/lib/legal/company-legal-info";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type KvkkAydinlatmaModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAcknowledge: () => void;
  legalInfo: CompanyLegalInfo;
};

export function KvkkAydinlatmaModal({
  open,
  onOpenChange,
  onAcknowledge,
  legalInfo,
}: KvkkAydinlatmaModalProps) {
  function handleAcknowledge() {
    onAcknowledge();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(90vh,720px)] w-full max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
        showCloseButton
      >
        <DialogHeader className="border-b border-slate-100 px-6 py-4">
          <DialogTitle className="text-base font-black text-[#0f1f4d]">
            Kişisel Verilerin İşlenmesine İlişkin Aydınlatma Metni
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Metni okuyup bilgilendirildiğinizi onaylayabilirsiniz. Bu onay,
            kişisel verilerin işlenmesine ilişkin açık rıza değildir.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <KvkkAydinlatmaContent showHeader={false} legalInfo={legalInfo} />
        </div>

        <DialogFooter className="border-t border-slate-100 px-6 py-4 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Kapat
          </Button>
          <Button type="button" onClick={handleAcknowledge}>
            Okudum ve bilgilendirildim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
