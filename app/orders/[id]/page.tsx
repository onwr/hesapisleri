import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Package,
  Truck,
  User,
  Warehouse,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { MarketplaceLogo } from "@/components/orders/marketplace-logo";
import { OrderDetailActions } from "@/components/orders/order-detail-actions";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { formatMoney } from "@/lib/format-utils";
import { getMarketplaceName } from "@/lib/marketplace-logos";
import {
  PAYMENT_STATUS_CLASS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/order-utils";
import { getOrderDetailData } from "@/lib/orders-page-data";
import {
  formatOrderDateTime,
  ORDER_STATUS_CLASS,
} from "@/lib/orders-page-utils";
type Props = {
  params: Promise<{ id: string }>;
};

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

function formatDate(date: Date | null) {
  if (!date) return "—";
  return formatOrderDateTime(date);
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  const token = await getAuthToken();
  if (!token) redirect("/login");

  const payload = verifyToken<AuthPayload>(token);
  if (!payload?.companyId) redirect("/login");

  const data = await getOrderDetailData(payload.companyId, id);
  if (!data) notFound();

  const { sale, orderRow, activities } = data;

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href="/orders"
              className="inline-flex items-center gap-2 text-[12px] font-bold text-blue-600 hover:text-blue-700"
            >
              <ArrowLeft size={14} />
              Siparişlere Dön
            </Link>
            <h1 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#0f1f4d]">
              {orderRow.orderNo}
            </h1>
            <p className="mt-1 text-[13px] font-semibold text-slate-500">
              Satış No: {sale.saleNo}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <MarketplaceLogo channel={sale.sourceChannel} className="h-10 w-10" />
            <div>
              <p className="text-[12px] font-black text-[#0f1f4d]">
                {getMarketplaceName(sale.sourceChannel)}
              </p>
              {sale.externalOrderId ? (
                <p className="text-[11px] font-semibold text-slate-500">
                  Harici: {sale.externalOrderId}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <h2 className="text-[14px] font-extrabold text-[#0f1f4d]">Sipariş Özeti</h2>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <InfoCard
                  icon={<User size={16} />}
                  label="Müşteri"
                  value={orderRow.customerName}
                  sub={orderRow.customerSubName}
                />
                <InfoCard
                  icon={<Package size={16} />}
                  label="Tutar"
                  value={formatMoney(orderRow.total)}
                />
                <InfoCard
                  label="Ödeme Durumu"
                  value={PAYMENT_STATUS_LABELS[sale.paymentStatus]}
                  badgeClass={PAYMENT_STATUS_CLASS[sale.paymentStatus]}
                />
                <InfoCard
                  label="Sipariş Durumu"
                  value={orderRow.status}
                  badgeClass={ORDER_STATUS_CLASS[orderRow.status]}
                />
                <InfoCard
                  icon={<Truck size={16} />}
                  label="Kargo Firması"
                  value={orderRow.cargo}
                />
                <InfoCard
                  label="Takip No"
                  value={orderRow.cargoCode ?? "—"}
                />
                <InfoCard label="Kargoya Verildi" value={formatDate(sale.shippedAt)} />
                <InfoCard label="Teslim Tarihi" value={formatDate(sale.deliveredAt)} />
                <InfoCard
                  icon={<Warehouse size={16} />}
                  label="Depo"
                  value={sale.warehouse?.name ?? "Varsayılan depo"}
                />
              </div>

              {sale.orderNote ? (
                <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-[12px] font-semibold text-slate-600">
                  {sale.orderNote}
                </p>
              ) : null}
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <h2 className="text-[14px] font-extrabold text-[#0f1f4d]">Ürün Kalemleri</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-black text-slate-500">
                      <th className="py-2">Ürün</th>
                      <th className="py-2">Adet</th>
                      <th className="py-2 text-right">Birim</th>
                      <th className="py-2 text-right">Toplam</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sale.items.map((item) => (
                      <tr key={item.id} className="font-semibold text-[#24345f]">
                        <td className="py-2.5">{item.name}</td>
                        <td className="py-2.5">{item.quantity}</td>
                        <td className="py-2.5 text-right">
                          {formatMoney(Number(item.unitPrice))}
                        </td>
                        <td className="py-2.5 text-right font-black">
                          {formatMoney(Number(item.total))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <h2 className="text-[14px] font-extrabold text-[#0f1f4d]">Aktivite</h2>
              <div className="mt-4 space-y-3">
                {activities.length > 0 ? (
                  activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3"
                    >
                      <p className="text-[12px] font-semibold text-[#24345f]">
                        {activity.message}
                      </p>
                      <p className="mt-1 text-[10px] font-medium text-slate-500">
                        {activity.user?.name ?? "Sistem"} ·{" "}
                        {formatOrderDateTime(activity.createdAt)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-[12px] font-medium text-slate-500">
                    Henüz aktivite kaydı yok.
                  </p>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <h2 className="text-[14px] font-extrabold text-[#0f1f4d]">İşlemler</h2>
              <div className="mt-4">
                <OrderDetailActions
                  orderId={sale.id}
                  orderNo={orderRow.orderNo}
                  orderStatus={sale.orderStatus}
                />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <h2 className="text-[14px] font-extrabold text-[#0f1f4d]">Bağlantılar</h2>
              <div className="mt-4 space-y-2">
                <Link
                  href={`/sales/${sale.id}`}
                  className="flex h-11 items-center justify-between rounded-xl border border-slate-200 px-4 text-[12px] font-black text-[#24345f] hover:bg-slate-50"
                >
                  Satış Detayı
                  <ExternalLink size={14} />
                </Link>
                {sale.invoice ? (
                  <Link
                    href={`/invoices/${sale.invoice.id}`}
                    className="flex h-11 items-center justify-between rounded-xl border border-slate-200 px-4 text-[12px] font-black text-[#24345f] hover:bg-slate-50"
                  >
                    Fatura ({sale.invoice.invoiceNo})
                    <FileText size={14} />
                  </Link>
                ) : null}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function InfoCard({
  icon,
  label,
  value,
  sub,
  badgeClass,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  sub?: string | null;
  badgeClass?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
      <p className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
        {icon}
        {label}
      </p>
      {badgeClass ? (
        <span
          className={[
            "mt-2 inline-block rounded-md px-2 py-1 text-[11px] font-black",
            badgeClass,
          ].join(" ")}
        >
          {value}
        </span>
      ) : (
        <p className="mt-2 text-[13px] font-black text-[#0f1f4d]">{value}</p>
      )}
      {sub ? (
        <p className="mt-0.5 text-[10px] font-semibold text-slate-400">{sub}</p>
      ) : null}
    </div>
  );
}
