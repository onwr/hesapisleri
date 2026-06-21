/**
 * Static tenant isolation audit — does not modify DB or source files.
 * Run: npm run security:audit-tenants
 */
import fs from "node:fs";
import path from "node:path";
import { isAllowlisted } from "./tenant-audit-allowlist";

type Severity = "Critical" | "High" | "Medium" | "Reviewed";

type Finding = {
  severity: Severity;
  file: string;
  message: string;
};

const root = path.join(process.cwd());
const findings: Finding[] = [];

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  "dist",
  "coverage",
  "prisma/migrations",
]);

const SOURCE_EXT = new Set([".ts", ".tsx"]);

function walk(dir: string, files: string[] = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;

    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
      continue;
    }

    if (!SOURCE_EXT.has(path.extname(entry.name))) continue;
    if (entry.name.endsWith(".test.ts")) continue;

    files.push(full);
  }

  return files;
}

function rel(file: string) {
  return path.relative(root, file).replace(/\\/g, "/");
}

function add(severity: Severity, file: string, message: string) {
  findings.push({ severity, file: rel(file), message });
}

const files = walk(root);

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const r = rel(file);

  const isApiRoute = r.startsWith("app/api/");
  const isService = r.startsWith("lib/") && r.includes("-service");
  const isPage = r.includes("/page.tsx");

  if (/findUnique\(\s*\{\s*where:\s*\{\s*id\s*:/.test(source)) {
    const tenantModels =
      /customer|product|sale|invoice|account|employee|supplier|warehouse|expense/i.test(
        source
      );

    if (
      tenantModels &&
      !/user\.findUnique|company\.findUnique/i.test(source) &&
      !isAllowlisted(r, "findUnique-by-id")
    ) {
      add("High", file, "findUnique by id only — prefer findFirst with companyId");
    }
  }

  if (
    /update\(\s*\{\s*where:\s*\{\s*id\s*:/.test(source) &&
    !/companyId/.test(source.slice(0, source.indexOf("update({")))
  ) {
    if (isService || isApiRoute) {
      add("Medium", file, "update({ where: { id } }) without visible companyId scope");
    }
  }

  if (/delete\(\s*\{\s*where:\s*\{\s*id\s*:/.test(source)) {
    if (isService || isApiRoute) {
      add("Medium", file, "delete({ where: { id } }) — prefer deleteMany with companyId");
    }
  }

  if ((/body\.companyId/.test(source) || /input\.companyId/.test(source)) && isApiRoute) {
    if (
      !/rejectMismatchedBodyCompanyId|assertCompanyAccess|tenant\.companyId|session\.companyId|auth\.companyId/.test(
        source
      ) &&
      !isAllowlisted(r, "body-company-id")
    ) {
      add("High", file, "body/input companyId without session validation");
    }
  }

  if (/\$queryRawUnsafe|\$executeRawUnsafe/.test(source) && !r.includes("audit-tenant-isolation")) {
    add("Critical", file, "Unsafe raw SQL — use parameterized $queryRaw");
  }

  if (/companyUsers\[0\]/.test(source) && isPage) {
    add("High", file, "companyUsers[0] fallback — wrong tenant context risk");
  }

  if (isApiRoute && /getAuthToken\(\)/.test(source)) {
    if (
      !/requireApiModuleAccess|requireApiTenantContext|requireSuperAdminApi|requireAuthenticatedApiSession|getOptionalAuthenticatedApiSession|requireAnyApiModuleAccess|requireApiCashBankRead|requireApiCashBankManage|requireApiWarehouseRead|requireApiWarehouseManage|requireApiEmployeesPermission|requireApiSupplierManage|requireApiDirectoryManage/.test(
        source
      ) &&
      !isAllowlisted(r, "token-only-api")
    ) {
      add("High", file, "Token-only API auth without live membership check");
    }
  }

  if (!r.startsWith("scripts/")) {
    const debtCall = source.match(
      /applyCustomerDebtFromDocument\(\s*tx,\s*([^,\n)]+)/
    );
    if (debtCall && !/companyId|ctx\.companyId|tenant\.|payload\.|input\./.test(debtCall[1])) {
      add("Critical", file, "Customer balance mutation without companyId scope");
    }

    const balanceCall = source.match(/adjustCustomerBalance\(\s*tx,\s*([^,\n)]+)/);
    if (balanceCall && !/companyId|ctx\.companyId|tenant\.|payload\.|input\./.test(balanceCall[1])) {
      add("Critical", file, "adjustCustomerBalance without companyId scope");
    }
  }

  if (/unstable_cache|cache\(/.test(source) && !/companyId/.test(source)) {
    add("Medium", file, "Cache without visible companyId in key");
  }
}

const order: Record<Severity, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Reviewed: 3,
};

findings.sort((a, b) => order[a.severity] - order[b.severity]);

console.log("Tenant Isolation Audit\n======================\n");

const grouped = {
  Critical: findings.filter((f) => f.severity === "Critical"),
  High: findings.filter((f) => f.severity === "High"),
  Medium: findings.filter((f) => f.severity === "Medium"),
};

for (const [severity, items] of Object.entries(grouped)) {
  console.log(`${severity}: ${items.length}`);
  for (const item of items.slice(0, 40)) {
    console.log(`  - [${item.file}] ${item.message}`);
  }
  if (items.length > 40) {
    console.log(`  ... and ${items.length - 40} more`);
  }
  console.log("");
}

console.log(`Total findings: ${findings.length}`);
console.log(
  "\nNote: Static analysis is not a security guarantee. Review findings manually."
);

if (grouped.Critical.length > 0 || grouped.High.length > 0) {
  process.exitCode = 1;
}
