-- BUG-07 Phase 1: PostgreSQL RLS for direct tenant tables.
-- Requires runtime role without BYPASSRLS. Context via:
--   SELECT set_config('app.current_company_id', '<companyId>', true);

-- Direct tenant tables (companyId column)
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'Customer',
    'Supplier',
    'Product',
    'Warehouse',
    'WarehouseStock',
    'StockMovement',
    'Sale',
    'Invoice',
    'Expense',
    'Account',
    'Employee',
    'DirectoryContact'
  ]
  LOOP
    IF to_regclass(format('public.%I', tbl)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_tenant_isolation', tbl);

    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (
        "companyId" = current_setting(''app.current_company_id'', true)
      ) WITH CHECK (
        "companyId" = current_setting(''app.current_company_id'', true)
      )',
      tbl || '_tenant_isolation',
      tbl
    );
  END LOOP;
END $$;

-- Indirect tenant: AccountTransaction via parent Account
DO $$
BEGIN
  IF to_regclass('public."AccountTransaction"') IS NOT NULL THEN
    ALTER TABLE "AccountTransaction" ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "AccountTransaction_tenant_isolation" ON "AccountTransaction";

    CREATE POLICY "AccountTransaction_tenant_isolation"
    ON "AccountTransaction"
    FOR ALL
    USING (
      EXISTS (
        SELECT 1
        FROM "Account"
        WHERE "Account"."id" = "AccountTransaction"."accountId"
          AND "Account"."companyId" = current_setting('app.current_company_id', true)
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM "Account"
        WHERE "Account"."id" = "AccountTransaction"."accountId"
          AND "Account"."companyId" = current_setting('app.current_company_id', true)
      )
    );
  END IF;
END $$;

-- Indirect tenant: InvoiceItem via parent Invoice
DO $$
BEGIN
  IF to_regclass('public."InvoiceItem"') IS NOT NULL THEN
    ALTER TABLE "InvoiceItem" ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "InvoiceItem_tenant_isolation" ON "InvoiceItem";

    CREATE POLICY "InvoiceItem_tenant_isolation"
    ON "InvoiceItem"
    FOR ALL
    USING (
      EXISTS (
        SELECT 1
        FROM "Invoice"
        WHERE "Invoice"."id" = "InvoiceItem"."invoiceId"
          AND "Invoice"."companyId" = current_setting('app.current_company_id', true)
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM "Invoice"
        WHERE "Invoice"."id" = "InvoiceItem"."invoiceId"
          AND "Invoice"."companyId" = current_setting('app.current_company_id', true)
      )
    );
  END IF;
END $$;

-- Indirect tenant: SaleItem via parent Sale
DO $$
BEGIN
  IF to_regclass('public."SaleItem"') IS NOT NULL THEN
    ALTER TABLE "SaleItem" ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "SaleItem_tenant_isolation" ON "SaleItem";

    CREATE POLICY "SaleItem_tenant_isolation"
    ON "SaleItem"
    FOR ALL
    USING (
      EXISTS (
        SELECT 1
        FROM "Sale"
        WHERE "Sale"."id" = "SaleItem"."saleId"
          AND "Sale"."companyId" = current_setting('app.current_company_id', true)
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM "Sale"
        WHERE "Sale"."id" = "SaleItem"."saleId"
          AND "Sale"."companyId" = current_setting('app.current_company_id', true)
      )
    );
  END IF;
END $$;
