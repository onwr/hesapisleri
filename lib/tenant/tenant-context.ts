import "server-only";

import { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";
import { requireCompanyUser } from "@/lib/auth/auth-dal";
import { getAppSession } from "@/lib/app-session";
import {
  assertModuleAccess,
  requireApiModuleAccess,
  requireModuleAccess,
} from "@/lib/module-access";
import type { AppModule } from "@/lib/permission-utils";
import { TenantForbiddenError } from "./tenant-errors";
import {
  assertTenantResource,
  rejectMismatchedBodyCompanyId,
} from "./tenant-guards";

export { assertTenantResource, rejectMismatchedBodyCompanyId };

export type TenantContext = {
  userId: string;
  companyId: string;
  role: UserRole;
  isOwner: boolean;
  isSuperAdmin: boolean;
};

function toTenantContext(input: {
  userId: string;
  companyId: string;
  role: UserRole;
  isOwner: boolean;
  isSuperAdmin: boolean;
}): TenantContext {
  if (input.companyId === "platform") {
    throw new TenantForbiddenError();
  }

  return input;
}

export async function requireTenantContext(): Promise<TenantContext> {
  const session = await requireCompanyUser();

  return toTenantContext({
    userId: session.userId,
    companyId: session.companyId,
    role: session.effectiveRole,
    isOwner: session.companyUser.isOwner,
    isSuperAdmin: session.isSuperAdmin,
  });
}

export async function getOptionalTenantContext(): Promise<TenantContext | null> {
  try {
    return await requireTenantContext();
  } catch {
    return null;
  }
}

export async function requireTenantPermission(
  module: AppModule
): Promise<TenantContext> {
  const session = await getAppSession();
  assertModuleAccess(session, module);

  return toTenantContext({
    userId: session.user.id,
    companyId: session.company.id,
    role: session.effectiveRole,
    isOwner: session.companyUser.isOwner,
    isSuperAdmin: session.isSuperAdmin,
  });
}

export type ApiTenantAuthResult =
  | {
      tenant: TenantContext;
      session: Awaited<ReturnType<typeof requireModuleAccess>>;
    }
  | { error: NextResponse };

export async function requireApiTenantContext(
  module: AppModule
): Promise<ApiTenantAuthResult> {
  const auth = await requireApiModuleAccess(module);

  if ("error" in auth && auth.error) {
    return { error: auth.error };
  }

  try {
    rejectMismatchedBodyCompanyId(undefined, auth.companyId);
  } catch {
    return {
      error: NextResponse.json(
        { success: false, message: "Bu firma için erişim yetkiniz bulunmuyor." },
        { status: 403 }
      ),
    };
  }

  const tenant: TenantContext = {
    userId: auth.userId,
    companyId: auth.companyId,
    role: auth.session.effectiveRole,
    isOwner: auth.session.companyUser.isOwner,
    isSuperAdmin: auth.session.isSuperAdmin,
  };

  return { tenant, session: auth.session };
}

export async function assertActiveCompanyMembership(input: {
  userId: string;
  companyId: string;
}) {
  await requireModuleAccess({
    userId: input.userId,
    companyId: input.companyId,
    module: "dashboard",
  });
}
