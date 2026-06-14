import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { getMarketplaceIntegrations } from "@/lib/marketplace/marketplace-integration-service";

export async function GET() {
  try {
    const auth = await requireApiModuleAccess("settings");
    if ("error" in auth) return auth.error;

    const integrations = await getMarketplaceIntegrations(auth.companyId);
    return NextResponse.json({ success: true, data: integrations });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Entegrasyon listesi alınamadı.",
      },
      { status: 500 }
    );
  }
}
