/**
 * Trendyol E-Faturam stage doğrulama scripti.
 * Token değerlerini loglamaz; yalnızca kaynak ve endpoint sonuçlarını raporlar.
 *
 * Gerekli env (direct akış için):
 *   TRENDYOL_EFATURAM_DIRECT_EMAIL
 *   TRENDYOL_EFATURAM_DIRECT_PASSWORD
 *   TRENDYOL_EFATURAM_DIRECT_TAX_ID
 * Partner akış için:
 *   TRENDYOL_EFATURAM_PARTNER_ID / USERNAME / PASSWORD
 *   TRENDYOL_EFATURAM_PARTNER_TAX_ID
 */
import { PrismaClient } from "@prisma/client";

const STAGE = "https://stage-apigateway.trendyolefaturam.com";

type ProbeResult = {
  path: string;
  method: string;
  status: number;
  routeExists: boolean;
  tokenInBody: boolean;
  tokenInHeader: boolean;
  bodyKeys: string[];
  headerAuthKeys: string[];
  errorDetail?: string;
};

function redactBody(body: unknown) {
  if (!body || typeof body !== "object") return body;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (/token|password|secret|authorization/i.test(key)) {
      out[key] = value ? "[present]" : "[missing]";
    } else if (typeof value === "object" && value) {
      out[key] = redactBody(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

async function probeAuthPath(input: {
  path: string;
  body?: Record<string, unknown>;
  bearer?: string;
}): Promise<ProbeResult> {
  const response = await fetch(`${STAGE}${input.path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(input.bearer ? { Authorization: `Bearer ${input.bearer}` } : {}),
    },
    body: JSON.stringify(input.body ?? {}),
  });

  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    parsed = { raw: text.slice(0, 200) };
  }

  const headerAuthKeys = [
    "authorization",
    "x-access-token",
    "x-refresh-token",
  ].filter((key) => response.headers.has(key));

  const bodyKeys = Object.keys(parsed);
  const tokenInBody = bodyKeys.some((key) =>
    /accessToken|refreshToken/i.test(key)
  );
  const authHeader = response.headers.get("authorization");
  const tokenInHeader = Boolean(authHeader);

  return {
    path: input.path,
    method: "POST",
    status: response.status,
    routeExists: response.status !== 404,
    tokenInBody,
    tokenInHeader,
    bodyKeys,
    headerAuthKeys,
    errorDetail:
      typeof parsed.detail === "string"
        ? parsed.detail
        : typeof parsed.title === "string"
          ? parsed.title
          : undefined,
  };
}

function extractTokens(body: Record<string, unknown>) {
  return {
    accessToken:
      typeof body.accessToken === "string" ? body.accessToken : undefined,
    refreshToken:
      typeof body.refreshToken === "string" ? body.refreshToken : undefined,
    userId: body.userId,
    companyId: body.companyId,
    partnerCustomerId: body.partnerCustomerId,
    expiresIn: body.expiresIn,
  };
}

async function postJson(path: string, body: unknown, bearer?: string) {
  const response = await fetch(`${STAGE}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    parsed = { raw: text.slice(0, 300) };
  }
  return { status: response.status, body: parsed, ok: response.ok };
}

async function getJson(path: string, bearer: string) {
  const response = await fetch(`${STAGE}${path}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${bearer}`,
    },
  });
  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    parsed = { raw: text.slice(0, 300) };
  }
  return { status: response.status, body: parsed, ok: response.ok };
}

