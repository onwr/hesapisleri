import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { z } from "zod";
import {
  createCustomerGroup,
  getCustomerGroupsWithStats,
} from "@/lib/customer-group-service";
import { buildTenantMutationSuccess } from "@/lib/tenant-cache/tenant-mutation-response";
const groupColorSchema = z.enum([
  "slate",
  "blue",
  "emerald",
  "violet",
  "orange",
  "rose",
  "cyan",
]);

const createGroupSchema = z.object({
  name: z.string().trim().min(1, "Grup adı zorunludur."),
  color: groupColorSchema.optional(),
  note: z.string().optional(),
});

export async function GET() {
  try {
    const auth = await requireApiModuleAccess("customers");
    if ("error" in auth) return auth.error;

    const companyId = auth.companyId;
    const userId = auth.userId;
    const groups = await getCustomerGroupsWithStats(companyId);

    return NextResponse.json({
      success: true,
      data: groups,
    });
  } catch (error) {
    console.error("GET_CUSTOMER_GROUPS_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gruplar alınırken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiModuleAccess("customers");
    if ("error" in auth) return auth.error;

    const companyId = auth.companyId;
    const userId = auth.userId;
    const body = await req.json();
    const parsed = createGroupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Bilgileri kontrol edin.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const group = await createCustomerGroup(companyId, parsed.data);

    return NextResponse.json(
      buildTenantMutationSuccess(companyId, {
        reason: "customer-group-change",
        entity: group as Record<string, unknown>,
        message: "Grup başarıyla oluşturuldu.",
      }),
    );
  } catch (error) {
    console.error("CREATE_CUSTOMER_GROUP_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Grup oluşturulurken bir hata oluştu.",
      },
      { status: 400 }
    );
  }
}
