import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiModuleAccess } from "@/lib/module-access";
import {
  bulkAdjustProductPrices,
  bulkDeleteProducts,
  bulkSetProductStatus,
} from "@/lib/product-bulk-service";
import { buildTenantMutationSuccess } from "@/lib/tenant-cache/tenant-mutation-response";

const bulkSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("delete"),
    productIds: z.array(z.string()).min(1),
  }),
  z.object({
    action: z.literal("set-status"),
    productIds: z.array(z.string()).min(1),
    status: z.enum(["ACTIVE", "PASSIVE"]),
  }),
  z.object({
    action: z.literal("adjust-price"),
    productIds: z.array(z.string()).min(1),
    priceField: z.enum(["sell", "buy", "both"]),
    direction: z.enum(["increase", "decrease"]),
    mode: z.enum(["percent", "fixed"]),
    value: z.number().positive(),
  }),
]);

export async function POST(req: Request) {
  try {
    const auth = await requireApiModuleAccess("products");
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const parsed = bulkSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Geçersiz toplu işlem isteği.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { companyId, userId } = auth;
    const input = parsed.data;

    if (input.action === "delete") {
      const result = await bulkDeleteProducts(
        companyId,
        userId,
        input.productIds
      );

      return NextResponse.json(
        buildTenantMutationSuccess(companyId, {
          reason: "product-update",
          affectedIds: input.productIds,
          entity: result as Record<string, unknown>,
          message: result.message,
          status: "bulk-deleted",
        }),
      );
    }

    if (input.action === "set-status") {
      const result = await bulkSetProductStatus(
        companyId,
        userId,
        input.productIds,
        input.status
      );

      return NextResponse.json(
        buildTenantMutationSuccess(companyId, {
          reason: "product-update",
          affectedIds: input.productIds,
          entity: result as Record<string, unknown>,
          message: result.message,
          status: "bulk-status-updated",
        }),
      );
    }

    const result = await bulkAdjustProductPrices(
      companyId,
      userId,
      input.productIds,
      {
        priceField: input.priceField,
        direction: input.direction,
        mode: input.mode,
        value: input.value,
      }
    );

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          message: result.message,
          code: result.code,
          affectedProductCount: result.affectedProductCount,
          violations: result.violations,
          missingProductIds: result.missingProductIds,
        },
        { status: result.status }
      );
    }

    return NextResponse.json(
      buildTenantMutationSuccess(companyId, {
        reason: "product-update",
        affectedIds: input.productIds,
        entity: result as Record<string, unknown>,
        message: result.message,
        status: "bulk-price-adjusted",
      }),
    );
  } catch (error) {
    console.error("PRODUCTS_BULK_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Toplu işlem tamamlanamadı." },
      { status: 500 }
    );
  }
}
