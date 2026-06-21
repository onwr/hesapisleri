import type {
  DirectoryContactType,
  DirectorySourceType,
  Prisma,
} from "@prisma/client";
import { db } from "@/lib/prisma";
import {
  isManualDirectoryContact,
  matchesDirectorySearch,
  normalizeDirectoryTags,
  parseDirectorySort,
  type DirectoryContactRow,
  type DirectorySortOption,
  validateDirectoryContactInput,
} from "@/lib/directory-utils";

export class DirectoryServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "DirectoryServiceError";
    this.status = status;
  }
}

export type DirectoryContactInput = {
  type?: DirectoryContactType;
  name?: string;
  companyName?: string | null;
  title?: string | null;
  department?: string | null;
  phone?: string | null;
  mobilePhone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  district?: string | null;
  taxNumber?: string | null;
  notes?: string | null;
  tags?: string[];
  isFavorite?: boolean;
  isActive?: boolean;
};

export type DirectorySyncResult = {
  created: number;
  updated: number;
  skipped: number;
};

export type DirectorySummary = {
  total: number;
  favorites: number;
  customers: number;
  employees: number;
  suppliers: number;
  manual: number;
  missingInfo: number;
};

function serializeDirectoryContact(
  contact: Prisma.DirectoryContactGetPayload<object>
): DirectoryContactRow {
  return {
    id: contact.id,
    type: contact.type,
    sourceType: contact.sourceType,
    sourceId: contact.sourceId,
    name: contact.name,
    companyName: contact.companyName,
    title: contact.title,
    department: contact.department,
    phone: contact.phone,
    mobilePhone: contact.mobilePhone,
    email: contact.email,
    website: contact.website,
    address: contact.address,
    city: contact.city,
    district: contact.district,
    taxNumber: contact.taxNumber,
    notes: contact.notes,
    tags: contact.tags,
    isFavorite: contact.isFavorite,
    isActive: contact.isActive,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
  };
}

function buildDirectoryOrderBy(sort: DirectorySortOption) {
  if (sort === "name_desc") {
    return [{ name: "desc" as const }, { companyName: "asc" as const }];
  }
  if (sort === "favorite_first") {
    return [
      { isFavorite: "desc" as const },
      { name: "asc" as const },
      { companyName: "asc" as const },
    ];
  }
  if (sort === "updated_desc") {
    return [{ updatedAt: "desc" as const }];
  }
  return [{ name: "asc" as const }, { companyName: "asc" as const }];
}

function buildDirectoryWhere(input: {
  companyId: string;
  search?: string;
  type?: DirectoryContactType | "ALL";
  sourceType?: DirectorySourceType | "ALL";
  tag?: string;
  isFavorite?: boolean;
  isActive?: boolean;
}): Prisma.DirectoryContactWhereInput {
  const where: Prisma.DirectoryContactWhereInput = {
    companyId: input.companyId,
  };

  if (input.type && input.type !== "ALL") {
    where.type = input.type;
  }

  if (input.sourceType && input.sourceType !== "ALL") {
    where.sourceType = input.sourceType;
  }

  if (typeof input.isFavorite === "boolean") {
    where.isFavorite = input.isFavorite;
  }

  if (typeof input.isActive === "boolean") {
    where.isActive = input.isActive;
  }

  if (input.tag?.trim()) {
    where.tags = { has: input.tag.trim() };
  }

  return where;
}

function normalizeOptionalString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function buildManualContactData(input: DirectoryContactInput) {
  return {
    type: input.type ?? "PERSON",
    name: input.name?.trim() ?? "",
    companyName: normalizeOptionalString(input.companyName),
    title: normalizeOptionalString(input.title),
    department: normalizeOptionalString(input.department),
    phone: normalizeOptionalString(input.phone),
    mobilePhone: normalizeOptionalString(input.mobilePhone),
    email: normalizeOptionalString(input.email),
    website: normalizeOptionalString(input.website),
    address: normalizeOptionalString(input.address),
    city: normalizeOptionalString(input.city),
    district: normalizeOptionalString(input.district),
    taxNumber: normalizeOptionalString(input.taxNumber),
    notes: normalizeOptionalString(input.notes),
    tags: normalizeDirectoryTags(input.tags),
    isFavorite: input.isFavorite ?? false,
    isActive: input.isActive ?? true,
  };
}

