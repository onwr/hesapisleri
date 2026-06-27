"use client";

import { useCallback, useMemo, useState } from "react";
import {
  appOutlineButtonClass,
  appPanelClass,
  appPrimaryButtonClass,
  appTableClass,
  appTableHeadClass,
  appTableRowClass,
} from "@/lib/admin-ui";
import { formatAdminDate } from "@/lib/admin-utils";

type RegistryEntry = {
  code: string;
  title: string;
  description: string;
  valueType: string;
  category: string;
  defaultValue: string;
};

type EntRow = {
  code: string;
  registryTitle: string;
  valueType: string;
  currentValue: string | null;
  publishedValue: string | null;
  addonAffectable: boolean;
  adminOverrideSupported: boolean;
  enforcementStatus: string;
  updatedAt: string;
  isUnknownCode: boolean;
  resolvedPreview: {
    registryDefault: string;
    planValue: string | null;
    addonAffectable: boolean;
    adminOverrideSupported: boolean;
    finalPlanLevelPreview: string;
  };
};

type EntitlementsData = {
  planStatus: string;
  message: string;
  registry: RegistryEntry[];
  entitlements: EntRow[];
  publishedVersion: number;
  publishedAt: string | null;
  unknownCodes: string[];
  issues: Array<{ code: string; severity: string; message: string }>;
};

type DraftRow = {
  code: string;
  valueType: string;
  booleanValue: boolean | null;
  numberValue: number | null;
  stringValue: string | null;
  isUnlimited: boolean;
};

type Props = {
  planId: string;
  data: EntitlementsData | null;
  onRefresh: () => void;
};

type PreviewData = {
  diff: Array<{
    code: string;
    changeType: string;
    oldValue: string | null;
    newValue: string | null;
    registryTitle: string;
    enforcementUnchanged: boolean;
  }>;
  currentVersion: number;
  operationalEnforcementNote: string;
};

function rowToDraft(row: EntRow): DraftRow {
  const vt = row.valueType;
  if (vt === "BOOLEAN") {
    return {
      code: row.code,
      valueType: vt,
      booleanValue: row.currentValue === "true",
      numberValue: null,
      stringValue: null,
      isUnlimited: false,
    };
  }
  if (vt === "UNLIMITED") {
    return { code: row.code, valueType: vt, booleanValue: null, numberValue: null, stringValue: null, isUnlimited: true };
  }
  if (vt === "NUMBER") {
    return {
      code: row.code,
      valueType: vt,
      booleanValue: null,
      numberValue: Number(row.currentValue ?? 0),
      stringValue: null,
      isUnlimited: false,
    };
  }
  return {
    code: row.code,
    valueType: vt,
    booleanValue: null,
    numberValue: null,
    stringValue: row.currentValue,
    isUnlimited: false,
  };
}

