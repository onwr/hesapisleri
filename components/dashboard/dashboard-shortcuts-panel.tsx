"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Banknote,
  Box,
  Brain,
  CalendarDays,
  CreditCard,
  FileText,
  Package,
  ReceiptText,
  RotateCcw,
  ScanBarcode,
  Settings,
  ShoppingCart,
  Store,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  DASHBOARD_SHORTCUT_CATALOG,
  DASHBOARD_SHORTCUT_LIMIT,
  DEFAULT_DASHBOARD_SHORTCUT_IDS,
  loadDashboardShortcutIds,
  resolveDashboardShortcuts,
  saveDashboardShortcutIds,
  type DashboardShortcutDefinition,
  type DashboardShortcutIconKey,
} from "@/lib/dashboard-shortcuts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const ICON_MAP: Record<DashboardShortcutIconKey, LucideIcon> = {
  users: Users,
  package: Package,
  "file-text": FileText,
  box: Box,
  "credit-card": CreditCard,
  "trending-up": TrendingUp,
  "shopping-cart": ShoppingCart,
  "receipt-text": ReceiptText,
  wallet: Wallet,
  "scan-barcode": ScanBarcode,
  banknote: Banknote,
  "bar-chart": BarChart3,
  calendar: CalendarDays,
  truck: Truck,
  settings: Settings,
  brain: Brain,
  store: Store,
};

const shortcutStyles = [
  "bg-violet-50 text-violet-600",
  "bg-orange-50 text-orange-500",
  "bg-blue-50 text-blue-500",
  "bg-purple-50 text-purple-500",
  "bg-amber-50 text-amber-500",
  "bg-emerald-50 text-emerald-600",
];

type DashboardShortcutsPanelProps = {
  userId: string;
  companyId: string;
};

function getShortcutIcon(icon: DashboardShortcutIconKey) {
  return ICON_MAP[icon] ?? Package;
}

export function DashboardShortcutsPanel({
  userId,
  companyId,
}: DashboardShortcutsPanelProps) {
  const [shortcutIds, setShortcutIds] = useState<string[]>([
    ...DEFAULT_DASHBOARD_SHORTCUT_IDS,
  ]);
  const [draftIds, setDraftIds] = useState<string[]>([
    ...DEFAULT_DASHBOARD_SHORTCUT_IDS,
  ]);
  const [editOpen, setEditOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = loadDashboardShortcutIds(userId, companyId);
    if (stored) {
      setShortcutIds(stored);
    }
    setReady(true);
  }, [userId, companyId]);

  const shortcuts = useMemo(
    () => resolveDashboardShortcuts(shortcutIds),
    [shortcutIds]
  );

  function openEditor() {
    setDraftIds([...shortcutIds]);
    setEditOpen(true);
  }

  function updateDraftSlot(index: number, nextId: string) {
    setDraftIds((current) => {
      const copy = [...current];
      const existingIndex = copy.findIndex((id) => id === nextId);
      if (existingIndex >= 0 && existingIndex !== index) {
        copy[existingIndex] = copy[index];
      }
      copy[index] = nextId;
      return copy;
    });
  }

  function moveDraft(index: number, direction: -1 | 1) {
    setDraftIds((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  function saveDraft() {
    const next = resolveDashboardShortcuts(draftIds).map((item) => item.id);
    setShortcutIds(next);
    saveDashboardShortcutIds(userId, companyId, next);
    setEditOpen(false);
  }

  function resetDraft() {
    setDraftIds([...DEFAULT_DASHBOARD_SHORTCUT_IDS]);
  }

  return (
    <>
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-[16px] font-extrabold text-[#0f1f4d]">
            Kısayollarım
          </h3>

          <button
            type="button"
            onClick={openEditor}
            aria-label="Kısayolları düzenle"
            className="text-[13px] font-bold text-blue-700 transition hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
          >
            Düzenle
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {(ready ? shortcuts : resolveDashboardShortcuts([...DEFAULT_DASHBOARD_SHORTCUT_IDS])).map(
            (item: DashboardShortcutDefinition, index: number) => {
              const Icon = getShortcutIcon(item.icon);

              return (
                <Link
                  key={`${item.id}-${index}`}
                  href={item.href}
                  className="group flex flex-col items-center gap-2 text-center"
                >
                  <div
                    className={[
                      "flex h-12 w-12 items-center justify-center rounded-2xl transition group-hover:scale-105",
                      shortcutStyles[index % shortcutStyles.length],
                    ].join(" ")}
                  >
                    <Icon size={21} strokeWidth={2.4} />
                  </div>

                  <span className="line-clamp-2 text-[13px] font-bold leading-tight text-[#24345f]">
                    {item.label}
                  </span>
                </Link>
              );
            }
          )}
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#0f1f4d]">
              Kısayolları Düzenle
            </DialogTitle>
            <DialogDescription>
              En fazla {DASHBOARD_SHORTCUT_LIMIT} kısayol seçebilir ve sıralayabilirsiniz.
              Değişiklikler bu tarayıcıda kaydedilir.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {draftIds.map((selectedId, index) => (
              <div
                key={`slot-${index}`}
                className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/70 p-2"
              >
                <span className="w-5 shrink-0 text-center text-[13px] font-black text-slate-500">
                  {index + 1}
                </span>

                <select
                  value={selectedId}
                  onChange={(event) => updateDraftSlot(index, event.target.value)}
                  className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-[#0f1f4d] outline-none focus:border-blue-200 focus:ring-2 focus:ring-blue-50"
                >
                  {DASHBOARD_SHORTCUT_CATALOG.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>

                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => moveDraft(index, -1)}
                    disabled={index === 0}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 disabled:opacity-40"
                    aria-label="Yukarı taşı"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDraft(index, 1)}
                    disabled={index === draftIds.length - 1}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 disabled:opacity-40"
                    aria-label="Aşağı taşı"
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={resetDraft}
              className="gap-2"
            >
              <RotateCcw size={14} />
              Varsayılana dön
            </Button>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
              >
                Vazgeç
              </Button>
              <Button type="button" onClick={saveDraft}>
                Kaydet
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
