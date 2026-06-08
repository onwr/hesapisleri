import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthToken, verifyToken } from "@/lib/auth";
import {
  createCustomerGroup,
  getCustomerGroupsWithStats,
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

const createGroupSchema = z.object({
  name: z.string().trim().min(1, "Grup adı zorunludur."),
  color: groupColorSchema.optional(),
  note: z.string().optional(),
});

export async function GET() {
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

    const groups = await getCustomerGroupsWithStats(payload.companyId);

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

    const group = await createCustomerGroup(payload.companyId, parsed.data);

    return NextResponse.json({
      success: true,
      message: "Grup başarıyla oluşturuldu.",
      data: group,
    });
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
