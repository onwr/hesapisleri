import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
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

async function scanZip(zip: string) {
  const temp = await mkdtemp(path.join(os.tmpdir(), "sov-scan-"));
  extractZip(zip, temp);
  const all = await walk(temp);
  const buf = await readFile(path.join(DOCS, zip));
  const latin = buf.toString("latin1");
  const patterns = [
    /https?:\/\/[a-z0-9.-]*fitbulut\.com[^\s"'<>\\)]{0,120}/gi,
    /[a-z0-9.-]*fitbulut\.com\/[a-zA-Z0-9_./-]{5,80}/gi,
    /\.svc\b/gi,
    /Basic\s+Authentication/gi,
    /WS-Security/gi,
    /UsernameToken/gi,
    /MD5/gi,
    /SHA-?256/gi,
  ];
  console.log(`\n=== ${zip} binary scan ===`);
  for (const re of patterns) {
    const hits = [...new Set([...latin.matchAll(re)].map((m) => m[0]))];
    if (hits.length) console.log(re.source, hits.slice(0, 20));
  }

  const soapSend = all.find((f) => /sendUBL\(INVOICE\)/i.test(f));
  if (soapSend) {
    console.log("\n--- sendUBL sample ---");
    console.log((await readFile(soapSend, "utf8")).slice(0, 2000));
  }

  const wsdl = all.find((f) => /ClientEInvoiceServices.*\.wsdl$/i.test(f));
  if (wsdl) {
    const xml = await readFile(wsdl, "utf8");
    console.log("\n--- WSDL excerpt ---");
    console.log(xml.slice(0, 4000));
  }

  const archiveWsdl = all.find((f) => /EArchiveInvoiceService.*\.wsdl$/i.test(f));
  if (archiveWsdl) {
    const xml = await readFile(archiveWsdl, "utf8");
    console.log("\n--- Archive WSDL excerpt ---");
    console.log(xml.slice(0, 5000));
  }

  const hashXsd = all.find((f) => /earchive/i.test(f) && f.endsWith(".xsd"));
  if (hashXsd) {
    const xsd = await readFile(hashXsd, "utf8");
    const hashLines = xsd.split("\n").filter((l) => /hash|md5|sha/i.test(l));
    if (hashLines.length) {
      console.log("\n--- hash XSD lines ---");
      console.log(hashLines.slice(0, 20).join("\n"));
    }
  }

  await rm(temp, { recursive: true, force: true });
}

async function main() {
  for (const zip of [
    "sovos-e-fatura-ws-api-v2.3.zip",
    "sovos-e-arsiv-ws-api-v2.3.zip",
    "sovos-e-irsaliye-ws-api-v1.3.zip",
  ]) {
    await scanZip(zip);
  }
}

main();
