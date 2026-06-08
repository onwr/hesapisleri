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

type Props = {
  params: Promise<{
    id: string;
  }>;
};

async function getAuthContext() {
  const token = await getAuthToken();

  if (!token) {
    return {
      error: NextResponse.json(
        { success: false, message: "Oturum bulunamadı." },
        { status: 401 }
      ),
    };
  }

  const payload = verifyToken<AuthPayload>(token);

  if (!payload?.userId || !payload.companyId) {
    return {
      error: NextResponse.json(
        { success: false, message: "Oturum geçersiz." },
        { status: 401 }
      ),
    };
  }

  return { payload };
}

export async function GET(_req: Request, { params }: Props) {
  try {
    const auth = await getAuthContext();
    if (auth.error) return auth.error;

    const { id } = await params;

    const customer = await db.customer.findFirst({
      where: {
        id,
        companyId: auth.payload!.companyId!,
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
    if (auth.error) return auth.error;

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
        companyId: auth.payload!.companyId!,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Müşteri bulunamadı." },
        { status: 404 }
      );
    }

    const normalized = normalizeCustomerInput(parsed.data);

    const customer = await db.customer.update({
      where: { id: existing.id },
      data: normalized,
    });

    await db.activityLog.create({
      data: {
        companyId: auth.payload!.companyId!,
        userId: auth.payload!.userId,
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
