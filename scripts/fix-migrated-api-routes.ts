import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function walk(dir: string, files: string[] = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name === "route.ts") files.push(full);
  }
  return files;
}

const orphanPattern =
  /\n\s*,\s*\n\s*\{ status: 401 \}\s*\n\s*\);\s*\n\s*\}\s*\n/g;

let fixed = 0;
for (const file of walk(path.join(root, "app", "api"))) {
  const source = fs.readFileSync(file, "utf8");
  if (!orphanPattern.test(source)) continue;
  const next = source.replace(orphanPattern, "\n");
  fs.writeFileSync(file, next);
  fixed++;
  console.log("Fixed:", path.relative(root, file));
}
console.log(`Fixed ${fixed} files`);
