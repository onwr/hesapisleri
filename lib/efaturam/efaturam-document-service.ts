import "server-only";

import type { InvoiceDocumentType, InvoiceStatus, InvoiceType } from "@prisma/client";
import { FeatureDisabledError, LimitReachedError } from "@/lib/billing/entitlements/entitlement-errors";
import {
  finalizeCompanyUsage,
  releaseCompanyUsage,
  reserveCompanyUsage,
} from "@/lib/billing/usage/usage-mutation-service";
import {
  requireCompanyFeature,
  requireCompanyLimit,
} from "@/lib/billing/entitlements/entitlement-enforcement-service";
import { efaturamRequest } from "@/lib/efaturam/efaturam-client";
import { withEfaturamAccessToken } from "@/lib/efaturam/efaturam-auth-service";
import { parseEfaturamErrorBody, sanitizeProviderPayload } from "@/lib/efaturam/efaturam-error-utils";
import { buildEfaturamDocumentPayload } from "@/lib/efaturam/efaturam-payload-builder";
import { db } from "@/lib/prisma";
import type {
  EfaturamDocumentCreateResponse,
  EfaturamDocumentStatusResponse,
} from "@/lib/efaturam/efaturam-types";
import { EfaturamApiError } from "@/lib/efaturam/efaturam-client";

const SUBMITTABLE_INVOICE_TYPES: InvoiceType[] = ["E_INVOICE", "E_ARCHIVE", "NORMAL"];

function mapDocumentTypeToInvoiceType(documentType: InvoiceDocumentType) {
  return documentType === "E_INVOICE" ? "E_INVOICE" : "E_ARCHIVE";
}

function mapInvoiceStatusFromProvider(
  providerStatus?: number,
  gibStatus?: string
): InvoiceStatus {
  const normalized = (gibStatus ?? "").toUpperCase();
  if (normalized.includes("CANCEL")) return "CANCELLED";
  if (normalized.includes("REJECT") || normalized.includes("FAIL")) {
    return "ERROR";
  }
  if (providerStatus != null && providerStatus >= 30) return "APPROVED";
  if (providerStatus != null && providerStatus >= 20) return "SENT";
  return "SENT";
}

async function loadInvoiceForSubmission(companyId: string, invoiceId: string) {
  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, companyId },
    include: {
      items: { orderBy: { lineIndex: "asc" } },
      customer: true,
      company: true,
      documentSubmission: true,
    },
  });

  if (!invoice) {
    throw new Error("Fatura bulunamadı.");
  }

  if (!SUBMITTABLE_INVOICE_TYPES.includes(invoice.type)) {
    throw new Error("Bu fatura türü e-belge için uygun değil.");
  }

  if (invoice.documentSubmission?.status === "SUCCESS") {
    throw new Error("Bu fatura için e-belge zaten oluşturulmuş.");
  }

  if (
    invoice.documentSubmission &&
    ["PENDING", "SUBMITTED"].includes(invoice.documentSubmission.status)
  ) {
    throw new Error("Bu fatura için devam eden bir e-belge işlemi var.");
  }

  return invoice;
}

async function assertEntitlements(companyId: string) {
  await requireCompanyFeature(companyId, "E_DOCUMENT");
  await requireCompanyLimit(companyId, "MONTHLY_E_DOCUMENTS");
}

export async function getInvoiceDocumentSubmission(companyId: string, invoiceId: string) {
  return db.invoiceDocumentSubmission.findFirst({
    where: { companyId, invoiceId },
  });
}

