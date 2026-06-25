import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const DOCS = path.join(process.cwd(), "docs", "private", "sovos");
const zips = [
  "sovos-e-fatura-ws-api-v2.3.zip",
  "sovos-e-arsiv-ws-api-v2.3.zip",
  "sovos-e-irsaliye-ws-api-v1.3.zip",
];

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

const KEYWORDS =
  /authentication|kimlik|basic auth|ws-security|usernametoken|passwordtext|endpoint|servis adres|web servis|canl[ıi] ortam|test ortam|efaturaws|efaturatest|earchive|irsaliye|\.svc/i;

async function main() {
  for (const zip of zips) {
    const temp = await mkdtemp(path.join(os.tmpdir(), "sov-kw-"));
    extractZip(zip, temp);
    const files = await walk(temp);
    console.log(`\n=== ${zip} ===`);
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (![".xml", ".xsd", ".wsdl", ".txt", ".html", ".pdf"].includes(ext)) continue;
      const text =
        ext === ".pdf"
          ? (await readFile(file)).toString("latin1")
          : await readFile(file, "utf8");
      if (!KEYWORDS.test(text)) continue;
      const rel = path.relative(temp, file);
      const lines = text.split(/\r?\n/);
      const matching = lines.filter((l) => KEYWORDS.test(l)).slice(0, 8);
      console.log(`\n[${rel}]`);
      for (const line of matching) {
        console.log(" ", line.trim().slice(0, 200));
      }
    }
    await rm(temp, { recursive: true, force: true });
  }
}

main();
