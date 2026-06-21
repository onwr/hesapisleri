import { NextResponse } from "next/server";
import {
  PartnerServiceError,
  submitPartnerApplication,
} from "@/lib/partner-service";
import { partnerApplicationSchema } from "@/lib/partner-utils";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = partnerApplicationSchema.safeParse(body);

    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message ?? "Başvuru bilgilerini kontrol edin.";
      return NextResponse.json(
        {
          success: false,
          message: firstError,
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    await submitPartnerApplication(parsed.data);

    return NextResponse.json({
      success: true,
      message:
        "Başvurunuz alındı. İnceleme sonrası sizinle iletişime geçeceğiz.",
    });
  } catch (error) {
    if (error instanceof PartnerServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("PARTNER_APPLICATION_POST_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Başvuru gönderilirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
