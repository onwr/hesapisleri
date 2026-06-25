/**
 * docs/private/sovos/ altındaki ZIP'lerden WSDL sözleşme manifesti üretir.
 *
 * Kullanım:
 *   cd web
 *   npx tsx scripts/sovos/inspect-sovos-contracts.ts
 */
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const DOCS_DIR = path.join(process.cwd(), "docs", "private", "sovos");
const MANIFEST_PATH = path.join(process.cwd(), "generated", "sovos-contract-manifest.json");

type WsdlOperation = {
  name: string;
  soapAction: string | null;
  inputElement: string | null;
  outputElement: string | null;
};

type WsdlServiceInfo = {
  sourceZip: string | null;
  wsdlPath: string;
  targetNamespace: string | null;
  soapVersion: "1.1" | "1.2" | "unknown";
  services: Array<{
    name: string;
    ports: Array<{
      name: string;
      binding: string | null;
      endpoint: string | null;
    }>;
  }>;
  bindings: Array<{
    name: string;
    type: string | null;
    soapVersion: "1.1" | "1.2" | "unknown";
    operations: WsdlOperation[];
  }>;
  imports: string[];
};

type ContractManifest = {
  generatedAt: string;
  documentVersion: string | null;
  sources: Array<{ filename: string; sha256: string; bytes: number }>;
  invoice: WsdlServiceInfo | null;
  archive: WsdlServiceInfo | null;
  despatch: WsdlServiceInfo | null;
  notes: string[];
};

const ZIP_MAP: Record<string, keyof Pick<ContractManifest, "invoice" | "archive" | "despatch">> = {
  "sovos-e-fatura-ws-api-v2.3.zip": "invoice",
  "sovos-e-arsiv-ws-api-v2.3.zip": "archive",
  "sovos-e-irsaliye-ws-api-v1.3.zip": "despatch",
};

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
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

async function findFiles(dir: string, ext: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findFiles(full, ext)));
    } else if (entry.name.toLowerCase().endsWith(ext)) {
      files.push(full);
    }
  }
  return files;
}

function detectSoapVersion(xml: string): "1.1" | "1.2" | "unknown" {
  if (/soap12:|http:\/\/www\.w3\.org\/2003\/05\/soap-envelope/i.test(xml)) {
    return "1.2";
  }
  if (/soap:|http:\/\/schemas\.xmlsoap\.org\/wsdl\/soap\//i.test(xml)) {
    return "1.1";
  }
  return "unknown";
}

function matchAll(xml: string, pattern: RegExp) {
  return [...xml.matchAll(pattern)].map((m) => m[1] ?? m[0]);
}

