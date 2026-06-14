import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiModuleAccess } from "@/lib/module-access";
import { db } from "@/lib/prisma";

const createSchema = z.object({
  productId: z.string().min(1),
  channel: z.enum(["TRENDYOL", "HEPSIBURADA"]),
  merchantSku: z.string().trim().min(1),
  barcode: z.string().trim().optional().nullable(),
  externalProductId: z.string().trim().optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const auth = await requireApiModuleAccess("products");
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const channel = searchParams.get("channel");
    const q = searchParams.get("q")?.trim();

    const rows = await db.productChannelMapping.findMany({
      where: {
        companyId: auth.companyId,
        ...(channel === "TRENDYOL" || channel === "HEPSIBURADA"
          ? { channel }
          : {}),
        ...(q
          ? {
              OR: [
                { merchantSku: { contains: q, mode: "insensitive" } },
                { barcode: { contains: q, mode: "insensitive" } },
                { product: { name: { contains: q, mode: "insensitive" } } },
                { product: { sku: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: {
        product: {
          select: { id: true, name: true, sku: true, barcode: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 300,
    });

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Eşlemeler alınamadı.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiModuleAccess("products");
    if ("error" in auth) return auth.error;

    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Geçersiz eşleme verisi.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const product = await db.product.findFirst({
      where: { id: parsed.data.productId, companyId: auth.companyId },
      select: { id: true },
    });
    if (!product) {
      return NextResponse.json(
        { success: false, message: "Ürün bulunamadı." },
        { status: 404 }
      );
    }

    const mapping = await db.productChannelMapping.create({
      data: {
        companyId: auth.companyId,
        productId: parsed.data.productId,
        channel: parsed.data.channel,
        merchantSku: parsed.data.merchantSku,
        barcode: parsed.data.barcode ?? null,
        externalProductId: parsed.data.externalProductId ?? null,
      },
      include: {
        product: {
          select: { id: true, name: true, sku: true, barcode: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: mapping });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Eşleme oluşturulamadı.",
      },
      { status: 500 }
    );
  }
}
