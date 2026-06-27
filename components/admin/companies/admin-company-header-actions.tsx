"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ActionModalProps = {
  companyId: string;
  companyName: string;
  status: string;
  subscriptionStatus: string | null;
};

export function AdminCompanyHeaderActions({
  companyId,
  companyName,
  status,
  subscriptionStatus,
}: ActionModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState<null | "suspend" | "reactivate" | "trial">(null);
  const [reason, setReason] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [trialMode, setTrialMode] = useState("PLUS_7");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function runAction(path: string, body: Record<string, unknown>) {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "İşlem başarısız");
      setMessage("İşlem tamamlandı.");
      setOpen(null);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "İşlem başarısız");
    } finally {
      setLoading(false);
    }
  }

  async function quickAction(path: string) {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(path, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "İşlem başarısız");
      if (json.data?.resetLink) {
        setMessage(`Sıfırlama bağlantısı oluşturuldu.`);
      } else if (json.data?.inviteLink) {
        setMessage(`Davet bağlantısı yenilendi.`);
      } else {
        setMessage(json.data?.message ?? "İşlem tamamlandı.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "İşlem başarısız");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "SUSPENDED" ? (
        <button
          type="button"
          onClick={() => setOpen("suspend")}
          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-[12px] font-bold text-rose-700"
        >
          Askıya al
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen("reactivate")}
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12px] font-bold text-emerald-700"
        >
          Yeniden etkinleştir
        </button>
      )}
      {subscriptionStatus === "TRIAL" ? (
        <button
          type="button"
          onClick={() => setOpen("trial")}
          className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-[12px] font-bold text-violet-700"
        >
          Trial uzat
        </button>
      ) : null}
      <button
        type="button"
        onClick={() =>
          quickAction(`/api/admin/companies/${companyId}/owner/reset-password`)
        }
        className="rounded-xl border border-slate-200 px-3 py-1.5 text-[12px] font-bold text-slate-700"
      >
        Parola sıfırlama
      </button>
      <button
        type="button"
        onClick={() =>
          quickAction(`/api/admin/companies/${companyId}/owner/resend-invite`)
        }
        className="rounded-xl border border-slate-200 px-3 py-1.5 text-[12px] font-bold text-slate-700"
      >
        Daveti yenile
      </button>

      {message ? (
        <p className="w-full text-[12px] text-slate-600">{message}</p>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl">
            <h3 className="text-sm font-bold text-[#0f1f4d]">
              {open === "suspend"
                ? `${companyName} — Askıya al`
                : open === "reactivate"
                  ? `${companyName} — Yeniden etkinleştir`
                  : `${companyName} — Trial uzat`}
            </h3>
            <div className="mt-3 space-y-2">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Neden (zorunlu)"
                className="min-h-[72px] w-full rounded-xl border border-slate-200 p-2 text-sm"
              />
              {open === "suspend" ? (
                <textarea
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  placeholder="İç not (zorunlu)"
                  className="min-h-[72px] w-full rounded-xl border border-slate-200 p-2 text-sm"
                />
              ) : null}
              {open === "trial" ? (
                <select
                  value={trialMode}
                  onChange={(e) => setTrialMode(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 px-2 text-sm"
                >
                  <option value="PLUS_3">+3 gün</option>
                  <option value="PLUS_7">+7 gün</option>
                  <option value="PLUS_14">+14 gün</option>
                </select>
              ) : null}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="rounded-xl px-3 py-1.5 text-sm text-slate-600"
              >
                İptal
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  if (open === "suspend") {
                    void runAction(`/api/admin/companies/${companyId}/suspend`, {
                      reason,
                      internalNote,
                    });
                  } else if (open === "reactivate") {
                    void runAction(
                      `/api/admin/companies/${companyId}/reactivate`,
                      { reason }
                    );
                  } else {
                    void runAction(
                      `/api/admin/companies/${companyId}/extend-trial`,
                      { mode: trialMode, reason }
                    );
                  }
                }}
                className="rounded-xl bg-[#0f1f4d] px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {loading ? "Kaydediliyor..." : "Onayla"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
