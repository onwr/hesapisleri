import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiModuleAccess } from "@/lib/module-access";
import {
  assertOwnerOrAdmin,
  disconnectMarketplaceIntegration,
  upsertMarketplaceIntegration,
} from "@/lib/marketplace/marketplace-integration-service";
import { parseMarketplaceChannel } from "@/app/api/integrations/_utils";
import { isIntegrationValidationError } from "@/lib/marketplace/trendyol-integration-utils";

const schema = z.object({
  supplierId: z.string().trim().optional(),
  apiKey: z.string().trim().optional(),
  apiSecret: z.string().trim().optional(),
  merchantId: z.string().trim().optional(),
  username: z.string().trim().optional(),
  password: z.string().trim().optional(),
  syncEnabled: z.boolean().optional(),
  autoSyncIntervalMinutes: z.number().int().min(5).max(240).optional(),
  defaultWarehouseId: z.string().trim().nullable().optional(),
});

type Props = {
  params: Promise<{ channel: string }>;
};

export async function PATCH(req: Request, { params }: Props) {
  try {
    const auth = await requireApiModuleAccess("settings");
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

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Geçersiz entegrasyon verisi.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const result = await upsertMarketplaceIntegration({
      companyId: auth.companyId,
      channel,
      data: parsed.data,
    });

    return NextResponse.json(
      {
        success: result.testResult.ok,
        data: result.integration,
        test: result.testResult,
        message: result.testResult.message,
        error: result.testResult.ok ? undefined : result.testResult.message,
        details: {
          status: result.integration.status,
        },
      },
      { status: result.testResult.ok ? 200 : 400 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Entegrasyon güncellenemedi.";

    return NextResponse.json(
      {
        success: false,
        message,
        error: message,
      },
      { status: isIntegrationValidationError(message) ? 400 : 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: Props) {
  try {
    const auth = await requireApiModuleAccess("settings");
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

    const data = await disconnectMarketplaceIntegration({
      companyId: auth.companyId,
      channel,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Bağlantı kesilemedi.",
      },
      { status: 500 }
    );
  }
}
