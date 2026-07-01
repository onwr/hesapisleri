const SUPPORT_FALLBACK = "https://hesapisleri.com/destek";

// `href="#"` veya boş string asla dönmez.
export const SUPPORT_URL =
  process.env.NEXT_PUBLIC_SUPPORT_URL?.trim() || SUPPORT_FALLBACK;
