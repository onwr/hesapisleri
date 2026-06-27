import type { PlanEntitlementValueType } from "@prisma/client";
import {
  ENTITLEMENT_REGISTRY,
  getEntitlementMeta,
  isKnownEntitlementCode,
} from "@/lib/billing/entitlements/entitlement-registry";
import type { EntitlementRegistryEntry } from "@/lib/billing/entitlements/entitlement-types";

export type EntitlementInputRow = {
  code: string;
  valueType: PlanEntitlementValueType;
  booleanValue?: boolean | null;
  numberValue?: number | null;
  stringValue?: string | null;
  isUnlimited?: boolean;
  description?: string | null;
  category?: string | null;
  sortOrder?: number;
};

export type EntitlementValidationIssueCode =
  | "ENTITLEMENT_UNKNOWN_CODE"
  | "ENTITLEMENT_TYPE_MISMATCH"
  | "ENTITLEMENT_DUPLICATE"
  | "ENTITLEMENT_MULTIPLE_VALUE_FIELDS"
  | "ENTITLEMENT_REQUIRED_VALUE_MISSING"
  | "ENTITLEMENT_DEPRECATED_CODE"
  | "ENTITLEMENT_REGISTRY_DEFAULT_INVALID";

export type EntitlementValidationIssue = {
  code: EntitlementValidationIssueCode;
  severity: "warning" | "error";
  message: string;
  entitlementCode?: string;
};

export class EntitlementValidationError extends Error {
  issues: EntitlementValidationIssue[];
  status = 400;
  constructor(issues: EntitlementValidationIssue[]) {
    super(issues.map((i) => i.message).join("; "));
    this.name = "EntitlementValidationError";
    this.issues = issues;
  }
}

export class EntitlementPreviewStaleError extends Error {
  code = "ENTITLEMENT_PREVIEW_STALE" as const;
  status = 409;
  constructor() {
    super("Entitlement önizlemesi güncel değil. Lütfen yeniden önizleyin.");
    this.name = "EntitlementPreviewStaleError";
  }
}

const STRING_MAX = 500;

function countValueFields(row: EntitlementInputRow): number {
  let n = 0;
  if (row.booleanValue != null) n++;
  if (row.numberValue != null) n++;
  if (row.stringValue != null && row.stringValue !== "") n++;
  if (row.isUnlimited) n++;
  return n;
}

function registryDefaultValue(meta: EntitlementRegistryEntry): EntitlementInputRow {
  if (meta.valueType === "BOOLEAN") {
    return {
      code: meta.code,
      valueType: "BOOLEAN",
      booleanValue: meta.defaultBehavior === "ALLOW",
      numberValue: null,
      stringValue: null,
      isUnlimited: false,
    };
  }
  if (meta.valueType === "NUMBER") {
    return {
      code: meta.code,
      valueType: "NUMBER",
      booleanValue: null,
      numberValue: meta.defaultBehavior === "ZERO" ? 0 : 0,
      stringValue: null,
      isUnlimited: false,
    };
  }
  return {
    code: meta.code,
    valueType: meta.valueType,
    booleanValue: null,
    numberValue: null,
    stringValue: null,
    isUnlimited: false,
  };
}

export function normalizeEntitlementRow(row: EntitlementInputRow): EntitlementInputRow {
  const code = row.code.trim().toUpperCase();
  const valueType = row.valueType;

  if (valueType === "BOOLEAN") {
    return {
      ...row,
      code,
      booleanValue: row.booleanValue ?? false,
      numberValue: null,
      stringValue: null,
      isUnlimited: false,
    };
  }
  if (valueType === "NUMBER") {
    return {
      ...row,
      code,
      booleanValue: null,
      numberValue: row.numberValue ?? 0,
      stringValue: null,
      isUnlimited: false,
    };
  }
  if (valueType === "UNLIMITED") {
    return {
      ...row,
      code,
      booleanValue: null,
      numberValue: null,
      stringValue: null,
      isUnlimited: true,
    };
  }
  return {
    ...row,
    code,
    booleanValue: null,
    numberValue: null,
    stringValue: (row.stringValue ?? "").trim() || null,
    isUnlimited: false,
  };
}

