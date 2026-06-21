import "server-only";

import type { UserConsentType } from "@prisma/client";
import { db } from "@/lib/prisma";

export async function recordUserConsent(input: {
  userId: string;
  type: UserConsentType;
  version: string;
  consentText: string;
  ip?: string | null;
  userAgent?: string | null;
}) {
  return db.userConsent.create({
    data: {
      userId: input.userId,
      type: input.type,
      version: input.version,
      consentText: input.consentText,
      ip: input.ip ?? null,
      userAgent: input.userAgent?.slice(0, 500) ?? null,
    },
  });
}
