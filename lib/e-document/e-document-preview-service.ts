import "server-only";

import type { EDocumentProvider } from "@prisma/client";
import { buildNonBlockingEntitlementStatus } from "@/lib/billing/entitlements/entitlement-operational-policy";
import {
  buildInternetSaleIssues,
  buildInternetSaleSnapshotFromInput,
  resolveInvoiceTypeCode,
  resolveProfileId,
} from "@/lib/e-document/e-document-preview-helpers";
import type {
  EDocumentFieldIssue,
  EDocumentPreviewInput,
  EDocumentPreviewResult,
} from "@/lib/e-document/e-document-preview-types";
import { resolveInvoiceEDocumentSnapshots } from "@/lib/e-document/invoice-e-document-snapshot-service";
import {
  mapBuyerPartyFromSnapshot,
  mapSellerPartyFromSnapshot,
} from "@/lib/e-document/ubl-tr/party-mapper";
import { mapInvoiceLinesFromSnapshots } from "@/lib/e-document/ubl-tr/line-mapper";
import {
  validateFinancialSnapshotTotals,
} from "@/lib/e-document/ubl-tr/totals-validator";
import { buildUblTrInvoiceXml } from "@/lib/e-document/ubl-tr/ubl-invoice-builder";
import { validateUblInvoiceXml } from "@/lib/e-document/ubl-tr/ubl-xsd-validator";
import {
  SOVOS_TAXPAYER_LOOKUP_METHOD,
  SOVOS_TAXPAYER_SYNC_OPERATION,
} from "@/lib/e-document/taxpayer/gib-user-list-parser";
import { lookupSovosTaxpayer } from "@/lib/e-document/taxpayer/sovos-taxpayer-lookup-service";
import { db } from "@/lib/prisma";

function toFieldIssues(
  issues: Array<{ field?: string; path?: string; message: string; lineIndex?: number }>
): EDocumentFieldIssue[] {
  return issues.map((issue) => ({
    field: issue.field ?? issue.path ?? "unknown",
    message: issue.message,
    lineIndex: issue.lineIndex,
  }));
}

