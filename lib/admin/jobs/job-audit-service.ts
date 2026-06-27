import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";

type Tx = Prisma.TransactionClient;

export async function logAdminJobAudit(input: {
  userId: string;
  action: string;
  jobKey: string;
  displayMessage: string;
  metadata?: Record<string, unknown>;
  tx?: Tx;
}) {
  const client = input.tx ?? db;
  return client.activityLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      module: "admin-jobs",
      message: input.displayMessage,
      entityType: "SystemJob",
      entityId: input.jobKey,
      metadata: {
        jobKey: input.jobKey,
        ...input.metadata,
      } as Prisma.InputJsonValue,
    },
  });
}

export function buildStructuredJobActivityWhere(jobKey: string): Prisma.ActivityLogWhereInput {
  return {
    module: "admin-jobs",
    OR: [
      { AND: [{ entityType: "SystemJob" }, { entityId: jobKey }] },
      { metadata: { path: ["jobKey"], equals: jobKey } },
    ],
  };
}
