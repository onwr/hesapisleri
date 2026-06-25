"use client";

import {
  getPosPaymentMethodLabel,
  getPosPaymentStatusLabel,
  type PosPaymentMethod,
  type PosPaymentStatus,
} from "@/lib/pos-checkout-utils";
import { formatMoney } from "@/lib/format-utils";

type ReceiptItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  lineTotal: number;
};

type ReceiptPayment = {
  paymentMethod: PosPaymentMethod | string;
  accountName: string;
  amount: number;
};

type PosReceiptProps = {
  companyName: string;
  saleNo: string;
  date: string;
  items: ReceiptItem[];
  subtotal: number;
  vatTotal: number;
  discount: number;
  total: number;
  paymentStatus: PosPaymentStatus;
  payments: ReceiptPayment[];
};

export function PosReceipt({
  companyName,
  saleNo,
  date,
  items,
  subtotal,
  vatTotal,
  discount,
  total,
  paymentStatus,
  payments,
}: PosReceiptProps) {
  return (
    <div
      id="pos-receipt-print"
      className="hidden print:block print:fixed print:inset-0 print:z-9999 print:bg-white print:p-8"
    >
      <div className="mx-auto max-w-md text-sm text-slate-900">
        <h1 className="text-center text-xl font-black">{companyName}</h1>
        <p className="mt-2 text-center text-xs text-slate-500">Satış Fişi</p>

        <div className="mt-6 space-y-1 text-xs">
          <p>
            <span className="font-bold">Satış No:</span> {saleNo}
          </p>
          <p>
            <span className="font-bold">Tarih:</span> {date}
          </p>
        </div>

        <div className="my-4 border-t border-dashed border-slate-300" />

        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              <th className="py-2">Ürün</th>
              <th className="py-2 text-center">Adet</th>
              <th className="py-2 text-right">Tutar</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={`${item.name}-${index}`} className="border-b border-slate-100">
                <td className="py-2 pr-2">
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-slate-500">
                    {formatMoney(item.unitPrice)} · KDV %{item.vatRate}
                  </p>
                </td>
                <td className="py-2 text-center">{item.quantity}</td>
                <td className="py-2 text-right font-semibold">
                  {formatMoney(item.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="my-4 border-t border-dashed border-slate-300" />

        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span>Ara Toplam</span>
            <span>{formatMoney(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>KDV</span>
            <span>{formatMoney(vatTotal)}</span>
          </div>
          {discount > 0 ? (
            <div className="flex justify-between">
              <span>İndirim</span>
              <span>-{formatMoney(discount)}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-base font-black">
            <span>Toplam</span>
            <span>{formatMoney(total)}</span>
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs">
          <p>
            <span className="font-bold">Ödeme:</span>{" "}
            {getPosPaymentStatusLabel(paymentStatus)}
          </p>
          {payments.map((payment, index) => (
            <p key={`${payment.accountName}-${index}`} className="mt-1">
              {getPosPaymentMethodLabel(payment.paymentMethod as PosPaymentMethod)}{" "}
              · {payment.accountName} · {formatMoney(payment.amount)}
            </p>
          ))}
        </div>

        <p className="mt-8 text-center text-[10px] text-slate-400">
          Hesapişleri POS · Teşekkür ederiz
        </p>
      </div>
    </div>
  );
}

export function printPosReceipt() {
  window.print();
}
