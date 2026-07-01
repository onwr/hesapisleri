import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import { MembershipServiceError } from "@/lib/membership-service";
import { createSipayProvider } from "./sipay-provider";
import { finalizeSipayPayment, cancelSipayAttempt } from "./sipay-checkout-service";
import { getSipayEnv } from "./sipay-env";

export class SipayCallbackParseError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "SipayCallbackParseError";
  }
}

function resultUrl(base: string, params: Record<string, string>): string {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

function getResultBase(returnOrCancelUrl: string): string {
  const appUrl =
    returnOrCancelUrl.split("/api/billing/sipay/")[0] ||
    process.env.APP_URL ||
    "https://hesapisleri.com";
  return `${appUrl}/settings/billing/payment/sipay-result`;
}

/** GET query, POST urlencoded/multipart; bilinmeyen content-type → 415 */
export async function parseSipayCallbackParams(
  request: Request,
): Promise<Record<string, string>> {
  const url = new URL(request.url);
  const fromQuery = Object.fromEntries(url.searchParams.entries());

  if (request.method === "GET") {
    return fromQuery;
  }

  const ct = (request.headers.get("content-type") ?? "").toLowerCase();

  if (!ct) {
    return fromQuery;
  }

  if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
    try {
      const formData = await request.formData();
      return {
        ...fromQuery,
        ...Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)])),
      };
    } catch {
      throw new SipayCallbackParseError("Form gövdesi okunamadı.", 400);
    }
  }

  if (ct.includes("application/json")) {
    try {
      const json = (await request.json()) as Record<string, unknown>;
      return {
        ...fromQuery,
        ...Object.fromEntries(Object.entries(json).map(([k, v]) => [k, String(v)])),
      };
    } catch {
      throw new SipayCallbackParseError("JSON gövdesi okunamadı.", 400);
    }
  }

  throw new SipayCallbackParseError(`Desteklenmeyen content-type: ${ct}`, 415);
}

const returnParamsSchema = z.object({
  invoice_id: z.string().min(1),
  status: z.string().optional(),
  hash_key: z.string().optional(),
  order_id: z.string().optional(),
  transaction_id: z.string().optional(),
});

const cancelParamsSchema = z.object({
  invoice_id: z.string().min(1),
  hash_key: z.string().optional(),
  status: z.string().optional(),
});

export async function handleSipayReturn(request: Request): Promise<NextResponse> {
  const env = getSipayEnv();
  const resultBase = getResultBase(env.SIPAY_RETURN_URL);

  let rawParams: Record<string, string>;
  try {
    rawParams = await parseSipayCallbackParams(request);
  } catch (error) {
    if (error instanceof SipayCallbackParseError) {
      if (error.statusCode === 415) {
        return NextResponse.json({ success: false, message: error.message }, { status: 415 });
      }
      return NextResponse.redirect(
        resultUrl(resultBase, { status: "error", reason: "invalid_params" }),
      );
    }
    throw error;
  }

  const parsed = returnParamsSchema.safeParse(rawParams);
  if (!parsed.success || !parsed.data.invoice_id) {
    return NextResponse.redirect(
      resultUrl(resultBase, { status: "error", reason: "invalid_params" }),
    );
  }

  const safeParams = parsed.data;

  try {
    const provider = createSipayProvider();
    const callbackParams: Record<string, string> = {
      invoice_id: safeParams.invoice_id,
      status: safeParams.status ?? "",
    };
    if (safeParams.hash_key) {
      callbackParams.hash_key = safeParams.hash_key;
    }

    const returnVerification = provider.verifyReturn(callbackParams);
    if (!returnVerification.valid) {
      return NextResponse.redirect(
        resultUrl(resultBase, { status: "error", reason: "invalid_hash" }),
      );
    }

    const { invoiceId } = returnVerification;
    const result = await finalizeSipayPayment(invoiceId, "return");

    if (result.duplicate) {
      return NextResponse.redirect(
        resultUrl(resultBase, { invoice_id: invoiceId }),
      );
    }

    if (result.membershipPaymentId) {
      return NextResponse.redirect(resultUrl(resultBase, { invoice_id: invoiceId }));
    }

    return NextResponse.redirect(
      resultUrl(resultBase, { invoice_id: invoiceId, outcome: "failed" }),
    );
  } catch (error) {
    if (error instanceof MembershipServiceError && error.status === 404) {
      return NextResponse.redirect(resultUrl(resultBase, { status: "error", reason: "not_found" }));
    }
    return NextResponse.redirect(resultUrl(resultBase, { status: "error", reason: "internal" }));
  }
}

export async function handleSipayCancel(request: Request): Promise<NextResponse> {
  const env = getSipayEnv();
  const resultBase = getResultBase(env.SIPAY_CANCEL_URL);

  let rawParams: Record<string, string>;
  try {
    rawParams = await parseSipayCallbackParams(request);
  } catch (error) {
    if (error instanceof SipayCallbackParseError) {
      if (error.statusCode === 415) {
        return NextResponse.json({ success: false, message: error.message }, { status: 415 });
      }
      return NextResponse.redirect(resultUrl(resultBase, { outcome: "cancelled" }));
    }
    throw error;
  }

  const parsed = cancelParamsSchema.safeParse(rawParams);
  if (!parsed.success || !parsed.data.invoice_id) {
    return NextResponse.redirect(resultUrl(resultBase, { outcome: "cancelled" }));
  }

  const { invoice_id } = parsed.data;

  try {
    const provider = createSipayProvider();
    const statusResult = await provider.checkStatus(invoice_id);

    if (statusResult.status === "PAID") {
      const result = await finalizeSipayPayment(invoice_id, "return");
      if (result.membershipPaymentId || result.duplicate) {
        return NextResponse.redirect(resultUrl(resultBase, { invoice_id }));
      }
    }

    await cancelSipayAttempt(invoice_id);
    return NextResponse.redirect(
      resultUrl(resultBase, { invoice_id, outcome: "cancelled" }),
    );
  } catch {
    try {
      await cancelSipayAttempt(invoice_id);
    } catch {
      /* ignore */
    }
    return NextResponse.redirect(
      resultUrl(resultBase, { invoice_id, outcome: "cancelled" }),
    );
  }
}
