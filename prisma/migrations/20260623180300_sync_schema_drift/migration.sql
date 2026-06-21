-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('SALES', 'INVOICES', 'STOCK', 'FINANCE', 'SYSTEM', 'TEAM', 'MARKETPLACE');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP');

-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('APPOINTMENT', 'PAYMENT', 'REMINDER');

-- CreateEnum
CREATE TYPE "CalendarEventStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CalendarEventSource" AS ENUM ('MANUAL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'PASSIVE', 'ON_LEAVE', 'TERMINATED');

-- CreateEnum
CREATE TYPE "EmployeeEmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'INTERN', 'SEASONAL');

-- CreateEnum
CREATE TYPE "EmployeeSalaryPeriod" AS ENUM ('MONTHLY', 'WEEKLY', 'DAILY', 'HOURLY');

-- CreateEnum
CREATE TYPE "EmployeePaymentType" AS ENUM ('SALARY', 'ADVANCE', 'BONUS', 'DEDUCTION', 'EXPENSE_REIMBURSEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "EmployeePaymentDirection" AS ENUM ('PAYABLE', 'PAID', 'DEDUCTED');

-- CreateEnum
CREATE TYPE "EmployeePaymentStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "EmployeeLeaveType" AS ENUM ('ANNUAL', 'SICK', 'UNPAID', 'EXCUSE', 'REMOTE', 'OTHER');

-- CreateEnum
CREATE TYPE "EmployeeLeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayrollRunItemStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID', 'CANCELLED');

-- AlterEnum (safe if already applied)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'UserRole' AND e.enumlabel = 'POS_STAFF'
  ) THEN
    ALTER TYPE "UserRole" ADD VALUE 'POS_STAFF';
  END IF;
END $$;

-- DropIndex
DROP INDEX "Company_referringPartnerId_idx";

-- DropIndex
DROP INDEX "Notification_companyId_idx";

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "actionUrl" TEXT,
ADD COLUMN     "category" "NotificationCategory" NOT NULL DEFAULT 'SYSTEM',
ADD COLUMN     "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
ADD COLUMN     "dedupeKey" TEXT,
ADD COLUMN     "entityId" TEXT,
ADD COLUMN     "entityType" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "module" TEXT,
ADD COLUMN     "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL';

-- AlterTable
ALTER TABLE "PartnerSettings" ALTER COLUMN "id" SET DEFAULT 'default';

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CalendarEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "amount" DECIMAL(65,30),
    "currency" TEXT,
    "color" TEXT,
    "status" "CalendarEventStatus" NOT NULL DEFAULT 'SCHEDULED',
    "source" "CalendarEventSource" NOT NULL DEFAULT 'MANUAL',
    "relatedType" TEXT,
    "relatedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeDepartment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "managerEmployeeId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "companyUserId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "nationalId" TEXT,
    "jobTitle" TEXT,
    "department" TEXT,
    "departmentId" TEXT,
    "employmentType" "EmployeeEmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "birthDate" TIMESTAMP(3),
    "address" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSalary" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "grossAmount" DECIMAL(18,2),
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "period" "EmployeeSalaryPeriod" NOT NULL DEFAULT 'MONTHLY',
    "paymentDay" INTEGER,
    "iban" TEXT,
    "bankName" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeSalary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeePayment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "EmployeePaymentType" NOT NULL,
    "direction" "EmployeePaymentDirection" NOT NULL DEFAULT 'PAYABLE',
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "status" "EmployeePaymentStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "relatedExpenseId" TEXT,
    "relatedAccountId" TEXT,
    "relatedTransactionId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeLeave" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "EmployeeLeaveType" NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "totalDays" DECIMAL(8,2),
    "status" "EmployeeLeaveStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeLeave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeePerformanceRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "salesTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "posSalesCount" INTEGER NOT NULL DEFAULT 0,
    "manualSalesCount" INTEGER NOT NULL DEFAULT 0,
    "invoiceCount" INTEGER NOT NULL DEFAULT 0,
    "expenseCount" INTEGER NOT NULL DEFAULT 0,
    "taskScore" DECIMAL(8,2),
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeePerformanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeePerformanceTarget" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT,
    "department" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "salesCountTarget" INTEGER,
    "revenueTarget" DECIMAL(18,2),
    "collectionTarget" DECIMAL(18,2),
    "maxLeaveDays" INTEGER,
    "payrollEfficiencyTarget" DECIMAL(8,2),
    "scoreTarget" DECIMAL(8,2),
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeePerformanceTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "payDate" TIMESTAMP(3),
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "grossTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "deductionTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "bonusTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRunItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "salaryId" TEXT,
    "baseSalary" DECIMAL(18,2) NOT NULL,
    "bonusAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "deductionAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "advanceDeduction" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netPayable" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "status" "PayrollRunItemStatus" NOT NULL DEFAULT 'DRAFT',
    "employeePaymentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRunItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarEvent_companyId_startAt_idx" ON "CalendarEvent"("companyId", "startAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_companyId_type_idx" ON "CalendarEvent"("companyId", "type");

-- CreateIndex
CREATE INDEX "CalendarEvent_companyId_status_idx" ON "CalendarEvent"("companyId", "status");

-- CreateIndex
CREATE INDEX "CalendarEvent_companyId_source_idx" ON "CalendarEvent"("companyId", "source");

-- CreateIndex
CREATE INDEX "EmployeeDepartment_companyId_isActive_idx" ON "EmployeeDepartment"("companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeDepartment_companyId_name_key" ON "EmployeeDepartment"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_companyUserId_key" ON "Employee"("companyUserId");

-- CreateIndex
CREATE INDEX "Employee_companyId_status_idx" ON "Employee"("companyId", "status");

-- CreateIndex
CREATE INDEX "Employee_companyId_department_idx" ON "Employee"("companyId", "department");

-- CreateIndex
CREATE INDEX "Employee_companyId_departmentId_idx" ON "Employee"("companyId", "departmentId");

-- CreateIndex
CREATE INDEX "Employee_companyId_email_idx" ON "Employee"("companyId", "email");

-- CreateIndex
CREATE INDEX "EmployeeSalary_companyId_employeeId_idx" ON "EmployeeSalary"("companyId", "employeeId");

-- CreateIndex
CREATE INDEX "EmployeeSalary_employeeId_isActive_idx" ON "EmployeeSalary"("employeeId", "isActive");

-- CreateIndex
CREATE INDEX "EmployeePayment_companyId_employeeId_idx" ON "EmployeePayment"("companyId", "employeeId");

-- CreateIndex
CREATE INDEX "EmployeePayment_companyId_status_idx" ON "EmployeePayment"("companyId", "status");

-- CreateIndex
CREATE INDEX "EmployeePayment_companyId_dueDate_idx" ON "EmployeePayment"("companyId", "dueDate");

-- CreateIndex
CREATE INDEX "EmployeePayment_relatedExpenseId_idx" ON "EmployeePayment"("relatedExpenseId");

-- CreateIndex
CREATE INDEX "EmployeePayment_relatedAccountId_idx" ON "EmployeePayment"("relatedAccountId");

-- CreateIndex
CREATE INDEX "EmployeePayment_relatedTransactionId_idx" ON "EmployeePayment"("relatedTransactionId");

-- CreateIndex
CREATE INDEX "EmployeeLeave_companyId_employeeId_idx" ON "EmployeeLeave"("companyId", "employeeId");

-- CreateIndex
CREATE INDEX "EmployeeLeave_companyId_status_idx" ON "EmployeeLeave"("companyId", "status");

-- CreateIndex
CREATE INDEX "EmployeeLeave_companyId_startAt_idx" ON "EmployeeLeave"("companyId", "startAt");

-- CreateIndex
CREATE INDEX "EmployeePerformanceRecord_companyId_employeeId_idx" ON "EmployeePerformanceRecord"("companyId", "employeeId");

-- CreateIndex
CREATE INDEX "EmployeePerformanceRecord_employeeId_periodStart_idx" ON "EmployeePerformanceRecord"("employeeId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeePerformanceRecord_employeeId_periodStart_periodEnd_key" ON "EmployeePerformanceRecord"("employeeId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "EmployeePerformanceTarget_companyId_periodStart_periodEnd_idx" ON "EmployeePerformanceTarget"("companyId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "EmployeePerformanceTarget_companyId_employeeId_idx" ON "EmployeePerformanceTarget"("companyId", "employeeId");

-- CreateIndex
CREATE INDEX "EmployeePerformanceTarget_companyId_department_idx" ON "EmployeePerformanceTarget"("companyId", "department");

-- CreateIndex
CREATE INDEX "PayrollRun_companyId_status_idx" ON "PayrollRun"("companyId", "status");

-- CreateIndex
CREATE INDEX "PayrollRun_companyId_periodStart_periodEnd_idx" ON "PayrollRun"("companyId", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRunItem_employeePaymentId_key" ON "PayrollRunItem"("employeePaymentId");

-- CreateIndex
CREATE INDEX "PayrollRunItem_payrollRunId_idx" ON "PayrollRunItem"("payrollRunId");

-- CreateIndex
CREATE INDEX "PayrollRunItem_companyId_employeeId_idx" ON "PayrollRunItem"("companyId", "employeeId");

-- CreateIndex
CREATE INDEX "CompanySubscription_nextBillingAt_status_idx" ON "CompanySubscription"("nextBillingAt", "status");

-- CreateIndex
CREATE INDEX "CompanySubscription_defaultPaymentMethodId_idx" ON "CompanySubscription"("defaultPaymentMethodId");

-- CreateIndex
CREATE INDEX "Notification_companyId_createdAt_idx" ON "Notification"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_companyId_readAt_idx" ON "Notification"("companyId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_companyId_category_idx" ON "Notification"("companyId", "category");

-- CreateIndex
CREATE INDEX "Notification_companyId_priority_idx" ON "Notification"("companyId", "priority");

-- CreateIndex
CREATE INDEX "Notification_companyId_dedupeKey_idx" ON "Notification"("companyId", "dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDepartment" ADD CONSTRAINT "EmployeeDepartment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDepartment" ADD CONSTRAINT "EmployeeDepartment_managerEmployeeId_fkey" FOREIGN KEY ("managerEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_companyUserId_fkey" FOREIGN KEY ("companyUserId") REFERENCES "CompanyUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "EmployeeDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSalary" ADD CONSTRAINT "EmployeeSalary_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSalary" ADD CONSTRAINT "EmployeeSalary_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePayment" ADD CONSTRAINT "EmployeePayment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePayment" ADD CONSTRAINT "EmployeePayment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePayment" ADD CONSTRAINT "EmployeePayment_relatedExpenseId_fkey" FOREIGN KEY ("relatedExpenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePayment" ADD CONSTRAINT "EmployeePayment_relatedAccountId_fkey" FOREIGN KEY ("relatedAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePayment" ADD CONSTRAINT "EmployeePayment_relatedTransactionId_fkey" FOREIGN KEY ("relatedTransactionId") REFERENCES "AccountTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeLeave" ADD CONSTRAINT "EmployeeLeave_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeLeave" ADD CONSTRAINT "EmployeeLeave_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePerformanceRecord" ADD CONSTRAINT "EmployeePerformanceRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePerformanceRecord" ADD CONSTRAINT "EmployeePerformanceRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePerformanceTarget" ADD CONSTRAINT "EmployeePerformanceTarget_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePerformanceTarget" ADD CONSTRAINT "EmployeePerformanceTarget_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRunItem" ADD CONSTRAINT "PayrollRunItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRunItem" ADD CONSTRAINT "PayrollRunItem_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRunItem" ADD CONSTRAINT "PayrollRunItem_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRunItem" ADD CONSTRAINT "PayrollRunItem_salaryId_fkey" FOREIGN KEY ("salaryId") REFERENCES "EmployeeSalary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRunItem" ADD CONSTRAINT "PayrollRunItem_employeePaymentId_fkey" FOREIGN KEY ("employeePaymentId") REFERENCES "EmployeePayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "CompanyPlanPriceOverride_companyId_planId_billingInterval_statu" RENAME TO "CompanyPlanPriceOverride_companyId_planId_billingInterval_s_idx";
