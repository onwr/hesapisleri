import { NextResponse } from "next/server";
import { getPublicPlatformRuntimeConfig } from "@/lib/platform-runtime";

export async function GET() {
  try {
    const data = await getPublicPlatformRuntimeConfig();
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json(
      { success: false, message: "Platform runtime yapılandırması yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json({ success: false, message: "Method not allowed." }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ success: false, message: "Method not allowed." }, { status: 405 });
}

export async function PATCH() {
  return NextResponse.json({ success: false, message: "Method not allowed." }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ success: false, message: "Method not allowed." }, { status: 405 });
}
