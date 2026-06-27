"use client";

import { useEffect, useState } from "react";
import { ENTITLEMENT_REGISTRY } from "@/lib/billing/entitlements/entitlement-registry";
import {
  adminAddonOverviewEditSchema,
  buildAddonOverviewPatchBody,
} from "@/lib/admin/addons/admin-addon-schemas";
import { appOutlineButtonClass, appPrimaryButtonClass } from "@/lib/admin-ui";

type AddOnShape = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  type: string;
  sortOrder: number;
  entitlementCode: string;
  entitlementQuantity: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  addOn: AddOnShape;
  onSuccess: (msg: string) => void;
};

const TYPE_OPTIONS = [
  { value: "RECURRING", label: "Yinelenen" },
  { value: "ONE_TIME", label: "Tek Seferlik" },
  { value: "USAGE_PACK", label: "Kullanım Paketi" },
] as const;

export function AdminAddonEditModal({ open, onClose, addOn, onSuccess }: Props) {
  const [name, setName] = useState(addOn.name);
  const [description, setDescription] = useState(addOn.description ?? "");
  const [sortOrder, setSortOrder] = useState(addOn.sortOrder);
  const [type, setType] = useState(addOn.type);
  const [entitlementCode, setEntitlementCode] = useState(addOn.entitlementCode);
  const [entitlementQuantity, setEntitlementQuantity] = useState(addOn.entitlementQuantity);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDraft = addOn.status === "DRAFT";
  const entitlementOptions = Object.values(ENTITLEMENT_REGISTRY);

  useEffect(() => {
    if (!open) return;
    setName(addOn.name);
    setDescription(addOn.description ?? "");
    setSortOrder(addOn.sortOrder);
    setType(addOn.type);
    setEntitlementCode(addOn.entitlementCode);
    setEntitlementQuantity(addOn.entitlementQuantity);
    setReason("");
    setError(null);
  }, [open, addOn]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);

    const parsed = adminAddonOverviewEditSchema.safeParse({
      name: name.trim(),
      description: description.trim() || null,
      sortOrder,
      ...(isDraft ? { type } : {}),
      entitlementCode,
      entitlementQuantity,
      reason: reason.trim(),
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Form doğrulaması başarısız.");
      setLoading(false);
      return;
    }

    const body = buildAddonOverviewPatchBody(parsed.data, {
      isDraft,
      currentType: addOn.type,
    });

    try {
      const res = await fetch(`/api/admin/add-ons/${addOn.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message ?? "Güncellenemedi.");
        return;
      }
      onSuccess(json.message ?? "Add-on güncellendi.");
    } catch {
      setError("İstek başarısız.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl"
      >
        <h3 className="text-[14px] font-bold text-slate-900">Add-on düzenle</h3>
        <div className="mt-4 space-y-3 text-[12px]">
          <label className="block">
            Ad
            <input
              className="mt-1 w-full rounded border px-2 py-1.5"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className="block">
            Açıklama
            <textarea
              className="mt-1 w-full rounded border px-2 py-1.5"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="block">
            Sıra
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded border px-2 py-1.5"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
            />
          </label>
          {isDraft ? (
            <label className="block">
              Tür (yalnız taslak)
              <select
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-slate-500">
              Tür: {TYPE_OPTIONS.find((o) => o.value === addOn.type)?.label ?? addOn.type} (değiştirilemez)
            </p>
          )}
          <label className="block">
            Entitlement kodu
            <select
              className="mt-1 w-full rounded border px-2 py-1.5 font-mono text-[11px]"
              value={entitlementCode}
              onChange={(e) => setEntitlementCode(e.target.value)}
            >
              {entitlementOptions.map((entry) => (
                <option key={entry.code} value={entry.code}>
                  {entry.code} — {entry.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Entitlement miktarı
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded border px-2 py-1.5"
              value={entitlementQuantity}
              onChange={(e) => setEntitlementQuantity(Number(e.target.value))}
              required
            />
          </label>
          <label className="block">
            Değişiklik sebebi
            <textarea
              className="mt-1 w-full rounded border px-2 py-1.5"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </label>
        </div>
        {error ? <p className="mt-2 text-[12px] text-red-700">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={appOutlineButtonClass} onClick={onClose} disabled={loading}>
            İptal
          </button>
          <button type="submit" className={appPrimaryButtonClass} disabled={loading}>
            {loading ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
}
