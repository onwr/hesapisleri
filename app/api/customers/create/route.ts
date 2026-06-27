import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { getPlatformRuntimeUploadLimits } from "@/lib/platform-runtime";
import { db } from "@/lib/prisma";
import {
  customerFormSchema,
  normalizeCustomerInput,
} from "@/lib/customer-form-utils";

export async function POST(req: Request) {
  try {
    const auth = await requireApiModuleAccess("customers");
    if ("error" in auth) return auth.error;

    const companyId = auth.companyId;
    const userId = auth.userId;
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

    const uploadLimits = await getPlatformRuntimeUploadLimits();

    let normalized;
    try {
      normalized = normalizeCustomerInput(parsed.data, {
        maxTaxCertificateBytes: uploadLimits.maxTaxCertificateBytes,
      });
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

    const customer = await db.customer.create({
      data: {
        companyId: companyId,
        ...normalized,
        balance: 0,
        status: "ACTIVE",
      },
    });

    await db.activityLog.create({
      data: {
        companyId: companyId,
        userId: userId,
        action: "CREATE",
        module: "customers",
        message: `${customer.name} müşterisi oluşturuldu.`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Müşteri başarıyla oluşturuldu.",
      data: customer,
    });
  } catch (error) {
    console.error("CREATE_CUSTOMER_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Müşteri oluşturulurken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
