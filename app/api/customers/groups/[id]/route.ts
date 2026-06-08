import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthToken, verifyToken } from "@/lib/auth";
import {
  deleteCustomerGroup,
  updateCustomerGroup,
} from "@/lib/customer-group-service";
const groupColorSchema = z.enum([
  "slate",
  "blue",
  "emerald",
  "violet",
  "orange",
  "rose",
  "cyan",
]);

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

type Props = {
  params: Promise<{
    id: string;
  }>;
};

const updateGroupSchema = z.object({
  name: z.string().trim().min(1).optional(),
  color: groupColorSchema.optional(),
  note: z.string().nullable().optional(),
});

export async function PATCH(req: Request, { params }: Props) {
  try {
    const { id } = await params;
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
    const parsed = updateGroupSchema.safeParse(body);

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

    const group = await updateCustomerGroup(payload.companyId, id, parsed.data);

    return NextResponse.json({
      success: true,
      message: "Grup başarıyla güncellendi.",
      data: group,
    });
  } catch (error) {
    console.error("UPDATE_CUSTOMER_GROUP_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Grup güncellenirken bir hata oluştu.",
      },
      { status: 400 }
    );
  }
}

export async function DELETE(_req: Request, { params }: Props) {
  try {
    const { id } = await params;
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

    await deleteCustomerGroup(payload.companyId, id);

    return NextResponse.json({
      success: true,
      message: "Grup silindi.",
    });
  } catch (error) {
    console.error("DELETE_CUSTOMER_GROUP_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Grup silinirken bir hata oluştu.",
      },
      { status: 400 }
    );
  }
}
