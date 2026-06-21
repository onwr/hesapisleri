import { Suspense } from "react";
import Link from "next/link";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import { AdminSubscriptionDetailContent } from "@/components/admin/admin-subscription-detail-content";
import { appOutlineButtonClass } from "@/lib/admin-ui";
import {
  getSubscriptionStatusBadgeClass,
  getSubscriptionStatusUiLabel,
} from "@/lib/admin-subscription-utils";
import { getAdminSubscriptionDetail } from "@/lib/admin-subscription-service";
import { AdminSubscriptionError } from "@/lib/admin-subscription-service";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminSubscriptionDetailPage({ params }: PageProps) {
  const { id } = await params;

  try {
    const data = await getAdminSubscriptionDetail(id);

    return (
      <AdminPageContainer size="full">
        <AdminPageHeader
          title={data.company.name}
          description={
            data.plan
              ? `${data.plan.name} · ${data.subscription.billingInterval ?? "—"}`
              : "Abonelik detayı"
          }
          backHref="/admin/subscriptions"
          badge={
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-bold ${getSubscriptionStatusBadgeClass(data.subscription.status)}`}
            >
              {getSubscriptionStatusUiLabel(data.subscription.status)}
            </span>
          }
          secondaryActions={
            <>
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                  data.subscription.autoRenew
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                Auto-renew: {data.subscription.autoRenew ? "Açık" : "Kapalı"}
              </span>
              <Link
                href={`/admin/companies/${data.company.id}`}
                className={appOutlineButtonClass}
              >
                Firma Detayına Git
              </Link>
            </>
          }
        />

        <Suspense fallback={<p className="text-slate-500">Yükleniyor...</p>}>
          <AdminSubscriptionDetailContent data={data} />
        </Suspense>
      </AdminPageContainer>
    );
  } catch (error) {
    if (error instanceof AdminSubscriptionError && error.status === 404) {
      return (
        <AdminPageContainer size="default">
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-8 text-center">
            <p className="font-bold text-rose-700">Abonelik bulunamadı.</p>
            <Link href="/admin/subscriptions" className="mt-4 inline-block text-blue-600">
              Listeye dön
            </Link>
          </div>
        </AdminPageContainer>
      );
    }

    return (
      <AdminPageContainer size="default">
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-8 text-center">
          <p className="font-bold text-rose-700">Abonelik bilgileri yüklenemedi.</p>
          <Link href="/admin/subscriptions" className="mt-4 inline-block text-blue-600">
            Tekrar dene
          </Link>
        </div>
      </AdminPageContainer>
    );
  }
}
