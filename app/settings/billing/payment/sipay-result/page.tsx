import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getAppSession } from "@/lib/app-session";
import { getSipayPaymentResultForCompany } from "@/lib/payments/sipay/sipay-result-service";

type PageProps = {
  searchParams: Promise<{
    invoice_id?: string;
    reason?: string;
  }>;
};

function statusHeading(status: string, found: boolean): { title: string; body: string; tone: "success" | "error" | "neutral" | "warning" } {
  if (!found) {
    return {
      title: "Ödeme durumu bilinmiyor",
      body: "Bu referans için kayıt bulunamadı veya erişim yetkiniz yok.",
      tone: "neutral",
    };
  }

  switch (status) {
    case "COMPLETED":
      return {
        title: "Ödeme tamamlandı",
        body: "Sipay ödemesi onaylandı. Üyeliğiniz aktif edildi.",
        tone: "success",
      };
    case "PENDING":
    case "CHECKOUT_LINK_READY":
    case "CREATED":
      return {
        title: "Ödeme beklemede",
        body: "Ödeme henüz kesinleşmedi. Birkaç dakika sonra billing sayfasından durumu kontrol edin.",
        tone: "warning",
      };
    case "CANCELLED":
      return {
        title: "Ödeme iptal edildi",
        body: "Ödeme işlemi iptal edildi. Üyeliğinizde herhangi bir değişiklik yapılmadı.",
        tone: "neutral",
      };
    case "FAILED":
    case "EXPIRED":
      return {
        title: "Ödeme başarısız",
        body: "Ödeme işlemi tamamlanamadı. Lütfen tekrar deneyin veya destek ile iletişime geçin.",
        tone: "error",
      };
    default:
      return {
        title: "Ödeme durumu bilinmiyor",
        body: "Ödeme durumu doğrulanamadı.",
        tone: "neutral",
      };
  }
}

export default async function SipayResultPage({ searchParams }: PageProps) {
  const session = await getAppSession();
  const { invoice_id: invoiceId, reason } = await searchParams;

  if (!invoiceId) {
    redirect("/settings/billing");
  }

  const result = await getSipayPaymentResultForCompany(session.company.id, invoiceId);
  const view = statusHeading(result.status, result.found);

  const titleClass =
    view.tone === "success"
      ? "text-[#0f1f4d]"
      : view.tone === "error"
        ? "text-red-600"
        : "text-slate-700";

  return (
    <AppShell>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Sipay</p>
        <h1 className={`mt-2 text-xl font-black ${titleClass}`}>{view.title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          {view.body}
          {reason && !result.found ? ` (${reason})` : ""}
        </p>
        <p className="mt-3 font-mono text-xs text-slate-400">Referans: {invoiceId}</p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/settings/billing"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-black text-[#0f1f4d] hover:bg-slate-50"
          >
            Billing Sayfasına Dön
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
