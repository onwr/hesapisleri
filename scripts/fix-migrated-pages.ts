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

const TOKEN_BLOCK =
  /const token = await getAuthToken\(\);\s*(?:if \(!token\) redirect\("\/login"\);\s*)?const payload = verifyToken(?:<AuthPayload>)?\(token\);\s*(?:if \(!payload\?\.userId \|\| !(?:payload\?\.companyId|session\.company\.id)\) redirect\("\/login"\);\s*|if \(!payload\?\.companyId\) redirect\("\/login"\);\s*)?const user = await db\.user\.findUnique\(\{[\s\S]*?\}\);\s*if \(!user\) redirect\("\/login"\);\s*/g;

const COMPANY_FALLBACK =
  /const company =\s*user\.companyUsers\.find\(\(item\) => item\.companyId === (?:payload\.companyId|session\.company\.id)\)\s*\?\.company \?\? user\.companyUsers\[0\]\?\.company;\s*if \(!company\) redirect\("\/login"\);\s*/g;

function ensureGuardImport(source: string) {
  if (!source.includes("guardPageModule")) return source;
  if (source.includes('from "@/lib/module-access"')) {
    if (!/guardPageModule/.test(source.match(/from "@\/lib\/module-access"/)?.input ?? "")) {
      source = source.replace(
        /import \{([^}]*)\} from "@\/lib\/module-access";/,
        (m, imports: string) =>
          imports.includes("guardPageModule")
            ? m
            : `import { guardPageModule${imports.trim() ? `,${imports}` : ""} } from "@/lib/module-access";`
      );
    }
    return source;
  }
  const anchor =
    source.match(/import \{ AppShell \} from "@\/components\/layout\/app-shell";/) ??
    source.match(/import .+ from .+;\n/);
  if (anchor) {
    return source.replace(
      anchor[0],
      `${anchor[0]}import { guardPageModule } from "@/lib/module-access";\n`
    );
  }
  return `import { guardPageModule } from "@/lib/module-access";\n${source}`;
}

function fixBrokenSignature(source: string, module: string) {
  // `{ const session = ... searchParams }` inside params
  source = source.replace(
    /\{\s*const session = await guardPageModule\("[^"]+"\);\s*const company = session\.company;\s*(?:const session = const company = session\.company;\s*const companyUser = session\.companyUser;\s*const effectiveRole = session\.effectiveRole;\s*)?/g,
    "{ "
  );

  source = source.replace(
    /const session = const company = session\.company;\s*const companyUser = session\.companyUser;\s*const effectiveRole = session\.effectiveRole;\s*/g,
    ""
  );

  // Duplicate session blocks at top of params list
  source = source.replace(
    /export default async function (\w+)\(\{\s*searchParams \}: (\w+)\) \{\s*const params = await searchParams;\s*/g,
    `export default async function $1({ searchParams }: $2) {\n  const session = await guardPageModule("${module}");\n  const company = session.company;\n  const params = await searchParams;\n`
  );

  source = source.replace(
    /export default async function (\w+)\(\{\s*params,\s*searchParams \}: (\w+)\) \{\s*/g,
    `export default async function $1({ params, searchParams }: $2) {\n  const session = await guardPageModule("${module}");\n  const company = session.company;\n`
  );

  source = source.replace(
    /export default async function (\w+)\(\{\s*params \}: (\w+)\) \{\s*/g,
    `export default async function $1({ params }: $2) {\n  const session = await guardPageModule("${module}");\n  const company = session.company;\n`
  );

  source = source.replace(
    /export default async function (\w+)\(\) \{\s*(?!const session = await guardPageModule)/g,
    `export default async function $1() {\n  const session = await guardPageModule("${module}");\n  const company = session.company;\n`
  );

  // Generic: function with searchParams props
  if (
    source.includes("searchParams") &&
    !source.includes(`await guardPageModule("${module}")`)
  ) {
    source = source.replace(
      /export default async function (\w+)\((\{[^}]+\}: \w+)\) \{\s*(?!const session)/,
      `export default async function $1($2) {\n  const session = await guardPageModule("${module}");\n  const company = session.company;\n`
    );
  }

  return source;
}

function fixPage(filePath: string) {
  const module = resolveModule(filePath);
  if (!module) return false;

  let source = fs.readFileSync(filePath, "utf8");
  const original = source;

  if (
    !source.includes("getAuthToken") &&
    !source.includes("companyUsers[0]") &&
    !source.includes("const session = const") &&
    !source.includes("{ const session")
  ) {
    if (source.includes("guardPageModule") && !source.includes('from "@/lib/module-access"')) {
      source = ensureGuardImport(source);
      if (source !== original) {
        fs.writeFileSync(filePath, source);
        console.log(`Import fix: ${path.relative(root, filePath)}`);
      }
    }
    return false;
  }

  source = fixBrokenSignature(source, module);
  source = source.replace(TOKEN_BLOCK, "");
  source = source.replace(COMPANY_FALLBACK, "");

  // cash-bank companyUser pattern
  if (source.includes("canManageAccounts")) {
    if (!source.includes("const companyUser = session.companyUser")) {
      source = source.replace(
        /const company = session\.company;\n/,
        `const company = session.company;\n  const companyUser = session.companyUser;\n  const effectiveRole = session.effectiveRole;\n`
      );
    }
    source = source.replace(
      /const canManage = canManageAccounts\(\s*resolveEffectiveRole\(\{[\s\S]*?\}\),\s*[^)]+\);/,
      "const canManage = canManageAccounts(effectiveRole, companyUser.isOwner);"
    );
  }

  // products membership pattern
  if (
    source.includes("canManageProducts") ||
    source.includes("canManageWarehouses") ||
    source.includes("membership?.isOwner")
  ) {
    if (!source.includes("const membership = session.companyUser")) {
      source = source.replace(
        /const company = session\.company;\n/,
        `const company = session.company;\n  const membership = session.companyUser;\n  const effectiveRole = session.effectiveRole;\n`
      );
    }
    source = source.replace(
      /const effectiveRole = membership\s*\?\s*resolveEffectiveRole\(\{[\s\S]*?\}\)\s*:\s*"STAFF";/g,
      ""
    );
  }

  source = source.replace(
    /import \{ getAuthToken, verifyToken \} from "@\/lib\/auth";\s*\n/g,
    ""
  );
  source = source.replace(/type AuthPayload = \{[\s\S]*?\};\s*\n/g, "");

  if (!source.includes("db.") && source.includes('from "@/lib/prisma"')) {
    source = source.replace(/import \{ db \} from "@\/lib\/prisma";\s*\n/g, "");
  }

  if (!source.includes("redirect(")) {
    source = source.replace(/import \{ redirect \} from "next\/navigation";\s*\n/g, "");
  }

  source = ensureGuardImport(source);

  if (source.includes("companyUsers[0]")) {
    console.warn(`Still has companyUsers[0]: ${path.relative(root, filePath)}`);
  }

  fs.writeFileSync(filePath, source);
  console.log(`Fixed: ${path.relative(root, filePath)}`);
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
  if (fixPage(file)) count++;
}
console.log(`Fixed ${count} pages`);
