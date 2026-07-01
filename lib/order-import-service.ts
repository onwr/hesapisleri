import type { OrderSourceChannel } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { generateSaleNo } from "@/lib/sale-number-utils";
import {
  applySaleStockDecrement,
  SaleStockValidationError,
  validateSaleItemsStock,
} from "@/lib/sale-stock-utils";
import { resolveWarehouseId } from "@/lib/warehouse-service";

const CHANNEL_MAP: Record<string, OrderSourceChannel> = {
  manual: "MANUAL",
  pos: "POS",
  website: "WEBSITE",
  trendyol: "TRENDYOL",
  hepsiburada: "HEPSIBURADA",
  n11: "N11",
  amazon: "AMAZON",
  ciceksepeti: "CICEKSEPETI",
  etsy: "ETSY",
  other: "OTHER",
};

export const orderImportRowSchema = z.object({
  externalOrderId: z.string().trim().optional(),
  customerName: z.string().trim().min(1),
  customerPhone: z.string().trim().optional(),
  channel: z.string().trim().default("MANUAL"),
  productSku: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1),
  unitPrice: z.coerce.number().min(0),
  shippingCarrier: z.string().trim().optional(),
  trackingNumber: z.string().trim().optional(),
});

export type OrderImportRow = z.infer<typeof orderImportRowSchema>;

export function parseOrderImportCsv(content: string) {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return {
      ok: false as const,
      message: "CSV dosyasında en az bir veri satırı olmalıdır.",
    };
  }

  const headers = lines[0]!
    .split(",")
    .map((header) => header.trim().toLowerCase());

  const required = [
    "customername",
    "productsku",
    "quantity",
    "unitprice",
  ];

  for (const field of required) {
    if (!headers.includes(field)) {
      return {
        ok: false as const,
        message: `CSV başlığı eksik: ${field}`,
      };
    }
  }

  const rows: OrderImportRow[] = [];
  const errors: string[] = [];

  for (let index = 1; index < lines.length; index += 1) {
    const values = parseCsvLine(lines[index]!);
    const record: Record<string, string> = {};

    headers.forEach((header, headerIndex) => {
      record[header] = values[headerIndex]?.trim() ?? "";
    });

    const parsed = orderImportRowSchema.safeParse({
      externalOrderId: record.externalorderid,
      customerName: record.customername,
      customerPhone: record.customerphone,
      channel: record.channel || "MANUAL",
      productSku: record.productsku,
      quantity: record.quantity,
      unitPrice: record.unitprice,
      shippingCarrier: record.shippingcarrier,
      trackingNumber: record.trackingnumber,
    });

    if (!parsed.success) {
      errors.push(`Satır ${index + 1}: Geçersiz veri.`);
      continue;
    }

    rows.push(parsed.data);
  }

  if (rows.length === 0) {
    return {
      ok: false as const,
      message: "Geçerli satır bulunamadı.",
      errors,
    };
  }

  return {
    ok: true as const,
    rows,
    errors,
  };
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]!;

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

const VALID_CHANNELS = new Set<OrderSourceChannel>([
  "MANUAL",
  "POS",
  "WEBSITE",
  "TRENDYOL",
  "HEPSIBURADA",
  "N11",
  "AMAZON",
  "CICEKSEPETI",
  "ETSY",
  "OTHER",
]);

function normalizeChannel(value: string): OrderSourceChannel {
  const normalized = value.trim().toLowerCase();
  if (CHANNEL_MAP[normalized]) return CHANNEL_MAP[normalized]!;
  const upper = value.trim().toUpperCase() as OrderSourceChannel;
  if (VALID_CHANNELS.has(upper)) return upper;
  return "MANUAL";
}

