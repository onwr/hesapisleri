import { NextResponse } from "next/server";
import { requireAnyApiModuleAccess } from "@/lib/module-access";
import { getPendingCollections } from "@/lib/collections-service";
import {
  parseCollectionDocumentType,
  parseCollectionDueStatus,
  parseCollectionPaymentStatus,
  parseDateParam,
  normalizeDateRange,
} from "@/lib/collections-page-utils";

export async function GET(req: Request) {
  const auth = await requireAnyApiModuleAccess([
    "cash-bank",
    "sales",
    "invoices",
  ]);

  if ("error" in auth) {
    return auth.error;
  }

  const { companyId } = auth;
  const { searchParams } = new URL(req.url);

  const { from, to } = normalizeDateRange(
    parseDateParam(searchParams.get("from")),
    parseDateParam(searchParams.get("to"))
  );

  const { items, summary } = await getPendingCollections(companyId, {
    search: searchParams.get("search") ?? searchParams.get("q") ?? undefined,
    customerId: searchParams.get("customerId") ?? undefined,
    documentType: parseCollectionDocumentType(
      searchParams.get("documentType")
    ),
    paymentStatus: parseCollectionPaymentStatus(
      searchParams.get("paymentStatus")
    ),
    dueStatus: parseCollectionDueStatus(searchParams.get("dueStatus")),
    from,
    to,
  });

  return NextResponse.json({
    success: true,
    summary,
    items,
  });
}
