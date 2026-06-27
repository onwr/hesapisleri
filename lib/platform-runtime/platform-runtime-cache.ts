import "server-only";

import { revalidateTag } from "next/cache";

export function invalidatePlatformRuntimeCaches() {
  revalidateTag("platform-runtime-public", "max");
  revalidateTag("platform-runtime-upload", "max");
  revalidateTag("platform-runtime-legal", "max");
}