export async function submitInvoiceDocument(input: {
  companyId: string;
  invoiceId: string;
  documentType: InvoiceDocumentType;
  targetAlias?: string | null;
  internetSale?: boolean;
}) {
  await assertEntitlements(input.companyId);
  const invoice = await loadInvoiceForSubmission(input.companyId, input.invoiceId);

  const integration = await db.efaturamIntegration.findUnique({
    where: { companyId: input.companyId },
  });
  if (!integration || integration.status !== "CONNECTED") {
    throw new Error("Aktif e-belge bağlantısı bulunamadı.");
  }
  if (integration.provider !== "TRENDYOL_EFATURAM") {
    throw new Error("Belge gönderimi şu an yalnızca Trendyol E-Faturam ile destekleniyor.");
  }

  const usageKey = `efaturam:${input.invoiceId}`;
  let reserved = false;

  try {
    await reserveCompanyUsage({
      companyId: input.companyId,
      entitlementCode: "MONTHLY_E_DOCUMENTS",
      idempotencyKey: usageKey,
      sourceType: "INVOICE_DOCUMENT",
      sourceId: input.invoiceId,
    });
    reserved = true;
  } catch (error) {
    if (error instanceof FeatureDisabledError || error instanceof LimitReachedError) {
      throw error;
    }
    throw error;
  }

  const payload = buildEfaturamDocumentPayload({
    invoice,
    connectionMode: integration.connectionMode,
    providerCompanyId: integration.providerCompanyId!,
    providerUserId: integration.providerUserId!,
    prefix: integration.prefix,
    xsltCode: integration.xsltCode,
    targetAlias: input.targetAlias,
    documentType: input.documentType,
    internetSale: input.internetSale,
  });

  const endpoint =
    input.documentType === "E_INVOICE"
      ? "/api/invoice/documents/outgoing-einvoice"
      : "/api/invoice/documents/earchive";

  let response: EfaturamDocumentCreateResponse;
  try {
    response = await withEfaturamAccessToken(
      input.companyId,
      async (accessToken, context) =>
        efaturamRequest<EfaturamDocumentCreateResponse>({
          environment: context.environment,
          path: endpoint,
          method: "POST",
          accessToken,
          body: payload,
        })
    );
  } catch (error) {
    await releaseCompanyUsage({
      companyId: input.companyId,
      entitlementCode: "MONTHLY_E_DOCUMENTS",
      idempotencyKey: usageKey,
    });

    const message =
      error instanceof EfaturamApiError
        ? parseEfaturamErrorBody(error.body)
        : error instanceof Error
          ? error.message
          : "E-belge gönderilemedi.";

    await db.invoiceDocumentSubmission.upsert({
      where: { invoiceId: input.invoiceId },
      create: {
        companyId: input.companyId,
        invoiceId: input.invoiceId,
        integrationId: integration.id,
        documentType: input.documentType,
        status: "FAILED",
        localReferenceId: invoice.id,
        targetAlias: input.targetAlias ?? null,
        requestSnapshot: sanitizeProviderPayload(payload) as object,
        errorDetail: message,
        usageReservationKey: usageKey,
      },
      update: {
        status: "FAILED",
        errorDetail: message,
        requestSnapshot: sanitizeProviderPayload(payload) as object,
        usageReservationKey: usageKey,
      },
    });

    throw new Error(message);
  }

  const submission = await db.$transaction(async (tx) => {
    const saved = await tx.invoiceDocumentSubmission.upsert({
      where: { invoiceId: input.invoiceId },
      create: {
        companyId: input.companyId,
        invoiceId: input.invoiceId,
        integrationId: integration.id,
        documentType: input.documentType,
        status: "SUBMITTED",
        localReferenceId: invoice.id,
        providerInvoiceUuid: response.invoiceUuid ?? null,
        providerInvoiceId: response.invoiceId ?? null,
        providerStatus: response.status ?? null,
        gibStatusCode: response.gibStatusCode ?? null,
        gibStatus: response.gibStatus ?? null,
        targetAlias: input.targetAlias ?? null,
        requestSnapshot: sanitizeProviderPayload(payload) as object,
        responseSnapshot: sanitizeProviderPayload(response) as object,
        usageReservationKey: usageKey,
        submittedAt: new Date(),
      },
      update: {
        status: "SUBMITTED",
        providerInvoiceUuid: response.invoiceUuid ?? null,
        providerInvoiceId: response.invoiceId ?? null,
        providerStatus: response.status ?? null,
        gibStatusCode: response.gibStatusCode ?? null,
        gibStatus: response.gibStatus ?? null,
        targetAlias: input.targetAlias ?? null,
        requestSnapshot: sanitizeProviderPayload(payload) as object,
        responseSnapshot: sanitizeProviderPayload(response) as object,
        usageReservationKey: usageKey,
        submittedAt: new Date(),
        errorDetail: null,
      },
    });

    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        type: mapDocumentTypeToInvoiceType(input.documentType),
        status: mapInvoiceStatusFromProvider(response.status, response.gibStatus),
        gibStatus: response.gibStatus ?? String(response.status ?? "GONDERILDI"),
        gibMessage: response.invoiceId
          ? `E-belge no: ${response.invoiceId}`
          : "E-belge gönderildi",
      },
    });

    return saved;
  });

  await finalizeCompanyUsage({
    companyId: input.companyId,
    entitlementCode: "MONTHLY_E_DOCUMENTS",
    idempotencyKey: usageKey,
  });

  return { submission, response };
}

