import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiModuleAccess } from "@/lib/module-access";
import {
  assertOwnerOrAdmin,
  disconnectEDocumentIntegration,
  getEDocumentIntegrationSummary,
  upsertEDocumentIntegration,
} from "@/lib/e-document/e-document-integration-service";

import { redactEDocumentValidationErrors } from "@/lib/e-document/e-document-payload-guard";

const upsertSchema = z.discriminatedUnion("provider", [
  z
    .object({
      provider: z.literal("TRENDYOL_EFATURAM"),
      connectionMode: z.enum(["DIRECT_ACCOUNT", "MARKETPLACE_PARTNER"]),
      environment: z.enum(["STAGE", "LIVE"]).default("STAGE"),
      email: z.string().trim().optional(),
      password: z.string().optional(),
      prefix: z
        .string()
        .trim()
        .regex(/^[A-Z0-9]{3}$/)
        .optional()
        .nullable(),
      xsltCode: z.string().trim().optional().nullable(),
    })
    .strict(),
  z
    .object({
      provider: z.literal("EFINANS"),
      username: z.string().trim().optional(),
      password: z.string().optional(),
      companyCode: z.string().trim().min(1),
      environment: z.enum(["STAGE", "LIVE"]).default("STAGE"),
    })
    .strict(),
  z
    .object({
      provider: z.literal("SOVOS"),
      environment: z.enum(["STAGE", "LIVE"]).default("STAGE"),
      externalCompanyCode: z.string().trim().optional().nullable(),
      taxId: z.string().trim().min(10).max(11),
      invoiceUsername: z.string().trim().optional(),
      invoicePassword: z.string().optional(),
      useSameArchiveCredentials: z.boolean().default(true),
      archiveUsername: z.string().trim().optional(),
      archivePassword: z.string().optional(),
      senderIdentifier: z.string().trim().optional().nullable(),
      receiverIdentifier: z.string().trim().optional().nullable(),
      branchCode: z.string().trim().optional().nullable(),
      invoiceSeries: z.string().trim().optional().nullable(),
      archiveSeries: z.string().trim().optional().nullable(),
    })
    .strict(),
  z
    .object({
      provider: z.literal("OTHER"),
    })
    .strict(),
]);

export async function GET() {
  try {
    const auth = await requireApiModuleAccess("settings");
    if ("error" in auth) return auth.error;

    const summary = await getEDocumentIntegrationSummary(auth.companyId);
    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "E-belge entegrasyonu yüklenemedi.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireApiModuleAccess("settings");
    if ("error" in auth) return auth.error;

    assertOwnerOrAdmin({
      role: auth.session.effectiveRole,
      isOwner: auth.session.companyUser.isOwner,
    });

    const parsed = upsertSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Geçersiz istek.",
          errors: redactEDocumentValidationErrors(parsed.error.flatten()),
        },
        { status: 400 }
      );
    }

    const summary = await upsertEDocumentIntegration({
      companyId: auth.companyId,
      ...parsed.data,
    } as never);

    const message =
      parsed.data.provider === "EFINANS"
        ? "eFinans ayarları kaydedildi. API entegrasyonu henüz hazır değil."
        : parsed.data.provider === "SOVOS"
          ? "Sovos servis sözleşmesi hazırlanıyor; ayarlar kaydedildi."
          : parsed.data.provider === "TRENDYOL_EFATURAM"
            ? "Trendyol E-Faturam bağlantısı kaydedildi."
            : "Sağlayıcı seçimi kaydedildi.";

    return NextResponse.json({ success: true, data: summary, message });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "E-belge bağlantısı kaydedilemedi.",
      },
      { status: 400 }
    );
  }
}

export async function DELETE() {
  try {
    const auth = await requireApiModuleAccess("settings");
    if ("error" in auth) return auth.error;

    assertOwnerOrAdmin({
      role: auth.session.effectiveRole,
      isOwner: auth.session.companyUser.isOwner,
    });

    const summary = await disconnectEDocumentIntegration(auth.companyId);
    return NextResponse.json({
      success: true,
      data: summary,
      message: "E-belge bağlantısı kaldırıldı.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "E-belge bağlantısı kaldırılamadı.",
      },
      { status: 400 }
    );
  }
}
