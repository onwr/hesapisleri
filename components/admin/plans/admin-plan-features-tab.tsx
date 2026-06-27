"use client";

import { useCallback, useState } from "react";
import {
  appOutlineButtonClass,
  appPanelClass,
  appPrimaryButtonClass,
  appTableClass,
  appTableHeadClass,
  appTableRowClass,
} from "@/lib/admin-ui";
import { formatAdminDate } from "@/lib/admin-utils";

type FeatureRow = {
  id: string;
  title: string;
  shortDescription: string | null;
  iconKey: string | null;
  sortOrder: number;
  isHighlighted: boolean;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
};

type FeaturesData = {
  planStatus: string;
  summary: {
    total: number;
    visible: number;
    hidden: number;
    highlighted: number;
    legacyInSync: boolean;
    lastUpdatedAt: string | null;
  };
  features: FeatureRow[];
};

type Props = {
  planId: string;
  data: FeaturesData | null;
  onRefresh: () => void;
};

const emptyForm = {
  title: "",
  shortDescription: "",
  iconKey: "",
  isHighlighted: false,
  isVisible: true,
};

export function AdminPlanFeaturesTab({ planId, data, onRefresh }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FeatureRow | null>(null);
  const [form, setForm] = useState(emptyForm);

  const archived = data?.planStatus === "ARCHIVED";

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      setError(null);
      try {
        await fn();
        onRefresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "İşlem başarısız");
      } finally {
        setBusy(false);
      }
    },
    [onRefresh]
  );

  if (!data) {
    return <p className="text-[12px] text-red-600">Özellik verisi yüklenemedi.</p>;
  }

  const features = data.features;

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(row: FeatureRow) {
    setEditing(row);
    setForm({
      title: row.title,
      shortDescription: row.shortDescription ?? "",
      iconKey: row.iconKey ?? "",
      isHighlighted: row.isHighlighted,
      isVisible: row.isVisible,
    });
    setFormOpen(true);
  }

  async function submitForm() {
    const payload = {
      title: form.title,
      shortDescription: form.shortDescription || null,
      iconKey: form.iconKey || null,
      isHighlighted: form.isHighlighted,
      isVisible: form.isVisible,
    };
    await run(async () => {
      const url = editing
        ? `/api/admin/plans/${planId}/features/${editing.id}`
        : `/api/admin/plans/${planId}/features`;
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setFormOpen(false);
    });
  }

  async function toggleField(row: FeatureRow, field: "isVisible" | "isHighlighted") {
    await run(async () => {
      const res = await fetch(`/api/admin/plans/${planId}/features/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: !row[field] }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
    });
  }

  async function move(row: FeatureRow, dir: -1 | 1) {
    const idx = features.findIndex((f) => f.id === row.id);
    const target = idx + dir;
    if (target < 0 || target >= features.length) return;
    const ordered = [...features];
    const [removed] = ordered.splice(idx, 1);
    ordered.splice(target, 0, removed);
    await run(async () => {
      const res = await fetch(`/api/admin/plans/${planId}/features/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedFeatureIds: ordered.map((f) => f.id) }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
    });
  }

  async function remove(row: FeatureRow) {
    if (!confirm(`"${row.title}" silinsin mi?`)) return;
    await run(async () => {
      const res = await fetch(`/api/admin/plans/${planId}/features/${row.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
    });
  }

  return (
    <div>
      <div className={`${appPanelClass} mb-4 p-4 text-[12px] text-slate-600`}>
        <div className="flex flex-wrap gap-4">
          <span>Toplam: {data.summary.total}</span>
          <span>Görünür: {data.summary.visible}</span>
          <span>Gizli: {data.summary.hidden}</span>
          <span>Öne çıkan: {data.summary.highlighted}</span>
          <span>
            Legacy uyum:{" "}
            {data.summary.legacyInSync ? (
              <span className="font-bold text-emerald-700">Senkron</span>
            ) : (
              <span className="font-bold text-amber-700">Uyumsuz</span>
            )}
          </span>
          {data.summary.lastUpdatedAt ? (
            <span>Son güncelleme: {formatAdminDate(data.summary.lastUpdatedAt)}</span>
          ) : null}
        </div>
        {archived ? (
          <p className="mt-2 text-amber-700">Arşivli plan — yeni özellik ve görünürlük açma kısıtlı.</p>
        ) : null}
      </div>

      <div className="mb-3 flex justify-between">
        <p className="text-[12px] text-slate-500">
          PlanFeature canonical kaynaktır; legacy features[] otomatik senkronize edilir.
        </p>
        <button
          type="button"
          className={appPrimaryButtonClass}
          onClick={openCreate}
          disabled={busy || archived}
        >
          Yeni özellik
        </button>
      </div>

      {error ? <p className="mb-2 text-[12px] text-red-600">{error}</p> : null}

      {features.length === 0 ? (
        <p className="text-[12px] text-slate-500">Henüz yapılandırılmış özellik yok.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className={appTableClass}>
            <thead>
              <tr className={appTableHeadClass}>
                <th className="px-2 py-2">Başlık</th>
                <th className="px-2 py-2">Açıklama</th>
                <th className="px-2 py-2">iconKey</th>
                <th className="px-2 py-2">Sıra</th>
                <th className="px-2 py-2">Öne çıkan</th>
                <th className="px-2 py-2">Görünür</th>
                <th className="px-2 py-2">Oluşturma</th>
                <th className="px-2 py-2">Güncelleme</th>
                <th className="px-2 py-2">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {features.map((row) => (
                <tr key={row.id} className={appTableRowClass}>
                  <td className="px-2 py-2 font-medium">{row.title}</td>
                  <td className="px-2 py-2 text-[11px]">{row.shortDescription ?? "—"}</td>
                  <td className="px-2 py-2 font-mono text-[10px]">{row.iconKey ?? "—"}</td>
                  <td className="px-2 py-2">{row.sortOrder}</td>
                  <td className="px-2 py-2">{row.isHighlighted ? "Evet" : "Hayır"}</td>
                  <td className="px-2 py-2">{row.isVisible ? "Evet" : "Hayır"}</td>
                  <td className="px-2 py-2 text-[10px]">{formatAdminDate(row.createdAt)}</td>
                  <td className="px-2 py-2 text-[10px]">{formatAdminDate(row.updatedAt)}</td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" className={appOutlineButtonClass} onClick={() => openEdit(row)} disabled={busy}>
                        Düzenle
                      </button>
                      <button type="button" className={appOutlineButtonClass} onClick={() => toggleField(row, "isVisible")} disabled={busy}>
                        {row.isVisible ? "Gizle" : "Göster"}
                      </button>
                      <button type="button" className={appOutlineButtonClass} onClick={() => toggleField(row, "isHighlighted")} disabled={busy}>
                        {row.isHighlighted ? "Öne çıkarma" : "Öne çıkar"}
                      </button>
                      <button type="button" className={appOutlineButtonClass} onClick={() => move(row, -1)} disabled={busy}>
                        ↑
                      </button>
                      <button type="button" className={appOutlineButtonClass} onClick={() => move(row, 1)} disabled={busy}>
                        ↓
                      </button>
                      <button type="button" className={appOutlineButtonClass} onClick={() => remove(row)} disabled={busy}>
                        Sil
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className={`${appPanelClass} w-full max-w-md p-4`}>
            <h3 className="mb-3 text-[14px] font-bold">{editing ? "Özellik düzenle" : "Yeni özellik"}</h3>
            <div className="space-y-2 text-[12px]">
              <label className="block">
                Başlık *
                <input
                  className="mt-1 w-full rounded border px-2 py-1"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>
              <label className="block">
                Kısa açıklama
                <input
                  className="mt-1 w-full rounded border px-2 py-1"
                  value={form.shortDescription}
                  onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
                />
              </label>
              <label className="block">
                iconKey (slug)
                <input
                  className="mt-1 w-full rounded border px-2 py-1"
                  value={form.iconKey}
                  onChange={(e) => setForm({ ...form, iconKey: e.target.value })}
                />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isHighlighted}
                  onChange={(e) => setForm({ ...form, isHighlighted: e.target.checked })}
                />
                Öne çıkarılmış
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isVisible}
                  onChange={(e) => setForm({ ...form, isVisible: e.target.checked })}
                />
                Görünür
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={appOutlineButtonClass} onClick={() => setFormOpen(false)}>
                İptal
              </button>
              <button type="button" className={appPrimaryButtonClass} onClick={() => void submitForm()} disabled={busy}>
                Kaydet
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
