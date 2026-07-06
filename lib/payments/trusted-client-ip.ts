import "server-only";

import { isIP } from "node:net";

/**
 * TRUSTED PROXY VARSAYIMI: uygulama yalnız kendi nginx'inin arkasında
 * çalışır ve nginx şu directive'leri uygular (bkz. docs/production/
 * nginx-security.md):
 *   proxy_set_header X-Real-IP $remote_addr;
 *   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
 *
 * X-Real-IP nginx tarafından her istekte EZİLEREK (overwrite, append değil)
 * ayarlanır — istemci bu header'a rastgele değer koyup nginx'i atlatamaz.
 * Bu yüzden X-Real-IP birincil kaynaktır.
 *
 * X-Forwarded-For ise `$proxy_add_x_forwarded_for` ile İSTEMCİNİN gönderdiği
 * değere EKLEME yapar (append) — dizinin İLK elemanı hâlâ istemci tarafından
 * uydurulabilir (örn. "1.2.3.4, <gerçek ip>" şeklinde sahte bir ilk IP
 * eklenebilir). Bu yüzden yalnız fallback olarak ve dizinin SON elemanı
 * (nginx'in eklediği, gerçek TCP peer) kullanılır — asla ilk eleman değil.
 */
function normalizeIp(candidate: string | null | undefined) {
  if (!candidate) return null;
  const trimmed = candidate.trim();
  if (!trimmed || trimmed.length > 45) return null;
  return isIP(trimmed) ? trimmed : null;
}

function lastTrustedForwardedFor(value: string | null) {
  if (!value) return null;
  const parts = value.split(",").map((part) => part.trim());
  const lastHop = parts[parts.length - 1];
  return normalizeIp(lastHop);
}

export function getTrustedClientIp(request: Request) {
  const realIp = normalizeIp(request.headers.get("x-real-ip"));
  if (realIp) return realIp;

  const forwarded = lastTrustedForwardedFor(request.headers.get("x-forwarded-for"));
  if (forwarded) return forwarded;

  return "127.0.0.1";
}

export function maskClientIp(value: string | null | undefined) {
  if (!value) return null;
  if (value.includes(":")) return `${value.slice(0, 6)}…`;
  const parts = value.split(".");
  if (parts.length !== 4) return "masked";
  return `${parts[0]}.${parts[1]}.x.x`;
}
