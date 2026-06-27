import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { getSuperAdminSession, isPlatformSuperAdminUser } from "@/lib/admin-auth";
import { getAppSession, type AppSession } from "@/lib/app-session";
import {
  canAccessModule,
  canManageAccounts,
  canManageDirectory,
  canManageSuppliers,
  canManageWarehouses,
  type AppModule,
} from "@/lib/permission-utils";
import {
  hasEmployeeApiPermission,
  type EmployeeApiPermission,
} from "@/lib/employee-permission-utils";
import {
  canCancelSales,
  canUpdateSales,
} from "@/lib/sale-permission-utils";
import { db } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";
import { resolveEffectiveRole } from "@/lib/permission-utils";

export class ModuleAccessError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "ModuleAccessError";
    this.status = status;
  }
}

export function assertModuleAccess(
  session: Pick<AppSession, "effectiveRole" | "companyUser" | "isSuperAdmin">,
  module: AppModule
) {
  if (module === "admin" && !session.isSuperAdmin) {
    throw new ModuleAccessError("Bu sayfaya erişim yetkiniz yok.");
  }

  if (
    !canAccessModule(
      session.effectiveRole,
      module,
      session.companyUser.isOwner
    )
  ) {
    throw new ModuleAccessError("Bu sayfaya erişim yetkiniz yok.");
  }
}

export async function guardPageModule(module: AppModule) {
  if (module === "admin") {
    await getSuperAdminSession();
    return getAppSession();
  }

  const session = await getAppSession();

  try {
    assertModuleAccess(session, module);
  } catch {
    redirect("/unauthorized");
  }

  return session;
}

export async function requireModuleAccess(input: {
  userId: string;
  companyId: string;
  module: AppModule;
}) {
  const companyUser = await db.companyUser.findFirst({
    where: {
      userId: input.userId,
      companyId: input.companyId,
      status: "ACTIVE",
    },
    include: {
      user: true,
    },
  });

  if (!companyUser) {
    throw new ModuleAccessError("Bu firmaya erişim yetkiniz yok.", 401);
  }

  const session: Pick<
    AppSession,
    "effectiveRole" | "companyUser" | "isSuperAdmin" | "user" | "company"
  > = {
    user: companyUser.user,
    company: await db.company.findUniqueOrThrow({
      where: { id: input.companyId },
    }),
    companyUser: {
      id: companyUser.id,
      role: companyUser.role,
      isOwner: companyUser.isOwner,
      status: companyUser.status,
    },
    effectiveRole: resolveEffectiveRole({
      role: companyUser.role,
      isOwner: companyUser.isOwner,
    }),
    isSuperAdmin: isPlatformSuperAdminUser(companyUser.user),
  };

  assertModuleAccess(session, input.module);

  return session;
}

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

async function rejectIfMaintenanceMode(isSuperAdmin: boolean) {
  const { assertPlatformAvailable } = await import(
    "@/lib/platform-runtime/platform-availability"
  );
  const { MaintenanceModeActiveError } = await import(
    "@/lib/admin/platform-settings/platform-settings-errors"
  );

  try {
    await assertPlatformAvailable({ isSuperAdmin });
  } catch (error) {
    if (error instanceof MaintenanceModeActiveError) {
      return NextResponse.json(
        { success: false, message: error.message, code: error.code },
        { status: error.status }
      );
    }
    throw error;
  }

  return null;
}

export async function requireAnyApiModuleAccess(modules: AppModule[]) {
  const token = await getAuthToken();

  if (!token) {
    return {
      error: NextResponse.json(
        { success: false, message: "Oturum bulunamadı." },
        { status: 401 }
      ),
    };
  }

  const payload = verifyToken<AuthPayload>(token);

  if (!payload?.userId || !payload.companyId) {
    return {
      error: NextResponse.json(
        { success: false, message: "Oturum geçersiz." },
        { status: 401 }
      ),
    };
  }

  let lastError: ModuleAccessError | null = null;

  for (const module of modules) {
    try {
      const session = await requireModuleAccess({
        userId: payload.userId,
        companyId: payload.companyId,
        module,
      });

      const maintenanceError = await rejectIfMaintenanceMode(session.isSuperAdmin);
      if (maintenanceError) {
        return { error: maintenanceError };
      }

      return {
        session,
        userId: payload.userId,
        companyId: payload.companyId,
      };
    } catch (error) {
      if (error instanceof ModuleAccessError) {
        lastError = error;
      } else {
        throw error;
      }
    }
  }

  return {
    error: NextResponse.json(
      {
        success: false,
        message: lastError?.message ?? "Bu işlem için yetkiniz yok.",
      },
      { status: lastError?.status ?? 403 }
    ),
  };
}

