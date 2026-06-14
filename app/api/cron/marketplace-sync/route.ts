import { NextResponse } from "next/server";
import { syncMarketplaceIntegration } from "@/lib/marketplace/marketplace-sync-service";
import { db } from "@/lib/prisma";

function isAuthorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected && process.env.NODE_ENV === "production") {
    throw new Error("CRON_SECRET production ortamında zorunludur.");
  }
  if (!expected) return true;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { success: false, message: "Yetkisiz cron isteği." },
        { status: 401 }
      );
    }

    const integrations = await db.marketplaceIntegration.findMany({
      where: {
        status: "CONNECTED",
        syncEnabled: true,
        credentialsEncrypted: { not: null },
      },
      select: {
        companyId: true,
        channel: true,
      },
    });

    const summary = {
      total: integrations.length,
      success: 0,
      failed: 0,
      items: [] as Array<{
        companyId: string;
        channel: string;
        ok: boolean;
        message?: string;
      }>,
    };

    for (const integration of integrations) {
      try {
        await syncMarketplaceIntegration({
          companyId: integration.companyId,
          channel: integration.channel,
          type: "AUTO",
        });
        summary.success += 1;
        summary.items.push({
          companyId: integration.companyId,
          channel: integration.channel,
          ok: true,
        });
      } catch (error) {
        summary.failed += 1;
        summary.items.push({
          companyId: integration.companyId,
          channel: integration.channel,
          ok: false,
          message: error instanceof Error ? error.message : "Sync başarısız.",
        });
      }
    }

    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Cron senkronizasyonu başarısız.",
      },
      { status: 500 }
    );
  }
}