export async function getDirectoryContacts(input: {
  companyId: string;
  search?: string;
  type?: DirectoryContactType | "ALL";
  sourceType?: DirectorySourceType | "ALL";
  tag?: string;
  isFavorite?: boolean;
  isActive?: boolean;
  sort?: string;
}) {
  const sort = parseDirectorySort(input.sort);
  const where = buildDirectoryWhere(input);

  const contacts = await db.directoryContact.findMany({
    where,
    orderBy: buildDirectoryOrderBy(sort),
  });

  const rows = contacts.map(serializeDirectoryContact);

  if (!input.search?.trim()) {
    return rows;
  }

  return rows.filter((contact) =>
    matchesDirectorySearch(contact, input.search)
  );
}

export async function getDirectoryContactById(input: {
  companyId: string;
  id: string;
}) {
  const contact = await db.directoryContact.findFirst({
    where: {
      id: input.id,
      companyId: input.companyId,
    },
  });

  if (!contact) {
    throw new DirectoryServiceError("Fihrist kaydı bulunamadı.", 404);
  }

  return serializeDirectoryContact(contact);
}

export async function getDirectorySummary(companyId: string): Promise<DirectorySummary> {
  const [
    total,
    favorites,
    customers,
    employees,
    suppliers,
    manual,
    missingInfo,
  ] = await Promise.all([
    db.directoryContact.count({ where: { companyId, isActive: true } }),
    db.directoryContact.count({
      where: { companyId, isActive: true, isFavorite: true },
    }),
    db.directoryContact.count({
      where: { companyId, isActive: true, type: "CUSTOMER" },
    }),
    db.directoryContact.count({
      where: { companyId, isActive: true, type: "EMPLOYEE" },
    }),
    db.directoryContact.count({
      where: { companyId, isActive: true, type: "SUPPLIER" },
    }),
    db.directoryContact.count({
      where: {
        companyId,
        isActive: true,
        OR: [{ sourceType: "MANUAL" }, { sourceType: null }],
      },
    }),
    db.directoryContact.count({
      where: {
        companyId,
        isActive: true,
        AND: [
          { OR: [{ phone: null }, { phone: "" }] },
          { OR: [{ mobilePhone: null }, { mobilePhone: "" }] },
          { OR: [{ email: null }, { email: "" }] },
        ],
      },
    }),
  ]);

  return {
    total,
    favorites,
    customers,
    employees,
    suppliers,
    manual,
    missingInfo,
  };
}

export async function getDirectoryTags(companyId: string) {
  const contacts = await db.directoryContact.findMany({
    where: { companyId, isActive: true },
    select: { tags: true },
  });

  const tagSet = new Set<string>();
  for (const contact of contacts) {
    for (const tag of contact.tags) {
      if (tag.trim()) tagSet.add(tag.trim());
    }
  }

  return [...tagSet].sort((a, b) => a.localeCompare(b, "tr"));
}

export async function createDirectoryContact(input: {
  companyId: string;
  createdByUserId?: string;
  data: DirectoryContactInput;
}) {
  const validation = validateDirectoryContactInput(input.data);
  if (!validation.ok) {
    throw new DirectoryServiceError(validation.message, 400);
  }

  const payload = buildManualContactData(input.data);

  const contact = await db.directoryContact.create({
    data: {
      companyId: input.companyId,
      sourceType: "MANUAL",
      sourceId: null,
      createdByUserId: input.createdByUserId,
      ...payload,
    },
  });

  return serializeDirectoryContact(contact);
}

