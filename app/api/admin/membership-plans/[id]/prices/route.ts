import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  MembershipPlanPriceError,
  createPlanPriceVersion,
  getPlanPriceMatrix,
  listPlanPrices,
  serializePlanPriceForAdmin,
} from "@/lib/membership-plan-price-service";

type RouteContext = { params: Promise<{ id: string }> };

const createPriceSchema = z.object({
  billingInterval: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"]),
  listPrice: z.union([z.string(), z.number()]),
  salePrice: z.union([z.string(), z.number()]).optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  vatRate: z.number().min(0).max(100).optional(),
  vatIncluded: z.boolean().optional(),
  effectiveFrom: z.string().datetime().optional(),
  effectiveUntil: z.string().datetime().nullable().optional(),
  isAutoRenewEnabled: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  priceChangePolicy: z
    .enum([
      "NEW_SUBSCRIBERS_ONLY",
      "NEXT_RENEWAL",
      "AFTER_DATE",
      "GRANDFATHERED",
    ])
    .optional(),
  adminNote: z.string().max(2000).nullable().optional(),
  publish: z.boolean().optional(),
});

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const [prices, matrix] = await Promise.all([
      listPlanPrices(id),
      getPlanPriceMatrix(id),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        prices: prices.map(serializePlanPriceForAdmin),
        matrix: Object.fromEntries(
          Object.entries(matrix).map(([interval, buckets]) => [
            interval,
            {
              active: buckets.active
                ? serializePlanPriceForAdmin(buckets.active)
                : null,
              draft: buckets.draft
                ? serializePlanPriceForAdmin(buckets.draft)
                : null,
              scheduled: buckets.scheduled
                ? serializePlanPriceForAdmin(buckets.scheduled)
                : null,
            },
          ])
        ),
      },
    });
  } catch (error) {
    console.error("ADMIN_PLAN_PRICES_GET_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Plan fiyatları yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const parsed = createPriceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Fiyat bilgilerini kontrol edin.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { id } = await context.params;
    const price = await createPlanPriceVersion({
      planId: id,
      billingInterval: parsed.data.billingInterval,
      userId: auth.user.id,
      publish: parsed.data.publish,
      data: {
        listPrice: parsed.data.listPrice,
        salePrice: parsed.data.salePrice,
        discountPercent: parsed.data.discountPercent,
        vatRate: parsed.data.vatRate,
        vatIncluded: parsed.data.vatIncluded,
        effectiveFrom: parsed.data.effectiveFrom,
        effectiveUntil: parsed.data.effectiveUntil,
        isAutoRenewEnabled: parsed.data.isAutoRenewEnabled,
        isPublic: parsed.data.isPublic,
        priceChangePolicy: parsed.data.priceChangePolicy,
        adminNote: parsed.data.adminNote,
      },
    });

    return NextResponse.json({
      success: true,
      message: parsed.data.publish
        ? "Fiyat versiyonu yayınlandı."
        : "Fiyat taslağı oluşturuldu.",
      data: { price: serializePlanPriceForAdmin(price) },
    });
  } catch (error) {
    if (error instanceof MembershipPlanPriceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    console.error("ADMIN_PLAN_PRICES_POST_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Fiyat kaydedilemedi." },
      { status: 500 }
    );
  }
}
