"use client";

import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";

type WarehouseCreateModalProps = {
  open: boolean;
  onClose: () => void;
};

export function WarehouseCreateModal({ open, onClose }: WarehouseCreateModalProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setCode("");
      setAddress("");
      setNote("");
      setIsDefault(false);
      setError("");
    }
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/stocks/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          code: code || undefined,
          address: address || undefined,
          note: note || undefined,
          isDefault,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || "Depo oluşturulamadı.");
        return;
      }

      onClose();
      router.refresh();
    } catch {
      setError("Sunucu hatası.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-[16px] font-black text-[#0f1f4d]">Yeni Depo</h2>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 p-2">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Depo adı"
            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-[13px] font-medium"
          />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Kod (opsiyonel)"
            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-[13px] font-medium"
          />
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Adres (opsiyonel)"
            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-[13px] font-medium"
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Not (opsiyonel)"
            className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] font-medium"
          />
          <label className="flex items-center gap-2 text-[13px] font-bold text-[#24345f]">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            Varsayılan depo yap
          </label>
          {error ? <p className="text-[12px] font-bold text-rose-600">{error}</p> : null}
          <button
            type="submit"
            disabled={saving}
            className="h-11 w-full rounded-xl bg-[#0f1f4d] text-[13px] font-black text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="mx-auto animate-spin" size={18} /> : "Oluştur"}
          </button>
        </form>
      </div>
    </div>
  );
}
