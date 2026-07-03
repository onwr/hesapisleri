"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { appOutlineButtonClass } from "@/lib/admin-ui";
import { AdminPlanMigrationModal } from "@/components/admin/plans/admin-plan-migration-modal";

type PlanRow = {
  id: string;
  name: string;
  planStatus: string;
  isActive: boolean;
  activeSubscriptionCount?: number;
  canHardDelete?: boolean;
};

type Action = "activate" | "deactivate" | "archive" | "delete";

export function AdminPlanRowActions({
  plan,
  onMigrated,
}: {
  plan: PlanRow;
  onMigrated?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<Action | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [migrationOpen, setMigrationOpen] = useState(false);

  async function runLifecycle(
    action: "activate" | "deactivate" | "archive",
    body: Record<string, unknown>
  ) {
    setLoading(action);
    setError(null);
    try {
      const res = await fetch(`/api/admin/plans/${plan.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "İşlem başarısız.");
      setArchiveOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "İşlem başarısız.");
    } finally {
      setLoading(null);
    }
  }

  async function runDelete() {
    setLoading("delete");
    setError(null);
    try {
      const res = await fetch(`/api/admin/plans/${plan.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, confirmName: confirmName.trim() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Silme başarısız.");
      setDeleteOpen(false);
      router.push("/admin/plans");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Silme başarısız.");
    } finally {
      setLoading(null);
    }
  }

  const isArchived = plan.planStatus === "ARCHIVED";
  const isDraft = plan.planStatus === "DRAFT";
  const isSalesActive = plan.planStatus === "ACTIVE" && plan.isActive;
  const isPassive = plan.planStatus === "ACTIVE" && !plan.isActive;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={`${appOutlineButtonClass} !h-8 !w-8 !p-0`}
          aria-label={`${plan.name} işlemleri`}
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <MoreHorizontal size={16} />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[190px]">
          <DropdownMenuItem asChild>
            <Link href={`/admin/plans/${plan.id}`}>Düzenle</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/admin/plans/${plan.id}?tab=pricing&action=change-price`}>
              Fiyatı Değiştir
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/admin/plans/${plan.id}?tab=pricing`}>Fiyat Geçmişi</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/admin/plans/${plan.id}?tab=pricing&action=preview`}>Önizle</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {isDraft || isPassive ? (
            <DropdownMenuItem
              disabled={loading !== null}
              onClick={() =>
                runLifecycle("activate", { confirm: true, reason: "Liste üzerinden aktifleştirildi." })
              }
            >
              Aktif Yap
            </DropdownMenuItem>
          ) : null}
          {isSalesActive ? (
            <DropdownMenuItem
              disabled={loading !== null}
              onClick={() =>
                runLifecycle("deactivate", {
                  confirm: true,
                  reason: "Liste üzerinden pasifleştirildi.",
                })
              }
            >
              Pasif Yap
            </DropdownMenuItem>
          ) : null}
          {!isArchived ? (
            <DropdownMenuItem disabled={loading !== null} onClick={() => setArchiveOpen(true)}>
              Arşivle
            </DropdownMenuItem>
          ) : null}
          {isArchived && (plan.activeSubscriptionCount ?? 0) > 0 ? (
            <DropdownMenuItem
              disabled={loading !== null}
              onClick={() => setMigrationOpen(true)}
            >
              Aboneleri Taşı
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          {isArchived ? (
            <div className="px-2 py-1.5 text-[11px] text-slate-400">
              Geçmiş kaydı korundu
            </div>
          ) : (
            <DropdownMenuItem
              disabled={loading !== null}
              className="text-red-700 focus:text-red-700"
              onClick={() => {
                setConfirmName("");
                setDeleteOpen(true);
              }}
            >
              Sil
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {migrationOpen ? (
        <AdminPlanMigrationModal
          planId={plan.id}
          planName={plan.name}
          onClose={() => {
            setMigrationOpen(false);
            onMigrated?.();
            router.refresh();
          }}
        />
      ) : null}

      {archiveOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
            <h4 className="text-[13px] font-bold text-slate-900">Planı arşivle</h4>
            <p className="mt-1 text-[11px] text-slate-500">
              Plan yeni satışlara kapatılır; mevcut abonelikler ve geçmiş kayıtlar korunur.
            </p>
            <textarea
              className="mt-3 w-full rounded border px-2 py-1.5 text-[12px]"
              rows={2}
              placeholder="Arşivleme sebebi"
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
            />
            {error ? <p className="mt-2 text-[11px] text-red-700">{error}</p> : null}
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className={appOutlineButtonClass} onClick={() => setArchiveOpen(false)}>
                İptal
              </button>
              <button
                type="button"
                className={appOutlineButtonClass}
                disabled={!archiveReason.trim() || loading === "archive"}
                onClick={() =>
                  runLifecycle("archive", {
                    confirm: true,
                    reason: archiveReason.trim(),
                    confirmActiveSubscriptions: true,
                  })
                }
              >
                {loading === "archive" ? "Arşivleniyor…" : "Arşivle"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
            <h4 className="text-[13px] font-bold text-slate-900">Planı sil</h4>
            <p className="mt-1 text-[11px] text-slate-500">
              Yalnızca hiç kullanılmamış planlar tamamen silinebilir. Onay için plan adını yazın:{" "}
              <strong>{plan.name}</strong>
            </p>
            <input
              className="mt-3 w-full rounded border px-2 py-1.5 text-[12px]"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={plan.name}
            />
            {error ? <p className="mt-2 text-[11px] text-red-700">{error}</p> : null}
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className={appOutlineButtonClass} onClick={() => setDeleteOpen(false)}>
                İptal
              </button>
              <button
                type="button"
                className={`${appOutlineButtonClass} border-red-200 text-red-700`}
                disabled={confirmName.trim() !== plan.name || loading === "delete"}
                onClick={runDelete}
              >
                {loading === "delete" ? "Siliniyor…" : "Kalıcı Sil"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
