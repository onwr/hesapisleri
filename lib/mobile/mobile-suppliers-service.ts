import { getSuppliers } from "@/lib/supplier-service";
import { MobileFinanceError } from "./mobile-finance-errors";
import { resolveMobileFinancePermissions } from "./mobile-finance-permissions";

const PAGE_SIZE = 24;

export async function listMobileSuppliers(input: {
  companyId: string;
  role: string;
  isOwner: boolean;
  q?: string;
  cursor?: string;
}) {
  const permissions = resolveMobileFinancePermissions(input.role, input.isOwner);
  if (!permissions.suppliers.read) {
    throw new MobileFinanceError("FORBIDDEN", "Tedarikçi görüntüleme yetkiniz yok.", 403);
  }

  const suppliers = await getSuppliers({
    companyId: input.companyId,
    search: input.q,
    isActive: true,
    sort: "name",
  });

  const start = input.cursor ? suppliers.findIndex((s) => s.id === input.cursor) + 1 : 0;
  const slice = suppliers.slice(start, start + PAGE_SIZE + 1);
  const hasMore = slice.length > PAGE_SIZE;
  const page = hasMore ? slice.slice(0, PAGE_SIZE) : slice;

  return {
    permissions,
    items: page.map((s) => ({
      id: s.id,
      name: s.name || s.companyName || "Tedarikçi",
      phone: s.phone,
      ...(permissions.suppliers.viewBalance ? { balance: s.currentBalance } : {}),
    })),
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
  };
}
