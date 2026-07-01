import { db } from "@/lib/prisma";
import { getSupplierDisplayName } from "@/lib/supplier-utils";
import {
  syncDirectoryFromCustomer,
  syncDirectoryFromSupplier,
} from "@/lib/directory-service";

export class SupplierCustomerRoleError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "SupplierCustomerRoleError";
    this.status = status;
  }
}

export type SupplierCustomerMatch = {
  customerId: string;
  name: string;
  phone: string | null;
  email: string | null;
  taxNo: string | null;
  matchReason: string;
  confidence: "exact" | "directory";
};

function normalizeMatchValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

export async function findSupplierCustomerMatches(
  companyId: string,
  supplierId: string
): Promise<SupplierCustomerMatch[]> {
  const supplier = await db.supplier.findFirst({
    where: { id: supplierId, companyId },
    select: {
      id: true,
      name: true,
      phone: true,
      mobilePhone: true,
      email: true,
      taxNumber: true,
      linkedCustomerId: true,
    },
  });

  if (!supplier) {
    throw new SupplierCustomerRoleError("Tedarikçi bulunamadı.", 404);
  }

  if (supplier.linkedCustomerId) {
    return [];
  }

  const matches = new Map<string, SupplierCustomerMatch>();

  const directoryLink = await db.directoryContact.findFirst({
    where: {
      companyId,
      sourceType: "SUPPLIER",
      sourceId: supplierId,
    },
    select: { id: true },
  });

  if (directoryLink) {
    const customerDirectory = await db.directoryContact.findFirst({
      where: {
        companyId,
        sourceType: "CUSTOMER",
        OR: [
          { taxNumber: supplier.taxNumber ?? undefined },
          { email: supplier.email ?? undefined },
          { phone: supplier.phone ?? undefined },
          { mobilePhone: supplier.mobilePhone ?? undefined },
        ].filter((clause) => Object.values(clause)[0]),
      },
    });

    if (customerDirectory?.sourceId) {
      const customer = await db.customer.findFirst({
        where: { id: customerDirectory.sourceId, companyId },
        select: { id: true, name: true, phone: true, email: true, taxNo: true },
      });
      if (customer) {
        matches.set(customer.id, {
          customerId: customer.id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          taxNo: customer.taxNo,
          matchReason: "Fihrist kaydı",
          confidence: "directory",
        });
      }
    }
  }

  const customers = await db.customer.findMany({
    where: { companyId },
    select: { id: true, name: true, phone: true, email: true, taxNo: true },
    take: 500,
  });

  for (const customer of customers) {
    if (matches.has(customer.id)) continue;

    const taxMatch =
      supplier.taxNumber &&
      customer.taxNo &&
      normalizeMatchValue(supplier.taxNumber) === normalizeMatchValue(customer.taxNo);

    const emailMatch =
      supplier.email &&
      customer.email &&
      normalizeMatchValue(supplier.email) === normalizeMatchValue(customer.email);

    const phoneMatch =
      (supplier.phone &&
        customer.phone &&
        normalizeMatchValue(supplier.phone) === normalizeMatchValue(customer.phone)) ||
      (supplier.mobilePhone &&
        customer.phone &&
        normalizeMatchValue(supplier.mobilePhone) === normalizeMatchValue(customer.phone));

    if (taxMatch) {
      matches.set(customer.id, {
        customerId: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        taxNo: customer.taxNo,
        matchReason: "Vergi numarası",
        confidence: "exact",
      });
    } else if (emailMatch) {
      matches.set(customer.id, {
        customerId: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        taxNo: customer.taxNo,
        matchReason: "E-posta",
        confidence: "exact",
      });
    } else if (phoneMatch) {
      matches.set(customer.id, {
        customerId: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        taxNo: customer.taxNo,
        matchReason: "Telefon",
        confidence: "exact",
      });
    }
  }

  return Array.from(matches.values());
}

export async function linkSupplierToCustomer(input: {
  companyId: string;
  supplierId: string;
  customerId: string;
  userId: string;
}) {
  const [supplier, customer] = await Promise.all([
    db.supplier.findFirst({
      where: { id: input.supplierId, companyId: input.companyId },
    }),
    db.customer.findFirst({
      where: { id: input.customerId, companyId: input.companyId },
    }),
  ]);

  if (!supplier) {
    throw new SupplierCustomerRoleError("Tedarikçi bulunamadı.", 404);
  }

  if (!customer) {
    throw new SupplierCustomerRoleError("Müşteri bulunamadı.", 404);
  }

  if (supplier.linkedCustomerId) {
    throw new SupplierCustomerRoleError("Bu tedarikçi zaten bir müşteri rolüne bağlı.");
  }

  const customerAlreadyLinked = await db.supplier.findFirst({
    where: {
      companyId: input.companyId,
      linkedCustomerId: input.customerId,
      NOT: { id: supplier.id },
    },
    select: { id: true },
  });

  if (customerAlreadyLinked) {
    throw new SupplierCustomerRoleError(
      "Bu müşteri başka bir tedarikçiye zaten bağlı.",
      409
    );
  }

  const updated = await db.supplier.update({
    where: { id: supplier.id },
    data: { linkedCustomerId: customer.id },
  });

  await db.activityLog.create({
    data: {
      companyId: input.companyId,
      userId: input.userId,
      action: "LINK_CUSTOMER",
      module: "suppliers",
      message: `${getSupplierDisplayName(supplier)} tedarikçisi ${customer.name} müşteri rolüne bağlandı.`,
    },
  });

  return updated;
}

export async function createCustomerRoleForSupplier(input: {
  companyId: string;
  supplierId: string;
  userId: string;
}) {
  const supplier = await db.supplier.findFirst({
    where: { id: input.supplierId, companyId: input.companyId },
  });

  if (!supplier) {
    throw new SupplierCustomerRoleError("Tedarikçi bulunamadı.", 404);
  }

  if (supplier.linkedCustomerId) {
    throw new SupplierCustomerRoleError("Bu tedarikçi zaten bir müşteri rolüne bağlı.");
  }

  const customer = await db.$transaction(async (tx) => {
    const created = await tx.customer.create({
      data: {
        companyId: input.companyId,
        name: getSupplierDisplayName(supplier),
        phone: supplier.phone ?? supplier.mobilePhone,
        email: supplier.email,
        taxNo: supplier.taxNumber,
        taxOffice: supplier.taxOffice,
        address: supplier.address,
        status: "ACTIVE",
      },
    });

    await tx.supplier.update({
      where: { id: supplier.id },
      data: { linkedCustomerId: created.id },
    });

    await tx.activityLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        action: "CREATE_CUSTOMER_ROLE",
        module: "suppliers",
        message: `${getSupplierDisplayName(supplier)} için müşteri rolü oluşturuldu.`,
      },
    });

    return created;
  });

  try {
    await syncDirectoryFromCustomer({ companyId: input.companyId });
    await syncDirectoryFromSupplier({ companyId: input.companyId });
  } catch {
    // directory sync is best-effort
  }

  return customer;
}
