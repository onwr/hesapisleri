import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Boxes } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { db } from "@/lib/prisma";
import {
  formatStockDateTime,
  formatStockMoney,
  getMovementClass,
  getMovementText,
} from "@/lib/stocks-page-utils";
import { getWarehouseDetailData } from "@/lib/warehouse-page-data";
import {
  getTransferStatusClass,
  getTransferStatusLabel,
  getWarehouseStatusLabel,
} from "@/lib/warehouse-utils";

type Props = { params: Promise<{ id: string }> };
type AuthPayload = { userId: string; companyId: string | null };

export default async function WarehouseDetailPage({ params }: Props) {
  const { id } = await params;
  const token = await getAuthToken();
  if (!token) redirect("/login");

  const payload = verifyToken<AuthPayload>(token);
  if (!payload?.companyId) redirect("/login");

  const data = await getWarehouseDetailData(payload.companyId, id);
  if (!data) notFound();

  const { warehouse, metrics, stockRows, movements, transfers } = data;

  return (
    <AppShell>
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <Link
              href="/stocks/warehouses"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-2xl font-black text-[#0f1f4d]">{warehouse.name}</h1>
              <p className="mt-1 text-sm text-slate-500">
                {getWarehouseStatusLabel(warehouse.status)}
                {warehouse.isDefault ? " · Varsayılan depo" : ""}
              </p>
              {warehouse.address ? (
                <p className="mt-2 text-sm text-slate-600">{warehouse.address}</p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          {[
            { label: "Toplam Ürün", value: metrics.productCount },
            { label: "Toplam Stok", value: metrics.totalStock },
            { label: "Stok Değeri", value: formatStockMoney(metrics.totalValue) },
            { label: "Kritik Stoklu", value: metrics.lowStockCount },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold text-slate-500">{item.label}</p>
              <p className="mt-2 text-xl font-black">{item.value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-black text-[#0f1f4d]">Depodaki Ürün Stokları</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs font-black text-slate-600">
                  <th className="px-4 py-3">Ürün</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3">Depodaki Stok</th>
                  <th className="px-4 py-3">Toplam Stok</th>
                  <th className="px-4 py-3">Kritik</th>
                  <th className="px-4 py-3">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stockRows.map((row) => (
                  <tr key={row.productId}>
                    <td className="px-4 py-3 font-bold">{row.productName}</td>
                    <td className="px-4 py-3">{row.sku || "—"}</td>
                    <td className="px-4 py-3">{row.categoryName}</td>
                    <td className="px-4 py-3 font-black">{row.warehouseStock}</td>
                    <td className="px-4 py-3">{row.totalStock}</td>
                    <td className="px-4 py-3">{row.minStock}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={row.stockMovementHref}
                        className="inline-flex items-center gap-1 rounded-lg border border-orange-100 bg-orange-50 px-2 py-1 text-xs font-black text-orange-600"
                      >
                        <Boxes size={12} />
                        Hareket
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 font-black text-[#0f1f4d]">Son Hareketler</h3>
            <div className="space-y-2">
              {movements.map((movement) => (
                <div
                  key={movement.id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-xs"
                >
                  <div>
                    <p className="font-bold">{movement.product.name}</p>
                    <span
                      className={[
                        "rounded px-1.5 py-0.5 text-[10px] font-black",
                        getMovementClass(movement.type),
                      ].join(" ")}
                    >
                      {getMovementText(movement.type)}
                    </span>
                  </div>
                  <span className="text-slate-500">
                    {formatStockDateTime(movement.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 font-black text-[#0f1f4d]">Transferler</h3>
            <div className="space-y-2">
              {transfers.map((transfer) => (
                <div
                  key={transfer.id}
                  className="rounded-xl border border-slate-100 px-3 py-2 text-xs"
                >
                  <p className="font-bold">{transfer.transferNo}</p>
                  <p className="text-slate-600">
                    {transfer.product.name}: {transfer.fromWarehouse.name} →{" "}
                    {transfer.toWarehouse.name} ({transfer.quantity})
                  </p>
                  <span
                    className={[
                      "mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-black",
                      getTransferStatusClass(transfer.status),
                    ].join(" ")}
                  >
                    {getTransferStatusLabel(transfer.status)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
