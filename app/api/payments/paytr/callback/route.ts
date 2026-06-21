import { processPaytrCallback } from "@/lib/payments/payment-service";
import { getTrustedClientIp } from "@/lib/payments/trusted-client-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ok() {
  return new Response("OK", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const payload: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") payload[key] = value;
    }

    await processPaytrCallback(payload, getTrustedClientIp(request));
    return ok();
  } catch {
    return new Response("INVALID", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
