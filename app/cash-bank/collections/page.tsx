import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { CollectionsPageClient } from "@/components/collections/collections-page-client";
import { getCollectionsPageData } from "@/lib/collections-page-data";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { guardPageModule } from "@/lib/module-access";
import { db } from "@/lib/prisma";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

type CollectionsPageProps = {
  searchParams: Promise<{
    q?: string;
    customerId?: string;
    documentType?: string;
    paymentStatus?: string;
    dueStatus?: string;
    from?: string;
    to?: string;
  }>;
};

export default async function CollectionsPage({ searchParams }: CollectionsPageProps) {
  await guardPageModule("cash-bank");

  const params = await searchParams;
  const token = await getAuthToken();

  if (!token) redirect("/login");

  const payload = verifyToken<AuthPayload>(token);

  if (!payload?.userId || !payload.companyId) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    include: {
      companyUsers: {
        include: { company: true },
      },
    },
  });

  if (!user) redirect("/login");

  const company =
    user.companyUsers.find((item) => item.companyId === payload.companyId)
      ?.company ?? user.companyUsers[0]?.company;

  if (!company) redirect("/login");

  const data = await getCollectionsPageData(company.id, {
    search: params.q,
    customerId: params.customerId,
    documentType: params.documentType,
    paymentStatus: params.paymentStatus,
    dueStatus: params.dueStatus,
    from: params.from,
    to: params.to,
  });

  return (
    <AppShell>
      <CollectionsPageClient
        items={data.items}
        summary={data.summary}
        accounts={data.accounts}
        customers={data.customers}
        initialFilters={{
          search: params.q,
          customerId: params.customerId,
          documentType: params.documentType,
          paymentStatus: params.paymentStatus,
          dueStatus: params.dueStatus,
          from: params.from,
          to: params.to,
        }}
      />
    </AppShell>
  );
}
