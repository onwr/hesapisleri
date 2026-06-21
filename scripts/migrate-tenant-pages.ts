import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const PAGE_MODULES: Array<{ pattern: RegExp; module: string }> = [
  { pattern: /app\/cash-bank\//, module: "cash-bank" },
  { pattern: /app\/customers\//, module: "customers" },
  { pattern: /app\/expenses\//, module: "expenses" },
  { pattern: /app\/invoices\//, module: "invoices" },
  { pattern: /app\/orders\//, module: "orders" },
  { pattern: /app\/products\//, module: "products" },
  { pattern: /app\/reports\//, module: "reports" },
  { pattern: /app\/sales\//, module: "sales" },
];

function resolveModule(file: string) {
  const rel = file.replace(/\\/g, "/");
  for (const entry of PAGE_MODULES) {
    if (entry.pattern.test(rel)) return entry.module;
  }
  return null;
}

const authBlock =
  /const token = await getAuthToken\(\);\s*if \(!token\) redirect\("\/login"\);\s*const payload = verifyToken<AuthPayload>\(token\);\s*if \(!payload\?\.userId \|\| !payload\?\.companyId\) redirect\("\/login"\);\s*const user = await db\.user\.findUnique\(\{[\s\S]*?\}\);\s*if \(!user\) redirect\("\/login"\);\s*const company =\s*user\.companyUsers\.find\(\(item\) => item\.companyId === payload\.companyId\)\s*\?\.company \?\? user\.companyUsers\[0\]\?\.company;\s*if \(!company\) redirect\("\/login"\);\s*/g;

function migratePage(filePath: string) {
  const rel = path.relative(root, filePath).replace(/\\/g, "/");
  const module = resolveModule(rel);
  if (!module) return false;

  let source = fs.readFileSync(filePath, "utf8");
  if (!source.includes("companyUsers[0]")) return false;

  source = source.replace(
    /import \{ getAuthToken, verifyToken \} from "@\/lib\/auth";\s*\n/g,
    ""
  );
  source = source.replace(/type AuthPayload = \{[\s\S]*?\};\s*\n/g, "");

  if (!source.includes("guardPageModule")) {
    source = source.replace(
      /import \{ AppShell \} from "@\/components\/layout\/app-shell";/,
      'import { AppShell } from "@/components/layout/app-shell";\nimport { guardPageModule } from "@/lib/module-access";'
    );
  }

  if (!authBlock.test(source)) {
    console.warn(`SKIP page pattern: ${rel}`);
    return false;
  }

  source = source.replace(
    authBlock,
    `const session = await guardPageModule("${module}");
  const company = session.company;
  const companyUser = session.companyUser;
  `
  );

  source = source.replace(/payload\.companyId/g, "session.company.id");
  source = source.replace(/company\.id/g, "company.id");

  const unusedDbImport =
    !source.includes("db.") && source.includes('from "@/lib/prisma"');
  if (unusedDbImport) {
    source = source.replace(/import \{ db \} from "@\/lib\/prisma";\s*\n/g, "");
  }

  fs.writeFileSync(filePath, source);
  console.log(`Migrated page: ${rel}`);
  return true;
}

function walk(dir: string, files: string[] = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name === "page.tsx") files.push(full);
  }
  return files;
}

let count = 0;
for (const file of walk(path.join(root, "app"))) {
  if (migratePage(file)) count++;
}
console.log(`Migrated ${count} pages`);
