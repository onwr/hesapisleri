import { z } from "zod";

const ICON_KEY_SLUG = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const UNSAFE_ICON = /<|>|script|svg/i;

export function validateIconKey(iconKey: string | null | undefined): string | null {
  if (iconKey == null || iconKey === "") return null;
  const trimmed = iconKey.trim();
  if (!trimmed) return null;
  if (UNSAFE_ICON.test(trimmed)) {
    throw new AdminPlanFeatureValidationError("iconKey güvenli slug formatında olmalıdır.");
  }
  if (!ICON_KEY_SLUG.test(trimmed)) {
    throw new AdminPlanFeatureValidationError("iconKey güvenli slug formatında olmalıdır.");
  }
  return trimmed;
}

export function normalizeFeatureTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

export class AdminPlanFeatureValidationError extends Error {
  status = 400;
  constructor(message: string) {
    super(message);
    this.name = "AdminPlanFeatureValidationError";
  }
}

export class AdminPlanFeatureServiceError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.name = "AdminPlanFeatureServiceError";
    this.status = status;
    this.code = code;
  }
}

const titleField = z
  .string()
  .min(1)
  .max(200)
  .transform((s) => s.trim())
  .refine((s) => s.length >= 1, "Başlık zorunludur.");

const shortDescriptionField = z
  .string()
  .max(500)
  .nullable()
  .optional()
  .transform((v) => {
    if (v == null) return null;
    const t = v.trim();
    return t.length ? t : null;
  });

const iconKeyField = z
  .string()
  .max(64)
  .nullable()
  .optional()
  .transform((v, ctx) => {
    try {
      return validateIconKey(v);
    } catch (e) {
      if (e instanceof AdminPlanFeatureValidationError) {
        ctx.addIssue({ code: "custom", message: e.message });
        return z.NEVER;
      }
      throw e;
    }
  });

export const adminPlanFeatureCreateSchema = z
  .object({
    title: titleField,
    shortDescription: shortDescriptionField,
    iconKey: iconKeyField,
    sortOrder: z.number().int().min(0).max(9999).optional(),
    isHighlighted: z.boolean().optional(),
    isVisible: z.boolean().optional(),
  })
  .strict();

export const adminPlanFeatureUpdateSchema = z
  .object({
    title: titleField.optional(),
    shortDescription: shortDescriptionField,
    iconKey: iconKeyField,
    sortOrder: z.number().int().min(0).max(9999).optional(),
    isHighlighted: z.boolean().optional(),
    isVisible: z.boolean().optional(),
    reason: z.string().min(1).max(2000).optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).some((k) => k !== "reason"), "En az bir alan gerekli.");

export const adminPlanFeatureReorderSchema = z
  .object({
    orderedFeatureIds: z.array(z.string().min(1)).min(1),
  })
  .strict();

export type AdminPlanFeatureCreateInput = z.infer<typeof adminPlanFeatureCreateSchema>;
export type AdminPlanFeatureUpdateInput = z.infer<typeof adminPlanFeatureUpdateSchema>;
