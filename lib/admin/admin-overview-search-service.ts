import { db } from "@/lib/prisma";

export type AdminGlobalSearchResult = {
  companies: Array<{ id: string; label: string; href: string; meta?: string }>;
  users: Array<{ id: string; label: string; href: string; meta?: string }>;
  subscriptions: Array<{ id: string; label: string; href: string; meta?: string }>;
  payments: Array<{ id: string; label: string; href: string; meta?: string }>;
  partners: Array<{ id: string; label: string; href: string; meta?: string }>;
};

const MIN_QUERY_LENGTH = 2;
const RESULT_LIMIT = 5;

export function isAdminSearchQueryValid(query: string) {
  return query.trim().length >= MIN_QUERY_LENGTH;
}

export async function searchAdminPlatform(
  query: string
): Promise<AdminGlobalSearchResult> {
  const q = query.trim();
  if (!isAdminSearchQueryValid(q)) {
    return emptyResults();
  }

  const [companies, users, subscriptions, payments, partners] =
    await Promise.all([
      db.company.findMany({
        where: {
          OR: [
            { id: q },
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { taxNo: { contains: q, mode: "insensitive" } },
          ],
        },
        take: RESULT_LIMIT,
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, email: true, status: true },
      }),
      db.user.findMany({
        where: {
          OR: [
            { id: q },
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        },
        take: RESULT_LIMIT,
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, email: true, status: true },
      }),
      db.companySubscription.findMany({
        where: {
          OR: [
            { id: q },
            { company: { name: { contains: q, mode: "insensitive" } } },
          ],
        },
        take: RESULT_LIMIT,
        orderBy: { updatedAt: "desc" },
        include: {
          company: { select: { id: true, name: true } },
          plan: { select: { name: true } },
        },
      }),
      db.membershipPayment.findMany({
        where: {
          OR: [
            { id: q },
            { merchantOid: q },
            { paymentRef: q },
            { company: { name: { contains: q, mode: "insensitive" } } },
          ],
        },
        take: RESULT_LIMIT,
        orderBy: { createdAt: "desc" },
        include: { company: { select: { id: true, name: true } } },
      }),
      db.partnerProfile.findMany({
        where: {
          OR: [
            { id: q },
            { referralCode: { contains: q, mode: "insensitive" } },
            { fullName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        },
        take: RESULT_LIMIT,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          fullName: true,
          referralCode: true,
          email: true,
        },
      }),
    ]);

  return {
    companies: companies.map((company) => ({
      id: company.id,
      label: company.name,
      meta: company.email ?? company.status,
      href: `/admin/companies/${company.id}`,
    })),
    users: users.map((user) => ({
      id: user.id,
      label: user.name,
      meta: user.email,
      href: `/admin/users/${user.id}`,
    })),
    subscriptions: subscriptions.map((subscription) => ({
      id: subscription.id,
      label: subscription.company.name,
      meta: `${subscription.plan?.name ?? "Plan"} · ${subscription.status}`,
      href: `/admin/subscriptions/${subscription.id}`,
    })),
    payments: payments.map((payment) => ({
      id: payment.id,
      label: payment.company.name,
      meta: `${payment.status} · ${payment.id.slice(0, 8)}`,
      href: `/admin/payments?paymentId=${payment.id}`,
    })),
    partners: partners.map((partner) => ({
      id: partner.id,
      label: partner.fullName,
      meta: partner.referralCode,
      href: `/admin/partners/${partner.id}`,
    })),
  };
}

function emptyResults(): AdminGlobalSearchResult {
  return {
    companies: [],
    users: [],
    subscriptions: [],
    payments: [],
    partners: [],
  };
}
