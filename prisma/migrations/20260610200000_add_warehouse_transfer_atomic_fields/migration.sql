-- PostgreSQL: new enum values must be committed before use in the same migration.
ALTER TYPE "WarehouseTransferStatus" ADD VALUE IF NOT EXISTS 'PENDING';
