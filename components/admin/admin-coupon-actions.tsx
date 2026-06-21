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

  async function run(action: Action) {
    setLoading(action);
    try {
      const res = await fetch(`/api/admin/membership-coupons/${couponId}/${action}`, {
        method: "POST",
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
      {status === "ACTIVE" ? (
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => run("pause")}
          className={appOutlineButtonClass}
        >
          Duraklat
        </button>
      ) : null}
      {status === "PAUSED" ? (
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => run("activate")}
          className={appOutlineButtonClass}
        >
          Aktifleştir
        </button>
      ) : null}
      {status !== "ARCHIVED" ? (
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => {
            if (confirm("Kupon arşivlensin mi?")) run("archive");
          }}
          className={appOutlineButtonClass}
        >
          Arşivle
        </button>
      ) : null}
    </div>
  );
}
