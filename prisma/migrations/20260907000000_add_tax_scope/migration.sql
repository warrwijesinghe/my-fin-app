ALTER TABLE `FinancialTransaction` ADD COLUMN `taxScope` ENUM('PERSONAL', 'BUSINESS') NULL AFTER `scope`;
UPDATE `FinancialTransaction` SET `taxScope` = `scope` WHERE `taxScope` IS NULL;
