import { NextResponse } from "next/server";
import { handleSipayWebhook } from "@/lib/payments/sipay/sipay-webhook-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  return handleSipayWebhook(request);
}