export function validateEntitlementRow(row: EntitlementInputRow): EntitlementValidationIssue[] {
  const issues: EntitlementValidationIssue[] = [];
  const code = row.code.trim().toUpperCase();

  if (!isKnownEntitlementCode(code)) {
    issues.push({
      code: "ENTITLEMENT_UNKNOWN_CODE",
      severity: "error",
      message: `Bilinmeyen entitlement kodu: ${code}`,
      entitlementCode: code,
    });
    return issues;
  }

  const meta = getEntitlementMeta(code)!;
  const allowedTypes: PlanEntitlementValueType[] = [meta.valueType];
  if (meta.kind === "LIMIT") allowedTypes.push("UNLIMITED");

  if (!allowedTypes.includes(row.valueType)) {
    issues.push({
      code: "ENTITLEMENT_TYPE_MISMATCH",
      severity: "error",
      message: `${code} için valueType ${row.valueType} geçersiz; beklenen: ${allowedTypes.join(" veya ")}`,
      entitlementCode: code,
    });
  }

  const valueFieldCount = countValueFields(row);
  if (valueFieldCount > 1) {
    issues.push({
      code: "ENTITLEMENT_MULTIPLE_VALUE_FIELDS",
      severity: "error",
      message: `${code}: yalnızca ilgili value alanı dolu olmalı.`,
      entitlementCode: code,
    });
  }

  if (row.valueType === "BOOLEAN") {
    if (row.booleanValue == null || typeof row.booleanValue !== "boolean") {
      issues.push({
        code: "ENTITLEMENT_REQUIRED_VALUE_MISSING",
        severity: "error",
        message: `${code}: boolean değer zorunlu.`,
        entitlementCode: code,
      });
    }
    if (row.numberValue != null || row.stringValue != null || row.isUnlimited) {
      issues.push({
        code: "ENTITLEMENT_MULTIPLE_VALUE_FIELDS",
        severity: "error",
        message: `${code}: BOOLEAN için yalnızca booleanValue kullanılmalı.`,
        entitlementCode: code,
      });
    }
  } else if (row.valueType === "NUMBER") {
    if (row.numberValue == null || !Number.isFinite(row.numberValue)) {
      issues.push({
        code: "ENTITLEMENT_REQUIRED_VALUE_MISSING",
        severity: "error",
        message: `${code}: geçerli sayısal değer zorunlu.`,
        entitlementCode: code,
      });
    } else if (row.numberValue < 0) {
      issues.push({
        code: "ENTITLEMENT_REQUIRED_VALUE_MISSING",
        severity: "error",
        message: `${code}: negatif değer kabul edilmez.`,
        entitlementCode: code,
      });
    }
    if (row.isUnlimited) {
      issues.push({
        code: "ENTITLEMENT_TYPE_MISMATCH",
        severity: "error",
        message: `${code}: NUMBER tipinde isUnlimited kullanılamaz; UNLIMITED tipini seçin.`,
        entitlementCode: code,
      });
    }
  } else if (row.valueType === "UNLIMITED") {
    if (!row.isUnlimited) {
      issues.push({
        code: "ENTITLEMENT_REQUIRED_VALUE_MISSING",
        severity: "error",
        message: `${code}: UNLIMITED için isUnlimited=true gerekli.`,
        entitlementCode: code,
      });
    }
    if (
      row.booleanValue != null ||
      row.numberValue != null ||
      (row.stringValue != null && row.stringValue !== "")
    ) {
      issues.push({
        code: "ENTITLEMENT_MULTIPLE_VALUE_FIELDS",
        severity: "error",
        message: `${code}: UNLIMITED için diğer value alanları boş olmalı.`,
        entitlementCode: code,
      });
    }
  } else if (row.valueType === "STRING") {
    const s = (row.stringValue ?? "").trim();
    if (!s) {
      issues.push({
        code: "ENTITLEMENT_REQUIRED_VALUE_MISSING",
        severity: "error",
        message: `${code}: metin değeri zorunlu.`,
        entitlementCode: code,
      });
    } else if (s.length > STRING_MAX) {
      issues.push({
        code: "ENTITLEMENT_REQUIRED_VALUE_MISSING",
        severity: "error",
        message: `${code}: metin en fazla ${STRING_MAX} karakter.`,
        entitlementCode: code,
      });
    }
  }

  return issues;
}

export function validateEntitlementSet(rows: EntitlementInputRow[]): EntitlementValidationIssue[] {
  const issues: EntitlementValidationIssue[] = [];
  const seen = new Set<string>();

  for (const raw of rows) {
    const code = raw.code.trim().toUpperCase();
    if (seen.has(code)) {
      issues.push({
        code: "ENTITLEMENT_DUPLICATE",
        severity: "error",
        message: `Yinelenen entitlement: ${code}`,
        entitlementCode: code,
      });
      continue;
    }
    seen.add(code);
    issues.push(...validateEntitlementRow(raw));
  }

  return issues;
}

