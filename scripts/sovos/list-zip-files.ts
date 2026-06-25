import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const DOCS = path.join(process.cwd(), "docs", "private", "sovos");

function extractZip(zip: string, dest: string) {
  spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `Expand-Archive -LiteralPath '${path.join(DOCS, zip).replace(/'/g, "''")}' -DestinationPath '${dest.replace(/'/g, "''")}' -Force`,
    ],
    { encoding: "utf8" }
  );
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(p)));
    else files.push(p);
  }
  return files;
}

async function main() {
  const temp = await mkdtemp(path.join(os.tmpdir(), "sov-list-"));
  extractZip("sovos-e-fatura-ws-api-v2.3.zip", temp);
  const files = await walk(temp);
  console.log("Total files:", files.length);
  for (const f of files.sort()) {
    console.log(path.relative(temp, f));
  }
  await rm(temp, { recursive: true, force: true });
}

main();
