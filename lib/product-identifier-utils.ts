export function generateProductSku(year = new Date().getFullYear()) {
  const random = Math.floor(10000 + Math.random() * 90000);
  return `STK-${year}-${random}`;
}

function ean13CheckDigit(code12: string) {
  const digits = code12.split("").map((char) => Number(char));
  const sum = digits.reduce(
    (total, digit, index) => total + digit * (index % 2 === 0 ? 1 : 3),
    0
  );
  return String((10 - (sum % 10)) % 10);
}

export function generateProductBarcode(prefix = "869") {
  const randomPart = String(Math.floor(Math.random() * 1_000_000_000)).padStart(
    9,
    "0"
  );
  const base = `${prefix}${randomPart}`.slice(0, 12);
  return base + ean13CheckDigit(base);
}
