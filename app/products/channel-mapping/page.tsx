import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ChannelMappingCenter } from "@/components/products/channel-mapping-center";
import { getAppSession } from "@/lib/app-session";
import { isMarketplaceFeatureEnabled } from "@/lib/features/marketplace-feature";
import { canManageProducts } from "@/lib/permission-utils";
import { db } from "@/lib/prisma";

export default async function ProductChannelMappingPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string }>;
}) {
  if (!isMarketplaceFeatureEnabled()) {
    redirect("/products");
  }

  const session = await getAppSession();
  if (!canManageProducts(session.effectiveRole, session.companyUser.isOwner)) {
    redirect("/unauthorized");
  }

  const params = await searchParams;
  const initialChannel =
    params.channel === "HEPSIBURADA" ? "HEPSIBURADA" : "TRENDYOL";

  const marketplaceDb = db as typeof db & Record<string, any>;
  const [products, initialRows] = await Promise.all([
    db.product.findMany({
      where: { companyId: session.company.id, status: "ACTIVE" },
      select: { id: true, name: true, sku: true, barcode: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
    marketplaceDb.productChannelMapping.findMany({
      where: { companyId: session.company.id, channel: initialChannel },
      include: {
        product: {
          select: { id: true, name: true, sku: true, barcode: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 300,
    }),
  ]);

  return (
    <AppShell>
      <ChannelMappingCenter
        products={products}
        initialRows={initialRows}
        initialChannel={initialChannel}
      />
    </AppShell>
  );
}
