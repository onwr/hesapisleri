export const FINANCE_REVERSAL_NOTE_PREFIX = "[REVERSAL]";
export const FINANCE_CORRECTION_NOTE_PREFIX = "[CORRECTION]";

export type FinanceMirrorKind = "REVERSAL" | "CORRECTION";

export function buildFinanceMirrorNote(
  kind: FinanceMirrorKind,
  message: string
) {
  const prefix =
    kind === "REVERSAL"
      ? FINANCE_REVERSAL_NOTE_PREFIX
      : FINANCE_CORRECTION_NOTE_PREFIX;

  return `${prefix} ${message}`;
}

export function getFinanceMirrorKind(transaction: {
  title: string;
  note?: string | null;
}): FinanceMirrorKind | null {
  const note = transaction.note ?? "";

  if (note.includes(FINANCE_REVERSAL_NOTE_PREFIX)) {
    return "REVERSAL";
  }

  if (note.includes(FINANCE_CORRECTION_NOTE_PREFIX)) {
    return "CORRECTION";
  }

  const title = transaction.title.toLocaleLowerCase("tr-TR");

  if (title.includes("satış iptali") || title.includes("satis iptali")) {
    return "REVERSAL";
  }

  if (
    title.includes("satış düzeltme") ||
    title.includes("satis duzeltme") ||
    title.includes("düzeltme geri alım") ||
    title.includes("duzeltme geri alim")
  ) {
    return "CORRECTION";
  }

  return null;
}

export function isFinanceMirrorTransaction(transaction: {
  title: string;
  note?: string | null;
}) {
  return getFinanceMirrorKind(transaction) !== null;
}
