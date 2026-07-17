import { formatMoney } from "@/lib/format-utils";
import type { SaleReceiptViewModel } from "@/lib/sale-receipt-utils";

type SaleReceiptViewProps = {
  receipt: SaleReceiptViewModel;
};

export function SaleReceiptView({ receipt }: SaleReceiptViewProps) {
  const widthClass =
    receipt.widthMm === 58 ? "receipt-width-58" : "receipt-width-80";

  return (
    <article
      data-testid="sale-receipt"
      data-width-mm={receipt.widthMm}
      className={[
        "receipt-print-area mx-auto bg-white font-mono text-black",
        widthClass,
      ].join(" ")}
    >
      <header className="text-center">
        <h1 className="text-[15px] font-black leading-tight tracking-tight">
          {receipt.company.name}
        </h1>
        {receipt.company.phone ? (
          <p className="mt-1 text-[11px]">{receipt.company.phone}</p>
        ) : null}
        {receipt.company.address ? (
          <p className="mt-1 text-[11px] leading-4">{receipt.company.address}</p>
        ) : null}
        {receipt.company.taxNo || receipt.company.taxOffice ? (
          <p className="mt-1 text-[11px]">
            {[
              receipt.company.taxOffice
                ? `VD: ${receipt.company.taxOffice}`
                : null,
              receipt.company.taxNo ? `VN: ${receipt.company.taxNo}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
        <p className="mt-2 text-[11px] font-bold uppercase tracking-wide">
          Satış Fişi
        </p>
        {receipt.isCancelled ? (
          <p className="mt-1 text-[12px] font-black text-rose-700">*** İPTAL ***</p>
        ) : null}
      </header>

      <div className="my-3 border-t border-dashed border-black/40" />

      <section className="space-y-0.5 text-[11px]">
        <div className="flex justify-between gap-2">
          <span>Satış No</span>
          <span className="font-bold">{receipt.saleNo}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Tarih</span>
          <span className="text-right">{receipt.dateLabel}</span>
        </div>
        {receipt.cashierName ? (
          <div className="flex justify-between gap-2">
            <span>Kasiyer</span>
            <span className="text-right">{receipt.cashierName}</span>
          </div>
        ) : null}
        <div className="flex justify-between gap-2">
          <span>Müşteri</span>
          <span className="max-w-[65%] text-right font-semibold">
            {receipt.customerName}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Ödeme</span>
          <span className="text-right font-semibold">
            {receipt.paymentStatusLabel}
          </span>
        </div>
        {receipt.invoiceNo ? (
          <div className="flex justify-between gap-2">
            <span>Fatura No</span>
            <span className="text-right">{receipt.invoiceNo}</span>
          </div>
        ) : null}
      </section>

      <div className="my-3 border-t border-dashed border-black/40" />

      <section className="space-y-2 text-[11px]">
        {receipt.items.map((item) => (
          <div key={item.id}>
            <p className="break-words font-semibold leading-4">{item.name}</p>
            <div className="mt-0.5 flex justify-between gap-2">
              <span>
                {item.quantity} x {formatMoney(item.unitPrice)}
                {item.vatRate > 0 ? ` · KDV %${item.vatRate}` : ""}
              </span>
              <span className="shrink-0 font-bold">
                {formatMoney(item.lineTotal)}
              </span>
            </div>
          </div>
        ))}
      </section>

      <div className="my-3 border-t border-dashed border-black/40" />

      <section className="space-y-1 text-[11px]">
        <div className="flex justify-between gap-2">
          <span>Ara Toplam</span>
          <span>{formatMoney(receipt.subtotal)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>KDV</span>
          <span>{formatMoney(receipt.vatTotal)}</span>
        </div>
        {receipt.discount > 0 ? (
          <div className="flex justify-between gap-2">
            <span>İndirim</span>
            <span>-{formatMoney(receipt.discount)}</span>
          </div>
        ) : null}
        <div className="flex justify-between gap-2 pt-1 text-[13px] font-black">
          <span>TOPLAM</span>
          <span>{formatMoney(receipt.total)}</span>
        </div>
      </section>

      <div className="my-3 border-t border-dashed border-black/40" />

      <section className="space-y-1 text-[11px]">
        {receipt.paymentLines.map((line, index) => (
          <div
            key={`${line.label}-${index}`}
            className="flex justify-between gap-2"
          >
            <span className="pr-2">{line.label}</span>
            <span className="shrink-0 font-semibold">
              {formatMoney(line.amount)}
            </span>
          </div>
        ))}
        <div className="flex justify-between gap-2 pt-1">
          <span>Ödenen</span>
          <span className="font-semibold">{formatMoney(receipt.paidAmount)}</span>
        </div>
        {receipt.remainingAmount > 0 ? (
          <div className="flex justify-between gap-2">
            <span>Kalan (Cari)</span>
            <span className="font-bold">
              {formatMoney(receipt.remainingAmount)}
            </span>
          </div>
        ) : null}
      </section>

      {receipt.note ? (
        <>
          <div className="my-3 border-t border-dashed border-black/40" />
          <p className="break-words text-[11px]">{receipt.note}</p>
        </>
      ) : null}

      <div className="my-3 border-t border-dashed border-black/40" />

      <footer className="space-y-1 text-center text-[10px] leading-4">
        <p>Bizi tercih ettiğiniz için teşekkür ederiz.</p>
        <p>Bu belge bilgi amaçlıdır.</p>
        <p>Hesapişleri.com</p>
      </footer>
    </article>
  );
}
