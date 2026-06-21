import "server-only";

import {
  resolvePaytrCapabilities,
  serializePaytrCapabilities,
  type PaytrCapabilities,
  type SerializedPaytrCapabilities,
} from "./paytr-capabilities-core";
import { getPaytrConfig, type PaytrConfig } from "./providers/paytr/paytr-config";

export {
  assertPaytrCheckoutOptionsAllowed,
  normalizePaytrCheckoutOptions,
  resolveAutoRenewFromPaymentMetadata,
  resolvePaytrCapabilities,
  serializePaytrCapabilities,
  type PaytrCapabilities,
  type SerializedPaytrCapabilities,
} from "./paytr-capabilities-core";

export function getPaytrCapabilities(config: PaytrConfig = getPaytrConfig()) {
  return resolvePaytrCapabilities({
    integrationMode: config.integrationMode,
    directApiEnabled: config.directApiEnabled,
    cardStorageEnabled: config.cardStorageEnabled,
    recurringEnabled: config.recurringEnabled,
    non3dEnabled: config.non3dEnabled,
  });
}

export function getSerializedPaytrCapabilities(
  config: PaytrConfig = getPaytrConfig()
): SerializedPaytrCapabilities {
  return serializePaytrCapabilities(getPaytrCapabilities(config));
}
