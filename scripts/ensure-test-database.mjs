import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const adminUrl =
  process.env.PG_ADMIN_URL ??
  "postgresql://postgres:kurkaya1234@127.0.0.1:5432/postgres";

const testDbUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:kurkaya1234@127.0.0.1:5432/hesapisleri_test";

const admin = new PrismaClient({
  datasources: { db: { url: adminUrl } },
});

try {
  await admin.$executeRawUnsafe("CREATE DATABASE hesapisleri_test");
  console.log("hesapisleri_test created");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("already exists")) {
    console.log("hesapisleri_test already exists");
  } else {
    console.error(message);
    process.exit(1);
  }
} finally {
  await admin.$disconnect();
}

const migrate = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  cwd: webRoot,
  env: { ...process.env, DATABASE_URL: testDbUrl, DIRECT_URL: testDbUrl, TEST_DATABASE_URL: testDbUrl },
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(migrate.status ?? 0);
