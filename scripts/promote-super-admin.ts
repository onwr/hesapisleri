import { PrismaClient } from "@prisma/client";

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error("Kullanım: npx tsx scripts/promote-super-admin.ts kullanici@email.com");
  process.exit(1);
}

const db = new PrismaClient();

async function main() {
  const user = await db.user.findUnique({ where: { email } });

  if (!user) {
    console.error("Kullanıcı bulunamadı:", email);
    process.exit(1);
  }

  if (user.role === "SUPER_ADMIN") {
    console.log("Kullanıcı zaten Super Admin:", email);
    return;
  }

  await db.user.update({
    where: { id: user.id },
    data: { role: "SUPER_ADMIN" },
  });

  console.log("Super Admin yapıldı:", email);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
