import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { SupplierDetailClient } from "@/components/suppliers/supplier-detail-client";
import { guardPageModule } from "@/lib/module-access";
import { canManageSuppliers } from "@/lib/permission-utils";
import { getSupplierDetailData } from "@/lib/supplier-detail-data";

type Props = { params: Promise<{ id: string }> };

export default async function SupplierDetailPage({ params }: Props) {
  const session = await guardPageModule("suppliers");
  const company = session.company;
  const companyUser = session.companyUser;
  const effectiveRole = session.effectiveRole;
  const { id } = await params;

  const data = await getSupplierDetailData(company.id, id);
  if (!data) notFound();

  const { supplier, summary, expenses, payments, activityLogs } = data;

  return (
    <AppShell>
      <SupplierDetailClient
        supplier={{
          id: supplier.id,
          code: supplier.code,
          name: supplier.name,
          companyName: supplier.companyName,
          contactName: supplier.contactName,
          phone: supplier.phone,
          mobilePhone: supplier.mobilePhone,
          email: supplier.email,
          website: supplier.website,
          taxOffice: supplier.taxOffice,
          taxNumber: supplier.taxNumber,
          iban: supplier.iban,
          address: supplier.address,
          city: supplier.city,
          district: supplier.district,
          country: supplier.country,
          category: supplier.category,
          tags: supplier.tags,
          notes: supplier.notes,
          openingBalance: Number(supplier.openingBalance),
          currentBalance: Number(supplier.currentBalance),
          currency: supplier.currency,
          paymentTermDays: supplier.paymentTermDays,
          isFavorite: supplier.isFavorite,
          isActive: supplier.isActive,
          updatedAt: supplier.updatedAt.toISOString(),
          contacts: supplier.contacts.map((contact) => ({
            id: contact.id,
            name: contact.name,
            title: contact.title,
            phone: contact.phone,
            email: contact.email,
            notes: contact.notes,
            isPrimary: contact.isPrimary,
            isActive: contact.isActive,
          })),
          supplierProducts: supplier.supplierProducts.map((item) => ({
            id: item.id,
            supplierSku: item.supplierSku,
            supplierBarcode: item.supplierBarcode,
            purchasePrice: item.purchasePrice ? Number(item.purchasePrice) : null,
            currency: item.currency,
            minOrderQuantity: item.minOrderQuantity,
            leadTimeDays: item.leadTimeDays,
            isPreferred: item.isPreferred,
            notes: item.notes,
            product: {
              id: item.product.id,
              name: item.product.name,
              sku: item.product.sku,
              buyPrice: item.product.buyPrice ? Number(item.product.buyPrice) : null,
            },
          })),
        }}
        summary={{
          ...summary,
          lastPayment: summary.lastPayment?.toISOString() ?? null,
        }}
        expenses={expenses.map((expense) => ({
          ...expense,
          date: expense.date.toISOString(),
        }))}
        payments={payments.map((payment) => ({
          ...payment,
          date: payment.date.toISOString(),
        }))}
        activityLogs={activityLogs.map((log) => ({
          id: log.id,
          action: log.action,
          message: log.message,
          createdAt: log.createdAt.toISOString(),
        }))}
        canManage={canManageSuppliers(effectiveRole, companyUser.isOwner)}
      />
    </AppShell>
  );
}
