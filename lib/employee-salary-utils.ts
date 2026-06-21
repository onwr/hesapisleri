import { z } from "zod";
import type { EmployeeSalaryPeriod } from "@prisma/client";

export const employeeSalaryFormSchema = z.object({
  amount: z.coerce.number().positive("Net maaş sıfırdan büyük olmalıdır."),
  grossAmount: z.coerce.number().positive().optional().nullable(),
  period: z.enum(["MONTHLY", "WEEKLY", "DAILY", "HOURLY"]).default("MONTHLY"),
  currency: z.string().trim().min(1).default("TRY"),
  paymentDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
  iban: z.string().trim().max(34).optional().nullable(),
  bankName: z.string().trim().max(120).optional().nullable(),
  effectiveFrom: z.string().optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const employeeSalaryPatchSchema = employeeSalaryFormSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "Güncellenecek alan bulunamadı." }
);

export function normalizeSalaryPatchInput(input: z.infer<typeof employeeSalaryPatchSchema>) {
  return {
    amount: input.amount,
    grossAmount: input.grossAmount ?? undefined,
    period: input.period as EmployeeSalaryPeriod | undefined,
    currency: input.currency,
    paymentDay: input.paymentDay ?? undefined,
    iban: input.iban?.trim() || undefined,
    bankName: input.bankName?.trim() || undefined,
    effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : undefined,
    notes: input.notes?.trim() || undefined,
  };
}

export function salaryAmountChanged(
  currentAmount: number,
  nextAmount: number | undefined
) {
  return nextAmount != null && Math.abs(currentAmount - nextAmount) > 0.0001;
}
