import { z } from "zod";

export {
  warehouseTransferSchema,
  warehouseTransferItemSchema,
  normalizeWarehouseTransferItems,
  buildWarehouseTransferPayloadHash,
  getTransferItemsForCancel,
  SERVICE_TRANSFER_ERROR_MESSAGE,
  SAME_WAREHOUSE_TRANSFER_ERROR_MESSAGE,
  IDEMPOTENCY_CONFLICT_MESSAGE,
  TRANSFER_FAILED_MESSAGE,
} from "@/lib/warehouse-transfer-utils";

export const createWarehouseSchema = z.object({
  name: z.string().trim().min(1, "Depo adı zorunludur."),
  code: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  note: z.string().optional(),
  description: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export const updateWarehouseSchema = z.object({
  name: z.string().trim().min(1).optional(),
  code: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  district: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
  status: z.enum(["ACTIVE", "PASSIVE"]).optional(),
});

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;

export function getWarehouseStatusLabel(status: string) {
  return status === "ACTIVE" ? "Aktif" : "Pasif";
}

export function getTransferStatusLabel(status: string) {
  if (status === "COMPLETED") return "Tamamlandı";
  if (status === "PENDING") return "Bekliyor";
  return "İptal";
}

export function getTransferStatusClass(status: string) {
  if (status === "COMPLETED") {
    return "bg-emerald-50 text-emerald-600";
  }
  if (status === "PENDING") {
    return "bg-amber-50 text-amber-600";
  }
  return "bg-slate-100 text-slate-500";
}
