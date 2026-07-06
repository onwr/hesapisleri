import { cpSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * next.config.ts'te output: "standalone" kullanılıyor. Bu modda Next.js
 * .next/standalone/server.js üretir ama public/ ve .next/static/'i
 * OTOMATİK KOPYALAMAZ — bunlar olmadan standalone sunucu statik dosyaları
 * (görseller, JS/CSS bundle'ları) bulamaz ve "isn't a valid image ...
 * received null" gibi hatalar verir. Bu script her build sonrası
 * bunları standalone klasörüne kopyalar.
 */
const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const standaloneDir = join(webRoot, ".next", "standalone");

if (!existsSync(standaloneDir)) {
  console.log(
    "[copy-standalone-assets] .next/standalone bulunamadı — output:standalone build alınmamış olabilir, atlanıyor."
  );
  process.exit(0);
}

const publicSrc = join(webRoot, "public");
const publicDest = join(standaloneDir, "public");
cpSync(publicSrc, publicDest, { recursive: true });
console.log("[copy-standalone-assets] public/ -> .next/standalone/public kopyalandı.");

const staticSrc = join(webRoot, ".next", "static");
const staticDest = join(standaloneDir, ".next", "static");
cpSync(staticSrc, staticDest, { recursive: true });
console.log(
  "[copy-standalone-assets] .next/static/ -> .next/standalone/.next/static kopyalandı."
);

// sharp, next.config.ts'te serverExternalPackages listesinde — native/opsiyonel
// binary bağımlılıkları standalone dosya izlemesi (tracing) tarafından bazen
// atlanıyor. Kopyalanmazsa next/image optimizasyonu prod'da 400 ile patlıyor
// ("isn't a valid image ... received null").
const nodeModulesPackages = ["sharp", "@img"];
for (const pkg of nodeModulesPackages) {
  const src = join(webRoot, "node_modules", pkg);
  if (!existsSync(src)) continue;

  const dest = join(standaloneDir, "node_modules", pkg);
  cpSync(src, dest, { recursive: true });
  console.log(`[copy-standalone-assets] node_modules/${pkg} -> .next/standalone/node_modules/${pkg} kopyalandı.`);
}
