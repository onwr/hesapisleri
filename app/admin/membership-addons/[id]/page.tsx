import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import { appOutlineButtonClass, appPanelClass } from "@/lib/admin-ui";
import { formatMinorToMoney } from "@/lib/billing/pricing-utils";
import { getAddOnDetail } from "@/lib/admin/addons";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export default async function AdminMembershipAddonDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { tab = "general" } = await searchParams;
  const detail = await getAddOnDetail(id);
  if (!detail) notFound();

  return (
    <AdminPageContainer size="full">
      <AdminPageHeader
        title={detail.name}
        description={detail.description ?? detail.code}
        secondaryActions={
          <Link href="/admin/membership-addons" className={appOutlineButtonClass}>
            Listeye Dön
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { id: "general", label: "Genel Bilgiler" },
          { id: "prices", label: "Fiyatlar" },
          { id: "companies", label: "Satın Alan Firmalar" },
        ].map((item) => (
          <Link
            key={item.id}
            href={`/admin/membership-addons/${id}?tab=${item.id}`}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              tab === item.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {tab === "general" ? (
        <div className={`${appPanelClass} grid gap-4 p-6 md:grid-cols-2`}>
          <div>
            <p className="text-xs text-slate-500">Tür</p>
            <p className="font-semibold">{detail.type}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Durum</p>
            <p className="font-semibold">{detail.status}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Entitlement</p>
            <p className="font-semibold">
              {detail.entitlementLabel} (+{detail.entitlementQuantity})
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Aktif Firma</p>
            <p className="font-semibold">{detail.activeCompanyCount}</p>
          </div>
        </div>
      ) : null}

      {tab === "prices" ? (
        <div className={`${appPanelClass} p-6`}>
          {detail.prices.length === 0 ? (
            <p className="text-slate-500">Fiyat tanımı yok.</p>
          ) : (
            <ul className="space-y-2">
              {detail.prices.map((price) => (
                <li key={price.id} className="flex justify-between rounded-xl border border-slate-100 px-4 py-3">
                  <span>
                    v{price.version} · {price.billingInterval ?? "—"} · {price.status}
                  </span>
                  <span className="font-semibold">
                    {formatMinorToMoney(price.salePriceMinor, price.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "companies" ? (
        <div className={`${appPanelClass} p-6`}>
          {detail.subscriptions.length === 0 ? (
            <p className="text-slate-500">Henüz satın alan firma yok.</p>
          ) : (
            <ul className="space-y-2">
              {detail.subscriptions.map((sub) => (
                <li key={sub.id} className="flex justify-between rounded-xl border border-slate-100 px-4 py-3">
                  <span>{sub.company.name}</span>
                  <span className="text-sm text-slate-600">
                    {sub.status} · x{sub.quantity}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </AdminPageContainer>
  );
}
