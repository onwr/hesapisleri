import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ProductsFilters } from "@/components/products/products-filters";
import { ProductsSelectableTable } from "@/components/products/products-selectable-table";
import { ProductsShell } from "@/components/products/products-shell";
import { ProductsTablePagination } from "@/components/products/products-table-controls";
import { PRODUCT_CARD_CLASS } from "@/components/products/product-ui-tokens";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { resolveEffectiveRole } from "@/lib/permission-utils";
import {
  buildProductsExportQuery,
  getProductsPageData,
  parseProductsListOptions,
} from "@/lib/products-page-data";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

type ProductsPageProps = {
  searchParams: Promise<{
    tab?: string;
    page?: string;
    category?: string;
    q?: string;
    stock?: string;
    sort?: string;
  }>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const token = await getAuthToken();

  if (!token) redirect("/login");

  const payload = verifyToken<AuthPayload>(token);

  if (!payload?.userId || !payload.companyId) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    include: {
      companyUsers: {
        include: {
          company: true,
        },
      },
    },
  });

  if (!user) redirect("/login");

  const company =
    user.companyUsers.find((item) => item.companyId === payload.companyId)
      ?.company ?? user.companyUsers[0]?.company;

  if (!company) redirect("/login");

  const membership =
    user.companyUsers.find((item) => item.companyId === company.id) ??
    user.companyUsers[0];

  const effectiveRole = membership
    ? resolveEffectiveRole({
        role: membership.role,
        isOwner: membership.isOwner,
      })
    : "STAFF";

  const canSyncStock =
    Boolean(membership?.isOwner) ||
    effectiveRole === "OWNER" ||
    effectiveRole === "ADMIN";

  const listOptions = parseProductsListOptions(params);

  const {
    stats,
    rows,
    categories,
    totalRecords,
    totalPages,
    currentPage: page,
  } = await getProductsPageData(company.id, listOptions);

  const exportHref = buildProductsExportQuery(listOptions);

  const hasFilters = Boolean(
    listOptions.q ||
      listOptions.category ||
      listOptions.tab !== "all" ||
      listOptions.stock !== "all" ||
      listOptions.sort !== "recent"
  );

  return (
    <AppShell>
      <ProductsShell stats={stats} canSyncStock={canSyncStock}>
        <ProductsFilters
          activeTab={listOptions.tab}
          activeCategory={listOptions.category}
          searchQuery={listOptions.q}
          stockFilter={listOptions.stock}
          sortKey={listOptions.sort}
          categories={categories}
        />

        <section id="products-list" className={PRODUCT_CARD_CLASS}>
          <ProductsSelectableTable
            rows={rows}
            exportHref={exportHref}
            hasFilters={hasFilters}
          />

          <ProductsTablePagination
            activeTab={listOptions.tab}
            activeCategory={listOptions.category}
            searchQuery={listOptions.q}
            stockFilter={listOptions.stock}
            sortKey={listOptions.sort}
            totalPages={totalPages}
            currentPage={page}
            totalRecords={totalRecords}
          />
        </section>
      </ProductsShell>
    </AppShell>
  );
}
