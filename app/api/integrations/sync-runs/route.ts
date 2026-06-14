import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { parseMarketplaceChannel } from "@/app/api/integrations/_utils";
import { listMarketplaceSyncRuns } from "@/lib/marketplace/marketplace-integration-service";

export async function GET(request: Request) {
  try {
    const auth = await requireApiModuleAccess("settings");
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const channelRaw = searchParams.get("channel");
    const channel = channelRaw
      ? parseMarketplaceChannel(channelRaw.toUpperCase())
      : null;
    const limit = Number(searchParams.get("limit") ?? "20");

    const runs = await listMarketplaceSyncRuns({
      companyId: auth.companyId,
      channel: channel ?? undefined,
      limit,
    });

    return NextResponse.json({ success: true, data: runs });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Senkronizasyon kayıtları alınamadı.",
      },
      { status: 500 }
    );
  }
}
