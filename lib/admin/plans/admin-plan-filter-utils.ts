import type { Prisma } from "@prisma/client";
import type { AdminPlanListQuery } from "@/lib/admin/plans/admin-plan-schemas";

export function buildAdminPlanListWhere(
  query: AdminPlanListQuery
): Prisma.MembershipPlanWhereInput {
  const where: Prisma.MembershipPlanWhereInput = {};

  if (query.planStatus !== "ALL") {
    where.planStatus = query.planStatus;
  }

  if (query.visibility !== "ALL") {
    where.visibility = query.visibility;
  }

  if (query.q?.trim()) {
    const q = query.q.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
    ];
  }

  return where;
}

export function buildAdminPlanOrderBy(
  query: AdminPlanListQuery
): Prisma.MembershipPlanOrderByWithRelationInput {
  return { [query.sortBy]: query.sortDir };
}