export async function queryInvoiceDocumentStatus(input: {
  companyId: string;
  invoiceId: string;
}) {
  const submission = await db.invoiceDocumentSubmission.findFirst({
    where: { companyId: input.companyId, invoiceId: input.invoiceId },
  });

  if (!submission?.providerInvoiceUuid) {
    throw new Error("Sorgulanacak e-belge kaydı bulunamadı.");
  }

  const endpoint =
    submission.documentType === "E_INVOICE"
      ? `/api/invoice/documents/outgoing-einvoice/status/${submission.providerInvoiceUuid}`
      : `/api/invoice/documents/earchive/status/${submission.providerInvoiceUuid}`;

  const status = await withEfaturamAccessToken(
    input.companyId,
    async (accessToken, context) =>
      efaturamRequest<EfaturamDocumentStatusResponse>({
        environment: context.environment,
        path: endpoint,
        accessToken,
      })
  );

  const updated = await db.$transaction(async (tx) => {
    const saved = await tx.invoiceDocumentSubmission.update({
      where: { id: submission.id },
      data: {
        providerStatus: status.status ?? submission.providerStatus,
        gibStatusCode: status.gibStatusCode ?? submission.gibStatusCode,
        gibStatus: status.gibStatus ?? submission.gibStatus,
        providerInvoiceId: status.invoiceId ?? submission.providerInvoiceId,
        responseSnapshot: sanitizeProviderPayload(status) as object,
        lastQueriedAt: new Date(),
        status:
          status.status != null && status.status >= 30 ? "SUCCESS" : submission.status,
      },
    });

    await tx.invoice.update({
      where: { id: submission.invoiceId },
      data: {
        status: mapInvoiceStatusFromProvider(status.status, status.gibStatus),
        gibStatus: status.gibStatus ?? submission.gibStatus,
      },
    });

    return saved;
  });

  return { submission: updated, status };
}

export async function cancelInvoiceDocument(input: {
  companyId: string;
  invoiceId: string;
}) {
  const submission = await db.invoiceDocumentSubmission.findFirst({
    where: { companyId: input.companyId, invoiceId: input.invoiceId },
  });

  if (!submission?.providerInvoiceUuid) {
    throw new Error("İptal edilecek e-Arşiv kaydı bulunamadı.");
  }

  if (submission.documentType !== "E_ARCHIVE") {
    throw new Error("İptal yalnızca e-Arşiv belgeleri için kullanılabilir.");
  }

  const response = await withEfaturamAccessToken(
    input.companyId,
    async (accessToken, context) =>
      efaturamRequest<Record<string, unknown>>({
        environment: context.environment,
        path: "/api/invoice/documents/earchive/cancel",
        method: "POST",
        accessToken,
        body: { invoiceUuid: submission.providerInvoiceUuid },
      })
  );

  const updated = await db.$transaction(async (tx) => {
    const saved = await tx.invoiceDocumentSubmission.update({
      where: { id: submission.id },
      data: {
        status: "CANCELLED",
        responseSnapshot: sanitizeProviderPayload(response) as object,
        lastQueriedAt: new Date(),
      },
    });

    await tx.invoice.update({
      where: { id: submission.invoiceId },
      data: { status: "CANCELLED", gibStatus: "CANCELLED" },
    });

    return saved;
  });

  return { submission: updated, response };
}

export async function resendInvoiceDocument(input: {
  companyId: string;
  invoiceId: string;
}) {
  const submission = await db.invoiceDocumentSubmission.findFirst({
    where: { companyId: input.companyId, invoiceId: input.invoiceId },
  });

  if (!submission?.providerInvoiceUuid) {
    throw new Error("Yeniden gönderilecek e-Fatura kaydı bulunamadı.");
  }

  if (submission.documentType !== "E_INVOICE") {
    throw new Error("Yeniden gönderim yalnızca e-Fatura için kullanılabilir.");
  }

  const response = await withEfaturamAccessToken(
    input.companyId,
    async (accessToken, context) =>
      efaturamRequest<Record<string, unknown>>({
        environment: context.environment,
        path: "/api/invoice/documents/outgoing-einvoice/resend",
        method: "POST",
        accessToken,
        body: { invoiceUuid: submission.providerInvoiceUuid },
      })
  );

  const updated = await db.invoiceDocumentSubmission.update({
    where: { id: submission.id },
    data: {
      responseSnapshot: sanitizeProviderPayload(response) as object,
      lastQueriedAt: new Date(),
    },
  });

  return { submission: updated, response };
}
