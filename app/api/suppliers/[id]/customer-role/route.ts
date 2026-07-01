import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiModuleAccess, requireApiSupplierManage } from "@/lib/module-access";
import {
  createCustomerRoleForSupplier,
  findSupplierCustomerMatches,
  linkSupplierToCustomer,
  SupplierCustomerRoleError,
} from "@/lib/supplier-customer-role-service";

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("link"),
    customerId: z.string().min(1),
  }),
  z.object({
    action: z.literal("create"),
  }),
]);

type Props = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Props) {
  try {
    const auth = await requireApiModuleAccess("suppliers");
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const matches = await findSupplierCustomerMatches(auth.companyId, id);

    return NextResponse.json({ success: true, data: { matches } });
  } catch (error) {
    if (error instanceof SupplierCustomerRoleError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    console.error("SUPPLIER_CUSTOMER_ROLE_GET_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Eşleşmeler yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, { params }: Props) {
  try {
    const auth = await requireApiSupplierManage();
    if ("error" in auth) return auth.error;

    const customersAuth = await requireApiModuleAccess("customers");
    if ("error" in customersAuth) return customersAuth.error;

    const { id } = await params;
    const parsed = postSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz müşteri rolü isteği." },
        { status: 400 }
      );
    }

    if (parsed.data.action === "link") {
      const supplier = await linkSupplierToCustomer({
        companyId: auth.companyId,
        supplierId: id,
        customerId: parsed.data.customerId,
        userId: auth.userId,
      });

      return NextResponse.json({
        success: true,
        message: "Müşteri rolü bağlandı.",
        data: { supplier },
      });
    }

    const customer = await createCustomerRoleForSupplier({
      companyId: auth.companyId,
      supplierId: id,
      userId: auth.userId,
    });

    return NextResponse.json({
      success: true,
      message: "Yeni müşteri rolü oluşturuldu.",
      data: { customer },
    });
  } catch (error) {
    if (error instanceof SupplierCustomerRoleError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    console.error("SUPPLIER_CUSTOMER_ROLE_POST_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Müşteri rolü eklenemedi." },
      { status: 500 }
    );
  }
}
