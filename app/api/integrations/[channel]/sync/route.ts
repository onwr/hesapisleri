import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { parseMarketplaceChannel } from "@/app/api/integrations/_utils";
import {
  assertOwnerOrAdmin,
} from "@/lib/marketplace/marketplace-integration-service";
import { syncMarketplaceIntegration } from "@/lib/marketplace/marketplace-sync-service";

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

    const run = await syncMarketplaceIntegration({
      companyId: auth.companyId,
      channel,
      type: "MANUAL",
      triggeredByUserId: auth.userId,
    });

    return NextResponse.json({ success: true, data: run });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Senkronizasyon başlatılamadı.",
      },
      { status: 500 }
    );
  }
}
