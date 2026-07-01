import type { CompanyAISettings } from "@prisma/client";
import { db } from "@/lib/prisma";
import { isPrismaUniqueConstraintError } from "@/lib/prisma-transaction-utils";

export async function getOrCreateCompanyAiSettings(
  companyId: string
): Promise<CompanyAISettings> {
  try {
    return await db.companyAISettings.upsert({
      where: { companyId },
      create: { companyId },
      update: {},
    });
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      return await db.companyAISettings.findUniqueOrThrow({
        where: { companyId },
      });
    }
    throw error;
  }
}
