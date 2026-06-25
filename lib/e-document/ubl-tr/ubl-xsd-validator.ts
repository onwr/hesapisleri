import type { Document } from "libxmljs2";
import fs from "node:fs";
import path from "node:path";
import libxmljs from "libxmljs2";

export type UblXsdValidationProfile = "transport" | "signed";

export type XsdValidationIssue = {
  path: string;
  message: string;
  line?: number;
  column?: number;
  element?: string;
};

export type XsdValidationResult = {
  ok: boolean;
  valid: boolean;
  schemaLoaded: boolean;
  profile: UblXsdValidationProfile;
  issues: XsdValidationIssue[];
};

const schemaCache = new Map<UblXsdValidationProfile, Document | null | undefined>();

function resolveSchemaDir(): string | null {
  const candidates = [
    path.join(process.cwd(), "generated", "ubl-tr-schemas"),
    path.join(
      process.cwd(),
      "docs",
      "private",
      "sovos",
      "ubl-tr-extract",
      "UBLTR_1.2.1_Paketi",
      "xsdrt"
    ),
  ];

  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "maindoc", "UBL-Invoice-2.1.xsd"))) {
      return dir;
    }
  }
  return null;
}

function schemaFileForProfile(profile: UblXsdValidationProfile) {
  return profile === "transport"
    ? "UBL-Invoice-2.1-Transport.xsd"
    : "UBL-Invoice-2.1.xsd";
}

export function loadUblInvoiceSchema(profile: UblXsdValidationProfile = "transport"): Document | null {
  if (schemaCache.has(profile)) {
    return schemaCache.get(profile) ?? null;
  }

  const schemaDir = resolveSchemaDir();
  if (!schemaDir) {
    schemaCache.set(profile, null);
    return null;
  }

  try {
    const schemaPath = path.join(schemaDir, "maindoc", schemaFileForProfile(profile));
    const xsdContent = fs.readFileSync(schemaPath);
    const schema = libxmljs.parseXml(xsdContent, {
      baseUrl: `${path.join(schemaDir, "maindoc")}${path.sep}`,
    });
    schemaCache.set(profile, schema);
    return schema;
  } catch {
    schemaCache.set(profile, null);
    return null;
  }
}

export function resetUblInvoiceSchemaCacheForTests() {
  schemaCache.clear();
}

function translateXsdMessage(raw: string): string {
  const text = raw.trim();
  if (/Missing child element/i.test(text)) {
    return `Zorunlu alt eleman eksik: ${text}`;
  }
  if (/This element is not expected/i.test(text)) {
    return `Beklenmeyen eleman: ${text}`;
  }
  if (/is not a valid value/i.test(text)) {
    return `Geçersiz değer: ${text}`;
  }
  return text || "XSD doğrulama hatası.";
}

function parseElementFromMessage(message: string): string | undefined {
  const match = message.match(/Expected is \( ([^)]+) \)/i);
  return match?.[1]?.split(",")[0]?.trim();
}

export function validateUblInvoiceXml(
  xml: string,
  options?: { profile?: UblXsdValidationProfile; expectedLineCount?: number }
): XsdValidationResult {
  const profile = options?.profile ?? "transport";
  const schema = loadUblInvoiceSchema(profile);

  if (!schema) {
    const issue = {
      path: "/schema",
      message:
        "UBL-TR XSD şemaları yüklenemedi. generated/ubl-tr-schemas veya GİB UBL paketi gerekli.",
    };
    return {
      ok: false,
      valid: false,
      schemaLoaded: false,
      profile,
      issues: [issue],
    };
  }

  const issues: XsdValidationIssue[] = [];

  let doc: Document;
  try {
    doc = libxmljs.parseXml(xml);
  } catch (error) {
    const message = error instanceof Error ? error.message : "XML ayrıştırılamadı.";
    return {
      ok: false,
      valid: false,
      schemaLoaded: true,
      profile,
      issues: [{ path: "/Invoice", message }],
    };
  }

  const valid = doc.validate(schema);
  if (!valid) {
    for (const error of doc.validationErrors ?? []) {
      const rawMessage = error.message?.trim() || "XSD doğrulama hatası.";
      const element = parseElementFromMessage(rawMessage);
      issues.push({
        path: element ? `/Invoice/${element}` : error.line ? `line:${error.line}` : "/Invoice",
        element,
        line: error.line,
        column: "column" in error ? (error as { column?: number }).column : undefined,
        message: translateXsdMessage(rawMessage),
      });
    }
  }

  if (options?.expectedLineCount !== undefined) {
    const actualLines = (xml.match(/<cac:InvoiceLine>/g) ?? []).length;
    if (actualLines !== options.expectedLineCount) {
      issues.push({
        path: "/Invoice/cac:InvoiceLine",
        element: "cac:InvoiceLine",
        message: `Satır sayısı uyuşmuyor (beklenen ${options.expectedLineCount}, XML ${actualLines}).`,
      });
    }
  }

  if (profile === "transport" && /<cac:Signature[\s>]/.test(xml)) {
    issues.push({
      path: "/Invoice/cac:Signature",
      element: "cac:Signature",
      message:
        "İmzasız taşıma profilinde cac:Signature bulunmamalı; imza Sovos provider tarafından uygulanır.",
    });
  }

  const ok = valid && issues.length === 0;
  return { ok, valid: ok, schemaLoaded: true, profile, issues };
}
