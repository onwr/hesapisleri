export {
  ONBOARDING_FLOW_VERSION,
  ONBOARDING_MAX_STEP,
  ONBOARDING_USAGE_AREAS,
  onboardingProgressPatchSchema,
} from "@/lib/onboarding/onboarding-schemas";

export {
  ONBOARDING_EXEMPT_ROUTE_PREFIXES,
  ONBOARDING_RETURN_TO_ALLOWLIST,
  isOnboardingExemptPath,
  parseSafeInternalReturnTo,
  resolvePostCreateRedirect,
  sanitizeOnboardingReturnTo,
} from "@/lib/onboarding/onboarding-routes";

export {
  buildOnboardingChecklist,
  calculateChecklistProgressPercent,
  getOnboardingMilestonesUncached,
} from "@/lib/onboarding/onboarding-progress";

export {
  completeCompanyOnboarding,
  createOnboardingForNewCompany,
  dismissCompanyOnboarding,
  dismissOnboardingChecklist,
  ensureCompanyOperationalDefaults,
  getDashboardOnboardingChecklist,
  getOnboardingBundle,
  getOrCreateCompanyOnboarding,
  reopenCompanyOnboarding,
  reopenOnboardingChecklist,
  serializeOnboardingState,
  startCompanyOnboarding,
  updateOnboardingProgress,
  validateOnboardingCompletionRequirements,
  assertCanManageCompanyOnboarding,
  OnboardingServiceError,
} from "@/lib/onboarding/onboarding-service";

export {
  resolveOnboardingRedirectPath,
  shouldForceOnboardingRedirect,
} from "@/lib/onboarding/onboarding-redirect";

export { isCompanyProfileComplete } from "@/lib/onboarding/onboarding-company-utils";

export { getCachedOnboardingMilestones } from "@/lib/onboarding/onboarding-cache";
