import { formatMoney } from "@/lib/format-utils";
import { formatReceiptDateTime } from "@/lib/sale-receipt-utils";
import { getSaleReturnRefundMethodLabel } from "@/lib/sale-return-utils";

export type SaleReturnReceiptViewModel = {
  widthMm: 58 | 80;
  company: {
    name: string;
    phone: string | null;
    address: string | null;
    taxNo: string | null;
    taxOffice: string | null;
  };
  saleNo: string;
  returnNo: string;
  dateLabel: string;
  customerName: string;
  reason: string;
  note: string | null;
  refundMethodLabel: string;
  totalReturnAmount: number;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
  }>;
};

export function buildSaleReturnReceiptViewModel(input: {
  widthMm?: 58 | 80;
  company: SaleReturnReceiptViewModel["company"];
  saleNo: string;
  returnNo: string;
  createdAt: Date;
  customerName: string | null;
  reason: string;
  note: string | null;
  refundMethod: "CASH" | "CARD" | "CREDIT";
  totalReturnAmount: number;
  items: SaleReturnReceiptViewModel["items"];
}): SaleReturnReceiptViewModel {
  return {
    widthMm: input.widthMm ?? 80,
    company: input.company,
    saleNo: input.saleNo,
    returnNo: input.returnNo,
    dateLabel: formatReceiptDateTime(input.createdAt),
    customerName: input.customerName?.trim() || "Perakende Müşteri",
    reason: input.reason,
    note: input.note,
    refundMethodLabel: getSaleReturnRefundMethodLabel(input.refundMethod),
    totalReturnAmount: input.totalReturnAmount,
    items: input.items,
  };
}

type SaleReturnReceiptViewProps = {
  receipt: SaleReturnReceiptViewModel;
};

export function SaleReturnReceiptView({ receipt }: SaleReturnReceiptViewProps) {
  const widthClass =
    receipt.widthMm === 58 ? "receipt-width-58" : "receipt-width-80";

  return (
    <article
      data-testid="sale-return-receipt"
      className={[
        "receipt-print-area mx-auto bg-white font-mono text-black",
        widthClass,
      ].join(" ")}
    >
      <header className="text-center">
        <h1 className="text-[15px] font-black leading-tight">
          {receipt.company.name}
        </h1>
        {receipt.company.phone ? (
          <p className="mt-1 text-[11px]">{receipt.company.phone}</p>
        ) : null}
        <p className="mt-2 text-[12px] font-black uppercase tracking-wide">
          İADE FİŞİ
        </p>
      </header>

      <div className="my-3 border-t border-dashed border-black/40" />

      <section className="space-y-0.5 text-[11px]">
        <div className="flex justify-between gap-2">
          <span>Satış No</span>
          <span className="font-bold">{receipt.saleNo}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>İade No</span>
          <span className="font-bold">{receipt.returnNo}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Tarih</span>
          <span className="text-right">{receipt.dateLabel}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Müşteri</span>
          <span className="max-w-[65%] text-right font-semibold">
            {receipt.customerName}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Yöntem</span>
          <span className="text-right">{receipt.refundMethodLabel}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Neden</span>
          <span className="max-w-[65%] text-right">{receipt.reason}</span>
        </div>
      </section>

      <div className="my-3 border-t border-dashed border-black/40" />

      <section className="space-y-2 text-[11px]">
        {receipt.items.map((item) => (
          <div key={item.id}>
            <p className="break-words font-semibold leading-4">{item.name}</p>
            <div className="mt-0.5 flex justify-between gap-2">
              <span>
                {item.quantity} x {formatMoney(item.unitPrice)}
              </span>
              <span className="shrink-0 font-bold">
                {formatMoney(item.totalAmount)}
              </span>
            </div>
          </div>
        ))}
      </section>

      <div className="my-3 border-t border-dashed border-black/40" />

      <div className="flex justify-between gap-2 text-[13px] font-black">
        <span>İADE TOPLAM</span>
        <span>{formatMoney(receipt.totalReturnAmount)}</span>
      </div>

      {receipt.note ? (
        <>
          <div className="my-3 border-t border-dashed border-black/40" />
          <p className="break-words text-[11px]">{receipt.note}</p>
        </>
      ) : null}

      <div className="my-3 border-t border-dashed border-black/40" />
      <footer className="text-center text-[10px] leading-4">
        <p>Bu belge bilgi amaçlıdır.</p>
        <p>Hesapişleri.com</p>
      </footer>
    </article>
  );
}