export async function previewInvoiceEDocument(input: {
  companyId: string;
  invoiceId: string;
  preview?: EDocumentPreviewInput;
}): Promise<EDocumentPreviewResult> {
  const invoice = await db.invoice.findFirst({
    where: {
      id: input.invoiceId,
      companyId: input.companyId,
    },
    include: {
      company: true,
      customer: true,
      items: {
        orderBy: { lineIndex: "asc" },
      },
    },
  });

  if (!invoice) {
    throw new Error("Fatura bulunamadı.");
  }

  const integration = await db.efaturamIntegration.findUnique({
    where: { companyId: input.companyId },
  });

  const provider = integration?.provider ?? null;
  const previewInput = input.preview ?? {};

  const entitlement = buildNonBlockingEntitlementStatus();

  const internetSaleSnapshot = buildInternetSaleSnapshotFromInput(previewInput);
  const snapshotResult = await resolveInvoiceEDocumentSnapshots({
    companyId: input.companyId,
    invoiceId: input.invoiceId,
    mode: "preview",
    internetSale: internetSaleSnapshot,
  });

  const seller = mapSellerPartyFromSnapshot(snapshotResult.snapshots.sellerSnapshot);
  const buyer = mapBuyerPartyFromSnapshot(snapshotResult.snapshots.buyerSnapshot);
  const { lines, issues: lineIssues } = mapInvoiceLinesFromSnapshots(
    snapshotResult.snapshots.lineSnapshots
  );

  const totals = snapshotResult.snapshots.financialSnapshot
    ? validateFinancialSnapshotTotals({
        financial: snapshotResult.snapshots.financialSnapshot,
        lineSnapshots: snapshotResult.snapshots.lineSnapshots,
      })
    : { ok: false, issues: [{ field: "financialSnapshot", message: "Finansal snapshot eksik." }] };

  const internetSaleIssues = buildInternetSaleIssues({
    internetSale: previewInput.internetSale,
    snapshot:
      snapshotResult.snapshots.internetSaleSnapshot ?? internetSaleSnapshot,
  });

  const snapshotIssues = toFieldIssues(snapshotResult.issues);

  const customerTaxId = snapshotResult.snapshots.buyerSnapshot?.taxId ??
    invoice.customer?.taxNo?.replace(/\D/g, "") ??
    "";

  let taxpayerLookup: EDocumentPreviewResult["taxpayerLookup"] = {
    syncOperation: SOVOS_TAXPAYER_SYNC_OPERATION,
    lookupMethod: SOVOS_TAXPAYER_LOOKUP_METHOD,
    registered: null,
    title: null,
    status: null,
    providerError: null,
    cacheHit: false,
    staleCache: false,
  };

  let taxpayer = {
    registered: false,
    recommendedDocumentType: "E_ARCHIVE" as "E_INVOICE" | "E_ARCHIVE",
    activePkAliases: [] as Array<{ alias: string; type: string; title?: string; active: boolean }>,
    title: undefined as string | undefined,
    status: "NOT_FOUND" as "ACTIVE" | "INACTIVE" | "NOT_FOUND",
  };

  if (provider === ("SOVOS" as EDocumentProvider) && customerTaxId) {
    const lookup = await lookupSovosTaxpayer({
      companyId: input.companyId,
      taxId: customerTaxId,
    });
    taxpayer = {
      registered: lookup.registered,
      recommendedDocumentType: lookup.recommendedDocumentType,
      activePkAliases: lookup.activePkAliases,
      title: lookup.title,
      status: lookup.status,
    };
    taxpayerLookup = {
      syncOperation: lookup.syncOperation,
      lookupMethod: lookup.lookupOperation,
      registered: lookup.registered,
      title: lookup.title ?? null,
      status: lookup.status,
      providerError: lookup.providerError ?? null,
      cacheHit: lookup.cacheHit,
      staleCache: lookup.staleCache,
    };
  } else if (provider === ("SOVOS" as EDocumentProvider)) {
    taxpayerLookup.providerError = "Alıcı VKN/TCKN tanımlı değil.";
  }

  const recommendedDocumentType =
    previewInput.documentType ??
    taxpayer.recommendedDocumentType ??
    "E_ARCHIVE";

  const profileId = resolveProfileId(
    recommendedDocumentType,
    Boolean(previewInput.commercialProfile)
  );
  const invoiceTypeCode = resolveInvoiceTypeCode({
    requested: previewInput.invoiceTypeCode,
    invoiceType: invoice.type,
  });

  const availableAliases = taxpayer.activePkAliases.map((item) => ({
    alias: item.alias,
    type: item.type,
    title: item.title,
    active: item.active,
  }));

  let selectedAlias = previewInput.targetAlias?.trim() || null;
  if (!selectedAlias && availableAliases.length === 1) {
    selectedAlias = availableAliases[0]!.alias;
  }

  if (recommendedDocumentType === "E_INVOICE" && !selectedAlias) {
    if (availableAliases.length > 1) {
      buyer.issues.push({
        field: "buyer.alias",
        message: "Birden fazla aktif PK alias bulundu; gönderim için seçim gerekir.",
      });
    } else if (availableAliases.length === 0) {
      buyer.issues.push({
        field: "buyer.alias",
        message: taxpayerLookup.providerError
          ? `Aktif e-Fatura posta kutusu bulunamadı: ${taxpayerLookup.providerError}`
          : "Aktif e-Fatura posta kutusu bulunamadı.",
      });
    }
  }

  let xmlPreviewAvailable = false;
  let previewUuid: string | null = null;
  let custInvId: string | null = null;
  let xsdValidation = {
    ok: false,
    valid: false,
    schemaLoaded: false,
    issues: [] as EDocumentFieldIssue[],
  };

  const mappingReady =
    !snapshotResult.locked &&
    hasCompleteSnapshotData(snapshotResult.snapshots) &&
    seller.party &&
    buyer.party &&
    lineIssues.length === 0 &&
    seller.issues.length === 0 &&
    buyer.issues.length === 0 &&
    snapshotIssues.length === 0;

  function hasCompleteSnapshotData(
    snapshots: typeof snapshotResult.snapshots
  ) {
    return Boolean(
      snapshots.sellerSnapshot &&
        snapshots.buyerSnapshot &&
        snapshots.lineSnapshots.length > 0 &&
        snapshots.financialSnapshot
    );
  }

  if (mappingReady && seller.party && buyer.party) {
    const built = buildUblTrInvoiceXml({
      invoice,
      seller: seller.party,
      buyer: buyer.party,
      lines,
      profileId,
      invoiceTypeCode,
      targetAlias: selectedAlias,
      senderIdentifier: integration?.senderIdentifier,
    });
    previewUuid = built.uuid;
    custInvId = built.custInvId;
    xmlPreviewAvailable = true;

    const xsd = validateUblInvoiceXml(built.xml, {
      profile: "transport",
      expectedLineCount: lines.length,
    });
    xsdValidation = {
      ok: xsd.ok,
      valid: xsd.valid,
      schemaLoaded: xsd.schemaLoaded,
      issues: toFieldIssues(xsd.issues),
    };
  } else if (!xsdValidation.schemaLoaded) {
    const probe = validateUblInvoiceXml("<Invoice/>", { profile: "transport" });
    xsdValidation.schemaLoaded = probe.schemaLoaded;
    xsdValidation.valid = false;
    if (!probe.schemaLoaded) {
      xsdValidation.issues = toFieldIssues(probe.issues);
    }
  }

  const providerBlocking =
    taxpayerLookup.providerError === "PROVIDER_UNAVAILABLE";

  const sendable = Boolean(
    mappingReady &&
      totals.ok &&
      xsdValidation.ok &&
      xsdValidation.schemaLoaded &&
      internetSaleIssues.length === 0 &&
      !providerBlocking &&
      (recommendedDocumentType === "E_ARCHIVE" || Boolean(selectedAlias))
  );

  return {
    provider,
    recommendedDocumentType,
    profileId,
    invoiceTypeCode,
    selectedAlias,
    availableAliases,
    sellerIssues: toFieldIssues(seller.issues),
    buyerIssues: toFieldIssues(buyer.issues),
    lineIssues: toFieldIssues(lineIssues),
    internetSaleIssues: toFieldIssues(internetSaleIssues),
    snapshotIssues,
    totalValidation: {
      ok: totals.ok,
      issues: toFieldIssues(totals.issues),
    },
    xsdValidation,
    entitlement,
    taxpayerLookup,
    snapshot: {
      ready: hasCompleteSnapshotData(snapshotResult.snapshots),
      persisted: snapshotResult.persisted,
      refreshed: snapshotResult.refreshed,
      locked: snapshotResult.locked,
      status: snapshotResult.status,
      revisionHash: snapshotResult.snapshots.revisionHash,
      capturedAt: snapshotResult.snapshots.eDocumentSnapshotAt?.toISOString() ?? null,
    },
    identifiers: {
      previewUuid,
      custInvId,
    },
    sendable,
    xmlPreviewAvailable,
  };
}
