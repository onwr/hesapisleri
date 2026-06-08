import { db } from "@/lib/prisma";
import {
  DEFAULT_CUSTOMER_GROUPS,
  DEFAULT_GROUP_NAME,
  getDefaultGroupColor,
  normalizeGroupName,
} from "@/lib/customer-group-utils";

type CustomerRecord = {
  group: string | null;
  balance: unknown;
  status: string;
};

type CustomerGroupNameRow = {
  name: string;
};

type CustomerGroupRecord = {
  id: string;
  name: string;
  color: string | null;
  note: string | null;
  sortOrder: number;
};

export type CustomerGroupStats = {
  customerCount: number;
  totalDebt: number;
  totalCredit: number;
  activeCustomerCount: number;
};

export type CustomerGroupWithStats = {
  id: string;
  name: string;
  color: string | null;
  note: string | null;
  sortOrder: number;
  customerCount: number;
  totalDebt: number;
  totalCredit: number;
  activeCustomerCount: number;
};

export function computeGroupStats(
  customers: CustomerRecord[],
  groupName: string
): CustomerGroupStats {
  const members = customers.filter(
    (customer) => normalizeGroupName(customer.group) === groupName
  );

  let totalDebt = 0;
  let totalCredit = 0;
  let activeCustomerCount = 0;

  for (const customer of members) {
    const balance = Number(customer.balance);

    if (balance > 0) {
      totalDebt += balance;
    } else if (balance < 0) {
      totalCredit += Math.abs(balance);
    }

    if (customer.status === "ACTIVE") {
      activeCustomerCount += 1;
    }
  }

  return {
    customerCount: members.length,
    totalDebt,
    totalCredit,
    activeCustomerCount,
  };
}

export async function ensureDefaultCustomerGroups(companyId: string) {
  await db.customerGroup.createMany({
    data: DEFAULT_CUSTOMER_GROUPS.map((group) => ({
      companyId,
      name: group.name,
      color: group.color,
      sortOrder: group.sortOrder,
    })),
    skipDuplicates: true,
  });
}

export async function syncOrphanCustomerGroups(companyId: string) {
  const [customers, groups] = await Promise.all([
    db.customer.findMany({
      where: { companyId },
      select: { group: true },
    }),
    db.customerGroup.findMany({
      where: { companyId },
      select: { name: true },
    }),
  ]);

  const existingNames = new Set(
    groups.map((group: CustomerGroupNameRow) => group.name)
  );
  const orphanNames = new Set<string>();

  for (const customer of customers) {
    const name = normalizeGroupName(customer.group);

    if (!existingNames.has(name)) {
      orphanNames.add(name);
    }
  }

  if (orphanNames.size === 0) {
    return;
  }

  await db.customerGroup.createMany({
    data: [...orphanNames].map((name, index) => ({
      companyId,
      name,
      color: getDefaultGroupColor(name),
      sortOrder: 100 + index,
    })),
    skipDuplicates: true,
  });
}

export async function prepareCustomerGroups(companyId: string) {
  await ensureDefaultCustomerGroups(companyId);
  await syncOrphanCustomerGroups(companyId);
}

export async function getCustomerGroupsWithStats(companyId: string) {
  await prepareCustomerGroups(companyId);

  const [groups, customers] = await Promise.all([
    db.customerGroup.findMany({
      where: { companyId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    db.customer.findMany({
      where: { companyId },
      select: {
        group: true,
        balance: true,
        status: true,
      },
    }),
  ]);

  return groups.map((group: CustomerGroupRecord) => {
    const stats = computeGroupStats(customers, group.name);

    return {
      id: group.id,
      name: group.name,
      color: group.color,
      note: group.note,
      sortOrder: group.sortOrder,
      ...stats,
    } satisfies CustomerGroupWithStats;
  });
}

export async function getCustomerGroupNames(companyId: string) {
  const groups = await getCustomerGroupsWithStats(companyId);
  return groups.map((group: CustomerGroupWithStats) => group.name);
}

export async function getCustomerGroupColorMap(companyId: string) {
  const groups = await getCustomerGroupsWithStats(companyId);

  return Object.fromEntries(
    groups.map((group: CustomerGroupWithStats) => [
      group.name,
      group.color ?? getDefaultGroupColor(group.name),
    ])
  );
}

export async function createCustomerGroup(
  companyId: string,
  input: { name: string; color?: string; note?: string }
) {
  const name = input.name.trim();

  if (!name) {
    throw new Error("Grup adı zorunludur.");
  }

  const existing = await db.customerGroup.findFirst({
    where: {
      companyId,
      name,
    },
  });

  if (existing) {
    throw new Error("Bu isimde bir grup zaten var.");
  }

  return db.customerGroup.create({
    data: {
      companyId,
      name,
      color: input.color || getDefaultGroupColor(name),
      note: input.note?.trim() || null,
      sortOrder: 100,
    },
  });
}

export async function updateCustomerGroup(
  companyId: string,
  groupId: string,
  input: { name?: string; color?: string; note?: string | null }
) {
  const group = await db.customerGroup.findFirst({
    where: {
      id: groupId,
      companyId,
    },
  });

  if (!group) {
    throw new Error("Grup bulunamadı.");
  }

  const nextName = input.name?.trim();
  const nextColor = input.color?.trim();
  const nextNote =
    input.note === undefined ? undefined : input.note?.trim() || null;

  if (nextName && nextName !== group.name) {
    const duplicate = await db.customerGroup.findFirst({
      where: {
        companyId,
        name: nextName,
        NOT: { id: group.id },
      },
    });

    if (duplicate) {
      throw new Error("Bu isimde bir grup zaten var.");
    }
  }

  return db.$transaction(async (tx) => {
    if (nextName && nextName !== group.name) {
      await tx.customer.updateMany({
        where: {
          companyId,
          group: group.name,
        },
        data: {
          group: nextName,
        },
      });
    }

    return tx.customerGroup.update({
      where: { id: group.id },
      data: {
        ...(nextName ? { name: nextName } : {}),
        ...(nextColor ? { color: nextColor } : {}),
        ...(nextNote !== undefined ? { note: nextNote } : {}),
      },
    });
  });
}

export async function deleteCustomerGroup(companyId: string, groupId: string) {
  const group = await db.customerGroup.findFirst({
    where: {
      id: groupId,
      companyId,
    },
  });

  if (!group) {
    throw new Error("Grup bulunamadı.");
  }

  if (group.name === DEFAULT_GROUP_NAME) {
    throw new Error("Genel grubu silinemez.");
  }

  await db.$transaction(async (tx) => {
    await tx.customer.updateMany({
      where: {
        companyId,
        group: group.name,
      },
      data: {
        group: DEFAULT_GROUP_NAME,
      },
    });

    await tx.customerGroup.delete({
      where: { id: group.id },
    });
  });
}

export function summarizeGroupsPage(customers: CustomerRecord[]) {
  let totalDebt = 0;
  let totalCredit = 0;
  let debtorCount = 0;

  for (const customer of customers) {
    const balance = Number(customer.balance);

    if (balance > 0) {
      totalDebt += balance;
      debtorCount += 1;
    } else if (balance < 0) {
      totalCredit += Math.abs(balance);
    }
  }

  return {
    totalCustomers: customers.length,
    debtorCount,
    totalDebt,
    totalCredit,
  };
}
