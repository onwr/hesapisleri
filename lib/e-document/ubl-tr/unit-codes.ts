/** UN/ECE Rec 20 — bilinen birim eşlemeleri (sessiz C62 fallback yok). */
const UNIT_CODE_MAP: Record<string, string> = {
  adet: "C62",
  ad: "C62",
  piece: "C62",
  c62: "C62",
  kg: "KGM",
  kilogram: "KGM",
  kgm: "KGM",
  gr: "GRM",
  gram: "GRM",
  grm: "GRM",
  lt: "LTR",
  litre: "LTR",
  ltr: "LTR",
  m: "MTR",
  metre: "MTR",
  mtr: "MTR",
  paket: "PA",
  pa: "PA",
  kutu: "BX",
  bx: "BX",
  saat: "HUR",
  hur: "HUR",
  gun: "DAY",
  gün: "DAY",
  day: "DAY",
};

export function resolveUnitCode(unit: string | null | undefined):
  | { ok: true; code: string }
  | { ok: false; message: string } {
  const raw = String(unit ?? "").trim();
  if (!raw) {
    return { ok: false, message: "Birim kodu zorunludur." };
  }

  if (/^[A-Z0-9]{2,3}$/.test(raw)) {
    return { ok: true, code: raw.toUpperCase() };
  }

  const mapped = UNIT_CODE_MAP[raw.toLowerCase()];
  if (!mapped) {
    return {
      ok: false,
      message: `Bilinmeyen birim kodu: "${raw}". Lütfen geçerli UN/ECE birim kodu girin.`,
    };
  }

  return { ok: true, code: mapped };
}
