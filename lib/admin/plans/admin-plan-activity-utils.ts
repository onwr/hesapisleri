import {
  maskIp,
  redactActivityForResponse,
  redactValueRecursive,
  isSensitiveMetadataKey,
} from "@/lib/admin/plans/admin-plan-activity-scope";

export { maskIp, redactActivityForResponse, redactValueRecursive, isSensitiveMetadataKey };

/** @deprecated redactActivityForResponse kullanın */
export function redactActivityMessage(message: string | null): string {
  return redactActivityForResponse({ message, metadata: null });
}
