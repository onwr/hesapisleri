import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { PaymentStatusActions } from "@/components/settings/payment-status-actions";

type PageProps = { searchParams: Promise<{ paymentId?: string }> };

export default async function BillingPaymentSuccessPage({ searchParams }: PageProps) {
  const { paymentId } = await searchParams;

  return (
    <AppShell>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
          PayTR
        </p>
        <h1 className="mt-2 text-xl font-black text-[#0f1f4d]">
          Ödeme doğrulanıyor
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Banka doğrulaması tamamlandı. PayTR sonucu kontrol ediliyor; onay
          sonrası üyeliğiniz aktif edilir.
        </p>
        {paymentId ? (
          <PaymentStatusActions
            paymentId={paymentId}
            initialStatus="FORM_READY"
            autoSync
          />
        ) : (
          <div className="mt-4">
            <Link
              href="/settings/billing"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-black text-[#0f1f4d]"
            >
              Billing Sayfasına Dön
            </Link>
          </div>
        )}
      </section>
    </AppShell>
  );
}
