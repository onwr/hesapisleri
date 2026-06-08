"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

type AdminCompanyActionsProps = {
  companyId: string;
  companyName: string;
  status: string;
  membershipStatus: string;
  nextPaymentDate?: string | null;
  monthlyFee?: number;
  membershipNote?: string | null;
  mode?: "row" | "detail";
};

export function AdminCompanyActions({
  companyId,
  companyName,
  status,
  membershipStatus,
  nextPaymentDate,
  monthlyFee = 1499,
  membershipNote,
  mode = "row",
}: AdminCompanyActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    membershipStatus,
    nextPaymentDate: nextPaymentDate?.slice(0, 10) ?? "",
    monthlyFee,
    membershipNote: membershipNote ?? "",
  });

  async function patchCompany(body: Record<string, unknown>) {
    setLoading(true);
    setError("");

    const response = await fetch(`/api/admin/companies/${companyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    setLoading(false);

    if (!response.ok || !result.success) {
      setError(result.message || "İşlem başarısız.");
      return false;
    }

    router.refresh();
    return true;
  }

  async function toggleStatus() {
    const nextStatus = status === "ACTIVE" ? "PASSIVE" : "ACTIVE";
    await patchCompany({ status: nextStatus });
  }

  async function saveMembership() {
    const ok = await patchCompany({
      membershipStatus: form.membershipStatus,
      nextPaymentDate: form.nextPaymentDate
        ? new Date(form.nextPaymentDate).toISOString()
        : null,
      monthlyFee: Number(form.monthlyFee),
      membershipNote: form.membershipNote || null,
    });

    if (ok) setOpen(false);
  }

  if (mode === "row") {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={toggleStatus}
          disabled={loading}
          className="rounded-xl border border-slate-200 px-3 py-1.5 text-[12px] font-bold text-slate-600 transition hover:border-slate-300 hover:text-[#0f1f4d] disabled:opacity-60"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : status === "ACTIVE" ? (
            "Pasife Al"
          ) : (
            "Aktife Al"
          )}
        </button>
        {error ? (
          <span className="text-[11px] font-medium text-rose-500">{error}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={toggleStatus}
          disabled={loading}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-[13px] font-bold text-slate-700 transition hover:border-slate-300 disabled:opacity-60"
        >
          {status === "ACTIVE" ? "Firmayı Pasife Al" : "Firmayı Aktife Al"}
        </button>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-2xl bg-[#0f1f4d] px-4 py-2 text-[13px] font-bold text-white transition hover:bg-[#162a66]"
        >
          Üyelik Düzenle
        </button>
        <button
          type="button"
          disabled
          title="Yakında"
          className="rounded-2xl border border-dashed border-slate-300 px-4 py-2 text-[13px] font-bold text-slate-400"
        >
          Firma Adına Giriş (Yakında)
        </button>
      </div>

      {open ? (
        <div className="rounded-[22px] border border-slate-200/70 bg-slate-50/70 p-4">
          <h3 className="mb-3 text-[15px] font-extrabold text-[#0f1f4d]">
            {companyName} · Üyelik Bilgileri
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-[12px] font-bold text-slate-500">
              Üyelik Durumu
              <select
                value={form.membershipStatus}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    membershipStatus: e.target.value,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-[#0f1f4d]"
              >
                <option value="ACTIVE">Aktif</option>
                <option value="PAST_DUE">Gecikmiş</option>
                <option value="CANCELLED">İptal</option>
              </select>
            </label>
            <label className="block text-[12px] font-bold text-slate-500">
              Sonraki Ödeme
              <input
                type="date"
                value={form.nextPaymentDate}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    nextPaymentDate: e.target.value,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-[#0f1f4d]"
              />
            </label>
            <label className="block text-[12px] font-bold text-slate-500">
              Aylık Ücret (TRY)
              <input
                type="number"
                min={0}
                value={form.monthlyFee}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    monthlyFee: Number(e.target.value),
                  }))
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-[#0f1f4d]"
              />
            </label>
            <label className="block text-[12px] font-bold text-slate-500 md:col-span-2">
              Not
              <textarea
                value={form.membershipNote}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    membershipNote: e.target.value,
                  }))
                }
                rows={3}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-[#0f1f4d]"
              />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={saveMembership}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#0f1f4d] px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              Kaydet
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-[13px] font-bold text-slate-600"
            >
              İptal
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="text-[13px] font-medium text-rose-500">{error}</p>
      ) : null}
    </div>
  );
}
