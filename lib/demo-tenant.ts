import type { PrismaClient } from "@prisma/client";

/** Canonical demo tenant marker — seed ve demo scriptlerle uyumlu. */
export const DEMO_TAX_NO = "DEMO-9988776655";

export const KNOWN_QA_PAYLOAD_PATTERNS = [
  /<\s*script/i,
  /<\s*img/i,
  /onerror\s*=/i,
  /onload\s*=/i,
  /javascript:/i,
  /<\s*\/?[a-z][^>]*>/i,
  /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/,
] as const;

export function getConfiguredDemoCompanyId() {
  const value = process.env.DEMO_COMPANY_ID?.trim();
  return value || null;
}

export function isUnsafeDemoContent(value: string | null | undefined) {
  const text = value?.trim();
  if (!text) return false;
  return KNOWN_QA_PAYLOAD_PATTERNS.some((pattern) => pattern.test(text));
}

export async function resolveDemoCompany(
  client: Pick<PrismaClient, "company">
) {
  const configuredId = getConfiguredDemoCompanyId();

  if (configuredId) {
    const company = await client.company.findUnique({
      where: { id: configuredId },
      select: { id: true, name: true, taxNo: true },
    });

    if (company?.taxNo === DEMO_TAX_NO) {
      return company;
    }

    return null;
  }

  return client.company.findFirst({
    where: { taxNo: DEMO_TAX_NO },
    select: { id: true, name: true, taxNo: true },
  });
}

export function assertDemoTenantCompany(company: {
  id: string;
  taxNo: string | null;
}) {
  if (company.taxNo !== DEMO_TAX_NO) {
    throw new Error(
      "Güvenlik: Yalnızca canonical demo tenant (DEMO_TAX_NO) hedeflenebilir."
    );
  }
}
