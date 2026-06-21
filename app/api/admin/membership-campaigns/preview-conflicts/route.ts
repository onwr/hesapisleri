import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { detectCampaignConflicts } from "@/lib/admin/promotions/campaign-conflict-service";

const schema = z.object({
  campaignId: z.string().optional(),
  discountType: z.string(),
  priority: z.number().int().optional(),
  autoApply: z.boolean().optional(),
  stackable: z.boolean().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional().nullable(),
  scopes: z
    .array(
      z.object({
        planId: z.string().optional().nullable(),
        billingInterval: z
          .enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"])
          .optional()
          .nullable(),
        companyId: z.string().optional().nullable(),
        partnerId: z.string().optional().nullable(),
        firstPaymentOnly: z.boolean().optional(),
        renewalAllowed: z.boolean().optional(),
      })
    )
    .optional(),
});

export async function POST(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz çakışma analizi isteği." },
        { status: 400 }
      );
    }

    const body = parsed.data;
    const conflicts = await detectCampaignConflicts({
      campaignId: body.campaignId,
      discountType: body.discountType,
      priority: body.priority ?? 100,
      autoApply: body.autoApply ?? false,
      stackable: body.stackable ?? false,
      startsAt: new Date(body.startsAt),
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
      scopes: body.scopes ?? [],
    });

    return NextResponse.json({
      success: true,
      data: {
        conflicts,
        hasBlocking: conflicts.some((c) => c.severity === "BLOCKING"),
      },
    });
  } catch (error) {
    console.error("ADMIN_CAMPAIGN_CONFLICT_PREVIEW_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Çakışma analizi yapılamadı." },
      { status: 500 }
    );
  }
}
