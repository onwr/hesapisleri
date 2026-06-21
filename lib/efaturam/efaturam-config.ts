import "server-only";

export type EfaturamEnvironment = "STAGE" | "LIVE";

const STAGE_GATEWAY = "https://stage-apigateway.trendyolefaturam.com";
const LIVE_GATEWAY = "https://apigateway.trendyolecozum.com";

export function getEfaturamGatewayUrl(environment: EfaturamEnvironment) {
  return environment === "LIVE" ? LIVE_GATEWAY : STAGE_GATEWAY;
}

export type EfaturamPartnerConfig = {
  enabled: boolean;
  partnerId: string | null;
  username: string | null;
  hasPassword: boolean;
};

export function getEfaturamPartnerConfig(): EfaturamPartnerConfig {
  const partnerId = process.env.TRENDYOL_EFATURAM_PARTNER_ID?.trim() || null;
  const username = process.env.TRENDYOL_EFATURAM_PARTNER_USERNAME?.trim() || null;
  const password = process.env.TRENDYOL_EFATURAM_PARTNER_PASSWORD?.trim() || null;

  const enabled = Boolean(partnerId && username && password);

  return {
    enabled,
    partnerId,
    username,
    hasPassword: Boolean(password),
  };
}

export function assertEfaturamPartnerConfigured() {
  const config = getEfaturamPartnerConfig();
  if (!config.enabled) {
    throw new Error(
      "Partner entegrasyonu için platform ortam değişkenleri eksik."
    );
  }
  return config;
}

export function getEfaturamPartnerPassword() {
  const password = process.env.TRENDYOL_EFATURAM_PARTNER_PASSWORD?.trim();
  if (!password) {
    throw new Error("Partner şifresi yapılandırılmamış.");
  }
  return password;
}
