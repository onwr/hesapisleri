/** Extract printable strings from PDF for endpoint discovery */
import { mkdtemp, readFile, rm } from "node:fs/promises";
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

function extractStrings(buf: Buffer, minLen = 6): string[] {
  const out: string[] = [];
  let current = "";
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i];
    if (c >= 32 && c <= 126) {
      current += String.fromCharCode(c);
    } else if (current.length >= minLen) {
      out.push(current);
      current = "";
    } else {
      current = "";
    }
  }
  if (current.length >= minLen) out.push(current);
  return out;
}

async function main() {
  const temp = await mkdtemp(path.join(os.tmpdir(), "sov-pdf-"));
  extractZip("sovos-e-fatura-ws-api-v2.3.zip", temp);

  const { readdir } = await import("node:fs/promises");
  async function walk(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) files.push(...(await walk(p)));
      else if (e.name.toLowerCase().endsWith(".pdf") && /e-fatura ws api v2\.3/i.test(e.name)) {
        files.push(p);
      }
    }
    return files;
  }

  const pdfs = await walk(temp);
  for (const pdf of pdfs) {
    const buf = await readFile(pdf);
    const strings = extractStrings(buf);
    const hits = strings.filter(
      (s) =>
        /fitbulut|efatura|earchive|irsaliye|despatch|wsdl|soap|basic|security|username|password|endpoint|servis|canl|test/i.test(
          s
        ) && s.length < 200
    );
    console.log("PDF:", path.basename(pdf));
    for (const h of [...new Set(hits)].sort()) {
      console.log(" ", h);
    }
  }

  await rm(temp, { recursive: true, force: true });
}

main();
