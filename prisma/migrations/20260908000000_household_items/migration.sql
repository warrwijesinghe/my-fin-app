ALTER TABLE Account ADD COLUMN owner ENUM('ME','WIFE') NOT NULL DEFAULT 'ME';
ALTER TABLE FinancialTransaction ADD COLUMN owner ENUM('ME','WIFE') NOT NULL DEFAULT 'ME', ADD COLUMN household BOOLEAN NOT NULL DEFAULT false, ADD INDEX household_date (household,transactionDate);
ALTER TABLE AccruedExpense ADD COLUMN owner ENUM('ME','WIFE') NOT NULL DEFAULT 'ME';
ALTER TABLE Category DROP INDEX Category_name_scope_key, ADD COLUMN kind ENUM('INCOME','EXPENSE') NOT NULL DEFAULT 'EXPENSE', ADD UNIQUE INDEX Category_name_scope_kind_key (name,scope,kind);
UPDATE Category c SET kind='INCOME' WHERE EXISTS (SELECT 1 FROM FinancialTransaction t WHERE t.categoryId=c.id AND t.type='INCOME') AND NOT EXISTS (SELECT 1 FROM FinancialTransaction t WHERE t.categoryId=c.id AND t.type IN ('EXPENSE','ACCRUED_EXPENSE')) AND NOT EXISTS (SELECT 1 FROM AccruedExpense a WHERE a.categoryId=c.id);
CREATE TEMPORARY TABLE IncomeCategoryMigration AS SELECT c.id oldId, UUID() newId FROM Category c WHERE c.kind='EXPENSE' AND EXISTS (SELECT 1 FROM FinancialTransaction t WHERE t.categoryId=c.id AND t.type='INCOME');
INSERT INTO Category (id,name,scope,kind,isActive) SELECT m.newId,c.name,c.scope,'INCOME',c.isActive FROM Category c JOIN IncomeCategoryMigration m ON m.oldId=c.id;
UPDATE FinancialTransaction t JOIN IncomeCategoryMigration m ON m.oldId=t.categoryId SET t.categoryId=m.newId WHERE t.type='INCOME';
DROP TEMPORARY TABLE IncomeCategoryMigration;
CREATE TABLE Item (
 id VARCHAR(191) NOT NULL PRIMARY KEY,
 name VARCHAR(140) NOT NULL,
 normalizedName VARCHAR(140) NOT NULL,
 categoryId VARCHAR(191) NOT NULL,
 defaultUnit VARCHAR(20) NULL,
 isActive BOOLEAN NOT NULL DEFAULT true,
 createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE INDEX Item_category_name (categoryId,normalizedName),
 CONSTRAINT Item_category_fk FOREIGN KEY (categoryId) REFERENCES Category(id) ON DELETE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE ExpenseLine (
 id VARCHAR(191) NOT NULL PRIMARY KEY,
 transactionId VARCHAR(191) NOT NULL,
 itemId VARCHAR(191) NOT NULL,
 categoryId VARCHAR(191) NOT NULL,
 quantity DECIMAL(15,3) NULL,
 unit VARCHAR(20) NULL,
 amount DECIMAL(15,2) NOT NULL,
 CONSTRAINT ExpenseLine_transaction_fk FOREIGN KEY (transactionId) REFERENCES FinancialTransaction(id) ON DELETE RESTRICT,
 CONSTRAINT ExpenseLine_item_fk FOREIGN KEY (itemId) REFERENCES Item(id) ON DELETE RESTRICT,
 CONSTRAINT ExpenseLine_category_fk FOREIGN KEY (categoryId) REFERENCES Category(id) ON DELETE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE HouseholdBudget (
 month CHAR(7) NOT NULL,
 categoryKey VARCHAR(191) NOT NULL DEFAULT '',
 amount DECIMAL(15,2) NOT NULL,
 PRIMARY KEY (month,categoryKey)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE VIEW IncomeExpenseActivity AS
 SELECT COALESCE(l.id,t.id) activityId,t.id,t.type,t.status,COALESCE(l.amount,t.amount) amount,t.transactionDate,t.description,t.counterparty,t.scope,t.taxScope,t.owner,t.household,t.projectId,t.taskId,COALESCE(l.categoryId,t.categoryId) categoryId,t.createdAt
 FROM FinancialTransaction t LEFT JOIN ExpenseLine l ON l.transactionId=t.id;
