export type PaytrIntegrationMode = "iframe" | "direct";

export type PaytrCapabilityFlags = {
  integrationMode: PaytrIntegrationMode;
  directApiEnabled: boolean;
  cardStorageEnabled: boolean;
  recurringEnabled: boolean;
  non3dEnabled: boolean;
};

export type PaytrCapabilities = {
  integrationMode: PaytrIntegrationMode;
  directApiEnabled: boolean;
  cardStorageEnabled: boolean;
  recurringEnabled: boolean;
  non3dEnabled: boolean;
  cardStorageAvailable: boolean;
  autoRenewAvailable: boolean;
  manualRenewalOnly: boolean;
  renewalMode: "manual" | "automatic";
};

export type SerializedPaytrCapabilities = PaytrCapabilities & {
  checkoutHint: string;
};

export function resolvePaytrCapabilities(
  flags: PaytrCapabilityFlags
): PaytrCapabilities {
  const cardStorageAvailable =
    flags.integrationMode === "direct" &&
    flags.directApiEnabled &&
    flags.cardStorageEnabled;

  const autoRenewAvailable =
    cardStorageAvailable && flags.recurringEnabled && flags.non3dEnabled;

  return {
    integrationMode: flags.integrationMode,
    directApiEnabled: flags.directApiEnabled,
    cardStorageEnabled: flags.cardStorageEnabled,
    recurringEnabled: flags.recurringEnabled,
    non3dEnabled: flags.non3dEnabled,
    cardStorageAvailable,
    autoRenewAvailable,
    manualRenewalOnly: !autoRenewAvailable,
    renewalMode: autoRenewAvailable ? "automatic" : "manual",
  };
}

export function serializePaytrCapabilities(
  caps: PaytrCapabilities
): SerializedPaytrCapabilities {
  return {
    ...caps,
    checkoutHint: caps.autoRenewAvailable
      ? "Kart saklama ve otomatik yenileme Direct API ile kullanılabilir."
      : caps.integrationMode === "iframe"
        ? "PayTR iFrame modunda üyelik süresi dolduğunda manuel yenileme yapılır."
        : "Otomatik yenileme için PayTR Direct API, kart saklama, recurring ve non-3D yetkileri gerekir.",
  };
}

export function normalizePaytrCheckoutOptions(
  caps: PaytrCapabilities,
  input: { autoRenew: boolean; saveCard: boolean }
) {
  if (!caps.autoRenewAvailable) {
    return { autoRenew: false, saveCard: false };
  }

  if (input.autoRenew && !input.saveCard) {
    return { autoRenew: true, saveCard: true };
  }

  return {
    autoRenew: input.autoRenew,
    saveCard: input.saveCard,
  };
}

export function assertPaytrCheckoutOptionsAllowed(
  caps: PaytrCapabilities,
  input: { autoRenew: boolean; saveCard: boolean }
) {
  if (!input.autoRenew && !input.saveCard) {
    return;
  }

  if (caps.manualRenewalOnly) {
    throw new Error(
      "Bu PayTR entegrasyon modunda kart saklama ve otomatik yenileme kullanılamaz."
    );
  }

  if (input.autoRenew && !caps.autoRenewAvailable) {
    throw new Error("PayTR otomatik yenileme yetkileri aktif değil.");
  }

  if (input.saveCard && !caps.cardStorageAvailable) {
    throw new Error("PayTR kart saklama yetkisi aktif değil.");
  }
}

export function resolveAutoRenewFromPaymentMetadata(
  caps: PaytrCapabilities,
  metadata: { autoRenew?: boolean; saveCard?: boolean } | null | undefined
) {
  if (!caps.autoRenewAvailable) {
    return false;
  }

  return Boolean(metadata?.autoRenew && metadata?.saveCard);
}
