import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = join(webRoot, "prisma", "schema.prisma");
const hashPath = join(webRoot, ".prisma-generate-hash");
const clientEntry = join(webRoot, "node_modules", ".prisma", "client", "index.js");
const maxAttempts = 5;
const baseDelayMs = 200;

function getSchemaHash() {
  return createHash("sha256").update(readFileSync(schemaPath)).digest("hex");
}

function readCachedHash() {
  try {
    return readFileSync(hashPath, "utf8").trim();
  } catch {
    return null;
  }
}

function writeCachedHash(hash) {
  writeFileSync(hashPath, hash, "utf8");
}

function isEpermError(output) {
  const text = String(output ?? "");
  return text.includes("EPERM") && text.includes("query_engine");
}

const schemaHash = getSchemaHash();
const cachedHash = readCachedHash();

if (
  cachedHash === schemaHash &&
  existsSync(clientEntry)
) {
  process.exit(0);
}

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const result = spawnSync("npx", ["prisma", "generate"], {
    cwd: webRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  if ((result.status ?? 1) === 0) {
    writeCachedHash(schemaHash);
    process.exit(0);
  }

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (!isEpermError(output) || attempt === maxAttempts) {
    if (isEpermError(output)) {
      console.error(
        [
          "Prisma generate failed: query engine file is locked (EPERM).",
          "Stop the Next.js dev server or any process using Prisma Client, then run:",
          "  npm run prisma:generate:safe",
        ].join("\n"),
      );
    } else {
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
    }
    process.exit(result.status ?? 1);
  }

  await delay(baseDelayMs * attempt);
}
