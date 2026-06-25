"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { generateReferralCode, getBadgeTypeLabel } from "@/lib/partner-utils";
import type { PartnerBadgeType } from "@prisma/client";

type Application = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  audienceTypeLabel: string;
  socialUrl: string | null;
  expectedReach: string | null;
  status: string;
  createdAt: string;
};

const badgeOptions: PartnerBadgeType[] = [
  "NONE",
  "PARTNER",
  "VERIFIED",
  "INFLUENCER",
  "CELEBRITY",
  "VIP",
];

const fieldClass =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-[#0f1f4d] outline-none transition focus:border-[#0f1f4d] focus:ring-2 focus:ring-[#0f1f4d]/10";

const labelClass = "block text-[12px] font-bold text-slate-500";

const hintClass = "mt-1 text-[11px] font-medium text-slate-400";

export function AdminPartnerApplicationActions({
  application,
}: {
  application: Application;
}) {
  const [open, setOpen] = useState<"approve" | "reject" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [approveForm, setApproveForm] = useState({
    referralCode: generateReferralCode(application.fullName),
    commissionRate: 10,
    badgeType: "PARTNER" as PartnerBadgeType,
    badgeLabel: "Onaylı Partner",
    notes: "",
  });
  const [rejectionReason, setRejectionReason] = useState("");

  async function submitApprove() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/partners/applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(approveForm),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || "Onaylama başarısız.");
        return;
      }

      window.location.reload();
    } catch {
      setError("Onaylama sırasında hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  async function submitReject() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/partners/applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED", rejectionReason }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || "Reddetme başarısız.");
        return;
      }

      window.location.reload();
    } catch {
      setError("Reddetme sırasında hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  if (application.status !== "PENDING") {
    return <span className="text-[12px] text-slate-400">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => setOpen("approve")}
        className="rounded-xl bg-emerald-600 px-3 py-1.5 text-[12px] font-bold text-white"
      >
        Onayla
      </button>
      <button
        type="button"
        onClick={() => setOpen("reject")}
        className="rounded-xl bg-rose-600 px-3 py-1.5 text-[12px] font-bold text-white"
      >
        Reddet
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-[24px] bg-white p-6 shadow-xl">
            <h3 className="text-[18px] font-extrabold text-[#0f1f4d]">
              {open === "approve" ? "Başvuruyu Onayla" : "Başvuruyu Reddet"}
            </h3>
            <p className="mt-1 text-[13px] text-slate-500">
              {application.fullName} · {application.email}
            </p>

            {open === "approve" ? (
              <div className="mt-4 space-y-4">
                <label className={labelClass}>
                  Referans kodu
                  <div className="mt-1 flex gap-2">
                    <input
                      className={fieldClass}
                      value={approveForm.referralCode}
                      onChange={(e) =>
                        setApproveForm({
                          ...approveForm,
                          referralCode: e.target.value.toUpperCase(),
                        })
                      }
                      placeholder="Örn. FADIME9041"
                      maxLength={32}
                    />
                    <button
                      type="button"
                      title="Yeni kod üret"
                      onClick={() =>
                        setApproveForm({
                          ...approveForm,
                          referralCode: generateReferralCode(application.fullName),
                        })
                      }
                      className="inline-flex shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-slate-600 transition hover:bg-slate-50"
                    >
                      <RefreshCw size={15} />
                    </button>
                  </div>
                  <p className={hintClass}>
                    Partner linkinde kullanılacak benzersiz kod. Boş bırakılırsa
                    otomatik üretilir.
                  </p>
                </label>

                <label className={labelClass}>
                  Komisyon oranı (%)
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    className={fieldClass}
                    value={approveForm.commissionRate}
                    onChange={(e) =>
                      setApproveForm({
                        ...approveForm,
                        commissionRate: Number(e.target.value),
                      })
                    }
                    placeholder="Örn. 10"
                  />
                  <p className={hintClass}>
                    Üyelik ödemelerinden partnerin kazanacağı yüzde. Varsayılan
                    platform oranı kullanılabilir.
                  </p>
                </label>

                <label className={labelClass}>
                  Partner rozeti (seviye)
                  <select
                    className={fieldClass}
                    value={approveForm.badgeType}
                    onChange={(e) =>
                      setApproveForm({
                        ...approveForm,
                        badgeType: e.target.value as PartnerBadgeType,
                      })
                    }
                  >
                    {badgeOptions.map((badge) => (
                      <option key={badge} value={badge}>
                        {getBadgeTypeLabel(badge)}
                      </option>
                    ))}
                  </select>
                  <p className={hintClass}>
                    Partner panelinde görünecek rozet türü (Influencer, VIP vb.).
                  </p>
                </label>

                <label className={labelClass}>
                  Rozet etiketi (görünen metin)
                  <input
                    className={fieldClass}
                    value={approveForm.badgeLabel}
                    onChange={(e) =>
                      setApproveForm({ ...approveForm, badgeLabel: e.target.value })
                    }
                    placeholder="Örn. Onaylı Partner"
                  />
                  <p className={hintClass}>
                    Rozetin yanında kullanıcıya gösterilecek kısa açıklama.
                  </p>
                </label>

                <label className={labelClass}>
                  İç not (isteğe bağlı)
                  <textarea
                    className={`${fieldClass} min-h-[88px] resize-y`}
                    value={approveForm.notes}
                    onChange={(e) =>
                      setApproveForm({ ...approveForm, notes: e.target.value })
                    }
                    placeholder="Yalnız admin panelinde görünür; partner ile paylaşılmaz."
                  />
                </label>
              </div>
            ) : (
              <label className={`${labelClass} mt-4 block`}>
                Red nedeni
                <textarea
                  className={`${fieldClass} min-h-[100px] resize-y`}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Başvurunun neden reddedildiğini kısaca yazın. Başvuru sahibi bu metni görebilir."
                  required
                />
                <p className={hintClass}>
                  Bu açıklama başvuru sahibine gösterilir; net ve profesyonel
                  olun.
                </p>
              </label>
            )}

            {error ? (
              <p className="mt-3 text-[13px] font-semibold text-rose-600">{error}</p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="rounded-xl border px-4 py-2 text-[13px] font-bold"
              >
                İptal
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void (open === "approve" ? submitApprove() : submitReject())}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0f1f4d] px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : null}
                {open === "approve" ? "Onayla ve Partner Oluştur" : "Reddet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
