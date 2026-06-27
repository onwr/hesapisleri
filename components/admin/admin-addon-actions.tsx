"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { appOutlineButtonClass } from "@/lib/admin-ui";

type Action = "activate" | "archive";

export function AdminAddonActions({
  addOnId,
  status,
}: {
  addOnId: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<Action | null>(null);

  async function run(action: Action, body?: Record<string, unknown>) {
    setLoading(action);
    try {
      const res = await fetch(`/api/admin/add-ons/${addOnId}/${action}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const json = await res.json();
        alert(json.message ?? "İşlem başarısız.");
        return;
      }
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  function activate() {
    const reason = prompt("Aktivasyon gerekçesi:");
    if (!reason?.trim()) return;
    void run("activate", { confirm: true, reason: reason.trim() });
  }

  function archive() {
    const reason = prompt("Arşivleme gerekçesi:");
    if (!reason?.trim()) return;
    if (!confirm("Add-on arşivlensin mi? Yeni satış kapanır.")) return;
    void run("archive", { confirm: true, reason: reason.trim() });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "DRAFT" ? (
        <button
          type="button"
          disabled={loading !== null}
          onClick={activate}
          className={appOutlineButtonClass}
        >
          {loading === "activate" ? "…" : "Aktifleştir"}
        </button>
      ) : null}
      {status !== "ARCHIVED" ? (
        <button
          type="button"
          disabled={loading !== null}
          onClick={archive}
          className={appOutlineButtonClass}
        >
          {loading === "archive" ? "…" : "Arşivle"}
        </button>
      ) : null}
    </div>
  );
}
