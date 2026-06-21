-- Warehouse transfer atomic fields (runs after PENDING enum value is committed)
ALTER TABLE "WarehouseTransfer"
ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
ADD COLUMN IF NOT EXISTS "payloadHash" TEXT,
ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

ALTER TABLE "WarehouseTransfer" ALTER COLUMN "status" SET DEFAULT 'PENDING';

UPDATE "WarehouseTransfer"
SET "completedAt" = "createdAt"
WHERE "status" = 'COMPLETED' AND "completedAt" IS NULL;

CREATE TABLE IF NOT EXISTS "WarehouseTransferItem" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarehouseTransferItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WarehouseTransferItem_transferId_idx" ON "WarehouseTransferItem"("transferId");
CREATE INDEX IF NOT EXISTS "WarehouseTransferItem_productId_idx" ON "WarehouseTransferItem"("productId");

CREATE UNIQUE INDEX IF NOT EXISTS "WarehouseTransfer_companyId_idempotencyKey_key"
ON "WarehouseTransfer"("companyId", "idempotencyKey");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WarehouseTransferItem_transferId_fkey'
  ) THEN
    ALTER TABLE "WarehouseTransferItem"
    ADD CONSTRAINT "WarehouseTransferItem_transferId_fkey"
    FOREIGN KEY ("transferId") REFERENCES "WarehouseTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WarehouseTransferItem_productId_fkey'
  ) THEN
    ALTER TABLE "WarehouseTransferItem"
    ADD CONSTRAINT "WarehouseTransferItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "WarehouseTransferItem" ("id", "transferId", "productId", "quantity", "createdAt")
SELECT
    wt."id" || '_legacy_item',
    wt."id",
    wt."productId",
    wt."quantity",
    wt."createdAt"
FROM "WarehouseTransfer" wt
WHERE NOT EXISTS (
    SELECT 1 FROM "WarehouseTransferItem" wti WHERE wti."transferId" = wt."id"
);
