"use client";

import Link from "next/link";
import { Clock3, RefreshCw, XCircle } from "lucide-react";
import type { PartnershipApplicationSnapshot } from "@/lib/partnership-access";
import { formatEmployeeDate } from "@/lib/employee-page-utils";

type PartnershipStatusClientProps = {
  kind: "PENDING" | "REJECTED";
  application: PartnershipApplicationSnapshot;
  canReapply: boolean;
};

const cardClass =
  "rounded-[22px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_26px_rgba(15,23,42,0.035)]";

export function PartnershipStatusClient({
  kind,
  application,
  canReapply,
}: PartnershipStatusClientProps) {
  const isPending = kind === "PENDING";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <p className="text-[12px] font-bold uppercase tracking-wide text-slate-400">
          Ortaklık Programı
        </p>
        <h1 className="mt-1 text-[24px] font-extrabold text-[#0f1f4d]">
          {isPending ? "Başvuru İnceleniyor" : "Başvuru Reddedildi"}
        </h1>
      </div>

      <div
        className={[
          cardClass,
          isPending ? "border-amber-200/80 bg-amber-50/40" : "border-rose-200/80",
        ].join(" ")}
      >
        <div className="flex items-start gap-3">
          {isPending ? (
            <Clock3 className="mt-0.5 shrink-0 text-amber-600" size={22} />
          ) : (
            <XCircle className="mt-0.5 shrink-0 text-rose-600" size={22} />
          )}
          <div className="space-y-2 text-[14px] text-slate-700">
            <p className="font-bold text-[#0f1f4d]">{application.fullName}</p>
            <p>{application.email}</p>
            <p className="text-[13px] text-slate-500">
              Başvuru tarihi: {formatEmployeeDate(application.createdAt)}
            </p>
            {isPending ? (
              <p>
                Başvurunuz değerlendirme aşamasında. Onaylandığında referans
                linkiniz ve partner paneliniz açılacaktır.
              </p>
            ) : (
              <>
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-[13px] font-semibold text-rose-800">
                  {application.rejectionReason ?? "Başvurunuz uygun bulunmadı."}
                </p>
                {canReapply ? (
                  <p className="text-[13px] text-slate-600">
                    Yeni bilgilerle tekrar başvurabilirsiniz.
                  </p>
                ) : (
                  <p className="text-[13px] text-slate-600">
                    Başvurular şu anda kapalıdır. Daha sonra tekrar deneyebilirsiniz.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {!isPending && canReapply ? (
        <Link
          href="/partnership/apply"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0f1f4d] px-4 text-[13px] font-bold text-white"
        >
          <RefreshCw size={15} />
          Yeniden Başvur
        </Link>
      ) : null}
    </div>
  );
}
