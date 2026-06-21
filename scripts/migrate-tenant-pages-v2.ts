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

const TOKEN_AUTH_BLOCK =
  /const token = await getAuthToken\(\);\s*(?:if \(!token\) redirect\("\/login"\);\s*)?const payload = verifyToken<AuthPayload>\(token\);\s*(?:if \(!payload\?\.userId \|\| !payload\?\.companyId\) redirect\("\/login"\);\s*|if \(!payload\?\.companyId\) redirect\("\/login"\);\s*)?const user = await db\.user\.findUnique\(\{[\s\S]*?\}\);\s*if \(!user\) redirect\("\/login"\);\s*/g;

const COMPANY_FALLBACK_BLOCK =
  /const company =\s*user\.companyUsers\.find\(\(item\) => item\.companyId === (?:payload\.companyId|company\.id|session\.company\.id)\)\s*\?\.company \?\? user\.companyUsers\[0\]\?\.company;\s*if \(!company\) redirect\("\/login"\);\s*/g;

const COMPANY_USER_BLOCK =
  /const companyUser =\s*user\.companyUsers\.find\(\(item\) => item\.companyId === (?:payload\.companyId|company\.id)\)\s*\?\?\s*user\.companyUsers\[0\];\s*/g;

const MEMBERSHIP_BLOCK =
  /const membership =\s*user\.companyUsers\.find\(\(item\) => item\.companyId === (?:payload\.companyId|company\.id)\)\s*\?\?\s*user\.companyUsers\[0\];\s*/g;

const WAREHOUSE_MEMBERSHIP_BLOCK =
  /const membership =\s*user\.companyUsers\.find\(\(item\) => item\.companyId === payload\.companyId\)\s*\?\?\s*user\.companyUsers\[0\];\s*const company = membership\?\.company \?\? user\.companyUsers\[0\]\?\.company;\s*if \(!company\) redirect\("\/login"\);\s*/g;

const GUARD_ONLY_LINE = /await guardPageModule\("[^"]+"\);\s*/g;

function cleanupImports(source: string) {
  source = source.replace(
    /import \{ getAuthToken, verifyToken \} from "@\/lib\/auth";\s*\n/g,
    ""
  );
  source = source.replace(/type AuthPayload = \{[\s\S]*?\};\s*\n/g, "");

  if (!source.includes("guardPageModule")) {
    if (source.includes('from "@/lib/module-access"')) {
      source = source.replace(
        /import \{([^}]*)\} from "@\/lib\/module-access";/,
        (match, imports: string) => {
          if (imports.includes("guardPageModule")) return match;
          return `import { guardPageModule${imports.trim() ? `,${imports}` : ""} } from "@/lib/module-access";`;
        }
      );
    } else {
      source = source.replace(
        /import \{ redirect \} from "next\/navigation";/,
        'import { redirect } from "next/navigation";\nimport { guardPageModule } from "@/lib/module-access";'
      );
    }
  }

  if (!source.includes("db.") && source.includes('from "@/lib/prisma"')) {
    source = source.replace(/import \{ db \} from "@\/lib\/prisma";\s*\n/g, "");
  }

  if (
    source.includes('redirect("/login")') &&
    !source.includes("redirect(")
  ) {
    source = source.replace(/import \{ redirect \} from "next\/navigation";\s*\n/g, "");
  }

  return source;
}

function migratePage(filePath: string) {
  const rel = path.relative(root, filePath).replace(/\\/g, "/");
  const module = resolveModule(rel);
  if (!module) return false;

  let source = fs.readFileSync(filePath, "utf8");
  if (!source.includes("companyUsers[0]") && !source.includes("getAuthToken")) {
    return false;
  }

  const hadGuardOnly = GUARD_ONLY_LINE.test(source);
  GUARD_ONLY_LINE.lastIndex = 0;

  source = source.replace(GUARD_ONLY_LINE, "");

  const sessionBlock = `const session = await guardPageModule("${module}");
  const company = session.company;
  const companyUser = session.companyUser;
  const effectiveRole = session.effectiveRole;
`;

  if (WAREHOUSE_MEMBERSHIP_BLOCK.test(source)) {
    WAREHOUSE_MEMBERSHIP_BLOCK.lastIndex = 0;
    source = source.replace(TOKEN_AUTH_BLOCK, "");
    source = source.replace(
      WAREHOUSE_MEMBERSHIP_BLOCK,
      `const session = await guardPageModule("${module}");
  const company = session.company;
  const membership = session.companyUser;
  const effectiveRole = session.effectiveRole;
`
    );
  } else if (MEMBERSHIP_BLOCK.test(source)) {
    MEMBERSHIP_BLOCK.lastIndex = 0;
    source = source.replace(TOKEN_AUTH_BLOCK, "");
    source = source.replace(COMPANY_FALLBACK_BLOCK, "");
    source = source.replace(
      MEMBERSHIP_BLOCK,
      `const session = await guardPageModule("${module}");
  const company = session.company;
  const membership = session.companyUser;
  const effectiveRole = session.effectiveRole;
`
    );
  } else if (COMPANY_USER_BLOCK.test(source)) {
    COMPANY_USER_BLOCK.lastIndex = 0;
    source = source.replace(TOKEN_AUTH_BLOCK, "");
    source = source.replace(COMPANY_FALLBACK_BLOCK, "");
    source = source.replace(
      COMPANY_USER_BLOCK,
      sessionBlock
    );
    source = source.replace(
      /const canManage = canManageAccounts\(\s*resolveEffectiveRole\(\{\s*role: companyUser\?\.role \?\? "STAFF",\s*isOwner: companyUser\?\.isOwner \?\? false,\s*\}\),\s*companyUser\?\.isOwner \?\? false\s*\);/,
      "const canManage = canManageAccounts(effectiveRole, companyUser.isOwner);"
    );
  } else if (TOKEN_AUTH_BLOCK.test(source)) {
    TOKEN_AUTH_BLOCK.lastIndex = 0;
    source = source.replace(TOKEN_AUTH_BLOCK, sessionBlock);
    source = source.replace(COMPANY_FALLBACK_BLOCK, "");
  } else if (COMPANY_FALLBACK_BLOCK.test(source)) {
    COMPANY_FALLBACK_BLOCK.lastIndex = 0;
    source = source.replace(COMPANY_FALLBACK_BLOCK, "");
    if (!source.includes("guardPageModule")) {
      source = source.replace(
        /export default async function[^{]+\{(\s*)/,
        `$&const session = await guardPageModule("${module}");
  const company = session.company;
`
      );
    }
  } else if (hadGuardOnly) {
    source = source.replace(
      /export default async function[^{]+\{(\s*)/,
      `$&const session = await guardPageModule("${module}");
  const company = session.company;
`
    );
    source = source.replace(COMPANY_FALLBACK_BLOCK, "");
  } else {
    console.warn(`SKIP pattern: ${rel}`);
    return false;
  }

  source = source.replace(/payload\.companyId/g, "session.company.id");
  source = source.replace(
    /const effectiveRole = membership\s*\?\s*resolveEffectiveRole\(\{\s*role: membership\.role,\s*isOwner: membership\.isOwner,\s*\}\)\s*:\s*"STAFF";/g,
    ""
  );

  source = cleanupImports(source);

  if (source.includes("companyUsers[0]")) {
    console.warn(`STILL has companyUsers[0]: ${rel}`);
    return false;
  }

  fs.writeFileSync(filePath, source);
  console.log(`Migrated: ${rel}`);
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