export async function importOrdersFromRows(input: {
  companyId: string;
  userId: string;
  rows: OrderImportRow[];
}) {
  const companySettings = await db.companySettings.findUnique({
    where: { companyId: input.companyId },
    select: { allowNegativeStockSales: true },
  });
  const allowNegativeStock = companySettings?.allowNegativeStockSales ?? false;

  const previewErrors: string[] = [];
  const grouped = new Map<string, OrderImportRow[]>();

  for (const row of input.rows) {
    const key = row.externalOrderId?.trim() || `${row.customerName}-${row.productSku}-${row.quantity}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(row);
    grouped.set(key, bucket);
  }

  let createdCount = 0;

  for (const [groupKey, groupRows] of grouped.entries()) {
    const first = groupRows[0]!;
    const sourceChannel = normalizeChannel(first.channel);

    try {
      await db.$transaction(async (tx) => {
        let customer = await tx.customer.findFirst({
          where: {
            companyId: input.companyId,
            name: { equals: first.customerName, mode: "insensitive" },
          },
        });

        if (!customer) {
          customer = await tx.customer.create({
            data: {
              companyId: input.companyId,
              name: first.customerName,
              phone: first.customerPhone || null,
            },
          });
        }

        const warehouseId = await resolveWarehouseId(input.companyId, undefined, tx);
        const saleItems: Array<{
          productId: string;
          name: string;
          quantity: number;
          unitPrice: number;
          vatRate: number;
        }> = [];

        for (const row of groupRows) {
          const product = await tx.product.findFirst({
            where: {
              companyId: input.companyId,
              sku: { equals: row.productSku, mode: "insensitive" },
            },
          });

          if (!product) {
            throw new Error(`SKU bulunamadı: ${row.productSku}`);
          }

          saleItems.push({
            productId: product.id,
            name: product.name,
            quantity: row.quantity,
            unitPrice: row.unitPrice,
            vatRate: product.vatRate,
          });
        }

        await validateSaleItemsStock(
          tx,
          input.companyId,
          saleItems,
          warehouseId,
          allowNegativeStock
        );

        const subtotal = saleItems.reduce(
          (sum, item) => sum + item.quantity * item.unitPrice,
          0
        );
        const vatTotal = saleItems.reduce((sum, item) => {
          const line = item.quantity * item.unitPrice;
          return sum + (line * item.vatRate) / 100;
        }, 0);
        const total = subtotal + vatTotal;

        const hasShipping = Boolean(
          first.shippingCarrier?.trim() && first.trackingNumber?.trim()
        );

        const sale = await tx.sale.create({
          data: {
            companyId: input.companyId,
            customerId: customer.id,
            userId: input.userId,
            warehouseId,
            saleNo: generateSaleNo(),
            subtotal,
            vatTotal,
            discount: 0,
            total,
            status: "COMPLETED",
            paymentStatus: "UNPAID",
            paidAmount: 0,
            sourceChannel,
            externalOrderId: first.externalOrderId || groupKey,
            orderStatus: hasShipping ? "SHIPPING" : "APPROVED",
            shippingCarrier: first.shippingCarrier?.trim() || null,
            trackingNumber: first.trackingNumber?.trim() || null,
            shippedAt: hasShipping ? new Date() : null,
            items: {
              create: saleItems.map((item) => ({
                productId: item.productId,
                warehouseId,
                name: item.name,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                vatRate: item.vatRate,
                total: item.quantity * item.unitPrice,
              })),
            },
          },
        });

        await applySaleStockDecrement(
          tx,
          input.companyId,
          sale.saleNo,
          saleItems,
          warehouseId,
          allowNegativeStock
        );

        await tx.activityLog.create({
          data: {
            companyId: input.companyId,
            userId: input.userId,
            action: "CREATE",
            module: "orders",
            message: `${sale.saleNo} CSV içe aktarım ile sipariş oluşturuldu.`,
          },
        });

        createdCount += 1;
      });
    } catch (error) {
      previewErrors.push(
        `${groupKey}: ${
          error instanceof SaleStockValidationError || error instanceof Error
            ? error.message
            : "İçe aktarım başarısız."
        }`
      );
    }
  }

  return {
    createdCount,
    errors: previewErrors,
  };
}

export const ORDER_IMPORT_TEMPLATE = [
  "externalOrderId,customerName,customerPhone,channel,productSku,quantity,unitPrice,shippingCarrier,trackingNumber",
  "TY-10001,Ahmet Yılmaz,05551234567,TRENDYOL,DEMO-SKU-001,2,150.00,Aras Kargo,112233445566",
].join("\n");
