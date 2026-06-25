/**
 * Sovos ZIP içeriğinden endpoint, auth ve XSD alanlarını çıkarır (geçici araç).
 */
import { createHash } from "node:crypto";
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

async function findFiles(dir: string, exts: string[]): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findFiles(full, exts)));
    } else if (exts.some((ext) => entry.name.toLowerCase().endsWith(ext))) {
      files.push(full);
    }
  }
  return files;
}

function extractZip(zipPath: string, destDir: string) {
  if (process.platform === "win32") {
    const result = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`,
      ],
      { encoding: "utf8" }
    );
    if (result.status !== 0) {
      throw new Error(result.stderr || "Expand-Archive başarısız.");
    }
    return;
  }
  const result = spawnSync("unzip", ["-oq", zipPath, "-d", destDir], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || "unzip başarısız.");
  }
}

const urlRe = /https?:\/\/[^\s"'<>\\]+/gi;
const authRe =
  /Basic\s+Auth|WS-Security|UsernameToken|PasswordText|kimlik\s*doğrulama|authentication|Authorization|BRANCH|SHA-?256|MD5|hash/i;

async function readSoapSamples(temp: string) {
  const samples = await findFiles(temp, [".xml"]);
  const interesting = samples.filter((f) =>
    /getPartialUserList|getRAWUserList|getUserList|sendInvoiceRequest|getStatusRequest/i.test(
      path.basename(f)
    )
  );
  for (const file of interesting) {
    const text = await readFile(file, "utf8");
    console.log(`\n--- SOAP sample: ${path.relative(temp, file)} ---`);
    console.log(text.slice(0, 3000));
  }
}

async function readPdfEndpoints(temp: string) {
  const pdfs = (await findFiles(temp, [".pdf"])).filter((f) =>
    /ws api|bulut/i.test(path.basename(f))
  );
  for (const pdf of pdfs) {
    const buf = await readFile(pdf);
    const text = buf.toString("latin1");
    const patterns = [
      /https?:\/\/[a-zA-Z0-9._~:/?#\[\]@!$&'()*+,;=%-]{10,}/g,
      /(?:test|canl[ıi]|prod(?:uction)?|endpoint|servis|url|adres)[^\n]{0,120}/gi,
    ];
    console.log(`\n--- PDF: ${path.basename(pdf)} ---`);
    for (const pattern of patterns) {
      const hits = [...new Set([...text.matchAll(pattern)].map((m) => m[0].trim()))];
      const relevant = hits.filter((h) =>
        /fitbulut|sovos|fitcons|efatura|earchive|irsaliye|despatch|endpoint|test|canl|wsdl|soap/i.test(
          h
        )
      );
      for (const hit of relevant.slice(0, 40)) {
        console.log(`  ${hit}`);
      }
    }
  }
}

async function main() {
  for (const zip of zips) {
    const temp = await mkdtemp(path.join(os.tmpdir(), "sovos-deep-"));
    const zipPath = path.join(DOCS, zip);
    extractZip(zipPath, temp);
    const all = await findFiles(temp, [".wsdl", ".xsd", ".pdf", ".txt", ".xml", ".html", ".docx"]);
    console.log(`\n=== ${zip} (${all.length} files) ===`);

    const urls = new Set<string>();
    const authHits: string[] = [];

    for (const file of all) {
      const buf = await readFile(file);
      const rel = path.relative(temp, file);
      const isBinary = file.toLowerCase().endsWith(".pdf") || file.toLowerCase().endsWith(".docx");
      const text = isBinary ? buf.toString("latin1") : buf.toString("utf8");

      for (const match of text.matchAll(urlRe)) {
        urls.add(match[0].replace(/[),.;]+$/, ""));
      }
      if (authRe.test(text)) {
        authHits.push(rel);
      }

      if (file.toLowerCase().endsWith(".wsdl")) {
        console.log(`WSDL: ${rel}`);
        const ns = text.match(/targetNamespace=["']([^"']+)["']/i)?.[1];
        const loc = text.match(/location=["']([^"']+)["']/gi);
        if (ns) console.log(`  namespace: ${ns}`);
        if (loc) console.log(`  locations: ${loc.join(", ")}`);
      }

      if (
        file.toLowerCase().includes("getpartialuserlist") ||
        file.toLowerCase().includes("getrawuserlist") ||
        file.toLowerCase().includes("getuserlist")
      ) {
        console.log(`UserList XSD: ${rel}`);
      }
    }

    const filtered = [...urls].filter((u) =>
      /sovos|fitcons|foriba|efatura|earchive|irsaliye|digitalplanet|taxten/i.test(u)
    );
    console.log("Filtered URLs:");
    for (const u of filtered.sort()) {
      console.log(`  ${u}`);
    }
    console.log("Auth-related files:");
    for (const hit of authHits.slice(0, 20)) {
      console.log(`  ${hit}`);
    }
    if (authHits.length > 20) {
      console.log(`  ... +${authHits.length - 20} more`);
    }

    await readPdfEndpoints(temp);
    await readSoapSamples(temp);
    await rm(temp, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
