import { db } from "@/lib/prisma";

const POS_EMAIL_DOMAIN = "pos.hesapisleri.local";

export function sanitizePosUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 48);
}

export function buildPosAccountEmail(username: string, companyId: string) {
  const safeUsername = sanitizePosUsername(username);
  return `${safeUsername}@${companyId}.${POS_EMAIL_DOMAIN}`;
}

export function parsePosUsernameFromEmail(email: string, companyId: string) {
  const suffix = `@${companyId}.${POS_EMAIL_DOMAIN}`;
  if (!email.endsWith(suffix)) return null;
  return email.slice(0, -suffix.length);
}

export function isPosAccountEmail(email: string) {
  return email.includes(`.${POS_EMAIL_DOMAIN}`);
}

export async function resolveLoginEmail(input: string) {
  const trimmed = input.trim();
  if (trimmed.includes("@")) {
    return trimmed.toLowerCase();
  }

  const prefix = `${sanitizePosUsername(trimmed)}@`;
  const matches = await db.user.findMany({
    where: {
      AND: [
        { email: { startsWith: prefix } },
        { email: { contains: `.${POS_EMAIL_DOMAIN}` } },
      ],
    },
    select: { email: true },
    take: 2,
  });

  if (matches.length === 1) {
    return matches[0]!.email;
  }

  if (matches.length > 1) {
    throw new Error(
      "Bu kullanıcı adı birden fazla firmada kayıtlı. Tam giriş adresini kullanın."
    );
  }

  return trimmed.toLowerCase();
}

export const EMPLOYEE_AVATAR_UPLOAD_FOLDER = "hesapisleri/employees";
