import { PricePreviewServiceError } from "@/lib/admin/price-preview/admin-price-preview-errors";

export function validateSubscriptionBelongsToCompany(input: {
  subscriptionCompanyId: string | null | undefined;
  companyId: string | null | undefined;
}) {
  if (!input.subscriptionCompanyId || !input.companyId) return;
  if (input.subscriptionCompanyId !== input.companyId) {
    throw new PricePreviewServiceError(
      "Seçilen abonelik bu firmaya ait değil.",
      403
    );
  }
}

export function resolvePreviewCompanyId(companyId?: string | null) {
  return companyId?.trim() || null;
}