export async function updateDirectoryContact(input: {
  companyId: string;
  id: string;
  data: DirectoryContactInput;
}) {
  const existing = await db.directoryContact.findFirst({
    where: { id: input.id, companyId: input.companyId },
  });

  if (!existing) {
    throw new DirectoryServiceError("Fihrist kaydı bulunamadı.", 404);
  }

  if (!isManualDirectoryContact(existing.sourceType)) {
    throw new DirectoryServiceError(
      "Senkron kaynaklı fihrist kayıtları düzenlenemez.",
      403
    );
  }

  const merged = {
    name: input.data.name ?? existing.name,
    companyName:
      input.data.companyName !== undefined
        ? input.data.companyName
        : existing.companyName,
    email: input.data.email !== undefined ? input.data.email : existing.email,
    website:
      input.data.website !== undefined ? input.data.website : existing.website,
  };

  const validation = validateDirectoryContactInput(merged);
  if (!validation.ok) {
    throw new DirectoryServiceError(validation.message, 400);
  }

  const payload = buildManualContactData({
    type: input.data.type ?? existing.type,
    name: merged.name,
    companyName: merged.companyName,
    title:
      input.data.title !== undefined ? input.data.title : existing.title,
    department:
      input.data.department !== undefined
        ? input.data.department
        : existing.department,
    phone: input.data.phone !== undefined ? input.data.phone : existing.phone,
    mobilePhone:
      input.data.mobilePhone !== undefined
        ? input.data.mobilePhone
        : existing.mobilePhone,
    email: merged.email,
    website: merged.website,
    address:
      input.data.address !== undefined ? input.data.address : existing.address,
    city: input.data.city !== undefined ? input.data.city : existing.city,
    district:
      input.data.district !== undefined
        ? input.data.district
        : existing.district,
    taxNumber:
      input.data.taxNumber !== undefined
        ? input.data.taxNumber
        : existing.taxNumber,
    notes: input.data.notes !== undefined ? input.data.notes : existing.notes,
    tags: input.data.tags ?? existing.tags,
    isFavorite:
      input.data.isFavorite !== undefined
        ? input.data.isFavorite
        : existing.isFavorite,
    isActive:
      input.data.isActive !== undefined
        ? input.data.isActive
        : existing.isActive,
  });

  const contact = await db.directoryContact.update({
    where: { id: existing.id },
    data: payload,
  });

  return serializeDirectoryContact(contact);
}

export async function deleteDirectoryContact(input: {
  companyId: string;
  id: string;
}) {
  const existing = await db.directoryContact.findFirst({
    where: { id: input.id, companyId: input.companyId },
  });

  if (!existing) {
    throw new DirectoryServiceError("Fihrist kaydı bulunamadı.", 404);
  }

  const contact = await db.directoryContact.update({
    where: { id: existing.id },
    data: { isActive: false },
  });

  return serializeDirectoryContact(contact);
}

export async function permanentlyDeleteDirectoryContact(input: {
  companyId: string;
  id: string;
}) {
  const existing = await db.directoryContact.findFirst({
    where: { id: input.id, companyId: input.companyId },
  });

  if (!existing) {
    throw new DirectoryServiceError("Fihrist kaydı bulunamadı.", 404);
  }

  await db.directoryContact.delete({
    where: { id: existing.id },
  });

  return { id: existing.id };
}

export async function toggleFavoriteDirectoryContact(input: {
  companyId: string;
  id: string;
}) {
  const existing = await db.directoryContact.findFirst({
    where: { id: input.id, companyId: input.companyId },
  });

  if (!existing) {
    throw new DirectoryServiceError("Fihrist kaydı bulunamadı.", 404);
  }

  const contact = await db.directoryContact.update({
    where: { id: existing.id },
    data: { isFavorite: !existing.isFavorite },
  });

  return serializeDirectoryContact(contact);
}

type DirectorySyncPayload = {
  type: DirectoryContactType;
  name: string;
  companyName: string | null;
  title?: string | null;
  department?: string | null;
  phone: string | null;
  email: string | null;
  taxNumber?: string | null;
  address?: string | null;
  isActive: boolean;
};

function directorySyncFieldsEqual(
  existing: Prisma.DirectoryContactGetPayload<object>,
  data: DirectorySyncPayload
) {
  return (
    existing.type === data.type &&
    existing.name === data.name &&
    existing.companyName === data.companyName &&
    existing.title === (data.title ?? null) &&
    existing.department === (data.department ?? null) &&
    existing.phone === data.phone &&
    existing.email === data.email &&
    existing.taxNumber === (data.taxNumber ?? null) &&
    existing.address === (data.address ?? null) &&
    existing.isActive === data.isActive
  );
}

