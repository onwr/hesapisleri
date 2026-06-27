import { z } from "zod";

export const ONBOARDING_FLOW_VERSION = 1;
export const ONBOARDING_MAX_STEP = 5;

export const onboardingProgressPatchSchema = z
  .object({
    currentStep: z.number().int().min(1).max(ONBOARDING_MAX_STEP),
  })
  .strict();

export type OnboardingProgressPatchInput = z.infer<
  typeof onboardingProgressPatchSchema
>;

export const ONBOARDING_USAGE_AREAS = [
  "sales_pos",
  "products_stock",
  "ecommerce",
  "finance",
  "invoice",
  "employees",
] as const;

export type OnboardingUsageArea = (typeof ONBOARDING_USAGE_AREAS)[number];