export async function requireApiModuleAccess(module: AppModule) {
  const token = await getAuthToken();

  if (!token) {
    return {
      error: NextResponse.json(
        { success: false, message: "Oturum bulunamadı." },
        { status: 401 }
      ),
    };
  }

  const payload = verifyToken<AuthPayload>(token);

  if (!payload?.userId || !payload.companyId) {
    return {
      error: NextResponse.json(
        { success: false, message: "Oturum geçersiz." },
        { status: 401 }
      ),
    };
  }

  try {
    const session = await requireModuleAccess({
      userId: payload.userId,
      companyId: payload.companyId,
      module,
    });

    const maintenanceError = await rejectIfMaintenanceMode(session.isSuperAdmin);
    if (maintenanceError) {
      return { error: maintenanceError };
    }

    return {
      session,
      userId: payload.userId,
      companyId: payload.companyId,
    };
  } catch (error) {
    if (error instanceof ModuleAccessError) {
      return {
        error: NextResponse.json(
          { success: false, message: error.message },
          { status: error.status }
        ),
      };
    }

    throw error;
  }
}

export async function requireApiSalesAction(action: "update" | "cancel") {
  const auth = await requireApiModuleAccess("sales");
  if ("error" in auth) return auth;

  const allowed =
    action === "update"
      ? canUpdateSales(
          auth.session.effectiveRole,
          auth.session.companyUser.isOwner
        )
      : canCancelSales(
          auth.session.effectiveRole,
          auth.session.companyUser.isOwner
        );

  if (!allowed) {
    return {
      error: NextResponse.json(
        {
          success: false,
          message:
            action === "update"
              ? "Satış düzenleme yetkiniz yok."
              : "Satış iptal yetkiniz yok.",
        },
        { status: 403 }
      ),
    };
  }

  return auth;
}

export async function requireApiEmployeesPermission(
  permission: EmployeeApiPermission
) {
  const auth = await requireApiModuleAccess("employees");
  if ("error" in auth) return auth;

  if (
    !hasEmployeeApiPermission(
      auth.session.effectiveRole,
      permission,
      auth.session.companyUser.isOwner
    )
  ) {
    return {
      error: NextResponse.json(
        { success: false, message: "Bu işlem için yetkiniz yok." },
        { status: 403 }
      ),
    };
  }

  return auth;
}

export async function requireApiWarehouseRead() {
  return requireAnyApiModuleAccess(["products", "stocks"]);
}

export async function requireApiWarehouseManage() {
  const auth = await requireApiWarehouseRead();
  if ("error" in auth) return auth;

  if (
    !canManageWarehouses(
      auth.session.effectiveRole,
      auth.session.companyUser.isOwner
    )
  ) {
    return {
      error: NextResponse.json(
        { success: false, message: "Bu işlem için yetkiniz yok." },
        { status: 403 }
      ),
    };
  }

  return auth;
}

export async function requireApiSupplierManage() {
  const auth = await requireApiModuleAccess("suppliers");
  if ("error" in auth) return auth;

  if (
    !canManageSuppliers(
      auth.session.effectiveRole,
      auth.session.companyUser.isOwner
    )
  ) {
    return {
      error: NextResponse.json(
        { success: false, message: "Bu işlem için yetkiniz yok." },
        { status: 403 }
      ),
    };
  }

  return auth;
}

export async function requireApiDirectoryManage() {
  const auth = await requireApiModuleAccess("directory");
  if ("error" in auth) return auth;

  if (
    !canManageDirectory(
      auth.session.effectiveRole,
      auth.session.companyUser.isOwner
    )
  ) {
    return {
      error: NextResponse.json(
        { success: false, message: "Bu işlem için yetkiniz yok." },
        { status: 403 }
      ),
    };
  }

  return auth;
}

