import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { parseMarketplaceChannel } from "@/app/api/integrations/_utils";
import { assertOwnerOrAdmin } from "@/lib/marketplace/marketplace-integration-service";
import { importMarketplaceProductMappings } from "@/lib/marketplace/marketplace-product-mapping-import-service";

type Props = {
  params: Promise<{ channel: string }>;
};

export async function POST(_req: Request, { params }: Props) {
  try {
    const auth = await requireApiModuleAccess("orders");
    if ("error" in auth) return auth.error;
    assertOwnerOrAdmin({
      role: auth.session.effectiveRole,
      isOwner: auth.session.companyUser.isOwner,
    });

    const { channel: rawChannel } = await params;
    const channel = parseMarketplaceChannel(rawChannel.toUpperCase());
    if (!channel) {
      return NextResponse.json(
        { success: false, message: "Geçersiz kanal." },
        { status: 400 }
      );
    }

    const result = await importMarketplaceProductMappings({
      companyId: auth.companyId,
      channel,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Ürün eşleme importu başlatılamadı.";

    const status =
      message.includes("desteklenmiyor") ||
      message.includes("bağlı olmalıdır") ||
      message.includes("kimlik bilgileri")
        ? 400
        : 500;

    return NextResponse.json({ success: false, message }, { status });
  }
}
