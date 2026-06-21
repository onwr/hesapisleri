"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { generateReferralCode } from "@/lib/partner-utils";

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

const badgeOptions = [
  "NONE",
  "PARTNER",
  "VERIFIED",
  "INFLUENCER",
  "CELEBRITY",
  "VIP",
] as const;

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
    badgeType: "PARTNER" as (typeof badgeOptions)[number],
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
              <div className="mt-4 space-y-3">
                <input
                  className="w-full rounded-xl border px-3 py-2 text-[13px]"
                  value={approveForm.referralCode}
                  onChange={(e) =>
                    setApproveForm({ ...approveForm, referralCode: e.target.value })
                  }
                  placeholder="Referral code"
                />
                <input
                  type="number"
                  className="w-full rounded-xl border px-3 py-2 text-[13px]"
                  value={approveForm.commissionRate}
                  onChange={(e) =>
                    setApproveForm({
                      ...approveForm,
                      commissionRate: Number(e.target.value),
                    })
                  }
                  placeholder="Komisyon %"
                />
                <select
                  className="w-full rounded-xl border px-3 py-2 text-[13px]"
                  value={approveForm.badgeType}
                  onChange={(e) =>
                    setApproveForm({
                      ...approveForm,
                      badgeType: e.target.value as (typeof badgeOptions)[number],
                    })
                  }
                >
                  {badgeOptions.map((badge) => (
                    <option key={badge} value={badge}>
                      {badge}
                    </option>
                  ))}
                </select>
                <input
                  className="w-full rounded-xl border px-3 py-2 text-[13px]"
                  value={approveForm.badgeLabel}
                  onChange={(e) =>
                    setApproveForm({ ...approveForm, badgeLabel: e.target.value })
                  }
                  placeholder="Rozet etiketi"
                />
              </div>
            ) : (
              <textarea
                className="mt-4 w-full rounded-xl border px-3 py-2 text-[13px]"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Red nedeni"
              />
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
                className="inline-flex items-center gap-2 rounded-xl bg-[#0f1f4d] px-4 py-2 text-[13px] font-bold text-white"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : null}
                Kaydet
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
