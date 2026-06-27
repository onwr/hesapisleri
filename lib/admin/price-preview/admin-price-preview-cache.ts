export const PRICE_PREVIEW_OPTIONS_CACHE_SECONDS = 60;

export function pricePreviewOptionsCacheControl() {
  return `private, max-age=${PRICE_PREVIEW_OPTIONS_CACHE_SECONDS}`;
}

export function pricePreviewResultCacheControl() {
  return "private, no-store";
}
