import { formatEnvValidationReport, validateProductionEnvironment } from "../lib/deployment/env-validation.ts";

const result = validateProductionEnvironment(process.env);
const report = formatEnvValidationReport(result);

console.log(report);

if (!result.ok) {
  process.exit(1);
}
