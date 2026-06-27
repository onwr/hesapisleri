const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T/;

export function formatHealthDetailScalar(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "Evet" : "Hayır";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (ISO_DATE_PATTERN.test(value)) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleString("tr-TR");
      }
    }
    return value;
  }
  return String(value);
}

export function formatHealthDetailEntry(key: string, value: unknown): string[] {
  if (value == null) {
    return [`${key}: —`];
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return [`${key}: —`];
    if (value.every((item) => typeof item !== "object" || item == null)) {
      return [`${key}: ${value.map((item) => formatHealthDetailScalar(item)).join(", ")}`];
    }
    return value.flatMap((item, index) =>
      typeof item === "object" && item != null
        ? formatHealthDetailObject(`${key}[${index}]`, item as Record<string, unknown>)
        : [`${key}[${index}]: ${formatHealthDetailScalar(item)}`]
    );
  }

  if (typeof value === "object") {
    return formatHealthDetailObject(key, value as Record<string, unknown>);
  }

  return [`${key}: ${formatHealthDetailScalar(value)}`];
}

function formatHealthDetailObject(prefix: string, obj: Record<string, unknown>): string[] {
  const lines: string[] = [];
  for (const [childKey, childValue] of Object.entries(obj)) {
    const fullKey = `${prefix}.${childKey}`;
    if (childValue != null && typeof childValue === "object" && !Array.isArray(childValue)) {
      lines.push(...formatHealthDetailObject(fullKey, childValue as Record<string, unknown>));
    } else {
      lines.push(...formatHealthDetailEntry(fullKey, childValue));
    }
  }
  return lines;
}

export function formatHealthDetailsLines(details: Record<string, unknown>, limit = 12): string[] {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(details)) {
    lines.push(...formatHealthDetailEntry(key, value));
    if (lines.length >= limit) break;
  }
  return lines.slice(0, limit);
}
