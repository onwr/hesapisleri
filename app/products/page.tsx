import { AppShell } from "@/components/layout/app-shell";
import { guardPageModule } from "@/lib/module-access";

import { ProductsFilters } from "@/components/products/products-filters";
import { ProductsSelectableTable } from "@/components/products/products-selectable-table";
import { ProductsShell } from "@/components/products/products-shell";
import { ProductsTablePagination } from "@/components/products/products-table-controls";
import { PRODUCT_CARD_CLASS } from "@/components/products/product-ui-tokens";
import { resolveEffectiveRole, canAccessModule, canManageProducts, canManageWarehouses } from "@/lib/permission-utils";
import {
  buildProductsExportQuery,
  getProductsPageData,
  parseProductsListOptions,
} from "@/lib/products-page-data";

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
  const session = await guardPageModule("products");
  const company = session.company;
  const params = await searchParams;
  const membership = session.companyUser;
  const effectiveRole = session.effectiveRole;


  const canSyncStock =
    Boolean(membership?.isOwner) ||
    effectiveRole === "OWNER" ||
    effectiveRole === "ADMIN";

  const isOwner = Boolean(membership?.isOwner);
  const permissions = {
    canCreateProduct: canManageProducts(effectiveRole, isOwner),
    canManageStocks: canAccessModule(effectiveRole, "stocks", isOwner),
    canManageWarehouses: canManageWarehouses(effectiveRole, isOwner),
    canManageProducts: canManageProducts(effectiveRole, isOwner),
  };

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
      <ProductsShell stats={stats} canSyncStock={canSyncStock} permissions={permissions}>
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
