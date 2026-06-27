-- Faz 6.2: PlanFeature pazarlama alanları (shortDescription, iconKey, isHighlighted)
ALTER TABLE "PlanFeature" ADD COLUMN "shortDescription" TEXT;
ALTER TABLE "PlanFeature" ADD COLUMN "iconKey" TEXT;
ALTER TABLE "PlanFeature" ADD COLUMN "isHighlighted" BOOLEAN NOT NULL DEFAULT false;
