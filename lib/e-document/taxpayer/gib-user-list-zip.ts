import AdmZip from "adm-zip";

export const GIB_USER_LIST_MAX_ZIP_BYTES = 50 * 1024 * 1024;
export const GIB_USER_LIST_MAX_XML_ENTRIES = 500;
export const GIB_USER_LIST_MAX_ENTRY_BYTES = 10 * 1024 * 1024;

export class GibUserListZipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GibUserListZipError";
  }
}

export function extractBase64PayloadFromSoap(soapBody: string, tagNames: string[]): Buffer | null {
  for (const tag of tagNames) {
    const match = soapBody.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, "i"));
    if (match?.[1]) {
      return Buffer.from(match[1].trim(), "base64");
    }
  }
  return null;
}

function assertSafeEntryName(entryName: string) {
  const normalized = entryName.replace(/\\/g, "/");
  if (normalized.includes("..") || normalized.startsWith("/")) {
    throw new GibUserListZipError(`Güvenli olmayan ZIP yolu: ${entryName}`);
  }
}

export function validateGibUserListZipEntryName(entryName: string) {
  assertSafeEntryName(entryName);
}

export function extractXmlFromUserListZip(zipBuffer: Buffer): string[] {
  if (zipBuffer.length > GIB_USER_LIST_MAX_ZIP_BYTES) {
    throw new GibUserListZipError("GİB mükellef listesi ZIP boyutu limiti aşıldı.");
  }

  const zip = new AdmZip(zipBuffer);
  const xmlParts: string[] = [];

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    assertSafeEntryName(entry.entryName);

    const name = entry.entryName.toLowerCase();
    if (!name.endsWith(".xml")) continue;

    const data = entry.getData();
    if (data.length > GIB_USER_LIST_MAX_ENTRY_BYTES) {
      throw new GibUserListZipError(`ZIP girdisi çok büyük: ${entry.entryName}`);
    }

    xmlParts.push(data.toString("utf8"));
    if (xmlParts.length > GIB_USER_LIST_MAX_XML_ENTRIES) {
      throw new GibUserListZipError("ZIP içindeki XML dosya sayısı limiti aşıldı.");
    }
  }

  return xmlParts;
}
