import Link from "next/link";
import { redirect } from "next/navigation";
import { Warehouse } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { WarehousesPageHeader } from "@/components/stocks/warehouses-page-header";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { formatStockMoney, formatStockNumber } from "@/lib/stocks-page-utils";
import { getWarehousesPageData } from "@/lib/warehouse-page-data";
import { getWarehouseStatusLabel } from "@/lib/warehouse-utils";

type AuthPayload = { userId: string; companyId: string | null };

export default async function WarehousesPage() {
  const token = await getAuthToken();
  if (!token) redirect("/login");

  const payload = verifyToken<AuthPayload>(token);
  if (!payload?.companyId) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    include: { companyUsers: { include: { company: true } } },
  });
  if (!user) redirect("/login");

  const company =
    user.companyUsers.find((item) => item.companyId === payload.companyId)
      ?.company ?? user.companyUsers[0]?.company;
  if (!company) redirect("/login");

  const { warehouses, stats } = await getWarehousesPageData(company.id);

  return (
    <AppShell>
      <div className="space-y-5">
        <WarehousesPageHeader />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Toplam Depo", value: stats.totalWarehouses },
            { label: "Aktif Depo", value: stats.activeWarehouses },
            { label: "Toplam Stok", value: formatStockNumber(stats.totalStock) },
            {
              label: "Toplam Stok Değeri",
              value: formatStockMoney(stats.totalStockValue),
            },
            { label: "Kritik Stoklu Ürün", value: stats.lowStockCount },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="text-xs font-bold text-slate-500">{item.label}</p>
              <p className="mt-2 text-xl font-black text-[#0f1f4d]">{item.value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs font-black text-slate-600">
                  <th className="px-4 py-3">Depo</th>
                  <th className="px-4 py-3">Kod</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">Ürün Çeşidi</th>
                  <th className="px-4 py-3">Toplam Stok</th>
                  <th className="px-4 py-3">Stok Değeri</th>
                  <th className="px-4 py-3">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {warehouses.map((warehouse) => (
                  <tr key={warehouse.id} className="text-sm">
                    <td className="px-4 py-3 font-bold text-[#0f1f4d]">
                      <div className="flex items-center gap-2">
                        <Warehouse size={16} className="text-blue-500" />
                        {warehouse.name}
                        {warehouse.isDefault ? (
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-black text-blue-600">
                            Varsayılan
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">{warehouse.code || "—"}</td>
                    <td className="px-4 py-3">
                      {getWarehouseStatusLabel(warehouse.status)}
                    </td>
                    <td className="px-4 py-3">{warehouse.metrics.productCount}</td>
                    <td className="px-4 py-3">{warehouse.metrics.totalStock}</td>
                    <td className="px-4 py-3">
                      {formatStockMoney(warehouse.metrics.totalValue)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/stocks/warehouses/${warehouse.id}`}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-black"
                      >
                        Detay
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
