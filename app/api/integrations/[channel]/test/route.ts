import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiModuleAccess } from "@/lib/module-access";
import {
  assertOwnerOrAdmin,
  testMarketplaceIntegration,
  type MarketplaceCredentialsOverride,
} from "@/lib/marketplace/marketplace-integration-service";
import { parseMarketplaceChannel } from "@/app/api/integrations/_utils";

type Props = {
  params: Promise<{ channel: string }>;
};

const bodySchema = z
  .object({
    supplierId: z.string().trim().optional(),
    apiKey: z.string().trim().optional(),
    apiSecret: z.string().trim().optional(),
    merchantId: z.string().trim().optional(),
    username: z.string().trim().optional(),
    password: z.string().trim().optional(),
  })
  .optional();

export async function POST(req: Request, { params }: Props) {
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

    const bodyParsed = bodySchema.safeParse(await req.json().catch(() => undefined));
    if (!bodyParsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz test verisi." },
        { status: 400 }
      );
    }
    const body = bodyParsed.data;

    let credentialsOverride: MarketplaceCredentialsOverride | undefined;
    if (
      channel === "TRENDYOL" &&
      body?.supplierId &&
      body.apiKey &&
      body.apiSecret
    ) {
      credentialsOverride = {
        channel: "TRENDYOL",
        supplierId: body.supplierId,
        apiKey: body.apiKey,
        apiSecret: body.apiSecret,
      };
    } else if (channel === "HEPSIBURADA" && body?.merchantId && body.password) {
      credentialsOverride = {
        channel: "HEPSIBURADA",
        merchantId: body.merchantId,
        password: body.password,
        username: body.username,
      };
    }

    const result = await testMarketplaceIntegration({
      companyId: auth.companyId,
      channel,
      credentialsOverride,
    });

    return NextResponse.json(
      {
        success: result.ok,
        message: result.message,
        error: result.ok ? undefined : result.message,
        details: {
          usedStoredCredentials: !credentialsOverride,
        },
      },
      { status: result.ok ? 200 : 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Bağlantı testi başarısız.",
      },
      { status: 500 }
    );
  }
}
