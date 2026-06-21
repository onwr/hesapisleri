import { AppShell } from "@/components/layout/app-shell";
import { DirectoryPageClient } from "@/components/directory/directory-page-client";
import { guardPageModule } from "@/lib/module-access";
import { getDirectoryPageData } from "@/lib/directory-page-data";
import { canManageDirectory } from "@/lib/permission-utils";

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
  const session = await guardPageModule("directory");
  const company = session.company;
  const companyUser = session.companyUser;
  const effectiveRole = session.effectiveRole;
  const params = await searchParams;

  const pageData = await getDirectoryPageData({
    companyId: company.id,
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
