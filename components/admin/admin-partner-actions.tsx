"use client";

import { useState } from "react";
import { appOutlineButtonClass, appPrimaryButtonClass } from "@/lib/admin-ui";

export function AdminPartnerActions({
  partnerId,
  status,
  onDone,
}: {
  partnerId: string;
  status: string;
  onDone: (msg: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function run(action: "activate" | "suspend" | "archive") {
    if (loading) return;
    if (!reason.trim()) {
      setError("Sebep zorunludur.");
      return;
    }
    setLoading(action);
    setError("");
    try {
      const res = await fetch(`/api/admin/partners/${partnerId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim(), confirm: true }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "İşlem başarısız.");
      onDone(json.message ?? "Tamamlandı.");
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "İşlem başarısız.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3 text-[12px]">
      <label className="block">
        Lifecycle sebebi
        <textarea
          className="mt-1 w-full rounded border px-2 py-1.5"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      {error ? <p className="text-red-700">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {status !== "ACTIVE" && status !== "ARCHIVED" ? (
          <button
            type="button"
            className={appPrimaryButtonClass}
            disabled={Boolean(loading)}
            onClick={() => run("activate")}
          >
            {loading === "activate" ? "…" : "Aktifleştir"}
          </button>
        ) : null}
        {status === "ACTIVE" ? (
          <button
            type="button"
            className={appOutlineButtonClass}
            disabled={Boolean(loading)}
            onClick={() => run("suspend")}
          >
            {loading === "suspend" ? "…" : "Askıya Al"}
          </button>
        ) : null}
        {status !== "ARCHIVED" ? (
          <button
            type="button"
            className={appOutlineButtonClass}
            disabled={Boolean(loading)}
            onClick={() => run("archive")}
          >
            {loading === "archive" ? "…" : "Arşivle"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
