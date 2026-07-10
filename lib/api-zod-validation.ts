import type { ZodError } from "zod";
import {
  getFirstZodErrorMessage,
  mapZodFieldErrors,
} from "@/lib/api-user-error";

export function buildZodValidationErrorBody(
  error: ZodError,
  options?: {
    message?: string;
    fieldLabels?: Record<string, string>;
  }
) {
  const fieldErrors = error.flatten().fieldErrors;

  return {
    success: false as const,
    message:
      options?.message ??
      getFirstZodErrorMessage(fieldErrors, options?.fieldLabels),
    errors: mapZodFieldErrors(fieldErrors, options?.fieldLabels),
  };
}
