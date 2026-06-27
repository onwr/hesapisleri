import "server-only";

import { db } from "@/lib/prisma";
import { DEFAULT_MEMBERSHIP_PLAN_CODE } from "@/lib/membership-service";
import { AdminPlanServiceError } from "@/lib/admin/plans/admin-plan-patch-service";

export const RESERVED_PLAN_CODES = new Set([DEFAULT_MEMBERSHIP_PLAN_CODE, "admin", "system"]);

export function normalizePlanCode(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function assertValidPlanCodeFormat(code: string): void {
  if (code.length < 2 || code.length > 64) {
    throw new AdminPlanServiceError("Plan kodu 2–64 karakter olmalıdır.", 400);
  }
  if (!/^[a-z0-9-]+$/.test(code)) {
    throw new AdminPlanServiceError(
      "Plan kodu yalnızca küçük harf, rakam ve tire içerebilir.",
      400
    );
  }
}

export async function assertPlanCodeAvailable(code: string, excludePlanId?: string) {
  const normalized = normalizePlanCode(code);
  assertValidPlanCodeFormat(normalized);

  if (RESERVED_PLAN_CODES.has(normalized)) {
    throw new AdminPlanServiceError(`"${normalized}" ayrılmış plan kodudur.`, 400);
  }

  const existing = await db.membershipPlan.findUnique({ where: { code: normalized } });
  if (existing && existing.id !== excludePlanId) {
    throw new AdminPlanServiceError("Bu plan kodu zaten kullanılıyor.", 409);
  }

  const slugConflict = await db.membershipPlan.findUnique({ where: { slug: normalized } });
  if (slugConflict && slugConflict.id !== excludePlanId) {
    throw new AdminPlanServiceError("Bu slug zaten kullanılıyor.", 409);
  }

  return normalized;
}
