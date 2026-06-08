import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAuthToken, verifyToken } from "@/lib/auth";
import {
  customerFormSchema,
  normalizeCustomerInput,
} from "@/lib/customer-form-utils";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

export async function POST(req: Request) {
  try {
    const token = await getAuthToken();

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Oturum bulunamadı." },
        { status: 401 }
      );
    }

    const payload = verifyToken<AuthPayload>(token);

    if (!payload?.userId || !payload.companyId) {
      return NextResponse.json(
        { success: false, message: "Oturum geçersiz." },
        { status: 401 }
      );
    }

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

    const normalized = normalizeCustomerInput(parsed.data);

    const customer = await db.customer.create({
      data: {
        companyId: payload.companyId,
        ...normalized,
        balance: 0,
        status: "ACTIVE",
      },
    });

    await db.activityLog.create({
      data: {
        companyId: payload.companyId,
        userId: payload.userId,
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
