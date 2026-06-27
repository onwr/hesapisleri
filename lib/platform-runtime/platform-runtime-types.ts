export type PublicPlatformRuntimeConfig = {
  maxImageBytes: number;
  maxTaxCertificateBytes: number;
  brandName: string;
  supportEmail: string;
  supportPhone: string | null;
  websiteUrl: string;
  registrationEnabled: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
};

export type PlatformUploadLimits = Pick<
  PublicPlatformRuntimeConfig,
  "maxImageBytes" | "maxTaxCertificateBytes"
>;

export const PUBLIC_RUNTIME_CONFIG_KEYS = [
  "maxImageBytes",
  "maxTaxCertificateBytes",
  "brandName",
  "supportEmail",
  "supportPhone",
  "websiteUrl",
  "registrationEnabled",
  "maintenanceMode",
  "maintenanceMessage",
] as const satisfies ReadonlyArray<keyof PublicPlatformRuntimeConfig>;
