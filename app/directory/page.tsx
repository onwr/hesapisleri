import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { DirectoryPageClient } from "@/components/directory/directory-page-client";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { getDirectoryPageData } from "@/lib/directory-page-data";
import { db } from "@/lib/prisma";
import {
  canManageDirectory,
  resolveEffectiveRole,
} from "@/lib/permission-utils";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

type DirectoryPageProps = {
  searchParams: Promise<{
    q?: string;
    type?: string;
    sourceType?: string;
    tag?: string;
    favorite?: string;
    status?: string;
    sort?: string;
  }>;
};

export default async function DirectoryPage({ searchParams }: DirectoryPageProps) {
  const params = await searchParams;
  const token = await getAuthToken();

  if (!token) redirect("/login");

  const payload = verifyToken<AuthPayload>(token);

  if (!payload?.userId || !payload.companyId) redirect("/login");

  const companyUser = await db.companyUser.findFirst({
    where: {
      userId: payload.userId,
      companyId: payload.companyId,
      status: "ACTIVE",
    },
  });

  if (!companyUser) redirect("/login");

  const effectiveRole = resolveEffectiveRole({
    role: companyUser.role,
    isOwner: companyUser.isOwner,
  });

  const pageData = await getDirectoryPageData({
    companyId: payload.companyId,
    search: params.q,
    type: params.type,
    sourceType: params.sourceType,
    tag: params.tag,
    favorite: params.favorite,
    status: params.status ?? "active",
    sort: params.sort,
  });

  return (
    <AppShell>
      <DirectoryPageClient
        contacts={pageData.contacts}
        summary={pageData.summary}
        tags={pageData.tags}
        canManage={canManageDirectory(effectiveRole, companyUser.isOwner)}
        initialFilters={pageData.filters}
      />
    </AppShell>
  );
}
