import Link from "next/link";
import type { CustomerLedgerEntry } from "@/lib/customer-detail-data";
import { formatCustomerMoney } from "@/lib/customers-page-utils";
import { formatDisplayDate } from "@/lib/format-utils";

type CustomerLedgerTableProps = {
  entries: CustomerLedgerEntry[];
};

const typeLabels: Record<CustomerLedgerEntry["type"], string> = {
  SALE: "Satış",
  INVOICE: "Fatura",
  COLLECTION: "Tahsilat",
  PAYMENT: "Ödeme",
  CANCEL_SALE: "Satış İptali",
  CANCEL_INVOICE: "Fatura İptali",
};

const typeClassMap: Record<CustomerLedgerEntry["type"], string> = {
  SALE: "bg-blue-50 text-blue-600",
  INVOICE: "bg-violet-50 text-violet-600",
  COLLECTION: "bg-emerald-50 text-emerald-600",
  PAYMENT: "bg-orange-50 text-orange-600",
  CANCEL_SALE: "bg-rose-50 text-rose-600",
  CANCEL_INVOICE: "bg-rose-50 text-rose-600",
};

export function CustomerLedgerTable({ entries }: CustomerLedgerTableProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
        <p className="text-[13px] font-black text-[#0f1f4d]">
          Cari hareket bulunamadı
        </p>
        <p className="mt-1 text-[12px] font-medium text-slate-500">
          Satış veya fatura oluşturduğunuzda hareketler burada listelenir.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-black text-[#24345f]/80">
            <th className="px-3 py-3">Tarih</th>
            <th className="px-3 py-3">Tür</th>
            <th className="px-3 py-3">Açıklama</th>
            <th className="px-3 py-3 text-right">Borç (+)</th>
            <th className="px-3 py-3 text-right">Alacak (-)</th>
            <th className="px-3 py-3 text-right">Bakiye</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {entries.map((entry) => (
            <tr
              key={entry.id}
              className="text-[12px] font-semibold text-[#24345f]"
            >
              <td className="px-3 py-3 text-slate-500">
                {formatDisplayDate(entry.occurredAt ?? entry.date)}
              </td>

              <td className="px-3 py-3">
                <span
                  className={[
                    "rounded-md px-2 py-1 text-[10px] font-black",
                    typeClassMap[entry.type],
                  ].join(" ")}
                >
                  {typeLabels[entry.type]}
                </span>
              </td>

              <td className="px-3 py-3">
                {entry.href ? (
                  <Link
                    href={entry.href}
                    className="font-black text-[#0f1f4d] hover:text-blue-600"
                  >
                    {entry.label}
                  </Link>
                ) : (
                  <span className="font-black text-[#0f1f4d]">
                    {entry.label}
                  </span>
                )}
              </td>

              <td className="px-3 py-3 text-right font-black text-rose-500">
                {entry.debit > 0 ? formatCustomerMoney(entry.debit) : "-"}
              </td>

              <td className="px-3 py-3 text-right font-black text-emerald-600">
                {entry.credit > 0 ? formatCustomerMoney(entry.credit) : "-"}
              </td>

              <td
                className={[
                  "px-3 py-3 text-right font-black",
                  entry.runningBalance > 0
                    ? "text-rose-500"
                    : entry.runningBalance < 0
                      ? "text-emerald-600"
                      : "text-[#0f1f4d]",
                ].join(" ")}
              >
                {formatCustomerMoney(entry.runningBalance)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
