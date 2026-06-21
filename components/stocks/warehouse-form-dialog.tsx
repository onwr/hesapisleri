"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PRODUCT_INPUT_CLASS } from "@/components/products/product-ui-tokens";
import { parseWarehouseAddress } from "@/lib/warehouse-admin-service";

export type WarehouseFormValues = {
  name: string;
  code: string;
  description: string;
  city: string;
  district: string;
  address: string;
  isDefault: boolean;
  status: "ACTIVE" | "PASSIVE";
};

export type WarehouseFormRecord = {
  id: string;
  name: string;
  code: string | null;
  note: string | null;
  address: string | null;
  isDefault: boolean;
  status: "ACTIVE" | "PASSIVE";
};

type WarehouseFormDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  mode: "create" | "edit";
  warehouse?: WarehouseFormRecord | null;
  canManage?: boolean;
};

const WAREHOUSE_API = "/api/products/stocks/warehouses";

function emptyForm(): WarehouseFormValues {
  return {
    name: "",
    code: "",
    description: "",
    city: "",
    district: "",
    address: "",
    isDefault: false,
    status: "ACTIVE",
  };
}

function fromWarehouse(warehouse: WarehouseFormRecord): WarehouseFormValues {
  const parsed = parseWarehouseAddress(warehouse.address);

  return {
    name: warehouse.name,
    code: warehouse.code ?? "",
    description: warehouse.note ?? "",
    city: parsed.city,
    district: parsed.district,
    address: parsed.address,
    isDefault: warehouse.isDefault,
    status: warehouse.status,
  };
}

export function WarehouseFormDialog({
  open,
  onClose,
  onSuccess,
  mode,
  warehouse,
  canManage = true,
}: WarehouseFormDialogProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<WarehouseFormValues>(emptyForm);

  useEffect(() => {
    if (!open) return;

    setError("");
    setForm(mode === "edit" && warehouse ? fromWarehouse(warehouse) : emptyForm());
  }, [open, mode, warehouse]);

  function updateField<K extends keyof WarehouseFormValues>(
    key: K,
    value: WarehouseFormValues[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManage) return;

    const name = form.name.trim();
    if (!name) {
      setError("Depo adı zorunludur.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        name,
        code: form.code.trim() || undefined,
        description: form.description.trim() || undefined,
        city: form.city.trim() || undefined,
        district: form.district.trim() || undefined,
        address: form.address.trim() || undefined,
        isDefault: form.isDefault,
        status: form.status,
      };

      const response = await fetch(
        mode === "edit" && warehouse
          ? `${WAREHOUSE_API}/${warehouse.id}`
          : WAREHOUSE_API,
        {
          method: mode === "edit" ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || "Depo kaydedilemedi.");
        return;
      }

      onSuccess(data.message || (mode === "edit" ? "Depo güncellendi." : "Depo oluşturuldu."));
      onClose();
    } catch {
      setError("Sunucu hatası.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-[#0f1f4d]">
            {mode === "edit" ? "Depoyu Düzenle" : "Yeni Depo"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Depo bilgilerini güncelleyin."
              : "Stok takibi için yeni bir depo oluşturun."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block space-y-1">
            <span className="text-[11px] font-bold text-slate-500">Depo adı *</span>
            <input
              required
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              className={PRODUCT_INPUT_CLASS}
              placeholder="Ana Depo"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] font-bold text-slate-500">Depo kodu</span>
            <input
              value={form.code}
              onChange={(event) => updateField("code", event.target.value)}
              className={PRODUCT_INPUT_CLASS}
              placeholder="ANA"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] font-bold text-slate-500">Açıklama</span>
            <textarea
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
              className="min-h-20 w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-[13px] font-semibold text-[#0f1f4d] outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              placeholder="Merkez stok deposu"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-[11px] font-bold text-slate-500">İl</span>
              <input
                value={form.city}
                onChange={(event) => updateField("city", event.target.value)}
                className={PRODUCT_INPUT_CLASS}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-bold text-slate-500">İlçe</span>
              <input
                value={form.district}
                onChange={(event) => updateField("district", event.target.value)}
                className={PRODUCT_INPUT_CLASS}
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-[11px] font-bold text-slate-500">Adres</span>
            <input
              value={form.address}
              onChange={(event) => updateField("address", event.target.value)}
              className={PRODUCT_INPUT_CLASS}
            />
          </label>

          <label className="flex items-center gap-2 text-[12px] font-bold text-[#24345f]">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(event) => updateField("isDefault", event.target.checked)}
            />
            Varsayılan depo olarak ayarla
          </label>

          {mode === "edit" ? (
            <label className="block space-y-1">
              <span className="text-[11px] font-bold text-slate-500">Durum</span>
              <select
                value={form.status}
                onChange={(event) =>
                  updateField("status", event.target.value as "ACTIVE" | "PASSIVE")
                }
                className={PRODUCT_INPUT_CLASS}
              >
                <option value="ACTIVE">Aktif</option>
                <option value="PASSIVE">Pasif</option>
              </select>
            </label>
          ) : null}

          {error ? <p className="text-[12px] font-bold text-rose-600">{error}</p> : null}

          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={saving || !canManage}>
              {saving ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Kaydediliyor...
                </>
              ) : (
                "Kaydet"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
