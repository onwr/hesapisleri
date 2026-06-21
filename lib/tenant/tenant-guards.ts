import { TenantForbiddenError, TenantNotFoundError } from "./tenant-errors";

export function assertTenantResource(
  resourceCompanyId: string,
  contextCompanyId: string
) {
  if (resourceCompanyId !== contextCompanyId) {
    throw new TenantNotFoundError();
  }
}

export function rejectMismatchedBodyCompanyId(
  bodyCompanyId: string | null | undefined,
  sessionCompanyId: string
) {
  if (!bodyCompanyId || bodyCompanyId === sessionCompanyId) {
    return;
  }

  throw new TenantForbiddenError();
}