export async function requireApiCashBankRead() {
  return requireAnyApiModuleAccess([
    "cash-bank",
    "pos",
    "expenses",
    "settings",
    "sales",
    "invoices",
  ]);
}

export async function requireApiCashBankManage() {
  const auth = await requireApiCashBankRead();
  if ("error" in auth) return auth;

  if (
    !canManageAccounts(
      auth.session.effectiveRole,
      auth.session.companyUser.isOwner
    )
  ) {
    return {
      error: NextResponse.json(
        { success: false, message: "Bu işlem için yetkiniz yok." },
        { status: 403 }
      ),
    };
  }

  return auth;
}

type SessionAuthPayload = {
  userId: string;
  companyId: string | null;
};

export type AuthenticatedApiSession = {
  userId: string;
  companyId: string | null;
  user: NonNullable<Awaited<ReturnType<typeof db.user.findUnique>>>;
};

export async function requireAuthenticatedApiSession(): Promise<
  | { session: AuthenticatedApiSession }
  | { error: NextResponse }
> {
  const token = await getAuthToken();

  if (!token) {
    return {
      error: NextResponse.json(
        { success: false, message: "Oturum bulunamadı." },
        { status: 401 }
      ),
    };
  }

  const payload = verifyToken<SessionAuthPayload>(token);

  if (!payload?.userId) {
    return {
      error: NextResponse.json(
        { success: false, message: "Oturum geçersiz." },
        { status: 401 }
      ),
    };
  }

  const user = await db.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user || user.status !== "ACTIVE") {
    return {
      error: NextResponse.json(
        { success: false, message: "Kullanıcı bulunamadı." },
        { status: 401 }
      ),
    };
  }

  return {
    session: {
      userId: payload.userId,
      companyId: payload.companyId ?? null,
      user,
    },
  };
}

export async function getOptionalAuthenticatedApiSession(): Promise<AuthenticatedApiSession | null> {
  const token = await getAuthToken();
  if (!token) return null;

  const payload = verifyToken<SessionAuthPayload>(token);
  if (!payload?.userId) return null;

  const user = await db.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user || user.status !== "ACTIVE") return null;

  return {
    userId: user.id,
    companyId: payload.companyId ?? null,
    user,
  };
}

export function getModuleForPath(pathname: string): AppModule | null {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return "dashboard";
  }
  if (pathname === "/pos" || pathname.startsWith("/pos/")) return "pos";
  if (pathname === "/sales" || pathname.startsWith("/sales/")) return "sales";
  if (pathname === "/customers" || pathname.startsWith("/customers/")) {
    return "customers";
  }
  if (pathname === "/suppliers" || pathname.startsWith("/suppliers/")) {
    return "suppliers";
  }
  if (pathname === "/directory" || pathname.startsWith("/directory/")) {
    return "directory";
  }
  if (pathname === "/products" || pathname.startsWith("/products/")) {
    return "products";
  }
  if (pathname === "/stocks" || pathname.startsWith("/stocks/")) return "stocks";
  if (pathname === "/invoices" || pathname.startsWith("/invoices/")) {
    return "invoices";
  }
  if (pathname === "/cash-bank" || pathname.startsWith("/cash-bank/")) {
    return "cash-bank";
  }
  if (pathname === "/expenses" || pathname.startsWith("/expenses/")) {
    return "expenses";
  }
  if (pathname === "/orders" || pathname.startsWith("/orders/")) return "orders";
  if (pathname === "/reports" || pathname.startsWith("/reports/")) {
    return "reports";
  }
  if (pathname === "/ai-assistant" || pathname.startsWith("/ai-assistant/")) {
    return "ai-assistant";
  }
  if (pathname === "/notifications" || pathname.startsWith("/notifications/")) {
    return "notifications";
  }
  if (pathname === "/calendar" || pathname.startsWith("/calendar/")) {
    return "calendar";
  }
  if (pathname === "/team" || pathname.startsWith("/team/")) {
    return "employees";
  }
  if (pathname === "/settings" || pathname.startsWith("/settings/")) {
    return "settings";
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  return null;
}