async function main() {
  const report: Record<string, unknown> = {
    migration: "pending-check",
    endpointProbes: [] as ProbeResult[],
    tokenSources: {} as Record<string, string>,
    flows: {} as Record<string, unknown>,
    payloadChecks: {} as Record<string, unknown>,
    gaps: [] as string[],
  };

  const probes = await Promise.all([
    probeAuthPath({ path: "/api/auth/signin", body: { username: "x", password: "y" } }),
    probeAuthPath({ path: "/api/auth/signIn", body: { username: "x", password: "y" } }),
    probeAuthPath({ path: "/signIn", body: { username: "x", password: "y" } }),
    probeAuthPath({ path: "/customerSignIn", body: { email: "x@y.com", password: "y", taxId: "1234567890" } }),
    probeAuthPath({ path: "/refreshToken", body: { refreshToken: "invalid" } }),
    probeAuthPath({ path: "/api/auth/refreshToken", body: { refreshToken: "invalid" } }),
  ]);
  report.endpointProbes = probes;

  const directEmail = process.env.TRENDYOL_EFATURAM_DIRECT_EMAIL?.trim();
  const directPassword = process.env.TRENDYOL_EFATURAM_DIRECT_PASSWORD?.trim();
  const directTaxId = process.env.TRENDYOL_EFATURAM_DIRECT_TAX_ID?.trim();
  const partnerId = process.env.TRENDYOL_EFATURAM_PARTNER_ID?.trim();
  const partnerUsername = process.env.TRENDYOL_EFATURAM_PARTNER_USERNAME?.trim();
  const partnerPassword = process.env.TRENDYOL_EFATURAM_PARTNER_PASSWORD?.trim();
  const partnerTaxId = process.env.TRENDYOL_EFATURAM_PARTNER_TAX_ID?.trim();

  if (!directEmail && !(partnerUsername && partnerPassword)) {
    report.gaps = [
      ...(report.gaps as string[]),
      "Stage credential env eksik: TRENDYOL_EFATURAM_DIRECT_* veya PARTNER_* tanımlı değil; uçtan uca belge akışı çalıştırılamadı.",
    ];
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  let accessToken: string | undefined;
  let refreshToken: string | undefined;
  let providerCompanyId: string | undefined;
  let providerUserId: string | undefined;

  if (directEmail && directPassword && directTaxId) {
    const signInAttempts = [
      "/customerSignIn",
      "/api/auth/signin",
      "/signIn",
    ];

    for (const path of signInAttempts) {
      const body =
        path === "/customerSignIn"
          ? { email: directEmail, password: directPassword, taxId: directTaxId }
          : { username: directEmail, password: directPassword };

      const result = await postJson(path, body);
      (report.flows as Record<string, unknown>)[`direct:${path}`] = {
        status: result.status,
        body: redactBody(result.body),
      };

      const tokens = extractTokens(result.body);
      if (tokens.accessToken) {
        accessToken = tokens.accessToken;
        refreshToken = tokens.refreshToken;
        providerCompanyId = tokens.companyId ? String(tokens.companyId) : undefined;
        providerUserId = tokens.userId ? String(tokens.userId) : undefined;
        (report.tokenSources as Record<string, string>).direct = `response body (${path})`;
        break;
      }
    }
  }

  if (!accessToken && partnerUsername && partnerPassword) {
    const partnerSignIn = await postJson("/signIn", {
      username: partnerUsername,
      password: partnerPassword,
    });
    (report.flows as Record<string, unknown>).partnerSignIn = {
      status: partnerSignIn.status,
      body: redactBody(partnerSignIn.body),
    };

    const partnerTokens = extractTokens(partnerSignIn.body);
    if (partnerTokens.accessToken && partnerId && partnerTaxId) {
      (report.tokenSources as Record<string, string>).partner = "response body (/signIn)";
      const appStatus = await getJson(
        `/api/invoice/partners/${partnerId}/application-status/by-tax-id/${partnerTaxId}`,
        partnerTokens.accessToken
      );
      (report.flows as Record<string, unknown>).partnerApplicationStatus = {
        status: appStatus.status,
        body: redactBody(appStatus.body),
      };

      const customerId = appStatus.body.partnerCustomerId;
      if (customerId) {
        const customerSignIn = await postJson(
          "/customerSignIn",
          { customerId: String(customerId) },
          partnerTokens.accessToken
        );
        (report.flows as Record<string, unknown>).partnerCustomerSignIn = {
          status: customerSignIn.status,
          body: redactBody(customerSignIn.body),
        };
        const customerTokens = extractTokens(customerSignIn.body);
        accessToken = customerTokens.accessToken;
        refreshToken = customerTokens.refreshToken;
        providerCompanyId = customerTokens.companyId
          ? String(customerTokens.companyId)
          : undefined;
        providerUserId = customerTokens.userId
          ? String(customerTokens.userId)
          : undefined;
        (report.tokenSources as Record<string, string>).partnerCustomer =
          "response body (/customerSignIn)";
      }
    }
  }

  if (!accessToken) {
    (report.gaps as string[]).push(
      "Geçerli stage credential ile access token alınamadı."
    );
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (refreshToken) {
    const refreshPaths = ["/refreshToken", "/api/auth/refreshToken"];
    for (const path of refreshPaths) {
      const refreshed = await postJson(path, { refreshToken });
      (report.flows as Record<string, unknown>)[`refresh:${path}`] = {
        status: refreshed.status,
        body: redactBody(refreshed.body),
        tokenSource:
          typeof refreshed.body.accessToken === "string"
            ? `response body (${path})`
            : "none",
      };
    }
  }

  const taxpayerTaxId = directTaxId ?? partnerTaxId;
  if (taxpayerTaxId) {
    const taxpayer = await getJson(
      `/api/invoice/taxpayers/${taxpayerTaxId}`,
      accessToken
    );
    (report.flows as Record<string, unknown>).taxpayerLookup = {
      status: taxpayer.status,
      body: redactBody(taxpayer.body),
    };
  }

  const db = new PrismaClient();
  try {
    const migration = await db.$queryRaw<
      Array<{ exists: boolean }>
    >`SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'EfaturamIntegration'
    ) as exists`;
    report.migration = migration[0]?.exists ? "applied" : "missing";

    const company = await db.company.findFirst({
      where: { taxNo: { not: null } },
      include: {
        customers: { where: { taxNo: { not: null } }, take: 1 },
        invoices: {
          where: { status: { not: "CANCELLED" } },
          include: { items: { orderBy: { lineIndex: "asc" } }, customer: true, company: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!company?.invoices[0] || !providerCompanyId || !providerUserId) {
      (report.gaps as string[]).push(
        "Belge oluşturma için uygun fatura veya provider kimlikleri eksik."
      );
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    const invoice = company.invoices[0];
    const localReferenceId = invoice.id;
    const archivePayload = {
      autoInvoiceId: true,
      companyId: Number(providerCompanyId),
      userId: Number(providerUserId),
      localReferenceId,
      source: "WEB",
      scenario: "EARSIVFATURA",
      invoiceTypeCode: "SATIS",
      currency: "TRY",
      issuedAt: invoice.createdAt.toISOString(),
      taxExcludedPrice: Math.round(Number(invoice.taxableAmount) * 100),
      taxAmount: Math.round(Number(invoice.totalVat) * 100),
      discountAmount: Math.round(Number(invoice.totalDiscount) * 100),
      price: Math.round(Number(invoice.total) * 100),
      payableAmount: Math.round(Number(invoice.total) * 100),
      recipientInfo: {
        taxId: (invoice.customer?.taxNo ?? taxpayerTaxId ?? "").replace(/\D/g, ""),
        countryCode: "TR",
        city: "İstanbul",
        name: invoice.customer?.name ?? "Müşteri",
        surname: "-",
        address: invoice.customer?.address ?? "Adres",
      },
      invoiceLines: invoice.items.map((item, index) => ({
        lineId: index + 1,
        name: item.productName,
        quantity: Number(item.quantity),
        unitPrice: Math.round(Number(item.unitPrice) * 100),
        taxExcludedPrice: Math.round(Number(item.lineNetAmount) * 100),
        taxAmount: Math.round(Number(item.vatAmount) * 100),
        price: Math.round(Number(item.lineGrossAmount) * 100),
        vatRate: Number(item.vatRate),
      })),
      paymentInfo: {
        paymentType: "CREDITCARD",
        paymentDate: invoice.createdAt.toISOString().slice(0, 10),
      },
      deliveryInfo: {
        deliveryType: "ELECTRONIC",
        deliveryDate: invoice.createdAt.toISOString().slice(0, 10),
      },
    };

    (report.payloadChecks as Record<string, unknown>).archive = {
      amountsAreMinor: true,
      localReferenceId,
      companyId: providerCompanyId,
      userId: providerUserId,
      hasPaymentDelivery: true,
    };

    const archiveCreate = await postJson(
      "/api/invoice/documents/earchive",
      archivePayload,
      accessToken
    );
    (report.flows as Record<string, unknown>).archiveCreate = {
      status: archiveCreate.status,
      body: redactBody(archiveCreate.body),
    };

    const archiveUuid =
      typeof archiveCreate.body.invoiceUuid === "string"
        ? archiveCreate.body.invoiceUuid
        : undefined;

    if (archiveUuid) {
      const archiveStatus = await getJson(
        `/api/invoice/documents/earchive/status/${archiveUuid}`,
        accessToken
      );
      (report.flows as Record<string, unknown>).archiveStatus = {
        status: archiveStatus.status,
        body: redactBody(archiveStatus.body),
      };

      const archiveCancel = await postJson(
        "/api/invoice/documents/earchive/cancel",
        { invoiceUuid: archiveUuid },
        accessToken
      );
      (report.flows as Record<string, unknown>).archiveCancel = {
        status: archiveCancel.status,
        body: redactBody(archiveCancel.body),
      };
    }

    const duplicateCreate = await postJson(
      "/api/invoice/documents/earchive",
      archivePayload,
      accessToken
    );
    (report.flows as Record<string, unknown>).duplicateArchiveAttempt = {
      status: duplicateCreate.status,
      body: redactBody(duplicateCreate.body),
    };

    const fakeResend = await postJson(
      "/api/invoice/documents/outgoing-einvoice/resend",
      { invoiceUuid: "00000000-0000-0000-0000-000000000000" },
      accessToken
    );
    (report.flows as Record<string, unknown>).invalidEinvoiceResend = {
      status: fakeResend.status,
      body: redactBody(fakeResend.body),
    };
  } finally {
    await db.$disconnect();
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      fatal: error instanceof Error ? error.message : "validation failed",
    })
  );
  process.exit(1);
});
