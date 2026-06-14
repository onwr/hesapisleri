import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiModuleAccess } from "@/lib/module-access";
import { db } from "@/lib/prisma";

const updateSchema = z.object({
  merchantSku: z.string().trim().min(1).optional(),
  barcode: z.string().trim().nullable().optional(),
  externalProductId: z.string().trim().nullable().optional(),
});

type Props = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: Request, { params }: Props) {
  try {
    const auth = await requireApiModuleAccess("products");
    if ("error" in auth) return auth.error;
    const { id } = await params;

    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz güncelleme verisi." },
        { status: 400 }
      );
    }

    const existing = await db.productChannelMapping.findFirst({
      where: { id, companyId: auth.companyId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Eşleme bulunamadı." },
        { status: 404 }
      );
    }

    const updated = await db.productChannelMapping.update({
      where: { id },
      data: {
        ...(parsed.data.merchantSku ? { merchantSku: parsed.data.merchantSku } : {}),
        ...(parsed.data.barcode !== undefined ? { barcode: parsed.data.barcode } : {}),
        ...(parsed.data.externalProductId !== undefined
          ? { externalProductId: parsed.data.externalProductId }
          : {}),
      },
      include: {
        product: {
          select: { id: true, name: true, sku: true, barcode: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Eşleme güncellenemedi.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: Props) {
  try {
    const auth = await requireApiModuleAccess("products");
    if ("error" in auth) return auth.error;
    const { id } = await params;

    const existing = await db.productChannelMapping.findFirst({
      where: { id, companyId: auth.companyId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Eşleme bulunamadı." },
        { status: 404 }
      );
    }

    await db.productChannelMapping.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Eşleme silinemedi.",
      },
      { status: 500 }
    );
  }
}
