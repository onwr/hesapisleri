/**
 * Sovos resmî doküman paketlerini indirir.
 * Credential kullanmaz. Mevcut dosyayı --force olmadan üzerine yazmaz.
 *
 * Kullanım:
 *   cd web
 *   npx tsx scripts/sovos/fetch-sovos-docs.ts
 *   npx tsx scripts/sovos/fetch-sovos-docs.ts --force
 */
import { createHash } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const OUTPUT_DIR = path.join(process.cwd(), "docs", "private", "sovos");
const TIMEOUT_MS = 60_000;
const FORCE = process.argv.includes("--force");

type DocTarget = {
  filename: string;
  url: string;
  expectedMagic?: "zip" | "xlsx";
};

const DOCUMENTS: DocTarget[] = [
  {
    filename: "sovos-e-fatura-ws-api-v2.3.zip",
    url: "https://api.fitbulut.com/servis/assets/docs/Sovos%20Bulut%20e-Fatura%20WS%20API%20v2.3.zip",
    expectedMagic: "zip",
  },
  {
    filename: "sovos-e-arsiv-ws-api-v2.3.zip",
    url: "https://api.fitbulut.com/servis/assets/docs/Sovos%20Bulut%20e-Ar%C5%9Fiv%20Fatura%20WS%20API%20v2.3.zip",
    expectedMagic: "zip",
  },
  {
    filename: "sovos-e-irsaliye-ws-api-v1.3.zip",
    url: "https://api.fitbulut.com/servis/assets/docs/Sovos%20Bulut%20e-%C4%B0rsaliye%20WS%20API%20v1.3.zip",
    expectedMagic: "zip",
  },
  {
    filename: "sovos-ubl-tr-catalogue.xlsx",
    url: "https://api.fitbulut.com/servis/assets/docs/Sovos%20R%26D%20-%20UBL-TR%20Catalogue.xlsx",
    expectedMagic: "xlsx",
  },
  {
    filename: "sovos-faq.xlsx",
    url: "https://api.fitbulut.com/servis/assets/docs/Sovos%20R%26D%20-S%C4%B1k%20Sorulan%20Sorular.xlsx",
    expectedMagic: "xlsx",
  },
];

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function looksLikeHtml(buffer: Buffer) {
  const head = buffer.subarray(0, 256).toString("utf8").trimStart().toLowerCase();
  return head.startsWith("<!doctype html") || head.startsWith("<html");
}

function validateMagic(buffer: Buffer, expected?: DocTarget["expectedMagic"]) {
  if (!expected) return;
  if (expected === "zip") {
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      throw new Error("Dosya ZIP magic byte içermiyor (PK).");
    }
    return;
  }
  if (expected === "xlsx") {
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      throw new Error("Dosya XLSX (ZIP tabanlı) magic byte içermiyor.");
    }
  }
}

async function downloadOne(target: DocTarget) {
  const outputPath = path.join(OUTPUT_DIR, target.filename);

  try {
    const existing = await stat(outputPath);
    if (existing.isFile() && !FORCE) {
      console.log(`ATLANDI (mevcut): ${target.filename}`);
      return { filename: target.filename, status: "skipped" as const };
    }
  } catch {
    // file does not exist
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(target.url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { Accept: "*/*" },
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} — ${target.url}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length < 64) {
    throw new Error("İndirilen dosya çok küçük.");
  }

  if (looksLikeHtml(buffer)) {
    throw new Error(
      "HTML/WAF cevabı alındı; ZIP/XLSX değil. Dokümanı manuel indirip docs/private/sovos/ altına koyun."
    );
  }

  validateMagic(buffer, target.expectedMagic);

  await writeFile(outputPath, buffer);
  const hash = sha256(buffer);
  console.log(`İNDİRİLDİ: ${target.filename} (${buffer.length} byte, sha256=${hash})`);
  return { filename: target.filename, status: "downloaded" as const, sha256: hash, bytes: buffer.length };
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const results: Array<Awaited<ReturnType<typeof downloadOne>>> = [];
  const failures: Array<{ filename: string; error: string }> = [];

  for (const doc of DOCUMENTS) {
    try {
      results.push(await downloadOne(doc));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ filename: doc.filename, error: message });
      console.error(`HATA: ${doc.filename} — ${message}`);
    }
  }

  console.log("\nÖzet:");
  console.log(JSON.stringify({ results, failures }, null, 2));

  if (failures.length > 0) {
    console.error(
      "\nBazı dokümanlar indirilemedi. Manuel indirme talimatları: docs/private/sovos/README.md"
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
