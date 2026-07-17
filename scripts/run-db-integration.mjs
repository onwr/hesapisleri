import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function resolveTestDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) {
    return process.env.TEST_DATABASE_URL;
  }

  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (databaseUrl.includes("hesapisleri_test")) {
    return databaseUrl;
  }

  if (databaseUrl.includes("/hesapisleri")) {
    return databaseUrl.replace("/hesapisleri", "/hesapisleri_test");
  }

  return "";
}

const testDbUrl = resolveTestDatabaseUrl();

if (!testDbUrl || !testDbUrl.includes("hesapisleri_test")) {
  console.error(
    "TEST_DATABASE_URL must point to disposable hesapisleri_test database."
  );
  console.error(
    "Example: TEST_DATABASE_URL=postgresql://postgres:pass@127.0.0.1:5432/hesapisleri_test npm run test:db-integration"
  );
  process.exit(1);
}

if (testDbUrl.includes("/hesapisleri") && !testDbUrl.includes("hesapisleri_test")) {
  console.error("Refusing to run DB integration against production hesapisleri database.");
  process.exit(1);
}

const env = {
  ...process.env,
  DATABASE_URL: testDbUrl,
  DIRECT_URL: testDbUrl,
  TEST_DATABASE_URL: testDbUrl,
};

console.log("DB integration target:", testDbUrl.replace(/:[^:@/]+@/, ":***@"));

const migrate = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  cwd: webRoot,
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if ((migrate.status ?? 1) !== 0) {
  process.exit(migrate.status ?? 1);
}

const testFiles = [
  "lib/mobile/mobile-db.test.ts",
  "lib/mobile/mobile-pos-checkout-db.test.ts",
  "lib/mobile/mobile-catalog-db.test.ts",
  "lib/mobile/mobile-finance-db.test.ts",
  "lib/qa-revision/faz-qa-1-1-db.test.ts",
  "lib/qa-revision/faz-qa-2-db.test.ts",
  "lib/qa-revision/faz-qa-3a-db.test.ts",
  "lib/qa-revision/faz-qa-3b-db.test.ts",
  "lib/payments/sipay/sipay-db.test.ts",
  "lib/payments/sipay/sipay-db-concurrency.test.ts",
  "lib/cash-bank-transfer-db.test.ts",
  "lib/cash-daily-closing-db.test.ts",
  "lib/sale-receipt-db.test.ts",
  "lib/sale-return-db.test.ts",
  "lib/lifecycle-cancellation-db.test.ts",
  "lib/pos-veresiye-db.test.ts",
  "lib/billing-mutation-guard.test.ts",
  "lib/membership-shared-entitlement-db.test.ts",
  "lib/partner-referral-db.test.ts",
  "lib/invoice-service-product-db.test.ts",
  "lib/qa-revision/faz-qa-5a-db.test.ts",
  "lib/qa-revision/faz-qa-5a1-db.test.ts",
  "lib/qa-revision/faz-qa-5b-db.test.ts",
  "lib/qa-revision/faz-qa-5b2-db.test.ts",
  "lib/qa-revision/faz-qa-5b3-db.test.ts",
  "lib/qa-revision/faz-qa-5c1-db.test.ts",
  "lib/qa-revision/faz-qa-5d-db.test.ts",
  "lib/qa-revision/faz-qa-5e-db.test.ts",
  "lib/features/marketplace-feature-db.test.ts",
];

const result = spawnSync(
  process.execPath,
  [
    "--import",
    "./test/mock-server-only.mjs",
    "--import",
    "tsx",
    "--test",
    "--test-concurrency=1",
    ...testFiles,
  ],
  { cwd: webRoot, env, stdio: "inherit" }
);

process.exit(result.status ?? 1);
