const SYNC_METADATA_PATTERNS = [
  /Alıcı:\s*[^.]+\./gi,
  /Tel:\s*[^.]+\./gi,
  /Pazaryeri siparişi \([^)]+\)\. Dış durum:[^.]+\./gi,
  /Paket:\s*[^.]+\./gi,
  /Eşleşmeyen SKU:[^.]+\./gi,
] as const;

export function stripMarketplaceSyncMetadata(note: string | null | undefined) {
  let cleaned = (note ?? "").trim();
  if (!cleaned) return "";

  for (const pattern of SYNC_METADATA_PATTERNS) {
    cleaned = cleaned.replace(pattern, "").trim();
  }

  return cleaned.replace(/\s+/g, " ").replace(/\.\s*$/, "").trim();
}

export function buildMarketplaceOrderNote(input: {
  existingNote?: string | null;
  buyerName?: string | null;
  buyerPhone?: string | null;
  channel: string;
  externalStatus: string;
  externalPackageId?: string | null;
  unmatchedSkus?: string[];
}) {
  const userNote = stripMarketplaceSyncMetadata(input.existingNote);
  const syncParts: string[] = [];

  const buyerName = input.buyerName?.trim();
  if (buyerName) {
    syncParts.push(`Alıcı: ${buyerName}.`);
  }

  const buyerPhone = input.buyerPhone?.trim();
  if (buyerPhone) {
    syncParts.push(`Tel: ${buyerPhone}.`);
  }

  syncParts.push(
    `Pazaryeri siparişi (${input.channel}). Dış durum: ${input.externalStatus}.`
  );

  if (input.externalPackageId) {
    syncParts.push(`Paket: ${input.externalPackageId}.`);
  }

  if (input.unmatchedSkus && input.unmatchedSkus.length > 0) {
    syncParts.push(
      `Eşleşmeyen SKU: ${input.unmatchedSkus.join(", ")}. Ürün eşlemesi yapıldıktan sonra onaylayın.`
    );
  }

  const syncText = syncParts.filter(Boolean).join(" ");
  if (!userNote) return syncText;
  if (!syncText) return userNote;
  return `${userNote} ${syncText}`.trim();
}
