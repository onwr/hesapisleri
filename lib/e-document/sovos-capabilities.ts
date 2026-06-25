export type SovosServiceCapability = {
  /** Ayarlar / credential mevcut */
  configured: boolean;
  /** WSDL/XSD sözleşmesi doğrulandı */
  contractReady: boolean;
  /** Yalnız mock/test ortamı SOAP testi başarılı */
  mockTested: boolean;
  /** Yalnız gerçek Sovos provider çağrısı başarılı */
  verified: boolean;
};

export type SovosCapabilities = {
  eInvoice: SovosServiceCapability;
  eArchive: SovosServiceCapability;
  eDespatch: SovosServiceCapability;
  taxpayerLookup: boolean;
  invoiceDownload: boolean;
  archiveCancel: boolean;
  archiveRetrigger: boolean;
};

const EMPTY_CAPABILITY: SovosServiceCapability = {
  configured: false,
  contractReady: false,
  mockTested: false,
  verified: false,
};

export const DEFAULT_SOVOS_CAPABILITIES: SovosCapabilities = {
  eInvoice: { ...EMPTY_CAPABILITY },
  eArchive: { ...EMPTY_CAPABILITY },
  eDespatch: { ...EMPTY_CAPABILITY },
  taxpayerLookup: false,
  invoiceDownload: false,
  archiveCancel: false,
  archiveRetrigger: false,
};

export function isSovosContractReady() {
  return true;
}

function parseServiceCapability(
  raw: Partial<SovosServiceCapability> | undefined,
  fallbackConfigured = false
): SovosServiceCapability {
  if (!raw || typeof raw !== "object") {
    return {
      configured: fallbackConfigured,
      contractReady: isSovosContractReady(),
      mockTested: false,
      verified: false,
    };
  }

  return {
    configured: Boolean(raw.configured ?? fallbackConfigured),
    contractReady: Boolean(raw.contractReady ?? isSovosContractReady()),
    mockTested: Boolean(raw.mockTested),
    verified: Boolean(raw.verified),
  };
}

export function buildSovosCapabilitiesFromInput(input: {
  hasInvoiceCredentials: boolean;
  hasArchiveCredentials: boolean;
  hasDespatchCredentials?: boolean;
}): SovosCapabilities {
  const contractReady = isSovosContractReady();
  return {
    eInvoice: {
      configured: input.hasInvoiceCredentials,
      contractReady,
      mockTested: false,
      verified: false,
    },
    eArchive: {
      configured: input.hasArchiveCredentials,
      contractReady,
      mockTested: false,
      verified: false,
    },
    eDespatch: {
      configured: Boolean(input.hasDespatchCredentials),
      contractReady,
      mockTested: false,
      verified: false,
    },
    taxpayerLookup: false,
    invoiceDownload: false,
    archiveCancel: false,
    archiveRetrigger: false,
  };
}

export type SovosVerificationMode = "none" | "mock" | "real";

export function buildSovosCapabilitiesFromTestOutcomes(input: {
  credentials: {
    hasInvoiceCredentials: boolean;
    hasArchiveCredentials: boolean;
    hasDespatchCredentials: boolean;
  };
  outcomes: Array<{
    service: "eInvoice" | "eArchive" | "eDespatch";
    ok: boolean;
    skipped: boolean;
  }>;
  verificationMode: SovosVerificationMode;
}): SovosCapabilities {
  const contractReady = isSovosContractReady();
  const outcomeMap = Object.fromEntries(
    input.outcomes.map((item) => [item.service, item])
  ) as Record<"eInvoice" | "eArchive" | "eDespatch", (typeof input.outcomes)[number]>;

  function capabilityFor(
    service: "eInvoice" | "eArchive" | "eDespatch",
    configured: boolean
  ): SovosServiceCapability {
    const outcome = outcomeMap[service];
    const testedOk = Boolean(outcome && !outcome.skipped && outcome.ok);
    return {
      configured,
      contractReady,
      mockTested: input.verificationMode === "mock" && testedOk,
      verified: input.verificationMode === "real" && testedOk,
    };
  }

  const eInvoice = capabilityFor("eInvoice", input.credentials.hasInvoiceCredentials);
  const eArchive = capabilityFor("eArchive", input.credentials.hasArchiveCredentials);
  const eDespatch = capabilityFor("eDespatch", input.credentials.hasDespatchCredentials);

  return {
    eInvoice,
    eArchive,
    eDespatch,
    taxpayerLookup: eInvoice.verified,
    invoiceDownload: false,
    archiveCancel: false,
    archiveRetrigger: false,
  };
}

export function parseSovosCapabilities(value: unknown): SovosCapabilities {
  if (!value || typeof value !== "object") {
    return DEFAULT_SOVOS_CAPABILITIES;
  }
  const raw = value as Partial<SovosCapabilities>;
  return {
    eInvoice: parseServiceCapability(raw.eInvoice),
    eArchive: parseServiceCapability(raw.eArchive),
    eDespatch: parseServiceCapability(raw.eDespatch),
    taxpayerLookup: Boolean(raw.taxpayerLookup),
    invoiceDownload: Boolean(raw.invoiceDownload),
    archiveCancel: Boolean(raw.archiveCancel),
    archiveRetrigger: Boolean(raw.archiveRetrigger),
  };
}
