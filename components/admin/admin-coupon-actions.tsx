"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { appOutlineButtonClass } from "@/lib/admin-ui";

type Action = "pause" | "activate" | "archive";

export function AdminCouponActions({
  couponId,
  status,
  code,
}: {
  couponId: string;
  status: string;
  code: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<Action | "copy" | null>(null);

  async function run(action: Action, body?: Record<string, unknown>) {
    setLoading(action);
    try {
      const res = await fetch(`/api/admin/coupons/${couponId}/${action}`, {
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
    if (!confirm("Kupon arşivlensin mi? Yeni kullanım kapanır.")) return;
    void run("archive", { confirm: true, reason: reason.trim() });
  }

  async function copyCode() {
    setLoading("copy");
    try {
      await navigator.clipboard.writeText(code);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={copyCode} className={appOutlineButtonClass}>
        {loading === "copy" ? "Kopyalandı" : "Kodu Kopyala"}
      </button>
      {status === "DRAFT" || status === "PAUSED" ? (
        <button
          type="button"
          disabled={loading !== null}
          onClick={activate}
          className={appOutlineButtonClass}
        >
          {loading === "activate" ? "…" : "Aktifleştir"}
        </button>
      ) : null}
      {status === "ACTIVE" ? (
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => run("pause")}
          className={appOutlineButtonClass}
        >
          {loading === "pause" ? "…" : "Duraklat"}
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
