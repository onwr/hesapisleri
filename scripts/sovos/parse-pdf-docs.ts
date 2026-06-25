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

async function parseDocx(docxPath: string) {
  const temp = await mkdtemp(path.join(os.tmpdir(), "sov-docx-"));
  spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `Expand-Archive -LiteralPath '${docxPath.replace(/'/g, "''")}' -DestinationPath '${temp.replace(/'/g, "''")}' -Force`,
    ],
    { encoding: "utf8" }
  );
  const documentXml = await readFile(path.join(temp, "word", "document.xml"), "utf8");
  const text = documentXml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
  console.log("--- DOCX text excerpt ---");
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (/fitbulut|endpoint|servis|basic|ws-security|kimlik|test|canl|authentication|web servis|url/i.test(line)) {
      console.log(line);
    }
  }
  await rm(temp, { recursive: true, force: true });
}

async function parsePdfWithPdfParse(pdfPath: string) {
  const { PDFParse } = await import("pdf-parse");
  const buf = await readFile(pdfPath);
  const parser = new PDFParse({ data: buf });
  const data = await parser.getText();
  await parser.destroy();
  console.log(`--- PDF: ${path.basename(pdfPath)} pages: ${data.total} ---`);
  const lines = data.text.split("\n");
  for (const line of lines) {
    if (/fitbulut|endpoint|servis|basic|ws-security|kimlik|test ortam|canl[ıi]|authentication|web servis|\.svc|ClientEInvoice|eArsiv|MD5|hash/i.test(line)) {
      console.log(line.trim());
    }
  }
}

async function main() {
  const temp = await mkdtemp(path.join(os.tmpdir(), "sov-pdf-"));
  extractZip("sovos-e-fatura-ws-api-v2.3.zip", temp);
  const files = await walk(temp);
  const mainPdf = files.find((f) => /e-Fatura WS API v2\.3\.pdf$/i.test(f));
  const docx = files.find((f) => /Test K.*lavuzu\.docx$/i.test(f));
  if (mainPdf) await parsePdfWithPdfParse(mainPdf);
  await rm(temp, { recursive: true, force: true });

  const temp2 = await mkdtemp(path.join(os.tmpdir(), "sov-pdf2-"));
  extractZip("sovos-e-arsiv-ws-api-v2.3.zip", temp2);
  const files2 = await walk(temp2);
  const archivePdf = files2.find((f) => /e-Ar.*iv.*WS API v2\.3\.pdf$/i.test(f));
  if (archivePdf) await parsePdfWithPdfParse(archivePdf);
  await rm(temp2, { recursive: true, force: true });

  const temp3 = await mkdtemp(path.join(os.tmpdir(), "sov-pdf3-"));
  extractZip("sovos-e-irsaliye-ws-api-v1.3.zip", temp3);
  const files3 = await walk(temp3);
  const despatchPdf = files3.find((f) => /rsaliye WS API v1\.3\.pdf$/i.test(f));
  if (despatchPdf) await parsePdfWithPdfParse(despatchPdf);
  await rm(temp3, { recursive: true, force: true });
}

main().catch(console.error);
