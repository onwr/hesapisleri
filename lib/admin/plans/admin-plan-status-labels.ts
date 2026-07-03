import type { PlanStatus } from "@prisma/client";

export function getPlanListStatusLabel(status: PlanStatus | string, isActive: boolean): string {
  if (status === "ARCHIVED") return "Arşivlendi";
  if (status === "DRAFT") return "Taslak";
  if (status === "ACTIVE") return isActive ? "Aktif" : "Pasif";
  return String(status);
}

export function isPlanPassive(status: PlanStatus | string, isActive: boolean): boolean {
  return status === "ACTIVE" && !isActive;
}

export function isPlanSalesActive(status: PlanStatus | string, isActive: boolean): boolean {
  return status === "ACTIVE" && isActive;
}
