-- Existing records keep their established owner. No historical wife balances are invented.
ALTER TABLE Account ADD COLUMN isSharedCash BOOLEAN NOT NULL DEFAULT false, DROP INDEX Account_name_key, ADD UNIQUE INDEX Account_owner_name_key(owner,name);
ALTER TABLE FinancialTransaction ADD COLUMN spentBy ENUM('ME','WIFE') NOT NULL DEFAULT 'ME', ADD COLUMN recordedBy ENUM('ME','WIFE') NOT NULL DEFAULT 'ME', ADD COLUMN revision INT NOT NULL DEFAULT 0, ADD INDEX owner_date(owner,transactionDate);
UPDATE FinancialTransaction SET spentBy=owner,recordedBy=owner;
ALTER TABLE Project ADD COLUMN owner ENUM('ME','WIFE') NOT NULL DEFAULT 'ME', DROP INDEX Project_name_key, ADD UNIQUE INDEX Project_owner_name_key(owner,name);
ALTER TABLE Task ADD COLUMN owner ENUM('ME','WIFE') NOT NULL DEFAULT 'ME';
ALTER TABLE Category ADD COLUMN owner ENUM('ME','WIFE') NOT NULL DEFAULT 'ME';
ALTER TABLE Party ADD COLUMN owner ENUM('ME','WIFE') NOT NULL DEFAULT 'ME';
ALTER TABLE FinancialGoal ADD COLUMN owner ENUM('ME','WIFE') NOT NULL DEFAULT 'ME';
ALTER TABLE AppSetting ADD COLUMN owner ENUM('ME','WIFE') NOT NULL DEFAULT 'ME', DROP PRIMARY KEY, ADD PRIMARY KEY(owner,`key`);
INSERT INTO Account (id,name,type,scope,owner,isSharedCash,includeInAvailable,updatedAt) VALUES
 ('fca00000-0000-4000-8000-000000000001','Cash at Sudu Manike','CASH','PERSONAL','ME',true,true,NOW(3)),
 ('fca00000-0000-4000-8000-000000000002','Cash at Ayya','CASH','PERSONAL','WIFE',true,true,NOW(3));
