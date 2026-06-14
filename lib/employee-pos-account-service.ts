import type { CompanyUserStatus } from "@prisma/client";
import { db } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { formatEmployeeDisplayName } from "@/lib/employee-utils";
import {
  EmployeeServiceError,
  serializeEmployee,
} from "@/lib/employee-service";
import {
  buildPosAccountEmail,
  parsePosUsernameFromEmail,
  sanitizePosUsername,
} from "@/lib/employee-pos-utils";

const employeeInclude = {
  companyUser: {
    include: {
      user: {
        select: { id: true, name: true, email: true, updatedAt: true },
      },
    },
  },
  salaryRecords: {
    orderBy: { effectiveFrom: "desc" as const },
  },
  payments: {
    orderBy: { createdAt: "desc" as const },
  },
  leaveRequests: {
    orderBy: { startAt: "desc" as const },
  },
};

async function getEmployeeForPos(employeeId: string, companyId: string) {
  const employee = await db.employee.findFirst({
    where: { id: employeeId, companyId },
    include: employeeInclude,
  });

  if (!employee) {
    throw new EmployeeServiceError("Çalışan bulunamadı.", 404);
  }

  return employee;
}

function assertCanManagePosAccount(role: string, isOwner: boolean) {
  if (isOwner || role === "OWNER" || role === "ADMIN" || role === "SUPER_ADMIN") {
    return;
  }
  throw new EmployeeServiceError("POS hesabı yönetme yetkiniz yok.", 403);
}

function serializePosAccount(
  employee: Awaited<ReturnType<typeof getEmployeeForPos>>,
  companyId: string
) {
  const companyUser = employee.companyUser;
  if (!companyUser || companyUser.role !== "POS_STAFF") {
    return null;
  }

  const username =
    parsePosUsernameFromEmail(companyUser.user.email, companyId) ??
    companyUser.user.email;

  return {
    username,
    loginEmail: companyUser.user.email,
    status: companyUser.status as CompanyUserStatus,
    statusLabel: companyUser.status === "ACTIVE" ? "Aktif" : "Pasif",
    lastLoginAt: companyUser.user.updatedAt.toISOString(),
    companyUserId: companyUser.id,
  };
}

async function logPosActivity(input: {
  companyId: string;
  userId: string;
  message: string;
  action?: string;
}) {
  await db.activityLog.create({
    data: {
      companyId: input.companyId,
      userId: input.userId,
      action: input.action ?? "UPDATE",
      module: "employees",
      message: input.message,
    },
  });
}

export async function createEmployeePosAccount(input: {
  companyId: string;
  actorUserId: string;
  actorRole: string;
  actorIsOwner: boolean;
  employeeId: string;
  username: string;
  password: string;
}) {
  assertCanManagePosAccount(input.actorRole, input.actorIsOwner);

  const username = sanitizePosUsername(input.username);
  if (username.length < 3) {
    throw new EmployeeServiceError(
      "Kullanıcı adı en az 3 karakter olmalıdır.",
      400
    );
  }

  if (input.password.length < 6) {
    throw new EmployeeServiceError("Şifre en az 6 karakter olmalıdır.", 400);
  }

  const employee = await getEmployeeForPos(input.employeeId, input.companyId);

  if (employee.companyUserId) {
    if (employee.companyUser?.role === "POS_STAFF") {
      throw new EmployeeServiceError("Bu çalışanın zaten POS erişimi var.", 409);
    }
    throw new EmployeeServiceError(
      "Bu çalışana bağlı başka bir hesap var. Önce mevcut bağlantıyı kaldırın.",
      409
    );
  }

  const email = buildPosAccountEmail(username, input.companyId);
  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new EmployeeServiceError("Bu POS kullanıcı adı zaten kullanılıyor.", 409);
  }

  const displayName = formatEmployeeDisplayName(employee);
  const hashedPassword = await hashPassword(input.password);

  const updated = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: displayName,
        email,
        password: hashedPassword,
        role: "STAFF",
        status: "ACTIVE",
      },
    });

    const companyUser = await tx.companyUser.create({
      data: {
        companyId: input.companyId,
        userId: user.id,
        role: "POS_STAFF",
        status: "ACTIVE",
        isOwner: false,
      },
      include: {
        user: { select: { id: true, name: true, email: true, updatedAt: true } },
      },
    });

    const linked = await tx.employee.update({
      where: { id: employee.id },
      data: { companyUserId: companyUser.id },
      include: employeeInclude,
    });

    await tx.activityLog.create({
      data: {
        companyId: input.companyId,
        userId: input.actorUserId,
        action: "CREATE",
        module: "employees",
        message: `${displayName} için POS hesabı oluşturuldu (${username}).`,
      },
    });

    return linked;
  });

  return {
    employee: serializeEmployee(updated, { includeSensitive: true }),
    posAccount: serializePosAccount(updated, input.companyId),
  };
}

