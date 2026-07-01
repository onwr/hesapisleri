import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const testDbUrl =
  process.env.TEST_DATABASE_URL ??
  (process.env.DATABASE_URL?.includes("hesapisleri_test")
    ? process.env.DATABASE_URL
    : process.env.DATABASE_URL?.replace("/hesapisleri", "/hesapisleri_test") ?? "");

if (!testDbUrl.includes("hesapisleri_test")) {
  console.log(
    "SKIP: mobile smoke tests require DATABASE_URL pointing to disposable hesapisleri_test database."
  );
  console.log(
    "Example: TEST_DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/hesapisleri_test npm run test:smoke"
  );
  process.exit(0);
}

const result = spawnSync(
  process.execPath,
  [
    "--import",
    "./test/mock-server-only.mjs",
    "--import",
    "tsx",
    "--test",
    "lib/mobile/mobile-smoke.test.ts",
  ],
  { cwd: webRoot, stdio: "inherit", env: { ...process.env, DATABASE_URL: testDbUrl, TEST_DATABASE_URL: testDbUrl } }
);

process.exit(result.status ?? 1);
