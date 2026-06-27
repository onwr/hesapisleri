import "server-only";

import { probeEnvFields } from "@/lib/admin/system-health/system-health-serializers";

type EnvGroupStatus = {
  provider: string;
  mode?: string;
  configured: boolean;
  missing: string[];
  invalid: string[];
};

function toGroupStatus(
  provider: string,
  probe: ReturnType<typeof probeEnvFields>,
  mode?: string
): EnvGroupStatus {
  return {
    provider,
    mode,
    configured: probe.configured,
    missing: probe.missing,
    invalid: probe.invalid,
  };
}

export function getPlatformEnvironmentStatus() {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const paytrTestMode =
    process.env.PAYTR_TEST_MODE === "1" || process.env.NODE_ENV !== "production";

  const database = toGroupStatus(
    "postgresql",
    probeEnvFields([{ key: "DATABASE_URL", required: true }]),
    nodeEnv
  );

  const cache = toGroupStatus(
    "next-cache",
    {
      configured: true,
      missing: [],
      invalid: [],
    },
    nodeEnv
  );

  const storage = toGroupStatus(
    "cdn",
    probeEnvFields([
      { key: "CDN_UPLOAD_URL", required: true },
      { key: "CDN_BASE_URL", required: false },
    ])
  );

  const paytr = toGroupStatus(
    "paytr",
    probeEnvFields([
      { key: "PAYTR_MERCHANT_ID", required: !paytrTestMode },
      { key: "PAYTR_MERCHANT_KEY", required: !paytrTestMode },
      { key: "PAYTR_MERCHANT_SALT", required: !paytrTestMode },
    ]),
    paytrTestMode ? "test" : "live"
  );

  const mail = toGroupStatus(
    "mail",
    probeEnvFields([
      { key: "SMTP_HOST", required: false },
      { key: "RESEND_API_KEY", required: false },
      { key: "SENDGRID_API_KEY", required: false },
    ]),
    process.env.SMTP_HOST
      ? "smtp"
      : process.env.RESEND_API_KEY
        ? "resend"
        : process.env.SENDGRID_API_KEY
          ? "sendgrid"
          : undefined
  );
  if (!mail.configured) {
    mail.missing = mail.missing.length ? mail.missing : ["mail-provider"];
  }

  const cron = toGroupStatus(
    "cron",
    probeEnvFields([{ key: "CRON_SECRET", required: nodeEnv === "production" }])
  );

  const marketplace = toGroupStatus(
    "marketplace",
    probeEnvFields([
      { key: "TRENDYOL_SUPPLIER_ID", required: false },
      { key: "HEPSIBURADA_MERCHANT_ID", required: false },
    ])
  );

  const eDocument = toGroupStatus(
    "e-document",
    probeEnvFields([
      { key: "EFATURAM_USERNAME", required: false },
      { key: "EFATURAM_PASSWORD", required: false },
    ])
  );

  const appRuntime = toGroupStatus(
    "app",
    probeEnvFields([
      { key: "APP_URL", required: false },
      { key: "JWT_SECRET", required: nodeEnv === "production" },
    ]),
    nodeEnv
  );

  return {
    database,
    cache,
    storage,
    paytr,
    mail,
    cron,
    marketplace,
    eDocument,
    appRuntime,
  };
}
