import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { db } from "@/lib/prisma";
import { updateWarehouseSchema } from "@/lib/warehouse-utils";

type Props = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Props) {
  try {
    const auth = await requireApiModuleAccess("stocks");
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const body = await req.json();
    const parsed = updateWarehouseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Bilgileri kontrol edin.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const warehouse = await db.warehouse.findFirst({
      where: { id, companyId: auth.companyId },
      include: {
        stocks: { where: { quantity: { gt: 0 } } },
      },
    });

    if (!warehouse) {
      return NextResponse.json(
        { success: false, message: "Depo bulunamadı." },
        { status: 404 }
      );
    }

    if (parsed.data.name) {
      const duplicate = await db.warehouse.findFirst({
        where: {
          companyId: auth.companyId,
          name: parsed.data.name.trim(),
          NOT: { id },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { success: false, message: "Bu depo adı zaten kullanılıyor." },
          { status: 400 }
        );
      }
    }

    if (parsed.data.status === "PASSIVE" && warehouse.isDefault) {
      return NextResponse.json(
        { success: false, message: "Varsayılan depo pasife alınamaz." },
        { status: 400 }
      );
    }

    const updated = await db.$transaction(async (tx) => {
      if (parsed.data.isDefault) {
        await tx.warehouse.updateMany({
          where: { companyId: auth.companyId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.warehouse.update({
        where: { id },
        data: {
          ...(parsed.data.name ? { name: parsed.data.name.trim() } : {}),
          ...(parsed.data.code !== undefined
            ? { code: parsed.data.code?.trim() || null }
            : {}),
          ...(parsed.data.address !== undefined
            ? { address: parsed.data.address?.trim() || null }
            : {}),
          ...(parsed.data.note !== undefined
            ? { note: parsed.data.note?.trim() || null }
            : {}),
          ...(parsed.data.isDefault !== undefined
            ? { isDefault: parsed.data.isDefault }
            : {}),
          ...(parsed.data.status ? { status: parsed.data.status } : {}),
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Depo güncellendi.",
      data: updated,
    });
  } catch (error) {
    console.error("STOCKS_WAREHOUSE_PATCH_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Depo güncellenemedi." },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: Props) {
  try {
    const auth = await requireApiModuleAccess("stocks");
    if ("error" in auth) return auth.error;

    const { id } = await params;

    const warehouse = await db.warehouse.findFirst({
      where: { id, companyId: auth.companyId },
      include: {
        stocks: { where: { quantity: { gt: 0 } } },
      },
    });

    if (!warehouse) {
      return NextResponse.json(
        { success: false, message: "Depo bulunamadı." },
        { status: 404 }
      );
    }

    if (warehouse.isDefault) {
      return NextResponse.json(
        { success: false, message: "Varsayılan depo silinemez veya pasife alınamaz." },
        { status: 400 }
      );
    }

    if (warehouse.stocks.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Depoda stok bulunduğu için silinemez. Pasife almayı deneyin.",
        },
        { status: 400 }
      );
    }

    await db.warehouse.update({
      where: { id },
      data: { status: "PASSIVE" },
    });

    return NextResponse.json({
      success: true,
      message: "Depo pasife alındı.",
    });
  } catch (error) {
    console.error("STOCKS_WAREHOUSE_DELETE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Depo işlemi tamamlanamadı." },
      { status: 500 }
    );
  }
}
