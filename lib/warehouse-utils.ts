import { z } from "zod";

export const createWarehouseSchema = z.object({
  name: z.string().min(1, "Depo adı zorunludur."),
  code: z.string().optional(),
  address: z.string().optional(),
  note: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export const updateWarehouseSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
  status: z.enum(["ACTIVE", "PASSIVE"]).optional(),
});

export const warehouseTransferSchema = z.object({
  fromWarehouseId: z.string().min(1),
  toWarehouseId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.number().min(1),
  note: z.string().optional(),
  transferDate: z.string().optional(),
});

export function getWarehouseStatusLabel(status: string) {
  return status === "ACTIVE" ? "Aktif" : "Pasif";
}

export function getTransferStatusLabel(status: string) {
  return status === "COMPLETED" ? "Tamamlandı" : "İptal";
}

export function getTransferStatusClass(status: string) {
  return status === "COMPLETED"
    ? "bg-emerald-50 text-emerald-600"
    : "bg-slate-100 text-slate-500";
}
