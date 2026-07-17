/**
 * Pazaryeri / e-ticaret yüzeyleri için ürün feature flag'i.
 *
 * Varsayılan: kapalı (esnaf odaklı konumlandırma).
 * Production'da açmak için:
 *   MARKETPLACE_FEATURE_ENABLED=true
 *
 * NEXT_PUBLIC_MARKETPLACE_FEATURE_ENABLED yalnız server flag unset iken
 * fallback olarak okunur. Server false / client true çelişkisinde
 * server policy kazanır.
 *
 * Backend servisler, modeller ve migration'lar korunur; yalnız UI/navigation
 * ve public marketing yüzeyleri gizlenir.
 */

const TRUTHY = new Set(["1", "true", "yes", "on"]);

export const MARKETPLACE_FEATURE_ENV_KEY = "MARKETPLACE_FEATURE_ENABLED";

export function parseFeatureFlag(value: string | undefined | null): boolean {
  if (!value) return false;
  return TRUTHY.has(value.trim().toLowerCase());
}

function hasExplicitEnvValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Server `MARKETPLACE_FEATURE_ENABLED` tanımlıysa yalnız o kullanılır.
 * Aksi halde `NEXT_PUBLIC_MARKETPLACE_FEATURE_ENABLED` fallback.
 * Hiçbiri yoksa false.
 */
export function isMarketplaceFeatureEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  if (hasExplicitEnvValue(env.MARKETPLACE_FEATURE_ENABLED)) {
    return parseFeatureFlag(env.MARKETPLACE_FEATURE_ENABLED);
  }

  return parseFeatureFlag(env.NEXT_PUBLIC_MARKETPLACE_FEATURE_ENABLED);
}
