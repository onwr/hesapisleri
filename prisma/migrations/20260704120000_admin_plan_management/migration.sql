-- Migration: admin_plan_management
-- PlanFeature, AdminPlanNote, deterministic features[] backfill

CREATE TYPE "AdminPlanNoteCategory" AS ENUM (
  'GENERAL',
  'PRICING',
  'LIFECYCLE',
  'ENTITLEMENT',
  'BILLING',
  'RISK',
  'SUPPORT',
  'TECHNICAL'
);

CREATE TABLE "PlanFeature" (
    "id"        TEXT         NOT NULL,
    "planId"    TEXT         NOT NULL,
    "label"     TEXT         NOT NULL,
    "sortOrder" INTEGER      NOT NULL DEFAULT 100,
    "isVisible" BOOLEAN      NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PlanFeature_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminPlanNote" (
    "id"           TEXT         NOT NULL,
    "planId"       TEXT         NOT NULL,
    "authorUserId" TEXT,
    "content"      TEXT         NOT NULL,
    "category"     "AdminPlanNoteCategory" NOT NULL DEFAULT 'GENERAL',
    "priority"     "AdminCompanyNotePriority" NOT NULL DEFAULT 'NORMAL',
    "isPinned"     BOOLEAN      NOT NULL DEFAULT false,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    "deletedAt"    TIMESTAMP(3),

    CONSTRAINT "AdminPlanNote_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PlanFeature"
    ADD CONSTRAINT "PlanFeature_planId_fkey"
    FOREIGN KEY ("planId")
    REFERENCES "MembershipPlan"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdminPlanNote"
    ADD CONSTRAINT "AdminPlanNote_planId_fkey"
    FOREIGN KEY ("planId")
    REFERENCES "MembershipPlan"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdminPlanNote"
    ADD CONSTRAINT "AdminPlanNote_authorUserId_fkey"
    FOREIGN KEY ("authorUserId")
    REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "PlanFeature_planId_label_key" ON "PlanFeature"("planId", "label");
CREATE INDEX "PlanFeature_planId_deletedAt_idx" ON "PlanFeature"("planId", "deletedAt");
CREATE INDEX "PlanFeature_planId_sortOrder_idx" ON "PlanFeature"("planId", "sortOrder");
CREATE INDEX "PlanFeature_planId_isVisible_idx" ON "PlanFeature"("planId", "isVisible");

CREATE INDEX "AdminPlanNote_planId_deletedAt_idx" ON "AdminPlanNote"("planId", "deletedAt");
CREATE INDEX "AdminPlanNote_planId_isPinned_idx" ON "AdminPlanNote"("planId", "isPinned");
CREATE INDEX "AdminPlanNote_authorUserId_idx" ON "AdminPlanNote"("authorUserId");

-- Deterministic, idempotent backfill from MembershipPlan.features[]
WITH raw AS (
  SELECT
    p.id AS plan_id,
    trim(f.feature) AS label,
    f.ord::int AS ord
  FROM "MembershipPlan" p
  CROSS JOIN LATERAL unnest(p.features) WITH ORDINALITY AS f(feature, ord)
  WHERE trim(f.feature) <> ''
),
deduped AS (
  SELECT DISTINCT ON (plan_id, lower(label))
    plan_id,
    label,
    ord
  FROM raw
  ORDER BY plan_id, lower(label), ord
)
INSERT INTO "PlanFeature" ("id", "planId", "label", "sortOrder", "isVisible", "createdAt", "updatedAt")
SELECT
  'pf_' || substr(md5(plan_id || '|' || lower(label)), 1, 24),
  plan_id,
  label,
  (ord - 1) * 10,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM deduped
ON CONFLICT ("planId", "label") DO NOTHING;
