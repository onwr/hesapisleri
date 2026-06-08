-- CreateEnum
CREATE TYPE "ExpensePaymentStatus" AS ENUM ('PAID', 'UNPAID');

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "paymentStatus" "ExpensePaymentStatus" NOT NULL DEFAULT 'UNPAID';
ALTER TABLE "Expense" ADD COLUMN "accountId" TEXT;

-- AlterTable
ALTER TABLE "AccountTransaction" ADD COLUMN "expenseId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AccountTransaction_expenseId_key" ON "AccountTransaction"("expenseId");
CREATE INDEX "Expense_accountId_idx" ON "Expense"("accountId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountTransaction" ADD CONSTRAINT "AccountTransaction_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
