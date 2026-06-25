/**
 * GİB UBL-TR XSD şemalarını generated/ubl-tr-schemas altına kopyalar.
 * Kaynak: docs/private/sovos/UBL-TR1.2.1_Paketi.zip
 */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const source = path.join(
  process.cwd(),
  "docs/private/sovos/ubl-tr-extract/UBLTR_1.2.1_Paketi/xsdrt"
);
const target = path.join(process.cwd(), "generated/ubl-tr-schemas");

if (!existsSync(source)) {
  console.error("Kaynak XSD bulunamadı. Önce UBL-TR1.2.1_Paketi.zip çıkarın.");
  process.exit(1);
}

mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
console.log(`UBL XSD kopyalandı: ${target}`);
