import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const DOCS = path.join(process.cwd(), "docs", "private", "sovos");

async function extractXlsxStrings(filename: string) {
  const temp = await mkdtemp(path.join(os.tmpdir(), "sov-xlsx-"));
  spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `Expand-Archive -LiteralPath '${path.join(DOCS, filename).replace(/'/g, "''")}' -DestinationPath '${temp.replace(/'/g, "''")}' -Force`,
    ],
    { encoding: "utf8" }
  );

  async function walk(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) files.push(...(await walk(p)));
      else if (p.endsWith(".xml")) files.push(p);
    }
    return files;
  }

  const xmlFiles = await walk(temp);
  const allText: string[] = [];
  for (const f of xmlFiles) {
    const xml = await readFile(f, "utf8");
    const cells = [...xml.matchAll(/<(?:v|t)[^>]*>([^<]{3,500})<\//g)].map((m) => m[1]);
    allText.push(...cells);
  }

  const hits = allText.filter((t) =>
    /fitbulut|efatura|earchive|irsaliye|endpoint|servis|basic|ws-security|username|password|kimlik|test|canl|hash|md5|branch/i.test(
      t
    )
  );

  console.log(`\n=== ${filename} (${hits.length} hits) ===`);
  for (const h of [...new Set(hits)].sort()) {
    console.log(h);
  }

  await rm(temp, { recursive: true, force: true });
}

async function main() {
  await extractXlsxStrings("sovos-faq.xlsx");
}

main();