function parseWsdl(wsdlPath: string, sourceZip: string | null): WsdlServiceInfo {
  const xml = readFileSync(wsdlPath, "utf8");
  const soapVersion = detectSoapVersion(xml);

  const targetNamespace =
    xml.match(/targetNamespace=["']([^"']+)["']/i)?.[1] ?? null;

  const imports = matchAll(xml, /<\s*(?:\w+:)?import[^>]*location=["']([^"']+)["']/gi);

  const bindings: WsdlServiceInfo["bindings"] = [];
  const bindingBlocks = [...xml.matchAll(/<\s*wsdl:binding[\s\S]*?<\/\s*wsdl:binding>/gi)].map(
    (m) => m[0]
  );

  for (const block of bindingBlocks) {
    const name = block.match(/name=["']([^"']+)["']/i)?.[1] ?? "unknown";
    const type = block.match(/type=["']([^"']+)["']/i)?.[1] ?? null;
    const bindingSoapVersion = detectSoapVersion(block);
    const operations: WsdlOperation[] = [];

    const opBlocks = [...block.matchAll(/<\s*wsdl:operation[\s\S]*?<\/\s*wsdl:operation>/gi)].map(
      (m) => m[0]
    );
    for (const op of opBlocks) {
      const opName = op.match(/name=["']([^"']+)["']/i)?.[1] ?? "unknown";
      const soapAction =
        op.match(/soapAction=["']([^"']*)["']/i)?.[1] ??
        op.match(/soapAction=["']([^"']*)["']/i)?.[1] ??
        null;
      const inputElement =
        op.match(/<\s*wsdl:input[^>]*name=["']([^"']+)["']/i)?.[1] ?? null;
      const outputElement =
        op.match(/<\s*wsdl:output[^>]*name=["']([^"']+)["']/i)?.[1] ?? null;
      operations.push({
        name: opName,
        soapAction,
        inputElement,
        outputElement,
      });
    }

    bindings.push({ name, type, soapVersion: bindingSoapVersion, operations });
  }

  const services: WsdlServiceInfo["services"] = [];
  const serviceBlocks = [...xml.matchAll(/<\s*wsdl:service[\s\S]*?<\/\s*wsdl:service>/gi)].map(
    (m) => m[0]
  );
  for (const block of serviceBlocks) {
    const name = block.match(/name=["']([^"']+)["']/i)?.[1] ?? "unknown";
    const ports: WsdlServiceInfo["services"][number]["ports"] = [];
    const portBlocks = [...block.matchAll(/<\s*wsdl:port[\s\S]*?<\/\s*wsdl:port>/gi)].map(
      (m) => m[0]
    );
    for (const port of portBlocks) {
      ports.push({
        name: port.match(/name=["']([^"']+)["']/i)?.[1] ?? "unknown",
        binding: port.match(/binding=["']([^"']+)["']/i)?.[1] ?? null,
        endpoint:
          port.match(/location=["']([^"']+)["']/i)?.[1] ??
          port.match(/address[^>]*location=["']([^"']+)["']/i)?.[1] ??
          null,
      });
    }
    services.push({ name, ports });
  }

  return {
    sourceZip,
    wsdlPath,
    targetNamespace,
    soapVersion,
    services,
    bindings,
    imports,
  };
}

