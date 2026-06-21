-- E-Document multi-provider support

CREATE TYPE "EDocumentProvider" AS ENUM ('TRENDYOL_EFATURAM', 'EFINANS', 'OTHER');

ALTER TABLE "EfaturamIntegration"
  ADD COLUMN "provider" "EDocumentProvider" NOT NULL DEFAULT 'TRENDYOL_EFATURAM',
  ADD COLUMN "externalCompanyCode" TEXT;

ALTER TABLE "EfaturamIntegration"
  ALTER COLUMN "connectionMode" DROP NOT NULL;
