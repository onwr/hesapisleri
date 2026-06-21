import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { db } from "@/lib/prisma";
import {
  customerFormSchema,
  normalizeCustomerInput,
} from "@/lib/customer-form-utils";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

async function getAuthContext() {
  const auth = await requireApiModuleAccess("customers");
  if ("error" in auth) {
    return { error: auth.error } as const;
  }

  return {
    companyId: auth.companyId,
    userId: auth.userId,
  } as const;
}

export async function GET(_req: Request, { params }: Props) {
  try {
    const auth = await getAuthContext();
    if ("error" in auth) return auth.error;

    const { id } = await params;

    const customer = await db.customer.findFirst({
      where: {
        id,
        companyId: auth.companyId,
      },
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, message: "Müşteri bulunamadı." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    console.error("CUSTOMER_DETAIL_API_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Müşteri bilgisi alınırken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, { params }: Props) {
  try {
    const auth = await getAuthContext();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const body = await req.json();
    const parsed = customerFormSchema.safeParse(body);

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

    const existing = await db.customer.findFirst({
      where: {
        id,
        companyId: auth.companyId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Müşteri bulunamadı." },
        { status: 404 }
      );
    }

    let normalized;
    try {
      normalized = normalizeCustomerInput(parsed.data);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Vergi levhası bilgileri geçersiz.",
        },
        { status: 400 }
      );
    }

    const updateResult = await db.customer.updateMany({
      where: { id: existing.id, companyId: auth.companyId },
      data: normalized,
    });

    if (updateResult.count === 0) {
      return NextResponse.json(
        { success: false, message: "Müşteri bulunamadı." },
        { status: 404 }
      );
    }

    const customer = await db.customer.findFirstOrThrow({
      where: { id: existing.id, companyId: auth.companyId },
    });

    await db.activityLog.create({
      data: {
        companyId: auth.companyId,
        userId: auth.userId,
        action: "UPDATE",
        module: "customers",
        message: `${customer.name} müşterisi güncellendi.`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Müşteri başarıyla güncellendi.",
      data: customer,
    });
  } catch (error) {
    console.error("UPDATE_CUSTOMER_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Müşteri güncellenirken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