function pickPrimaryWsdl(wsdlFiles: string[]) {
  const scored = wsdlFiles.map((file) => {
    const base = path.basename(file).toLowerCase();
    let score = 0;
    if (base.includes("service")) score += 3;
    if (base.includes("invoice")) score += 2;
    if (base.includes("efatura") || base.includes("e-fatura") || base.includes("fatura")) {
      score += 2;
    }
    if (base.includes("archive") || base.includes("earsiv") || base.includes("arsiv")) {
      score += 2;
    }
    if (base.includes("despatch") || base.includes("irsaliye")) score += 2;
    return { file, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.file ?? wsdlFiles[0] ?? null;
}

function enrichManifest(manifest: ContractManifest) {
  const notes = [
    ...manifest.notes,
    "Auth: HTTP Basic Authentication (VKN/TCKN tabanlı kullanıcı adı/şifre).",
    "E-Fatura bağlantı testi operasyonu: getRAWUserList.",
    "E-Arşiv bağlantı testi operasyonu: getUserList.",
    "E-İrsaliye bağlantı testi operasyonu: getDesUserList.",
    "Gerçek test/canlı URL'ler müşteriye özel verilir; SOVOS_*_ENDPOINT_* env ile yapılandırılır.",
  ];

  return {
    ...manifest,
    notes: [...new Set(notes)],
    auth: {
      method: "HTTP_BASIC",
      header: "Authorization: Basic <base64(username:password)>",
      transport: "HTTPS:443",
    },
    endpointPatterns: {
      invoice:
        "https://<musteri-servis-adresi>/ClientEInvoiceServices/ClientEInvoiceServicesPort.svc",
      archive: "https://<musteri-servis-adresi>/ClientEArsivServicesPort.svc",
      despatch:
        "https://<musteri-servis-adresi>/ClientEDespatchServices/ClientEDespatchServicesPort.svc",
    },
    envEndpointKeys: {
      invoice: {
        test: "SOVOS_INVOICE_ENDPOINT_TEST",
        live: "SOVOS_INVOICE_ENDPOINT_LIVE",
      },
      archive: {
        test: "SOVOS_ARCHIVE_ENDPOINT_TEST",
        live: "SOVOS_ARCHIVE_ENDPOINT_LIVE",
      },
      despatch: {
        test: "SOVOS_DESPATCH_ENDPOINT_TEST",
        live: "SOVOS_DESPATCH_ENDPOINT_LIVE",
      },
    },
    connectionTests: {
      invoice: {
        operation: "getRAWUserList",
        soapAction: "getRAWUserList",
        namespace: "http:/fitcons.com/eInvoice/",
        requestElement: "getRAWUserListRequest",
        responseElement: "getRAWUserListResponse",
        requestFields: ["Identifier", "VKN_TCKN", "Role"],
      },
      archive: {
        operation: "getUserList",
        soapAction: "getUserList",
        namespace: "http:/fitcons.com/earchive/getuserlist",
        requestElement: "getUserListRequest",
        responseElement: "getUserListResponse",
        requestFields: ["vknTckn"],
      },
      despatch: {
        operation: "getDesUserList",
        soapAction: "getDesUserList",
        namespace: "http://foriba.com/eDespatch/",
        requestElement: "getDesUserListRequest",
        responseElement: "getDesUserListResponse",
        requestFields: ["Identifier", "VKN_TCKN", "Role"],
      },
    },
    archiveHash: {
      sendInvoice: "MD5",
      signedInvoice: "SHA-256",
      branchParam: "customizationParams/paramName=BRANCH",
    },
  };
}

async function inspectZip(filename: string): Promise<{
  info: WsdlServiceInfo | null;
  source: { filename: string; sha256: string; bytes: number };
}> {
  const zipPath = path.join(DOCS_DIR, filename);
  const buffer = await readFile(zipPath);
  const source = { filename, sha256: sha256(buffer), bytes: buffer.length };

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "sovos-wsdl-"));
  try {
    extractZip(zipPath, tempDir);
    const wsdlFiles = await findFiles(tempDir, ".wsdl");
    if (wsdlFiles.length === 0) {
      return { info: null, source };
    }
    const primary = pickPrimaryWsdl(wsdlFiles);
    if (!primary) return { info: null, source };
    return { info: parseWsdl(primary, filename), source };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  await mkdir(path.dirname(MANIFEST_PATH), { recursive: true });

  const manifest: ContractManifest = {
    generatedAt: new Date().toISOString(),
    documentVersion: null,
    sources: [],
    invoice: null,
    archive: null,
    despatch: null,
    notes: [],
  };

  const files = await readdir(DOCS_DIR);
  const zipFiles = files.filter((f) => f.toLowerCase().endsWith(".zip"));

  if (zipFiles.length === 0) {
    manifest.notes.push(
      "ZIP bulunamadı. Önce scripts/sovos/fetch-sovos-docs.ts çalıştırın veya docs/private/sovos/README.md talimatlarını izleyin."
    );
    await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
    console.error(manifest.notes[0]);
    process.exit(1);
  }

  for (const filename of zipFiles) {
    const key = ZIP_MAP[filename];
    if (!key) {
      manifest.notes.push(`Tanımsız ZIP atlandı: ${filename}`);
      continue;
    }

    try {
      const { info, source } = await inspectZip(filename);
      manifest.sources.push(source);
      manifest[key] = info;
      if (!info) {
        manifest.notes.push(`${filename}: WSDL bulunamadı.`);
      } else if (!info.targetNamespace || info.bindings.length === 0) {
        manifest.notes.push(`${filename}: WSDL parse eksik; manuel doğrulama gerekir.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      manifest.notes.push(`${filename}: ${message}`);
    }
  }

  if (manifest.invoice?.sourceZip?.includes("v2.3")) {
    manifest.documentVersion = "2.3";
  }

  const enriched = enrichManifest(manifest);
  await writeFile(MANIFEST_PATH, JSON.stringify(enriched, null, 2), "utf8");
  console.log(`Manifest yazıldı: ${MANIFEST_PATH}`);
  if (enriched.notes.length > 0) {
    console.log("Notlar:", enriched.notes.join("\n"));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
