export type EnvValidationIssue = {
  code: "MISSING" | "INVALID" | "INSECURE";
  variable: string;
  message: string;
};

export type EnvValidationResult = {
  ok: boolean;
  environment: string;
  issues: EnvValidationIssue[];
};

function isTruthyFlag(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes((value ?? "").toLowerCase());
}

function isProductionLike(env: NodeJS.ProcessEnv = process.env) {
  const nodeEnv = env.NODE_ENV?.trim().toLowerCase();
  const appEnv = env.APP_ENV?.trim().toLowerCase();
  return nodeEnv === "production" || appEnv === "production";
}

function isTestLike(env: NodeJS.ProcessEnv = process.env) {
  return env.NODE_ENV === "test" || env.VITEST === "true";
}

function requireNonEmpty(
  issues: EnvValidationIssue[],
  env: NodeJS.ProcessEnv,
  key: string,
  message?: string
) {
  if (!env[key]?.trim()) {
    issues.push({
      code: "MISSING",
      variable: key,
      message: message ?? `${key} tanımlı olmalıdır.`,
    });
  }
}

function requireUrl(
  issues: EnvValidationIssue[],
  env: NodeJS.ProcessEnv,
  key: string
) {
  const value = env[key]?.trim();
  if (!value) return;
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      issues.push({
        code: "INVALID",
        variable: key,
        message: `${key} geçerli bir http(s) URL olmalıdır.`,
      });
    }
  } catch {
    issues.push({
      code: "INVALID",
      variable: key,
      message: `${key} geçerli bir URL olmalıdır.`,
    });
  }
}

export function validateProductionEnvironment(
  env: NodeJS.ProcessEnv = process.env
): EnvValidationResult {
  const environment = env.APP_ENV?.trim() || env.NODE_ENV?.trim() || "development";
  const issues: EnvValidationIssue[] = [];

  if (!isProductionLike(env) || isTestLike(env)) {
    return { ok: true, environment, issues: [] };
  }

  requireNonEmpty(issues, env, "DATABASE_URL");
  requireNonEmpty(issues, env, "JWT_SECRET");
  requireNonEmpty(issues, env, "APP_URL");
  requireNonEmpty(issues, env, "CRON_SECRET");
  requireNonEmpty(issues, env, "CDN_UPLOAD_URL");
  requireNonEmpty(issues, env, "CDN_UPLOAD_TOKEN");
  requireNonEmpty(issues, env, "INTEGRATION_ENCRYPTION_KEY");
  requireNonEmpty(issues, env, "PAYMENT_TOKEN_ENCRYPTION_KEY");

  requireUrl(issues, env, "APP_URL");
  requireUrl(issues, env, "CDN_BASE_URL");
  requireUrl(issues, env, "CDN_UPLOAD_URL");

  const jwt = env.JWT_SECRET?.trim();
  if (jwt && (jwt.length < 32 || jwt === "hesapisleri-secret")) {
    issues.push({
      code: "INSECURE",
      variable: "JWT_SECRET",
      message: "JWT_SECRET production için yeterince güçlü değil.",
    });
  }

  const cronSecret = env.CRON_SECRET?.trim();
  if (cronSecret && cronSecret.length < 16) {
    issues.push({
      code: "INSECURE",
      variable: "CRON_SECRET",
      message: "CRON_SECRET en az 16 karakter olmalıdır.",
    });
  }

  const paytrLive =
    !isTruthyFlag(env.PAYTR_TEST_MODE) && env.NODE_ENV === "production";

  if (paytrLive) {
    requireNonEmpty(issues, env, "PAYTR_MERCHANT_ID");
    requireNonEmpty(issues, env, "PAYTR_MERCHANT_KEY");
    requireNonEmpty(issues, env, "PAYTR_MERCHANT_SALT");
  }

  const paymentKey = env.PAYMENT_TOKEN_ENCRYPTION_KEY?.trim();
  if (paymentKey && paymentKey.length !== 32) {
    issues.push({
      code: "INVALID",
      variable: "PAYMENT_TOKEN_ENCRYPTION_KEY",
      message: "PAYMENT_TOKEN_ENCRYPTION_KEY tam 32 karakter olmalıdır.",
    });
  }

  const integrationKey = env.INTEGRATION_ENCRYPTION_KEY?.trim();
  if (integrationKey && integrationKey.length < 32) {
    issues.push({
      code: "INSECURE",
      variable: "INTEGRATION_ENCRYPTION_KEY",
      message: "INTEGRATION_ENCRYPTION_KEY en az 32 karakter olmalıdır.",
    });
  }

  return { ok: issues.length === 0, environment, issues };
}

export function formatEnvValidationReport(result: EnvValidationResult) {
  if (result.ok) {
    return `OK — ${result.environment} ortam değişkenleri geçerli.`;
  }

  const lines = result.issues.map(
    (issue) => `[${issue.code}] ${issue.variable}: ${issue.message}`
  );
  return [`FAIL — ${result.environment}`, ...lines].join("\n");
}