export async function updateEmployeePosAccount(input: {
  companyId: string;
  actorUserId: string;
  actorRole: string;
  actorIsOwner: boolean;
  employeeId: string;
  password?: string;
  status?: CompanyUserStatus;
}) {
  assertCanManagePosAccount(input.actorRole, input.actorIsOwner);

  const employee = await getEmployeeForPos(input.employeeId, input.companyId);

  if (!employee.companyUser || employee.companyUser.role !== "POS_STAFF") {
    throw new EmployeeServiceError("Bu çalışanın POS hesabı bulunamadı.", 404);
  }

  if (input.password != null && input.password.length > 0 && input.password.length < 6) {
    throw new EmployeeServiceError("Şifre en az 6 karakter olmalıdır.", 400);
  }

  if (
    input.status != null &&
    input.status !== "ACTIVE" &&
    input.status !== "PASSIVE"
  ) {
    throw new EmployeeServiceError("Geçersiz hesap durumu.", 400);
  }

  const displayName = formatEmployeeDisplayName(employee);

  const updated = await db.$transaction(async (tx) => {
    if (input.password) {
      const hashedPassword = await hashPassword(input.password);
      await tx.user.update({
        where: { id: employee.companyUser!.user.id },
        data: { password: hashedPassword },
      });
    }

    if (input.status) {
      await tx.companyUser.update({
        where: { id: employee.companyUser!.id },
        data: { status: input.status },
      });
    }

    const messages: string[] = [];
    if (input.password) messages.push("şifre yenilendi");
    if (input.status === "ACTIVE") messages.push("erişim aktifleştirildi");
    if (input.status === "PASSIVE") messages.push("erişim pasifleştirildi");

    if (messages.length > 0) {
      await tx.activityLog.create({
        data: {
          companyId: input.companyId,
          userId: input.actorUserId,
          action: "UPDATE",
          module: "employees",
          message: `${displayName} POS hesabı güncellendi: ${messages.join(", ")}.`,
        },
      });
    }

    return tx.employee.findFirst({
      where: { id: employee.id },
      include: employeeInclude,
    });
  });

  if (!updated) {
    throw new EmployeeServiceError("Çalışan bulunamadı.", 404);
  }

  return {
    employee: serializeEmployee(updated, { includeSensitive: true }),
    posAccount: serializePosAccount(updated, input.companyId),
  };
}

export async function disableEmployeePosAccount(input: {
  companyId: string;
  actorUserId: string;
  actorRole: string;
  actorIsOwner: boolean;
  employeeId: string;
}) {
  return updateEmployeePosAccount({
    ...input,
    status: "PASSIVE",
  });
}

export function getPosAccountFromEmployee(
  employee: Parameters<typeof serializeEmployee>[0],
  companyId: string
) {
  if (!employee.companyUser || employee.companyUser.role !== "POS_STAFF") {
    return null;
  }

  const username =
    parsePosUsernameFromEmail(employee.companyUser.user.email, companyId) ??
    employee.companyUser.user.email;

  return {
    username,
    loginEmail: employee.companyUser.user.email,
    status: employee.companyUser.status,
    statusLabel: employee.companyUser.status === "ACTIVE" ? "Aktif" : "Pasif",
    lastLoginAt: null as string | null,
    companyUserId: employee.companyUser.id,
  };
}
