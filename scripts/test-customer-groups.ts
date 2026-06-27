import { db } from "../lib/prisma";
import {
  createCustomerGroup,
  deleteCustomerGroup,
  getCustomerGroupsWithStats,
  updateCustomerGroup,
} from "../lib/customer-group-service";
import {
  DEFAULT_GROUP_NAME,
  normalizeGroupName,
} from "../lib/customer-group-utils";
import { normalizeCustomerInput } from "../lib/customer-form-utils";

const TEST_COMPANY_NAME = "TEST_CUSTOMER_GROUPS_COMPANY";
const TEST_USER_EMAIL = "test-customer-groups@hesapisleri.local";

function assertEqual(label: string, actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(`${label}: beklenen ${expected}, gelen ${actual}`);
  }
}

function assertTrue(label: string, value: boolean) {
  if (!value) {
    throw new Error(`${label}: koşul sağlanmadı`);
  }
}

async function cleanup() {
  await db.company.deleteMany({
    where: { name: TEST_COMPANY_NAME },
  });

  await db.user.deleteMany({
    where: { email: TEST_USER_EMAIL },
  });
}

async function setup() {
  await cleanup();

  const company = await db.company.create({
    data: {
      name: TEST_COMPANY_NAME,
      status: "ACTIVE",
    },
  });

  const user = await db.user.create({
    data: {
      name: "Test Groups User",
      email: TEST_USER_EMAIL,
      password: "test-password-hash",
      role: "OWNER",
      status: "ACTIVE",
    },
  });

  await db.companyUser.create({
    data: {
      companyId: company.id,
      userId: user.id,
      role: "OWNER",
      isOwner: true,
      status: "ACTIVE",
    },
  });

  return { companyId: company.id, userId: user.id };
}

async function main() {
  console.log("Müşteri grupları testleri başlıyor...\n");

  const ctx = await setup();

  try {
    await createCustomerGroup(ctx.companyId, {
      name: "Bayi",
      color: "orange",
    });

    try {
      await createCustomerGroup(ctx.companyId, { name: "Bayi" });
      throw new Error("Duplicate grup oluşturulmamalıydı.");
    } catch (error) {
      assertTrue(
        "Duplicate grup engellendi",
        error instanceof Error && error.message.includes("zaten var")
      );
    }

    console.log("✅ Yeni grup oluşturma ve duplicate engeli geçti");

    const normalized = normalizeCustomerInput(
      {
        name: "Grup Test Müşteri",
        phone: "",
        email: "",
        taxNo: "",
        address: "",
        group: "Bayi",
      },
      { maxTaxCertificateBytes: 5 * 1024 * 1024 }
    );

    const customer = await db.customer.create({
      data: {
        companyId: ctx.companyId,
        ...normalized,
        balance: 150,
        status: "ACTIVE",
      },
    });

    assertEqual("Müşteri group alanı", customer.group, "Bayi");
    console.log("✅ Müşteri oluştururken grup seçimi geçti");

    let groups = await getCustomerGroupsWithStats(ctx.companyId);
    const bayiGroup = groups.find((group) => group.name === "Bayi");

    if (!bayiGroup) {
      throw new Error("Bayi grubu bulunamadı.");
    }

    assertEqual("Grup müşteri sayısı", bayiGroup.customerCount, 1);
    assertEqual("Grup borç toplamı", bayiGroup.totalDebt, 150);
    assertEqual("Grup alacak toplamı", bayiGroup.totalCredit, 0);
    console.log("✅ Grup istatistikleri geçti");

    await updateCustomerGroup(ctx.companyId, bayiGroup.id, {
      name: "Bayi Plus",
    });

    const renamedCustomer = await db.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });

    assertEqual("Rename sonrası müşteri group", renamedCustomer.group, "Bayi Plus");

    groups = await getCustomerGroupsWithStats(ctx.companyId);
    assertTrue(
      "Rename sonrası yeni grup adı listede",
      groups.some((group) => group.name === "Bayi Plus")
    );
    console.log("✅ Grup rename geçti");

    const creditCustomer = await db.customer.create({
      data: {
        companyId: ctx.companyId,
        name: "Alacaklı Müşteri",
        group: "Bayi Plus",
        balance: -80,
        status: "ACTIVE",
      },
    });

    groups = await getCustomerGroupsWithStats(ctx.companyId);
    const renamedGroup = groups.find((group) => group.name === "Bayi Plus");

    if (!renamedGroup) {
      throw new Error("Bayi Plus grubu bulunamadı.");
    }

    assertEqual("Alacak toplamı", renamedGroup.totalCredit, 80);
    console.log("✅ Borç/alacak istatistikleri geçti");

    await deleteCustomerGroup(ctx.companyId, renamedGroup.id);

    const movedCustomer = await db.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    const movedCreditCustomer = await db.customer.findUniqueOrThrow({
      where: { id: creditCustomer.id },
    });

    assertEqual("Silinen gruptan taşınan müşteri", movedCustomer.group, DEFAULT_GROUP_NAME);
    assertEqual(
      "Silinen gruptan taşınan ikinci müşteri",
      movedCreditCustomer.group,
      DEFAULT_GROUP_NAME
    );

    groups = await getCustomerGroupsWithStats(ctx.companyId);
    assertTrue(
      "Silinen grup listede yok",
      !groups.some((group) => group.name === "Bayi Plus")
    );
    console.log("✅ Grup silme geçti");

    const generalGroup = groups.find((group) => group.name === DEFAULT_GROUP_NAME);

    if (!generalGroup) {
      throw new Error("Genel grubu bulunamadı.");
    }

    try {
      await deleteCustomerGroup(ctx.companyId, generalGroup.id);
      throw new Error("Genel grubu silinmemeliydi.");
    } catch (error) {
      assertTrue(
        "Genel grubu silme engellendi",
        error instanceof Error && error.message.includes("Genel grubu silinemez")
      );
    }

    console.log("✅ Genel grubu silme engeli geçti");

    const emptyGroupCustomer = await db.customer.create({
      data: {
        companyId: ctx.companyId,
        name: "Boş Grup Müşteri",
        group: null,
        balance: 0,
        status: "ACTIVE",
      },
    });

    assertEqual(
      "Boş group normalize",
      normalizeGroupName(emptyGroupCustomer.group),
      DEFAULT_GROUP_NAME
    );

    console.log("\nTüm müşteri grupları testleri geçti.");
  } finally {
    await cleanup();
    console.log("\nTest verileri temizlendi.");
  }
}

main()
  .catch((error) => {
    console.error("\nTest başarısız:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
