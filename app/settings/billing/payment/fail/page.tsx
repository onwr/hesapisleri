import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";

type PageProps = { searchParams: Promise<{ paymentId?: string }> };

export default async function BillingPaymentFailPage({ searchParams }: PageProps) {
  const { paymentId } = await searchParams;

  return (
    <AppShell>
      <section className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-wide text-rose-400">
          PayTR
        </p>
        <h1 className="mt-2 text-xl font-black text-[#0f1f4d]">
          Ödeme tamamlanamadı
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Bu ekran kesin ödeme sonucu değildir. Kesin durum PayTR callback ve
          mutabakat kayıtlarından okunur.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {paymentId ? (
            <Link
              href={`/settings/billing/payment/status/${paymentId}`}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-black text-[#0f1f4d]"
            >
              Durumu Kontrol Et
            </Link>
          ) : null}
          <Link
            href="/settings/billing"
            className="rounded-lg bg-[#0f1f4d] px-4 py-2 text-sm font-black text-white"
          >
            Tekrar Dene
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
