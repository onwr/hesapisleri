"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Save, Sparkles } from "lucide-react";
import { formatMoney } from "@/lib/format-utils";

type Plan = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  currency: string;
  isActive: boolean;
  features: string[];
  prices: {
    MONTHLY: number;
    QUARTERLY: number;
    SEMI_ANNUAL: number;
    YEARLY: number;
  };
};

type AdminPriceRow = {
  id: string;
  billingInterval: string;
  version: number;
  status: string;
  listPrice: number;
  salePrice: number;
  discountPercent: number;
  monthlyEquivalent: number;
  vatRate: number;
  vatIncluded: boolean;
  totalMinor: number;
  effectiveFrom: string;
  isPublic: boolean;
};

const INTERVAL_LABELS: Record<string, string> = {
  MONTHLY: "Aylık",
  QUARTERLY: "3 Aylık",
  SEMI_ANNUAL: "6 Aylık",
  YEARLY: "Yıllık",
};

type AdminMembershipPlansPanelProps = {
  initialPlans: Plan[];
};

export function AdminMembershipPlansPanel({
  initialPlans,
}: AdminMembershipPlansPanelProps) {
  const [plans, setPlans] = useState(initialPlans);
  const [priceMatrix, setPriceMatrix] = useState<
    Record<string, Record<string, AdminPriceRow | null>>
  >({});
  const [loadingPrices, setLoadingPrices] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    planId: string;
    interval: string;
  } | null>(null);
  const [form, setForm] = useState({
    listPrice: "",
    salePrice: "",
    discountPercent: "",
    vatIncluded: false,
    publish: true,
  });
  const [message, setMessage] = useState("");

  useEffect(() => {
    for (const plan of plans) {
      if (!priceMatrix[plan.id] && loadingPrices !== plan.id) {
        void loadPrices(plan.id);
      }
    }
  }, [plans, priceMatrix, loadingPrices]);

  const activePlan = useMemo(
    () => plans.find((plan) => plan.id === editing?.planId),
    [plans, editing]
  );

  async function loadPrices(planId: string) {
    setLoadingPrices(planId);
    try {
      const res = await fetch(`/api/admin/membership-plans/${planId}/prices`);
      const json = await res.json();
      if (res.ok && json.success) {
        const matrix: Record<string, AdminPriceRow | null> = {};
        for (const [interval, buckets] of Object.entries(
          json.data.matrix as Record<
            string,
            { active: AdminPriceRow | null }
          >
        )) {
          matrix[interval] = buckets.active;
        }
        setPriceMatrix((current) => ({ ...current, [planId]: matrix }));
      }
    } finally {
      setLoadingPrices(null);
    }
  }

  async function savePlan(plan: Plan) {
    setSavingId(plan.id);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/membership-plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: plan.name,
          description: plan.description,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setMessage(json.message || "Paket güncellenemedi.");
        return;
      }
      setPlans((current) =>
        current.map((entry) => (entry.id === plan.id ? json.data.plan : entry))
      );
      setMessage("Plan bilgileri güncellendi.");
    } catch {
      setMessage("Plan güncellenirken hata oluştu.");
    } finally {
      setSavingId(null);
    }
  }

  function openPriceEditor(planId: string, interval: string) {
    const active = priceMatrix[planId]?.[interval];
    setEditing({ planId, interval });
    setForm({
      listPrice: active ? String(active.listPrice) : "",
      salePrice: active ? String(active.salePrice) : "",
      discountPercent: active ? String(active.discountPercent) : "",
      vatIncluded: active?.vatIncluded ?? false,
      publish: true,
    });
  }

  async function savePriceVersion() {
    if (!editing) return;
    setSavingId(editing.planId);
    setMessage("");
    try {
      const res = await fetch(
        `/api/admin/membership-plans/${editing.planId}/prices`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            billingInterval: editing.interval,
            listPrice: form.listPrice,
            salePrice: form.salePrice || undefined,
            discountPercent: form.discountPercent
              ? Number(form.discountPercent)
              : undefined,
            vatIncluded: form.vatIncluded,
            publish: form.publish,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        setMessage(json.message || "Fiyat kaydedilemedi.");
        return;
      }
      setMessage(json.message || "Fiyat kaydedildi.");
      setEditing(null);
      await loadPrices(editing.planId);
    } catch {
      setMessage("Fiyat kaydedilirken hata oluştu.");
    } finally {
      setSavingId(null);
    }
  }

  const preview = useMemo(() => {
    const list = Number(form.listPrice);
    const sale = Number(form.salePrice || form.listPrice);
    if (!list || !sale) return null;
    const discount = list > 0 ? Math.round(((list - sale) / list) * 1000) / 10 : 0;
    const months =
      editing?.interval === "QUARTERLY"
        ? 3
        : editing?.interval === "SEMI_ANNUAL"
          ? 6
          : editing?.interval === "YEARLY"
            ? 12
            : 1;
    return {
      discount,
      monthly: sale / months,
      total: form.vatIncluded ? sale : sale * 1.2,
    };
  }, [form, editing]);

  return (
    <div className="space-y-5">
      {message ? (
        <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
          {message}
        </div>
      ) : null}

      {plans.map((plan) => {
        const matrix = priceMatrix[plan.id];

        return (
          <section
            key={plan.id}
            className="rounded-[22px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_26px_rgba(15,23,42,0.035)]"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="grid flex-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Plan Adı
                  </span>
                  <input
                    value={plan.name}
                    onChange={(e) =>
                      setPlans((current) =>
                        current.map((entry) =>
                          entry.id === plan.id
                            ? { ...entry, name: e.target.value }
                            : entry
                        )
                      )
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Kod
                  </span>
                  <input
                    value={plan.code}
                    disabled
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-500"
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={savingId === plan.id}
                onClick={() => void savePlan(plan)}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0f1f4d] px-4 text-xs font-black text-white disabled:opacity-50"
              >
                {savingId === plan.id ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <Save size={14} />
                )}
                Planı Kaydet
              </button>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-black text-slate-500">
                    <th className="px-2 py-2">Dönem</th>
                    <th className="px-2 py-2">Liste</th>
                    <th className="px-2 py-2">Satış</th>
                    <th className="px-2 py-2">İndirim</th>
                    <th className="px-2 py-2">Aylık Eşdeğer</th>
                    <th className="px-2 py-2">KDV</th>
                    <th className="px-2 py-2">Durum</th>
                    <th className="px-2 py-2 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"] as const).map(
                    (interval) => {
                      const row = matrix?.[interval];
                      const legacy = plan.prices[interval];
                      return (
                        <tr key={interval} className="border-b border-slate-50">
                          <td className="px-2 py-3 font-bold text-slate-700">
                            {INTERVAL_LABELS[interval]}
                          </td>
                          <td className="px-2 py-3">
                            {formatMoney(row?.listPrice ?? legacy)}
                          </td>
                          <td className="px-2 py-3 font-black text-[#0f1f4d]">
                            {formatMoney(row?.salePrice ?? legacy)}
                          </td>
                          <td className="px-2 py-3 text-emerald-700">
                            {row ? `%${row.discountPercent}` : "—"}
                          </td>
                          <td className="px-2 py-3">
                            {row
                              ? formatMoney(row.monthlyEquivalent)
                              : formatMoney(
                                  legacy /
                                    (interval === "QUARTERLY"
                                      ? 3
                                      : interval === "SEMI_ANNUAL"
                                        ? 6
                                        : interval === "YEARLY"
                                          ? 12
                                          : 1)
                                )}
                          </td>
                          <td className="px-2 py-3">
                            {row
                              ? row.vatIncluded
                                ? "Dahil"
                                : `%${row.vatRate} hariç`
                              : "%20 hariç"}
                          </td>
                          <td className="px-2 py-3">
                            <span className="rounded-md bg-slate-100 px-2 py-1 font-bold">
                              {row?.status ?? "LEGACY"}
                            </span>
                          </td>
                          <td className="px-2 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => openPriceEditor(plan.id, interval)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-bold text-slate-700 hover:bg-slate-50"
                            >
                              <Plus size={12} />
                              Yeni Versiyon
                            </button>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-violet-600" />
              <h3 className="text-lg font-black text-[#0f1f4d]">
                {activePlan?.name} · {INTERVAL_LABELS[editing.interval]} Fiyat
              </h3>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-semibold">
                Liste Fiyatı (TL)
                <input
                  value={form.listPrice}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, listPrice: e.target.value }))
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3"
                  placeholder="479"
                />
              </label>
              <label className="block text-sm font-semibold">
                Satış Fiyatı (TL)
                <input
                  value={form.salePrice}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, salePrice: e.target.value }))
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3"
                  placeholder="429"
                />
              </label>
              <label className="block text-sm font-semibold">
                İndirim %
                <input
                  value={form.discountPercent}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      discountPercent: e.target.value,
                    }))
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3"
                  placeholder="10"
                />
              </label>
              <label className="mt-7 flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={form.vatIncluded}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      vatIncluded: e.target.checked,
                    }))
                  }
                />
                KDV dahil fiyat
              </label>
            </div>

            {preview ? (
              <div className="mt-4 rounded-xl bg-violet-50 p-4 text-sm text-violet-900">
                <p className="font-black">Canlı Önizleme</p>
                <p className="mt-1">
                  İndirim: %{preview.discount} · Aylık eşdeğer:{" "}
                  {formatMoney(preview.monthly)} · Tahmini tahsilat (KDV):{" "}
                  {formatMoney(preview.total)}
                </p>
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={savingId === editing.planId}
                onClick={() => void savePriceVersion()}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-black text-white disabled:opacity-50"
              >
                {savingId === editing.planId ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : null}
                Yayınla
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
