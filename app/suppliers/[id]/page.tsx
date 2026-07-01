import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { SupplierDetailClient } from "@/components/suppliers/supplier-detail-client";
import { guardPageModule } from "@/lib/module-access";
import { canManageSuppliers } from "@/lib/permission-utils";
import { toIsoString } from "@/lib/format-utils";
import {
  getCachedSupplierDetailData,
  getCachedSupplierLedgerData,
} from "@/lib/tenant-cache/cached-tenant-page-data";

type Props = { params: Promise<{ id: string }> };

export default async function SupplierDetailPage({ params }: Props) {
  const session = await guardPageModule("suppliers");
  const company = session.company;
  const companyUser = session.companyUser;
  const effectiveRole = session.effectiveRole;
  const { id } = await params;

  const [data, ledgerData] = await Promise.all([
    getCachedSupplierDetailData({ companyId: company.id, supplierId: id }),
    getCachedSupplierLedgerData({ companyId: company.id, supplierId: id }),
  ]);

  if (!data || !ledgerData) notFound();

  const { supplier, summary, expenses, payments, activityLogs } = data;
  const canManage = canManageSuppliers(effectiveRole, companyUser.isOwner);
  const canPay = canManage;
  const canCollect = canManage;

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
          updatedAt: toIsoString(supplier.updatedAt) ?? new Date(0).toISOString(),
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
          currentBalance: ledgerData.summary.signedBalance,
          payableAmount: ledgerData.summary.payableAmount,
          receivableAmount: ledgerData.summary.receivableAmount,
          directionLabel: ledgerData.summary.directionLabel,
          netStatusLabel: ledgerData.summary.netStatusLabel,
          unpaidTotal: summary.unpaidTotal,
          thisMonthPurchases: summary.thisMonthPurchases,
          productCount: summary.productCount,
          lastPayment: toIsoString(summary.lastPayment),
          lastMovementDate: ledgerData.summary.lastMovementDate,
          overduePayable: ledgerData.summary.overduePayable,
          totalPurchases: ledgerData.summary.totalPurchases,
        }}
        ledger={ledgerData.ledger}
        linkedCustomer={ledgerData.linkedCustomer}
        expenses={expenses.map((expense) => ({
          ...expense,
          date: toIsoString(expense.date) ?? new Date(0).toISOString(),
        }))}
        payments={payments.map((payment) => ({
          ...payment,
          date: toIsoString(payment.date) ?? new Date(0).toISOString(),
        }))}
        activityLogs={activityLogs.map((log) => ({
          id: log.id,
          action: log.action,
          message: log.message,
          createdAt: toIsoString(log.createdAt) ?? new Date(0).toISOString(),
        }))}
        canManage={canManage}
        canPay={canPay}
        canCollect={canCollect}
      />
    </AppShell>
  );
}
