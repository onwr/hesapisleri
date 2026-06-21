"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PRODUCT_CARD_CLASS } from "@/components/products/product-ui-tokens";
import { formatSupplierMoney } from "@/lib/supplier-utils";

type SupplierProductRow = {
  id: string;
  supplierSku: string | null;
  purchasePrice: number | null;
  currency: string;
  isPreferred: boolean;
  supplier: {
    id: string;
    name: string;
    companyName: string | null;
    isActive: boolean;
  };
};

export function ProductSuppliersPanel({ productId }: { productId: string }) {
  const [rows, setRows] = useState<SupplierProductRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/products/${productId}/suppliers`)
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          setRows(
            (data.data ?? []).map((row: SupplierProductRow & { purchasePrice: unknown }) => ({
              ...row,
              purchasePrice:
                row.purchasePrice !== null && row.purchasePrice !== undefined
                  ? Number(row.purchasePrice)
                  : null,
            }))
          );
        }
      })
      .finally(() => setLoading(false));
  }, [productId]);

  if (loading) {
    return <p className="p-4 text-[12px] text-slate-500">Tedarikçiler yükleniyor...</p>;
  }

  if (rows.length === 0) {
    return (
      <div className={`${PRODUCT_CARD_CLASS} p-6 text-center`}>
        <p className="text-sm font-bold text-[#0f1f4d]">Bu ürün için tedarikçi kaydı yok</p>
        <p className="mt-2 text-[12px] text-slate-500">
          Tedarikçi detayından ürün eşlemesi ekleyebilirsiniz.
        </p>
      </div>
    );
  }

  return (
    <section className={`${PRODUCT_CARD_CLASS} overflow-x-auto`}>
      <table className="w-full min-w-[640px] text-left text-[12px]">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-black text-slate-600">
            <th className="px-3 py-2.5">Tedarikçi</th>
            <th className="px-3 py-2.5">Tedarikçi SKU</th>
            <th className="px-3 py-2.5">Alış fiyatı</th>
            <th className="px-3 py-2.5">Durum</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-2.5 font-bold">
                <Link href={`/suppliers/${row.supplier.id}`} className="text-blue-600 hover:underline">
                  {row.supplier.companyName || row.supplier.name}
                </Link>
                {row.isPreferred ? (
                  <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-black text-blue-700">
                    Tercih edilen
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2.5">{row.supplierSku || "—"}</td>
              <td className="px-3 py-2.5">
                {row.purchasePrice !== null
                  ? formatSupplierMoney(row.purchasePrice, row.currency)
                  : "—"}
              </td>
              <td className="px-3 py-2.5">
                {row.supplier.isActive ? "Aktif" : "Pasif"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
