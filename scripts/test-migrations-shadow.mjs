import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const envPath = path.join(root, ".env");
const envText = fs.readFileSync(envPath, "utf8");
const match = envText.match(/^DATABASE_URL=(.+)$/m);
if (!match) {
  console.error("DATABASE_URL not found in .env");
  process.exit(1);
}

const baseUrl = match[1].replace(/^"|"$/g, "");
const shadowUrl = new URL(baseUrl);
shadowUrl.pathname = "/hesapisleri_shadow";

console.log("Clearing shadow database schema...");
const clearSql =
  "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;";
execSync(
  `npx prisma db execute --url "${shadowUrl.toString()}" --stdin`,
  {
    stdio: ["pipe", "inherit", "inherit"],
    cwd: root,
    shell: true,
    input: clearSql,
  },
);

console.log("Applying all migrations on shadow database...");
execSync("npx prisma migrate deploy", {
  stdio: "inherit",
  cwd: root,
  shell: true,
  env: { ...process.env, DATABASE_URL: shadowUrl.toString() },
});

console.log("Shadow migration test passed.");
