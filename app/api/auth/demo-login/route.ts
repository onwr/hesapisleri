import { NextResponse } from "next/server";
import { verifyApiMutationOrigin } from "@/lib/api-origin-guard";
import { performDemoLogin } from "@/lib/demo-login-service";

export async function POST(req: Request) {
  const originError = verifyApiMutationOrigin(req);
  if (originError) return originError;

  try {
    const result = await performDemoLogin(req);

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    return result.response;
  } catch (error) {
    console.error("DEMO_LOGIN_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Demo giriş tamamlanamadı." },
      { status: 500 }
    );
  }
}
