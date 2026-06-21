"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { appOutlineButtonClass } from "@/lib/admin-ui";

type Action = "publish" | "pause" | "activate" | "archive";

export function AdminCampaignActions({
  campaignId,
  status,
}: {
  campaignId: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<Action | null>(null);

  async function run(action: Action) {
    setLoading(action);
    try {
      const res = await fetch(`/api/admin/membership-campaigns/${campaignId}/${action}`, {
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

  return (
    <div className="flex flex-wrap gap-2">
      {status === "DRAFT" || status === "SCHEDULED" ? (
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => run("publish")}
          className={appOutlineButtonClass}
        >
          {loading === "publish" ? "…" : "Yayınla"}
        </button>
      ) : null}
      {status === "ACTIVE" || status === "SCHEDULED" ? (
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => run("pause")}
          className={appOutlineButtonClass}
        >
          {loading === "pause" ? "…" : "Duraklat"}
        </button>
      ) : null}
      {status === "PAUSED" ? (
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => run("activate")}
          className={appOutlineButtonClass}
        >
          {loading === "activate" ? "…" : "Yeniden Aktifleştir"}
        </button>
      ) : null}
      {status !== "ARCHIVED" ? (
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => {
            if (confirm("Kampanya arşivlensin mi?")) run("archive");
          }}
          className={appOutlineButtonClass}
        >
          {loading === "archive" ? "…" : "Arşivle"}
        </button>
      ) : null}
    </div>
  );
}
