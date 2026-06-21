import { sanitizeAuthRedirectPath } from "@/lib/auth/auth-redirect";

export function sanitizeRedirectPath(
  value: string | null | undefined
): string | null {
  if (!value) {
    return null;
  }

  const sanitized = sanitizeAuthRedirectPath(value, { fallback: "" });

  return sanitized || null;
}

export { sanitizeAuthRedirectPath } from "@/lib/auth/auth-redirect";
