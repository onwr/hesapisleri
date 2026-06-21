import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { TenantNotFoundError } from "./tenant-errors";

type DbClient = Prisma.TransactionClient | typeof db;

export async function assertTenantCustomer(
  client: DbClient,
  companyId: string,
  customerId: string
) {
  const customer = await client.customer.findFirst({
    where: { id: customerId, companyId },
    select: { id: true },
  });

  if (!customer) {
    throw new TenantNotFoundError("Müşteri bulunamadı.");
  }

  return customer;
}

export async function assertOptionalTenantCustomer(
  client: DbClient,
  companyId: string,
  customerId: string | null | undefined
) {
  if (!customerId) {
    return null;
  }

  return assertTenantCustomer(client, companyId, customerId);
}

export async function assertTenantProduct(
  client: DbClient,
  companyId: string,
  productId: string
) {
  const product = await client.product.findFirst({
    where: { id: productId, companyId },
    select: { id: true },
  });

  if (!product) {
    throw new TenantNotFoundError("Ürün bulunamadı.");
  }

  return product;
}

export async function assertTenantAccount(
  client: DbClient,
  companyId: string,
  accountId: string
) {
  const account = await client.account.findFirst({
    where: { id: accountId, companyId },
    select: { id: true },
  });

  if (!account) {
    throw new TenantNotFoundError("Hesap bulunamadı.");
  }

  return account;
}

export async function assertTenantWarehouse(
  client: DbClient,
  companyId: string,
  warehouseId: string
) {
  const warehouse = await client.warehouse.findFirst({
    where: { id: warehouseId, companyId },
    select: { id: true },
  });

  if (!warehouse) {
    throw new TenantNotFoundError("Depo bulunamadı.");
  }

  return warehouse;
}
