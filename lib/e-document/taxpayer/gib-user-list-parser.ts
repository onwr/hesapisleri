export type GibUserAlias = {
  alias: string;
  type: string;
  title?: string;
  active: boolean;
  deleted?: boolean;
  taxId?: string;
};

export type NormalizedTaxpayerResult = {
  taxId: string;
  registered: boolean;
  title?: string;
  status: "ACTIVE" | "INACTIVE" | "NOT_FOUND";
  pkAliases: GibUserAlias[];
  activePkAliases: GibUserAlias[];
  recommendedDocumentType: "E_INVOICE" | "E_ARCHIVE";
  lookupOperation: "getRAWUserList" | "local-cache" | "none";
  syncOperation?: "getRAWUserList" | "getPartialUserList";
};

/**
 * GİB mükellef listesi senkronu: getRAWUserList tam ZIP döner.
 * getPartialUserList parça indirir; VKN_TCKN alanı entegratör VKN'sidir, müşteri filtresi değildir.
 */
export const SOVOS_TAXPAYER_SYNC_OPERATION = "getRAWUserList" as const;

/** Tek müşteri sorgusu: senkronize listeden yerel arama. */
export const SOVOS_TAXPAYER_LOOKUP_METHOD = "local-cache" as const;

/** @deprecated SOVOS_TAXPAYER_SYNC_OPERATION kullanın */
export const SOVOS_TAXPAYER_LIST_OPERATION = SOVOS_TAXPAYER_SYNC_OPERATION;

export function parseGibUserListXml(xml: string): GibUserAlias[] {
  const aliases: GibUserAlias[] = [];
  const userBlocks = xml.match(/<User[\s\S]*?<\/User>/gi) ?? [];

  for (const block of userBlocks) {
    const identifier =
      block.match(/<Identifier[^>]*>([^<]+)<\/Identifier>/i)?.[1]?.trim() ??
      block.match(/<Alias[^>]*>([^<]+)<\/Alias>/i)?.[1]?.trim();
    if (!identifier) continue;

    const type = block.match(/<Type[^>]*>([^<]+)<\/Type>/i)?.[1]?.trim() ?? "";
    const title = block.match(/<Title[^>]*>([^<]+)<\/Title>/i)?.[1]?.trim();
    const taxId =
      block.match(/<(?:VKN_TCKN|vknTckn|VknTckn)[^>]*>([^<]+)<\//i)?.[1]?.replace(/\D/g, "") ??
      undefined;
    const deleted = /<Deleted[^>]*>true<\/Deleted>/i.test(block);
    const active = !deleted && !/<Deactivated[^>]*>true<\/Deactivated>/i.test(block);

    aliases.push({
      alias: identifier,
      type,
      title,
      active,
      deleted,
      taxId,
    });
  }

  if (aliases.length === 0) {
    const simpleAliases = [...xml.matchAll(/urn:mail:[^<\s"']+/gi)].map((match) => match[0]);
    for (const alias of simpleAliases) {
      aliases.push({ alias, type: "PK", active: true });
    }
  }

  return aliases;
}

export function filterGibUserAliasesByTaxId(xmlContents: string[], taxId: string): GibUserAlias[] {
  const normalizedTaxId = taxId.replace(/\D/g, "");
  if (!normalizedTaxId) return [];

  const matches: GibUserAlias[] = [];

  for (const xml of xmlContents) {
    const userBlocks = xml.match(/<User[\s\S]*?<\/User>/gi) ?? [];
    for (const block of userBlocks) {
      const blockTaxId =
        block.match(/<(?:VKN_TCKN|vknTckn|VknTckn)[^>]*>([^<]+)<\//i)?.[1]?.replace(/\D/g, "") ??
        "";
      if (blockTaxId && blockTaxId !== normalizedTaxId) {
        continue;
      }
      if (!blockTaxId && !block.includes(normalizedTaxId)) {
        continue;
      }
      matches.push(...parseGibUserListXml(block));
    }
  }

  if (matches.length > 0) {
    return matches;
  }

  return parseGibUserListXml(xmlContents.join("\n")).filter(
    (item) => item.taxId === normalizedTaxId
  );
}

export function normalizeTaxpayerFromAliases(
  taxId: string,
  aliases: GibUserAlias[],
  lookupOperation: NormalizedTaxpayerResult["lookupOperation"] = "local-cache"
): NormalizedTaxpayerResult {
  const pkAliases = aliases.filter((item) => /PK/i.test(item.type) || item.alias.includes("@"));
  const activePkAliases = pkAliases.filter((item) => item.active && !item.deleted);

  const registered = activePkAliases.length > 0;
  const title = activePkAliases[0]?.title ?? pkAliases[0]?.title;

  return {
    taxId,
    registered,
    title,
    status: registered ? "ACTIVE" : aliases.length > 0 ? "INACTIVE" : "NOT_FOUND",
    pkAliases,
    activePkAliases,
    recommendedDocumentType: registered ? "E_INVOICE" : "E_ARCHIVE",
    lookupOperation,
    syncOperation: SOVOS_TAXPAYER_SYNC_OPERATION,
  };
}

/** getPartialUserList tek VKN filtresi yapmaz — sözleşme doğrulaması. */
export function getPartialUserListFiltersSingleTaxId(): boolean {
  return false;
}
