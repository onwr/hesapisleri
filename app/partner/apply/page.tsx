import Link from "next/link";
import { PartnerApplyForm } from "@/components/partner/partner-apply-form";

export default function PartnerApplyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <p className="text-[12px] font-bold uppercase tracking-wide text-violet-600">
            Referans Programı
          </p>
          <h1 className="mt-2 text-[32px] font-extrabold text-[#0f1f4d]">
            Ortaklık Başvurusu
          </h1>
          <p className="mt-2 text-[14px] text-slate-500">
            Bizi önerin, komisyon kazanın. Başvurunuz onaylandıktan sonra referans
            linkiniz ve panel erişiminiz açılır.
          </p>
        </div>

        <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)] md:p-8">
          <PartnerApplyForm />
        </div>

        <p className="mt-6 text-center text-[13px] text-slate-500">
          Zaten onaylı partner misiniz?{" "}
          <Link href="/partner/dashboard" className="font-bold text-[#0f1f4d] hover:underline">
            Panele git
          </Link>
        </p>
      </div>
    </div>
  );
}
