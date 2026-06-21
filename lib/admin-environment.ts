export type AdminEnvironment = "local" | "staging" | "production";

export function getAdminEnvironment(): AdminEnvironment {
  const appEnv = process.env.APP_ENV?.trim().toLowerCase();
  if (appEnv === "production") return "production";
  if (appEnv === "staging") return "staging";

  const vercelEnv = process.env.VERCEL_ENV?.trim().toLowerCase();
  if (vercelEnv === "production") return "production";
  if (vercelEnv === "preview") return "staging";

  if (process.env.NODE_ENV === "production") return "production";
  return "local";
}

export function getAdminEnvironmentLabel(env: AdminEnvironment) {
  if (env === "production") return "Production";
  if (env === "staging") return "Staging";
  return "Local";
}
