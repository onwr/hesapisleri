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

async function main() {
  const temp = await mkdtemp(path.join(os.tmpdir(), "sov-xsd-"));
  extractZip("sovos-e-fatura-ws-api-v2.3.zip", temp);
  const xsd = (await walk(temp)).find((f) =>
    f.endsWith("ClientEInvoiceServicesTypes-2.2.xsd")
  );
  if (xsd) {
    const xml = await readFile(xsd, "utf8");
    const blocks = ["getRAWUserList", "getPartialUserList", "ProcessingFault"];
    for (const name of blocks) {
      const idx = xml.indexOf(`name="${name}"`);
      if (idx >= 0) console.log(`\n=== ${name} ===\n`, xml.slice(idx, idx + 1500));
    }
  }
  await rm(temp, { recursive: true, force: true });

  const temp2 = await mkdtemp(path.join(os.tmpdir(), "sov-xsd2-"));
  extractZip("sovos-e-arsiv-ws-api-v2.3.zip", temp2);
  const wsdl = (await walk(temp2)).find((f) => f.endsWith("EArchiveInvoiceService_v2.wsdl"));
  if (wsdl) {
    const xml = await readFile(wsdl, "utf8");
    const idx = xml.indexOf("sendInvoiceRequestType");
    if (idx >= 0) console.log("\n=== sendInvoice ===\n", xml.slice(idx, idx + 2000));
    const hashIdx = xml.indexOf("hash");
    console.log("\n=== hash mentions ===");
    let pos = 0;
    while (true) {
      const i = xml.indexOf("hash", pos);
      if (i < 0) break;
      console.log(xml.slice(Math.max(0, i - 80), i + 120));
      pos = i + 4;
    }
  }
  await rm(temp2, { recursive: true, force: true });
}

main();
