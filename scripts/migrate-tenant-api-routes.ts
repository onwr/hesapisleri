/**
 * One-shot migration helper for token-only tenant API routes.
 * Run: npx tsx scripts/migrate-tenant-api-routes.ts
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const ROUTE_MODULES: Array<{ pattern: RegExp; module: string }> = [
  { pattern: /app\/api\/customers\//, module: "customers" },
  { pattern: /app\/api\/invoices\//, module: "invoices" },
  { pattern: /app\/api\/sales\//, module: "sales" },
  { pattern: /app\/api\/products\//, module: "products" },
  { pattern: /app\/api\/stocks\/export/, module: "stocks" },
  { pattern: /app\/api\/settings\//, module: "settings" },
  { pattern: /app\/api\/company\/update/, module: "settings" },
];

function resolveModule(file: string) {
  const rel = file.replace(/\\/g, "/");
  for (const entry of ROUTE_MODULES) {
    if (entry.pattern.test(rel)) return entry.module;
  }
  return null;
}

function migrateFile(filePath: string) {
  const rel = path.relative(root, filePath).replace(/\\/g, "/");
  const module = resolveModule(rel);
  if (!module) return false;

  let source = fs.readFileSync(filePath, "utf8");
  if (!source.includes("getAuthToken()")) return false;
  if (source.includes("requireApiModuleAccess")) return false;

  source = source.replace(
    /import \{ getAuthToken, verifyToken \} from "@\/lib\/auth";\s*\n/g,
    ""
  );
  source = source.replace(
    /import \{ getAuthToken \} from "@\/lib\/auth";\s*\n/g,
    ""
  );
  source = source.replace(
    /import \{ verifyToken, getAuthToken \} from "@\/lib\/auth";\s*\n/g,
    ""
  );

  if (!source.includes('from "@/lib/module-access"')) {
    const firstImportEnd = source.indexOf("\n", source.indexOf("import "));
    source =
      source.slice(0, firstImportEnd + 1) +
      `import { requireApiModuleAccess } from "@/lib/module-access";\n` +
      source.slice(firstImportEnd + 1);
  } else if (!source.includes("requireApiModuleAccess")) {
    source = source.replace(
      /from "@\/lib\/module-access";/,
      ', requireApiModuleAccess } from "@/lib/module-access";'.replace(
        ", requireApiModuleAccess",
        source.includes("{ requireApi")
          ? ", requireApiModuleAccess"
          : '{ requireApiModuleAccess'
      )
    );
    if (!source.includes("requireApiModuleAccess")) {
      source = source.replace(
        /import \{([^}]+)\} from "@\/lib\/module-access";/,
        'import { $1, requireApiModuleAccess } from "@/lib/module-access";'
      );
    }
  }

  source = source.replace(
    /type AuthPayload = \{[\s\S]*?\};\s*\n/g,
    ""
  );

  const authBlock =
    /const token = await getAuthToken\(\);\s*if \(!token\) \{[\s\S]*?\}\s*const payload = verifyToken<AuthPayload>\(token\);\s*if \(!payload\?\.(?:userId|companyId)[\s\S]*?\}\s*/g;

  const replacement = `const auth = await requireApiModuleAccess("${module}");
    if ("error" in auth) return auth.error;

    const companyId = auth.companyId;
    const userId = auth.userId;
    `;

  if (!authBlock.test(source)) {
    console.warn(`SKIP pattern: ${rel}`);
    return false;
  }

  source = source.replace(authBlock, replacement);
  source = source.replace(/payload\.companyId/g, "companyId");
  source = source.replace(/payload\.userId/g, "userId");
  source = source.replace(/payload!\.companyId/g, "companyId");
  source = source.replace(/payload!\.userId/g, "userId");

  fs.writeFileSync(filePath, source);
  console.log(`Migrated: ${rel}`);
  return true;
}

function walk(dir: string, files: string[] = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name === "route.ts") files.push(full);
  }
  return files;
}

let count = 0;
for (const file of walk(path.join(root, "app", "api"))) {
  if (migrateFile(file)) count++;
}
console.log(`Done. Migrated ${count} files.`);
