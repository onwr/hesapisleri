export class EntitlementError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 403, code = "ENTITLEMENT_DENIED") {
    super(message);
    this.name = "EntitlementError";
    this.status = status;
    this.code = code;
  }
}

export class FeatureDisabledError extends EntitlementError {
  featureCode: string;

  constructor(featureCode: string, message?: string) {
    super(
      message ?? `Bu özellik planınızda aktif değil: ${featureCode}`,
      403,
      "FEATURE_DISABLED"
    );
    this.name = "FeatureDisabledError";
    this.featureCode = featureCode;
  }
}

export class LimitReachedError extends EntitlementError {
  limitCode: string;
  usage: number;
  limit: number | null;

  constructor(input: {
    limitCode: string;
    usage: number;
    limit: number | null;
    message?: string;
  }) {
    super(
      input.message ??
        `Kullanım limitine ulaşıldı (${input.limitCode}: ${input.usage}/${input.limit ?? "∞"})`,
      409,
      "LIMIT_REACHED"
    );
    this.name = "LimitReachedError";
    this.limitCode = input.limitCode;
    this.usage = input.usage;
    this.limit = input.limit;
  }
}
