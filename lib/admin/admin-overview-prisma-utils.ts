import type { Prisma } from "@prisma/client";

export function decimalToNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  return Number(value);
}
