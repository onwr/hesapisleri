export function getBankLogo(accountName?: string | null) {
  if (!accountName) return null;

  const name = accountName.toLocaleLowerCase("tr-TR");

  if (
    name.includes("iş") ||
    name.includes("is bankasi") ||
    name.includes("iş bankası") ||
    name.includes("isbank")
  ) {
    return "/isbankasi.jpg";
  }

  if (name.includes("garanti") || name.includes("bbva")) {
    return "/garantibbva.jpg";
  }

  if (name.includes("vakıf") || name.includes("vakif")) {
    return "/vakifbank.webp";
  }

  if (name.includes("ziraat")) {
    return "/ziraatbank.jpg";
  }

  if (name.includes("akbank")) {
    return "/akbank.jpg";
  }

  if (name.includes("yapı") || name.includes("yapi") || name.includes("kredi")) {
    return "/yapikredi.jpg";
  }

  return null;
}
