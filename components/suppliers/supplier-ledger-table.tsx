"use client";

import Link from "next/link";
import { formatSupplierMoney } from "@/lib/supplier-utils";
import { SUPPLIER_BALANCE_LABELS } from "@/lib/supplier-balance-utils";
import type { SupplierLedgerRow } from "@/lib/supplier-ledger-utils";

type Props = {
  rows: SupplierLedgerRow[];
  currency?: string;
};

export function SupplierLedgerTable({ rows, currency = "TRY" }: Props) {
  if (rows.length === 0) {
    return (
      <p className="text-[12px] text-slate-500">Henüz cari hareket kaydı yok.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-[12px]">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            <th className="px-2 py-2">Tarih</th>
            <th className="px-2 py-2">Tür</th>
            <th className="px-2 py-2">Açıklama</th>
            <th className="px-2 py-2">Borç</th>
            <th className="px-2 py-2">Alacak</th>
            <th className="px-2 py-2">Bakiye Yönü</th>
            <th className="px-2 py-2">Kalan</th>
            <th className="px-2 py-2">Hesap</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-50 text-slate-700">
              <td className="px-2 py-2 whitespace-nowrap">
                {new Date(row.date).toLocaleDateString("tr-TR")}
              </td>
              <td className="px-2 py-2">{row.typeLabel}</td>
              <td className="px-2 py-2">
                {row.relatedEntityHref ? (
                  <Link href={row.relatedEntityHref} className="font-semibold text-blue-700 hover:underline">
                    {row.description}
                  </Link>
                ) : (
                  row.description
                )}
              </td>
              <td className="px-2 py-2 font-semibold text-rose-600">
                {row.debit > 0 ? formatSupplierMoney(row.debit, currency) : "—"}
              </td>
              <td className="px-2 py-2 font-semibold text-emerald-600">
                {row.credit > 0 ? formatSupplierMoney(row.credit, currency) : "—"}
              </td>
              <td className="px-2 py-2">{SUPPLIER_BALANCE_LABELS[row.balanceDirection]}</td>
              <td className="px-2 py-2 font-bold text-[#0f1f4d]">
                {row.balanceDirection === "SETTLED"
                  ? SUPPLIER_BALANCE_LABELS.SETTLED
                  : formatSupplierMoney(Math.abs(row.balance), currency)}
              </td>
              <td className="px-2 py-2 text-slate-500">
                {row.accountTransactionId ? (
                  <Link
                    href={`/cash-bank/transactions/${row.accountTransactionId}`}
                    className="font-semibold text-blue-700 hover:underline"
                  >
                    {row.accountName ?? "Hareket"}
                  </Link>
                ) : (
                  row.accountName ?? "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
