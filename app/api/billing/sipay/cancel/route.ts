import { NextResponse } from "next/server";
import { handleSipayCancel } from "@/lib/payments/sipay/sipay-callback-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  return handleSipayCancel(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  return handleSipayCancel(request);
}
