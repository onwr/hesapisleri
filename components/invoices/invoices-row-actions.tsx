"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Download,
  Edit3,
  Eye,
  FileText,
  MoreVertical,
  Printer,
  Send,
  ShoppingCart,
  Wallet,
  XCircle,
} from "lucide-react";
import {
  CollectPaymentDialog,
  toCollectPaymentTarget,
  type CollectPaymentTarget,
} from "@/components/collections/collect-payment-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { InvoiceRowActionData } from "@/lib/invoices-page-utils";

type InvoicesRowActionsProps = {
  row: InvoiceRowActionData;
};

export function InvoicesRowActions({ row }: InvoicesRowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [collectTarget, setCollectTarget] = useState<CollectPaymentTarget | null>(
    null
  );

  function handleDownload() {
    if (row.pdfUrl) {
      window.open(row.pdfUrl, "_blank", "noopener,noreferrer");
      return;
    }

    window.open(row.downloadHref, "_blank", "noopener,noreferrer");
  }

  function handlePrint() {
    window.open(`${row.detailHref}?print=1`, "_blank", "noopener,noreferrer");
  }

  function openCollectModal() {
    setCollectTarget(
      toCollectPaymentTarget({
        collectTargetType: "INVOICE",
        collectTargetId: row.id,
        documentNo: row.invoiceNo,
        totalAmount: row.totalAmount,
        paidAmount: row.paidAmount,
        remainingAmount: row.remainingAmount,
      })
    );
  }

  async function handleCancel() {
    const confirmed = window.confirm(
      `${row.invoiceNo} numaralı faturayı iptal etmek istediğinize emin misiniz?`
    );

    if (!confirmed) return;

    setMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/invoices/${row.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "cancel" }),
        });

        const result = (await response.json()) as {
          success?: boolean;
          message?: string;
        };

        if (!response.ok || !result.success) {
          setMessage(result.message ?? "İptal işlemi başarısız.");
          return;
        }

        router.refresh();
      } catch {
        setMessage("İptal işlemi sırasında bir hata oluştu.");
      }
    });
  }

  const isBusy = isPending;

  return (
    <>
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center justify-center gap-1">
          <Link
            href={row.detailHref}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-[#24345f] transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600"
            title="Detay"
          >
            <Eye size={13} />
          </Link>

          <Link
            href={row.editHref}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-[#24345f] transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600"
            title="Düzenle"
          >
            <Edit3 size={13} />
          </Link>

          <button
            type="button"
            onClick={handleDownload}
            disabled={isBusy}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-[#24345f] transition hover:bg-slate-50 disabled:opacity-60"
            title="PDF indir"
          >
            <Download size={13} />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={isBusy}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-[#24345f] transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                title="İşlemler"
              >
                <MoreVertical size={13} />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem asChild>
                <Link href={row.detailHref} className="cursor-pointer">
                  <Eye size={14} />
                  Detay görüntüle
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <Link href={row.editHref} className="cursor-pointer">
                  <Edit3 size={14} />
                  Düzenle
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handleDownload} className="cursor-pointer">
                <Download size={14} />
                PDF indir / yazdır
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handlePrint} className="cursor-pointer">
                <Printer size={14} />
                Yazdır
              </DropdownMenuItem>

              {row.canConvertToEInvoice ? (
                <DropdownMenuItem asChild>
                  <Link
                    href={`/invoices/e-invoice?convertFrom=${row.id}`}
                    className="cursor-pointer"
                  >
                    <Send size={14} />
                    e-Fatura / e-Arşiv&apos;e dönüştür
                  </Link>
                </DropdownMenuItem>
              ) : null}

              {row.saleId ? (
                <DropdownMenuItem asChild>
                  <Link href={`/sales/${row.saleId}`} className="cursor-pointer">
                    <ShoppingCart size={14} />
                    Bağlı satışa git
                  </Link>
                </DropdownMenuItem>
              ) : null}

              {row.canCollect ? (
                <DropdownMenuItem
                  onClick={openCollectModal}
                  className="cursor-pointer"
                >
                  <Wallet size={14} />
                  Tahsilat al
                </DropdownMenuItem>
              ) : null}

              {row.canCancel ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => void handleCancel()}
                    className="cursor-pointer"
                  >
                    <XCircle size={14} />
                    {isBusy ? "İptal ediliyor..." : "Faturayı iptal et"}
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {message ? (
          <p className="max-w-[180px] text-center text-[10px] font-semibold text-rose-500">
            {message}
          </p>
        ) : null}
      </div>

      <CollectPaymentDialog
        target={collectTarget}
        onClose={() => setCollectTarget(null)}
      />
    </>
  );
}
