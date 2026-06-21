import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";

export async function withTenantDb<T>(
  companyId: string,
  callback: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT set_config(
        'app.current_company_id',
        ${companyId},
        true
      )
    `;

    return callback(tx);
  });
}