export function assertValidEntitlementSet(rows: EntitlementInputRow[]) {
  const issues = validateEntitlementSet(rows);
  const errors = issues.filter((i) => i.severity === "error");
  if (errors.length) throw new EntitlementValidationError(errors);
}

export type EntitlementDiffEntry = {
  code: string;
  changeType: "added" | "removed" | "changed";
  valueType: PlanEntitlementValueType;
  oldValue: string | null;
  newValue: string | null;
  registryTitle: string;
  registryDefault: string;
  addonAffectable: boolean;
  adminOverrideSupported: boolean;
  enforcementUnchanged: true;
};

function formatEntitlementValue(row: {
  valueType: PlanEntitlementValueType;
  booleanValue?: boolean | null;
  numberValue?: number | null;
  stringValue?: string | null;
  isUnlimited?: boolean;
}): string {
  if (row.valueType === "UNLIMITED" || row.isUnlimited) return "Sınırsız";
  if (row.valueType === "BOOLEAN") return String(row.booleanValue ?? false);
  if (row.valueType === "NUMBER") return String(row.numberValue ?? 0);
  return row.stringValue ?? "";
}

export function computeEntitlementDiff(
  current: EntitlementInputRow[],
  next: EntitlementInputRow[]
): EntitlementDiffEntry[] {
  const currentMap = new Map(current.map((r) => [r.code.toUpperCase(), normalizeEntitlementRow(r)]));
  const nextMap = new Map(next.map((r) => [r.code.toUpperCase(), normalizeEntitlementRow(r)]));
  const diff: EntitlementDiffEntry[] = [];

  for (const [code, row] of nextMap) {
    const meta = getEntitlementMeta(code);
    const registryDefault = meta ? formatEntitlementValue(registryDefaultValue(meta)) : "—";
    const prev = currentMap.get(code);
    const newVal = formatEntitlementValue(row);
    if (!prev) {
      diff.push({
        code,
        changeType: "added",
        valueType: row.valueType,
        oldValue: null,
        newValue: newVal,
        registryTitle: meta?.label ?? code,
        registryDefault,
        addonAffectable: meta?.kind === "LIMIT",
        adminOverrideSupported: true,
        enforcementUnchanged: true,
      });
    } else {
      const oldVal = formatEntitlementValue(prev);
      if (oldVal !== newVal || prev.valueType !== row.valueType) {
        diff.push({
          code,
          changeType: "changed",
          valueType: row.valueType,
          oldValue: oldVal,
          newValue: newVal,
          registryTitle: meta?.label ?? code,
          registryDefault,
          addonAffectable: meta?.kind === "LIMIT",
          adminOverrideSupported: true,
          enforcementUnchanged: true,
        });
      }
    }
  }

  for (const [code, row] of currentMap) {
    if (!nextMap.has(code)) {
      const meta = getEntitlementMeta(code);
      diff.push({
        code,
        changeType: "removed",
        valueType: row.valueType,
        oldValue: formatEntitlementValue(row),
        newValue: null,
        registryTitle: meta?.label ?? code,
        registryDefault: meta ? formatEntitlementValue(registryDefaultValue(meta)) : "—",
        addonAffectable: meta?.kind === "LIMIT",
        adminOverrideSupported: true,
        enforcementUnchanged: true,
      });
    }
  }

  return diff;
}

export function listRegistryForAdmin() {
  return Object.values(ENTITLEMENT_REGISTRY).map((e) => ({
    code: e.code,
    title: e.label,
    description: e.description,
    valueType: e.valueType,
    category: e.category,
    kind: e.kind,
    defaultValue: formatEntitlementValue(registryDefaultValue(e)),
    addonAffectable: e.kind === "LIMIT",
    adminOverrideSupported: true,
    deprecated: false,
  }));
}

export function getEnforcementDisplayStatus(_code: string): "ANALYTICS_ONLY" | "ENFORCEMENT_DISABLED" {
  return "ENFORCEMENT_DISABLED";
}

export function resolvePlanLevelPreview(row: EntitlementInputRow | null, code: string) {
  const meta = getEntitlementMeta(code);
  const registryDefault = meta ? registryDefaultValue(meta) : null;
  const planValue = row ? normalizeEntitlementRow(row) : null;
  return {
    registryDefault: registryDefault ? formatEntitlementValue(registryDefault) : "—",
    planValue: planValue ? formatEntitlementValue(planValue) : null,
    addonAffectable: meta?.kind === "LIMIT",
    adminOverrideSupported: true,
    finalPlanLevelPreview: planValue
      ? formatEntitlementValue(planValue)
      : registryDefault
        ? formatEntitlementValue(registryDefault)
        : "—",
  };
}
