-- Production baseline. This migration creates no accounts, projects, transactions,
-- categories, goals, or other sample financial data.
CREATE TABLE `Account` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `type` ENUM('CASH','BANK','SAVINGS','CREDIT_CARD','LOAN') NOT NULL,
  `scope` ENUM('PERSONAL','BUSINESS') NOT NULL,
  `holder` VARCHAR(80) NULL,
  `includeInAvailable` BOOLEAN NOT NULL DEFAULT true,
  `openingDate` DATE NULL,
  `dueDay` INTEGER NULL,
  `annualInterestRate` DECIMAL(7,4) NULL,
  `minimumPayment` DECIMAL(15,2) NULL,
  `debtPriority` INTEGER NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Account_name_key`(`name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Project` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `Project_name_key`(`name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Task` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(140) NOT NULL,
  `scope` ENUM('PERSONAL','BUSINESS') NOT NULL,
  `projectId` VARCHAR(191) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `Task_name_projectId_key`(`name`, `projectId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Category` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `scope` ENUM('PERSONAL','BUSINESS') NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `Category_name_scope_key`(`name`, `scope`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AccruedExpense` (
  `id` VARCHAR(191) NOT NULL,
  `amount` DECIMAL(15,2) NOT NULL,
  `expenseDate` DATE NOT NULL,
  `dueDate` DATE NULL,
  `description` VARCHAR(300) NULL,
  `scope` ENUM('PERSONAL','BUSINESS') NOT NULL,
  `projectId` VARCHAR(191) NULL,
  `taskId` VARCHAR(191) NULL,
  `categoryId` VARCHAR(191) NULL,
  `status` ENUM('OPEN','PARTIALLY_PAID','PAID','VOID') NOT NULL DEFAULT 'OPEN',
  `paidAmount` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `FinancialTransaction` (
  `id` VARCHAR(191) NOT NULL,
  `type` ENUM('INCOME','EXPENSE','TRANSFER','ACCRUED_EXPENSE','DEBT_PAYMENT','OPENING_BALANCE','ADJUSTMENT') NOT NULL,
  `status` ENUM('PENDING_REVIEW','POSTED','VOID') NOT NULL DEFAULT 'PENDING_REVIEW',
  `amount` DECIMAL(15,2) NOT NULL,
  `transactionDate` DATE NOT NULL,
  `description` VARCHAR(300) NULL,
  `counterparty` VARCHAR(140) NULL,
  `scope` ENUM('PERSONAL','BUSINESS') NOT NULL,
  `accountId` VARCHAR(191) NULL,
  `destinationAccountId` VARCHAR(191) NULL,
  `projectId` VARCHAR(191) NULL,
  `taskId` VARCHAR(191) NULL,
  `categoryId` VARCHAR(191) NULL,
  `accrualId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `FinancialTransaction_accrualId_key`(`accrualId`),
  INDEX `FinancialTransaction_transactionDate_status_idx`(`transactionDate`, `status`),
  INDEX `FinancialTransaction_scope_transactionDate_idx`(`scope`, `transactionDate`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AccountEntry` (
  `id` VARCHAR(191) NOT NULL,
  `accountId` VARCHAR(191) NOT NULL,
  `transactionId` VARCHAR(191) NOT NULL,
  `amount` DECIMAL(15,2) NOT NULL,
  `entryDate` DATE NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `AccountEntry_accountId_entryDate_idx`(`accountId`, `entryDate`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `FinancialGoal` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `type` ENUM('MONTHLY_INCOME','WEALTH') NOT NULL,
  `targetAmount` DECIMAL(15,2) NOT NULL,
  `baselineAmount` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `scope` ENUM('PERSONAL','BUSINESS') NULL,
  `projectId` VARCHAR(191) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AppSetting` (
  `key` VARCHAR(100) NOT NULL,
  `value` TEXT NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AuditLog` (
  `id` VARCHAR(191) NOT NULL,
  `transactionId` VARCHAR(191) NULL,
  `action` VARCHAR(80) NOT NULL,
  `details` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Task` ADD CONSTRAINT `Task_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `FinancialTransaction` ADD CONSTRAINT `FinancialTransaction_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `Account`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `FinancialTransaction` ADD CONSTRAINT `FinancialTransaction_destinationAccountId_fkey` FOREIGN KEY (`destinationAccountId`) REFERENCES `Account`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `FinancialTransaction` ADD CONSTRAINT `FinancialTransaction_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `FinancialTransaction` ADD CONSTRAINT `FinancialTransaction_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `FinancialTransaction` ADD CONSTRAINT `FinancialTransaction_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `FinancialTransaction` ADD CONSTRAINT `FinancialTransaction_accrualId_fkey` FOREIGN KEY (`accrualId`) REFERENCES `AccruedExpense`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AccountEntry` ADD CONSTRAINT `AccountEntry_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `Account`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `AccountEntry` ADD CONSTRAINT `AccountEntry_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `FinancialTransaction`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `FinancialTransaction`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
