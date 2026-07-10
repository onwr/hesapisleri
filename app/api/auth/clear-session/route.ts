import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      message: "Oturum kapatma işlemi GET ile yapılamaz. POST /api/auth/logout kullanın.",
      code: "METHOD_NOT_ALLOWED",
    },
    {
      status: 405,
      headers: { Allow: "POST" },
    }
  );
}
