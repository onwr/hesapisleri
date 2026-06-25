import "server-only";

const CREDENTIAL_PATTERNS = [
  /Authorization:\s*Basic\s+[A-Za-z0-9+/=]+/gi,
  /Basic\s+[A-Za-z0-9+/=]{8,}/gi,
  /<[^:]+:Password[^>]*>[^<]+</gi,
  /<[^:]+:Username[^>]*>[^<]+</gi,
];

export function buildSovosBasicAuthHeader(username: string, password: string): string {
  const token = Buffer.from(`${username}:${password}`, "utf8").toString("base64");
  return `Basic ${token}`;
}

export function redactSovosSecrets(text: string): string {
  let redacted = text;
  for (const pattern of CREDENTIAL_PATTERNS) {
    redacted = redacted.replace(pattern, "[REDACTED]");
  }
  return redacted;
}

export type SovosAuthCredentials = {
  username: string;
  password: string;
};

export function buildSovosRequestHeaders(
  credentials: SovosAuthCredentials,
  soapAction: string
): Record<string, string> {
  return {
    "Content-Type": "text/xml; charset=utf-8",
    SOAPAction: `"${soapAction}"`,
    Authorization: buildSovosBasicAuthHeader(credentials.username, credentials.password),
  };
}
