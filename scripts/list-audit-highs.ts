import fs from "node:fs";
import path from "node:path";

type Finding = { file: string; message: string };
const root = process.cwd();
const findings: Finding[] = [];
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "coverage", "prisma/migrations"]);
const SOURCE_EXT = new Set([".ts", ".tsx"]);

function walk(dir: string, files: string[] = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (SOURCE_EXT.has(path.extname(entry.name)) && !entry.name.endsWith(".test.ts")) {
      files.push(full);
    }
  }
  return files;
}

function rel(file: string) {
  return path.relative(root, file).replace(/\\/g, "/");
}

for (const file of walk(root)) {
  const source = fs.readFileSync(file, "utf8");
  const r = rel(file);
  const isApiRoute = r.startsWith("app/api/");
  const isPage = r.includes("/page.tsx");

  if (/findUnique\(\s*\{\s*where:\s*\{\s*id\s*:/.test(source)) {
    const tenantModels = /customer|product|sale|invoice|account|employee|supplier|warehouse|expense/i.test(source);
    if (tenantModels && !/user\.findUnique|company\.findUnique/i.test(source)) {
      findings.push({ file: r, message: "findUnique by id only" });
    }
  }

  if (/companyUsers\[0\]/.test(source) && isPage) {
    findings.push({ file: r, message: "companyUsers[0]" });
  }

  if (isApiRoute && /getAuthToken\(\)/.test(source)) {
    if (!/requireApiModuleAccess|requireApiTenantContext|requireSuperAdminApi/.test(source)) {
      findings.push({ file: r, message: "token-only API" });
    }
  }

  if (/body\.companyId|input\.companyId/.test(source)) {
    if (!/rejectMismatchedBodyCompanyId|assertCompanyAccess|tenant\.companyId|session\.companyId|payload\.companyId/.test(source)) {
      findings.push({ file: r, message: "body companyId" });
    }
  }
}

const groups = new Map<string, Finding[]>();
for (const f of findings) {
  const key = f.message;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key)!.push(f);
}

for (const [msg, items] of groups) {
  console.log(`\n${msg}: ${items.length}`);
  for (const i of items) console.log(`  ${i.file}`);
}
console.log(`\nTotal High-like: ${findings.length}`);
