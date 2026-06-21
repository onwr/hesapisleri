const TR_MAP: Record<string, string> = {
  ç: "c",
  Ç: "C",
  ğ: "g",
  Ğ: "G",
  ı: "i",
  İ: "I",
  ö: "o",
  Ö: "O",
  ş: "s",
  Ş: "S",
  ü: "u",
  Ü: "U",
};

export function normalizeCouponCode(raw: string) {
  const trimmed = raw.trim();
  const ascii = trimmed
    .split("")
    .map((ch) => TR_MAP[ch] ?? ch)
    .join("");
  return ascii.toUpperCase().replace(/\s+/g, "");
}

export function generateBulkCouponCode(prefix: string, length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < length; i += 1) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix.toUpperCase()}-${suffix}`;
}