async function upsertDirectorySyncEntry(input: {
  companyId: string;
  sourceType: "CUSTOMER" | "EMPLOYEE" | "SUPPLIER";
  sourceId: string;
  data: DirectorySyncPayload;
}): Promise<"created" | "updated" | "skipped"> {
  const existing = await db.directoryContact.findUnique({
    where: {
      companyId_sourceType_sourceId: {
        companyId: input.companyId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      },
    },
  });

  if (!existing) {
    await db.directoryContact.create({
      data: {
        companyId: input.companyId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        ...input.data,
      },
    });
    return "created";
  }

  if (directorySyncFieldsEqual(existing, input.data)) {
    return "skipped";
  }

  await db.directoryContact.update({
    where: { id: existing.id },
    data: input.data,
  });
  return "updated";
}

export async function syncDirectoryFromCustomer(input: {
  companyId: string;
}): Promise<DirectorySyncResult> {
  const customers = await db.customer.findMany({
    where: { companyId: input.companyId },
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const customer of customers) {
    const name = customer.name.trim();
    if (!name) {
      skipped += 1;
      continue;
    }

    const data: DirectorySyncPayload = {
      type: "CUSTOMER",
      name,
      companyName: null,
      phone: customer.phone,
      email: customer.email,
      taxNumber: customer.taxNo,
      address: customer.address,
      isActive: customer.status === "ACTIVE",
    };

    const result = await upsertDirectorySyncEntry({
      companyId: input.companyId,
      sourceType: "CUSTOMER",
      sourceId: customer.id,
      data,
    });

    if (result === "created") created += 1;
    else if (result === "updated") updated += 1;
    else skipped += 1;
  }

  return { created, updated, skipped };
}

export async function syncDirectoryFromEmployee(input: {
  companyId: string;
}): Promise<DirectorySyncResult> {
  const employees = await db.employee.findMany({
    where: { companyId: input.companyId },
    include: {
      departmentRef: true,
    },
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const employee of employees) {
    const name = `${employee.firstName} ${employee.lastName}`.trim();
    if (!name) {
      skipped += 1;
      continue;
    }

    const department =
      employee.departmentRef?.name ?? employee.department ?? null;

    const data: DirectorySyncPayload = {
      type: "EMPLOYEE",
      name,
      companyName: null,
      title: employee.jobTitle,
      department,
      phone: employee.phone,
      email: employee.email,
      address: employee.address,
      isActive: employee.status === "ACTIVE",
    };

    const result = await upsertDirectorySyncEntry({
      companyId: input.companyId,
      sourceType: "EMPLOYEE",
      sourceId: employee.id,
      data,
    });

    if (result === "created") created += 1;
    else if (result === "updated") updated += 1;
    else skipped += 1;
  }

  return { created, updated, skipped };
}

export async function syncDirectoryFromSupplier(input: {
  companyId: string;
}): Promise<DirectorySyncResult> {
  const suppliers = await db.supplier.findMany({
    where: { companyId: input.companyId },
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const supplier of suppliers) {
    const name = supplier.name.trim();
    if (!name) {
      skipped += 1;
      continue;
    }

    const data: DirectorySyncPayload = {
      type: "SUPPLIER",
      name,
      companyName: supplier.companyName,
      title: supplier.contactName,
      phone: supplier.phone ?? supplier.mobilePhone,
      email: supplier.email,
      taxNumber: supplier.taxNumber,
      address: [supplier.city, supplier.district, supplier.address]
        .filter(Boolean)
        .join(", ") || supplier.address,
      isActive: supplier.isActive,
    };

    const result = await upsertDirectorySyncEntry({
      companyId: input.companyId,
      sourceType: "SUPPLIER",
      sourceId: supplier.id,
      data,
    });

    if (result === "created") created += 1;
    else if (result === "updated") updated += 1;
    else skipped += 1;
  }

  return { created, updated, skipped };
}

export async function getDirectoryExportRows(input: {
  companyId: string;
  search?: string;
  type?: DirectoryContactType | "ALL";
  sourceType?: DirectorySourceType | "ALL";
  tag?: string;
  isFavorite?: boolean;
  isActive?: boolean;
  sort?: string;
}) {
  return getDirectoryContacts(input);
}
