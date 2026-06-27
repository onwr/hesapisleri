export function formatMaxBytesMessage(maxBytes: number) {
  const mb = maxBytes / (1024 * 1024);
  const label = Number.isInteger(mb) ? `${mb}` : mb.toFixed(1);
  return `Dosya boyutu ${label}MB'dan küçük olmalıdır`;
}

export function formatMaxBytesMbLabel(maxBytes: number) {
  const mb = maxBytes / (1024 * 1024);
  return Number.isInteger(mb) ? `${mb}` : mb.toFixed(1);
}
