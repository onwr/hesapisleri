import type { PlanStatus, PlanVisibility } from "@prisma/client";
import type { PlanPricingClass } from "@/lib/admin/plans/admin-plan-classification";
import { getPlanPricingClassLabel } from "@/lib/admin/plans/admin-plan-classification";

export function getPlanStatusLabel(status: PlanStatus): string {
  switch (status) {
    case "DRAFT":
      return "Taslak";
    case "ACTIVE":
      return "Aktif";
    case "ARCHIVED":
      return "Arşiv";
  }
}

export function getPlanStatusClass(status: PlanStatus): string {
  switch (status) {
    case "DRAFT":
      return "bg-amber-100 text-amber-800";
    case "ACTIVE":
      return "bg-emerald-100 text-emerald-700";
    case "ARCHIVED":
      return "bg-slate-100 text-slate-600";
  }
}

export function getPlanVisibilityLabel(v: PlanVisibility): string {
  switch (v) {
    case "PUBLIC":
      return "Herkese açık";
    case "PRIVATE":
      return "Özel";
    case "INTERNAL":
      return "Dahili";
  }
}

export function formatPricingClass(cls: PlanPricingClass): string {
  return getPlanPricingClassLabel(cls);
}