export function AdminPlanEntitlementsTab({ planId, data, onRefresh }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [reason, setReason] = useState("");
  const [addCode, setAddCode] = useState("");

  const registryCodes = useMemo(
    () => new Set((data?.registry ?? []).map((r) => r.code)),
    [data?.registry]
  );

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      setError(null);
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "İşlem başarısız");
      } finally {
        setBusy(false);
      }
    },
    []
  );

  if (!data) {
    return <p className="text-[12px] text-red-600">Entitlement verisi yüklenemedi.</p>;
  }

  const entData = data;

  function openEditor() {
    setDrafts(entData.entitlements.map(rowToDraft));
    setPreview(null);
    setReason("");
    setEditorOpen(true);
  }

  function addEntitlement() {
    if (!addCode || !registryCodes.has(addCode)) return;
    if (drafts.some((d) => d.code === addCode)) return;
    const meta = entData.registry.find((r) => r.code === addCode)!;
    const draft: DraftRow = {
      code: addCode,
      valueType: meta.valueType,
      booleanValue: meta.valueType === "BOOLEAN" ? meta.defaultValue === "true" : null,
      numberValue: meta.valueType === "NUMBER" ? Number(meta.defaultValue) || 0 : null,
      stringValue: meta.valueType === "STRING" ? meta.defaultValue : null,
      isUnlimited: meta.valueType === "UNLIMITED",
    };
    setDrafts([...drafts, draft]);
    setAddCode("");
  }

  function removeDraft(code: string) {
    setDrafts(drafts.filter((d) => d.code !== code));
    setPreview(null);
  }

  function updateDraft(code: string, patch: Partial<DraftRow>) {
    setDrafts(drafts.map((d) => (d.code === code ? { ...d, ...patch } : d)));
    setPreview(null);
  }

  async function doPreview() {
    await run(async () => {
      const entitlements = drafts.map((d) => ({
        code: d.code,
        valueType: d.valueType,
        booleanValue: d.booleanValue,
        numberValue: d.numberValue,
        stringValue: d.stringValue,
        isUnlimited: d.isUnlimited,
      }));
      const res = await fetch(`/api/admin/plans/${planId}/entitlements/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entitlements, baseVersion: entData.publishedVersion }),
      });
      const json = await res.json();
      if (json.code === "ENTITLEMENT_PREVIEW_STALE") {
        throw new Error("Önizleme güncel değil — sayfayı yenileyin.");
      }
      if (!json.success) throw new Error(json.message);
      setPreview(json.data);
    });
  }

  async function doPublish() {
    if (!reason.trim()) {
      setError("Yayın için sebep zorunlu.");
      return;
    }
    await run(async () => {
      const entitlements = drafts.map((d) => ({
        code: d.code,
        valueType: d.valueType,
        booleanValue: d.booleanValue,
        numberValue: d.numberValue,
        stringValue: d.stringValue,
        isUnlimited: d.isUnlimited,
      }));
      const res = await fetch(`/api/admin/plans/${planId}/entitlements/publish`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entitlements,
          baseVersion: preview?.currentVersion ?? entData.publishedVersion,
          reason,
        }),
      });
      const json = await res.json();
      if (json.code === "ENTITLEMENT_PREVIEW_STALE") {
        throw new Error("Yayın başarısız — sürüm değişti, yeniden önizleyin.");
      }
      if (!json.success) throw new Error(json.message);
      setEditorOpen(false);
      onRefresh();
    });
  }

  const availableToAdd = entData.registry.filter((r) => !drafts.some((d) => d.code === r.code));

  return (
    <div>
      <div className={`${appPanelClass} mb-4 p-4 text-[12px] text-slate-600`}>
        <p>{entData.message}</p>
        <p className="mt-2">
          Yayınlanmış sürüm: v{entData.publishedVersion}
          {entData.publishedAt ? ` · ${formatAdminDate(entData.publishedAt)}` : ""}
        </p>
        {entData.unknownCodes.length > 0 ? (
          <p className="mt-2 text-amber-700">
            Bilinmeyen kodlar (otomatik silinmez): {entData.unknownCodes.join(", ")}
          </p>
        ) : null}
        {entData.issues.length > 0 ? (
          <ul className="mt-2 list-disc pl-4 text-amber-700">
            {entData.issues.map((i) => (
              <li key={`${i.code}-${i.message}`}>{i.message}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mb-3 flex justify-end">
        <button type="button" className={appPrimaryButtonClass} onClick={openEditor} disabled={busy}>
          Entitlement düzenle
        </button>
      </div>

      {error ? <p className="mb-2 text-[12px] text-red-600">{error}</p> : null}

      {entData.entitlements.length === 0 ? (
        <p className="text-[12px] text-slate-500">Henüz plan entitlement kaydı yok.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className={appTableClass}>
            <thead>
              <tr className={appTableHeadClass}>
                <th className="px-2 py-2">Kod</th>
                <th className="px-2 py-2">Registry</th>
                <th className="px-2 py-2">Tip</th>
                <th className="px-2 py-2">Plan değeri</th>
                <th className="px-2 py-2">Yayın değeri</th>
                <th className="px-2 py-2">Add-on</th>
                <th className="px-2 py-2">Override</th>
                <th className="px-2 py-2">Resolved önizleme</th>
                <th className="px-2 py-2">Enforcement</th>
                <th className="px-2 py-2">Güncelleme</th>
              </tr>
            </thead>
            <tbody>
              {entData.entitlements.map((row) => (
                <tr key={row.code} className={appTableRowClass}>
                  <td className="px-2 py-2 font-mono text-[10px]">
                    {row.code}
                    {row.isUnknownCode ? <span className="text-amber-600"> ⚠</span> : null}
                  </td>
                  <td className="px-2 py-2 text-[11px]">{row.registryTitle}</td>
                  <td className="px-2 py-2">{row.valueType}</td>
                  <td className="px-2 py-2">{row.currentValue ?? "—"}</td>
                  <td className="px-2 py-2">{row.publishedValue ?? "—"}</td>
                  <td className="px-2 py-2">{row.addonAffectable ? "Evet" : "Hayır"}</td>
                  <td className="px-2 py-2">{row.adminOverrideSupported ? "Evet" : "Hayır"}</td>
                  <td className="px-2 py-2 text-[10px]">
                    <div>Varsayılan: {row.resolvedPreview.registryDefault}</div>
                    <div>Plan: {row.resolvedPreview.planValue ?? "—"}</div>
                    <div className="font-bold">Final: {row.resolvedPreview.finalPlanLevelPreview}</div>
                  </td>
                  <td className="px-2 py-2 text-[10px]">{row.enforcementStatus}</td>
                  <td className="px-2 py-2 text-[10px]">{formatAdminDate(row.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
          <div className={`${appPanelClass} my-4 w-full max-w-3xl p-4`}>
            <h3 className="mb-3 text-[14px] font-bold">Entitlement düzenleme</h3>

            <div className="mb-3 flex gap-2 text-[12px]">
              <select
                className="rounded border px-2 py-1"
                value={addCode}
                onChange={(e) => setAddCode(e.target.value)}
              >
                <option value="">Registry&apos;den ekle…</option>
                {availableToAdd.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.code} — {r.title}
                  </option>
                ))}
              </select>
              <button type="button" className={appOutlineButtonClass} onClick={addEntitlement} disabled={!addCode}>
                Ekle
              </button>
            </div>

            <div className="max-h-64 space-y-2 overflow-y-auto text-[12px]">
              {drafts.map((d) => {
                const meta = entData.registry.find((r) => r.code === d.code);
                return (
                  <div key={d.code} className="flex flex-wrap items-center gap-2 rounded border p-2">
                    <span className="font-mono font-bold">{d.code}</span>
                    <span className="text-slate-500">{meta?.title}</span>
                    {d.valueType === "BOOLEAN" ? (
                      <select
                        value={d.booleanValue ? "true" : "false"}
                        onChange={(e) => updateDraft(d.code, { booleanValue: e.target.value === "true" })}
                      >
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    ) : null}
                    {d.valueType === "NUMBER" ? (
                      <input
                        type="number"
                        min={0}
                        className="w-24 rounded border px-1"
                        value={d.numberValue ?? 0}
                        onChange={(e) => updateDraft(d.code, { numberValue: Number(e.target.value) })}
                      />
                    ) : null}
                    {d.valueType === "UNLIMITED" ? <span>Sınırsız</span> : null}
                    {d.valueType === "STRING" ? (
                      <input
                        className="flex-1 rounded border px-1"
                        value={d.stringValue ?? ""}
                        onChange={(e) => updateDraft(d.code, { stringValue: e.target.value })}
                      />
                    ) : null}
                    <button type="button" className={appOutlineButtonClass} onClick={() => removeDraft(d.code)}>
                      Kaldır
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex gap-2">
              <button type="button" className={appOutlineButtonClass} onClick={() => void doPreview()} disabled={busy}>
                Önizle
              </button>
            </div>

            {preview ? (
              <div className="mt-3 rounded border bg-slate-50 p-3 text-[11px]">
                <p className="font-bold">Değişiklik özeti</p>
                <p className="text-slate-600">{preview.operationalEnforcementNote}</p>
                {preview.diff.length === 0 ? (
                  <p>Değişiklik yok.</p>
                ) : (
                  <ul className="mt-2 list-disc pl-4">
                    {preview.diff.map((d) => (
                      <li key={d.code}>
                        [{d.changeType}] {d.code} ({d.registryTitle}): {d.oldValue ?? "—"} → {d.newValue ?? "—"}
                      </li>
                    ))}
                  </ul>
                )}
                <label className="mt-3 block">
                  Sebep *
                  <textarea
                    className="mt-1 w-full rounded border px-2 py-1"
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className={`${appPrimaryButtonClass} mt-2`}
                  onClick={() => void doPublish()}
                  disabled={busy || preview.diff.length === 0}
                >
                  Yayınla
                </button>
              </div>
            ) : null}

            <div className="mt-4 flex justify-end">
              <button type="button" className={appOutlineButtonClass} onClick={() => setEditorOpen(false)}>
                Kapat
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
