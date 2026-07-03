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

function redirectResult(request: Request, url: string): NextResponse {
  const status = request.method === "POST" ? 303 : 302;
  return NextResponse.redirect(url, { status });
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
      return redirectResult(
        request,
        resultUrl(resultBase, { status: "error", reason: "invalid_params" }),
      );
    }
    throw error;
  }

  const parsed = returnParamsSchema.safeParse(rawParams);
  if (!parsed.success || !parsed.data.invoice_id) {
    return redirectResult(
      request,
      resultUrl(resultBase, { status: "error", reason: "invalid_params" }),
    );
  }

  const safeParams = parsed.data;
  const invoiceId = safeParams.invoice_id;

  try {
    const provider = createSipayProvider();
    let hashValid = false;
    if (safeParams.hash_key) {
      const returnVerification = provider.verifyReturn({
        invoice_id: invoiceId,
        status: safeParams.status ?? "",
        hash_key: safeParams.hash_key,
      });
      hashValid = returnVerification.valid;
    }

    if (!hashValid) {
      console.warn("[sipay-return] hash missing or invalid; continuing with checkstatus", {
        invoiceId,
        hasHash: Boolean(safeParams.hash_key),
      });
    }

    const result = await finalizeSipayPayment(invoiceId, "return");

    if (result.duplicate) {
      return redirectResult(
        request,
        resultUrl(resultBase, { invoice_id: invoiceId, outcome: "success" }),
      );
    }

    if (result.verificationPending) {
      return redirectResult(
        request,
        resultUrl(resultBase, { invoice_id: invoiceId, outcome: "pending" }),
      );
    }

    if (result.membershipPaymentId) {
      return redirectResult(
        request,
        resultUrl(resultBase, { invoice_id: invoiceId, outcome: "success" }),
      );
    }

    return redirectResult(
      request,
      resultUrl(resultBase, { invoice_id: invoiceId, outcome: "failed" }),
    );
  } catch (error) {
    if (error instanceof MembershipServiceError && error.status === 404) {
      return redirectResult(
        request,
        resultUrl(resultBase, { invoice_id: invoiceId, status: "error", reason: "not_found" }),
      );
    }
    console.error("[sipay-return] finalize error", {
      invoiceId,
      message: error instanceof Error ? error.message : "unknown",
    });
    return redirectResult(
      request,
      resultUrl(resultBase, { invoice_id: invoiceId, status: "error", reason: "internal" }),
    );
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
      return redirectResult(request, resultUrl(resultBase, { outcome: "cancelled" }));
    }
    throw error;
  }

  const parsed = cancelParamsSchema.safeParse(rawParams);
  if (!parsed.success || !parsed.data.invoice_id) {
    return redirectResult(request, resultUrl(resultBase, { outcome: "cancelled" }));
  }

  const { invoice_id } = parsed.data;

  try {
    const provider = createSipayProvider();
    const statusResult = await provider.checkStatus(invoice_id);

    if (statusResult.status === "PAID") {
      const result = await finalizeSipayPayment(invoice_id, "return");
      if (result.membershipPaymentId || result.duplicate) {
        return redirectResult(
          request,
          resultUrl(resultBase, { invoice_id, outcome: "success" }),
        );
      }
    }

    await cancelSipayAttempt(invoice_id);
    return redirectResult(
      request,
      resultUrl(resultBase, { invoice_id, outcome: "cancelled" }),
    );
  } catch {
    try {
      await cancelSipayAttempt(invoice_id);
    } catch {
      /* ignore */
    }
    return redirectResult(
      request,
      resultUrl(resultBase, { invoice_id, outcome: "cancelled" }),
    );
  }
}
