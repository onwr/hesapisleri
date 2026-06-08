import { NextResponse } from "next/server";
import {
  CompanyUsersError,
  declineCompanyInvite,
} from "@/lib/company-users-service";
import { z } from "zod";

const declineInviteSchema = z.object({
  token: z.string().min(10, "Davet kodu geçersiz."),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = declineInviteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Davet bilgilerini kontrol edin.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const result = await declineCompanyInvite(parsed.data.token);

    return NextResponse.json({
      success: true,
      message: "Davet reddedildi.",
      data: result,
    });
  } catch (error) {
    if (error instanceof CompanyUsersError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("INVITE_DECLINE_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Davet reddedilirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
