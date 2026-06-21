import { createHash } from "node:crypto";
import { z } from "zod";

export const warehouseTransferItemSchema = z.object({
  productId: z.string().trim().min(1, "Ürün seçilmelidir."),
  quantity: z
    .number()
    .finite("Geçerli bir miktar girin.")
    .int("Miktar tam sayı olmalıdır.")
    .positive("Transfer miktarı 0'dan büyük olmalıdır."),
});

export const warehouseTransferSchema = z
  .object({
    fromWarehouseId: z.string().trim().min(1).optional(),
    toWarehouseId: z.string().trim().min(1).optional(),
    sourceWarehouseId: z.string().trim().min(1).optional(),
    destinationWarehouseId: z.string().trim().min(1).optional(),
    productId: z.string().trim().min(1).optional(),
    quantity: z.number().finite().optional(),
    items: z.array(warehouseTransferItemSchema).optional(),
    note: z.string().optional(),
    transferDate: z.string().optional(),
    idempotencyKey: z.string().trim().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    const fromWarehouseId = data.sourceWarehouseId ?? data.fromWarehouseId;
    const toWarehouseId = data.destinationWarehouseId ?? data.toWarehouseId;

    if (!fromWarehouseId) {
      ctx.addIssue({
        code: "custom",
        message: "Kaynak depo seçilmelidir.",
        path: ["fromWarehouseId"],
      });
    }

    if (!toWarehouseId) {
      ctx.addIssue({
        code: "custom",
        message: "Hedef depo seçilmelidir.",
        path: ["toWarehouseId"],
      });
    }

    const hasItems = Boolean(data.items && data.items.length > 0);
    const hasSingle =
      Boolean(data.productId?.trim()) &&
      typeof data.quantity === "number" &&
      Number.isFinite(data.quantity) &&
      data.quantity > 0;

    if (!hasItems && !hasSingle) {
      ctx.addIssue({
        code: "custom",
        message: "En az bir transfer kalemi gereklidir.",
        path: ["items"],
      });
    }
  });

export type WarehouseTransferRequest = z.infer<typeof warehouseTransferSchema>;

export type NormalizedTransferItem = {
  productId: string;
  quantity: number;
};

export type NormalizedWarehouseTransferInput = {
  companyId: string;
  userId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  items: NormalizedTransferItem[];
  note?: string | null;
  transferDate?: string | null;
  idempotencyKey?: string | null;
};

export function normalizeWarehouseTransferItems(
  data: WarehouseTransferRequest
):
  | { ok: true; items: NormalizedTransferItem[] }
  | { ok: false; message: string } {
  const rawItems =
    data.items && data.items.length > 0
      ? data.items
      : data.productId && typeof data.quantity === "number"
        ? [{ productId: data.productId, quantity: data.quantity }]
        : [];

  if (!rawItems.length) {
    return { ok: false, message: "En az bir transfer kalemi gereklidir." };
  }

  const seen = new Set<string>();

  for (const item of rawItems) {
    if (seen.has(item.productId)) {
      return {
        ok: false,
        message:
          "Aynı ürün birden fazla kalemde yer alamaz. Miktarları birleştirip tek kalem gönderin.",
      };
    }
    seen.add(item.productId);
  }

  return {
    ok: true,
    items: rawItems.map((item) => ({
      productId: item.productId.trim(),
      quantity: Math.trunc(item.quantity),
    })),
  };
}

export function generateTransferNo() {
  const year = new Date().getFullYear();
  const suffix = String(Date.now()).slice(-6);
  return `TRF-${year}-${suffix}`;
}

export function buildWarehouseTransferPayloadHash(input: {
  fromWarehouseId: string;
  toWarehouseId: string;
  items: NormalizedTransferItem[];
  note?: string | null;
}) {
  const payload = {
    fromWarehouseId: input.fromWarehouseId,
    toWarehouseId: input.toWarehouseId,
    items: [...input.items]
      .map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      }))
      .sort((a, b) => a.productId.localeCompare(b.productId)),
    note: input.note?.trim() || null,
  };

  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function getTransferItemsForCancel(transfer: {
  productId: string;
  quantity: number;
  items?: Array<{ productId: string; quantity: number }>;
}) {
  if (transfer.items && transfer.items.length > 0) {
    return transfer.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    }));
  }

  return [{ productId: transfer.productId, quantity: transfer.quantity }];
}

export function sumTransferItemQuantities(items: NormalizedTransferItem[]) {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export const SERVICE_TRANSFER_ERROR_MESSAGE =
  "Hizmet türündeki ürünler depolar arasında transfer edilemez.";

export const SAME_WAREHOUSE_TRANSFER_ERROR_MESSAGE =
  "Kaynak depo ile hedef depo aynı olamaz.";

export const IDEMPOTENCY_CONFLICT_MESSAGE =
  "Bu işlem anahtarı farklı bir transfer için daha önce kullanılmış.";

export const TRANSFER_FAILED_MESSAGE =
  "Transfer tamamlanamadı. Stoklarda herhangi bir değişiklik yapılmadı.";

export const TRANSFER_BUSY_MESSAGE =
  "Sunucu yoğunluğu nedeniyle transfer tamamlanamadı. Stoklarda herhangi bir değişiklik yapılmadı.";
