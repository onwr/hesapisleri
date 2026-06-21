import { db } from "@/lib/prisma";

export class SettingsAccessError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "SettingsAccessError";
    this.status = status;
  }
}

export async function assertCompanyAccess(userId: string, companyId: string) {
  const companyUser = await db.companyUser.findFirst({
    where: {
      userId,
      companyId,
      status: "ACTIVE",
    },
  });

  if (!companyUser) {
    throw new SettingsAccessError("Bu firmaya erişim yetkiniz yok.");
  }

  return companyUser;
}
