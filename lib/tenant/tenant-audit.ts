import "server-only";

type CrossTenantAttemptLog = {
  requestId?: string;
  userId: string;
  companyId: string;
  resourceType: string;
  resourceId: string;
  endpoint: string;
};

export function logCrossTenantAccessAttempt(input: CrossTenantAttemptLog) {
  console.warn("TENANT_ISOLATION_ATTEMPT", {
    requestId: input.requestId,
    userId: input.userId,
    companyId: input.companyId,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    endpoint: input.endpoint,
    timestamp: new Date().toISOString(),
  });
}
