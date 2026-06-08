export function generateSaleNo(year = new Date().getFullYear()) {
  const random = Math.floor(10000 + Math.random() * 90000);
  return `S-${year}-${random}`;
}

export function generateQuoteNo(year = new Date().getFullYear()) {
  const random = Math.floor(10000 + Math.random() * 90000);
  return `T-${year}-${random}`;
}
