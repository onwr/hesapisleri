"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRightLeft,
  Download,
  Eye,
  FileText,
  MoreVertical,
  Printer,
  RefreshCcw,
  Wallet,
  XCircle,
} from "lucide-react";
import {
  CollectPaymentDialog,
  toCollectPaymentTarget,
  type CollectPaymentTarget,
} from "@/components/collections/collect-payment-dialog";
import { SaleCancelDialog } from "@/components/sales/sale-cancel-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SalesRowActionData } from "@/lib/sales-page-utils";
import { useTenantMutation } from "@/hooks/use-tenant-mutation";
import { notifyTenantCacheSync } from "@/lib/tenant-cache/client-tenant-sync";

type SalesRowActionsProps = {
  row: SalesRowActionData;
};

export function SalesRowActions({ row }: SalesRowActionsProps) {
  const { mutate, isSubmitting } = useTenantMutation({ refresh: false });
  const [message, setMessage] = useState<string | null>(null);
  const [collectTarget, setCollectTarget] = useState<CollectPaymentTarget | null>(
    null
  );
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  function handleDownload() {
    if (row.pdfUrl) {
      window.open(row.pdfUrl, "_blank", "noopener,noreferrer");
      return;
    }

    if (row.downloadHref) {
      window.location.href = row.downloadHref;
    }
  }

  function handlePrint() {
    if (row.saleId) {
      const printWindow = window.open(
        `/sales/${row.saleId}?print=1`,
        "_blank",
        "noopener,noreferrer"
      );
      printWindow?.focus();
      return;
    }

    window.open(row.detailHref, "_blank", "noopener,noreferrer");
  }

  function openCollectModal() {
    const target = toCollectPaymentTarget({
      collectTargetType: row.collectTargetType,
      collectTargetId: row.collectTargetId,
      documentNo: row.documentNo,
      totalAmount: row.totalAmount,
      paidAmount: row.paidAmount,
      remainingAmount: row.remainingAmount,
      collectViaInvoice: row.collectViaInvoice,
      linkedInvoiceId: row.linkedInvoiceId,
    });

    if (target) {
      setCollectTarget(target);
    }
  }

  function handleCancel() {
    if (row.isQuote) {
      void handleQuoteOrInvoiceCancel();
      return;
    }

    if (row.sourceType === "sale") {
      setMessage(null);
      setCancelDialogOpen(true);
      return;
    }

    void handleQuoteOrInvoiceCancel();
  }

  async function handleQuoteOrInvoiceCancel() {
    const confirmed = window.confirm(
      `${row.documentNo} numaralı kaydı iptal etmek istediğinize emin misiniz?`
    );

    if (!confirmed) return;

    setMessage(null);

    const endpoint = row.isQuote
      ? `/api/sales/${row.sourceId}/cancel-quote`
      : row.sourceType === "invoice"
        ? `/api/invoices/${row.sourceId}`
        : null;

    const method = row.isQuote ? "POST" : "PATCH";
    const body = row.isQuote
      ? undefined
      : JSON.stringify({ action: "cancel" });

    if (!endpoint) {
      setMessage("Bu kayıt türü iptal edilemez.");
      return;
    }

    const result = await mutate(endpoint, {
      method,
      headers: body
        ? {
            "Content-Type": "application/json",
          }
        : undefined,
      body,
    });

    if (!result.ok) {
      if (result.error !== "duplicate_submit") {
        setMessage(result.error);
      }
      return;
    }

    notifyTenantCacheSync();
  }

  const canDownload = Boolean(row.pdfUrl || row.downloadHref);
  const isBusy = isSubmitting;

  if (row.isQuote) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center justify-center gap-2">
          <Link
            href={row.detailHref}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#24345f] transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600"
            title="Detay"
          >
            <Eye size={15} />
          </Link>

          <button
            type="button"
            onClick={handlePrint}
            disabled={isBusy}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#24345f] transition hover:bg-slate-50"
            title="Yazdır"
          >
            <Printer size={15} />
          </button>

          <Link
            href={`${row.detailHref}?convert=1`}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"
            title="Satışa Dönüştür"
          >
            <ArrowRightLeft size={15} />
          </Link>

          {row.canCancel ? (
            <button
              type="button"
              onClick={() => void handleCancel()}
              disabled={isBusy}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100 disabled:cursor-wait disabled:opacity-60"
              title="İptal Et"
            >
              <XCircle size={15} />
            </button>
          ) : null}
        </div>

        {message ? (
          <p className="max-w-[180px] text-center text-[10px] font-semibold text-rose-500">
            {message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center justify-center gap-2">
          <Link
            href={row.detailHref}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#24345f] transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600"
            title="Detay"
          >
            <Eye size={15} />
          </Link>

          <button
            type="button"
            onClick={handleDownload}
            disabled={!canDownload || isBusy}
            className={[
              "flex h-8 w-8 items-center justify-center rounded-lg border bg-white transition",
              canDownload
                ? "border-slate-200 text-[#24345f] hover:bg-slate-50"
                : "cursor-not-allowed border-slate-100 text-slate-300",
            ].join(" ")}
            title={canDownload ? "İndir" : "İndirilebilir dosya yok"}
          >
            <Download size={15} />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={isBusy}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#24345f] transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                title="İşlemler"
              >
                <MoreVertical size={15} />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem asChild>
                <Link href={row.detailHref} className="cursor-pointer">
                  <Eye size={14} />
                  Detay görüntüle
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem
                disabled={!canDownload}
                onClick={handleDownload}
                className="cursor-pointer"
              >
                <Download size={14} />
                Belge indir
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handlePrint} className="cursor-pointer">
                <Printer size={14} />
                Yazdır
              </DropdownMenuItem>

              {row.canCreateInvoice && row.saleId ? (
                <DropdownMenuItem asChild>
                  <Link
                    href={`/invoices/e-invoice?saleId=${row.saleId}`}
                    className="cursor-pointer"
                  >
                    <FileText size={14} />
                    Fatura kes
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
                    {isBusy ? "İptal ediliyor..." : "İptal et"}
                  </DropdownMenuItem>
                </>
              ) : null}

              {row.sourceType === "sale" &&
              row.saleStatus !== "CANCELLED" &&
              row.saleStatus !== "REFUNDED" ? (
                <DropdownMenuItem asChild>
                  <Link href={`/sales?tab=returns`} className="cursor-pointer">
                    <RefreshCcw size={14} />
                    İade kayıtları
                  </Link>
                </DropdownMenuItem>
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

      {row.sourceType === "sale" && row.saleId ? (
        <SaleCancelDialog
          saleId={row.saleId}
          saleNo={row.documentNo}
          open={cancelDialogOpen}
          onOpenChange={setCancelDialogOpen}
          onSuccess={() => {
            notifyTenantCacheSync();
          }}
        />
      ) : null}
    </>
  );
}
