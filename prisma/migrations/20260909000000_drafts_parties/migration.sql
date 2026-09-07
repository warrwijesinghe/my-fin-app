CREATE TABLE Party (
 id VARCHAR(191) NOT NULL PRIMARY KEY,
 name VARCHAR(140) NOT NULL,
 kind ENUM('CUSTOMER','SUPPLIER','BOTH') NOT NULL,
 contactNo VARCHAR(40) NULL,
 isCash BOOLEAN NOT NULL DEFAULT false,
 isActive BOOLEAN NOT NULL DEFAULT true,
 createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE INDEX Party_name (name)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE FinancialTransaction ADD COLUMN partyId VARCHAR(191) NULL, ADD COLUMN dueDate DATE NULL, ADD COLUMN paymentTiming ENUM('PAID','CREDIT') NOT NULL DEFAULT 'PAID', ADD CONSTRAINT Transaction_party_fk FOREIGN KEY (partyId) REFERENCES Party(id) ON DELETE RESTRICT;
ALTER TABLE FinancialTransaction MODIFY COLUMN type ENUM('INCOME','EXPENSE','TRANSFER','ACCRUED_EXPENSE','DEBT_PAYMENT','OPENING_BALANCE','ADJUSTMENT','PARTY_PAYMENT') NOT NULL;
CREATE TABLE PartyEntry (
 id VARCHAR(191) NOT NULL PRIMARY KEY,
 partyId VARCHAR(191) NOT NULL,
 transactionId VARCHAR(191) NOT NULL,
 settlesTransactionId VARCHAR(191) NULL,
 amount DECIMAL(15,2) NOT NULL,
 CONSTRAINT PartyEntry_party_fk FOREIGN KEY (partyId) REFERENCES Party(id) ON DELETE RESTRICT,
 CONSTRAINT PartyEntry_transaction_fk FOREIGN KEY (transactionId) REFERENCES FinancialTransaction(id) ON DELETE RESTRICT,
 CONSTRAINT PartyEntry_settlement_fk FOREIGN KEY (settlesTransactionId) REFERENCES FinancialTransaction(id) ON DELETE RESTRICT,
 UNIQUE INDEX PartyEntry_transaction (transactionId),
 INDEX PartyEntry_settlement (settlesTransactionId)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE VIEW CreditOutstanding AS
 SELECT t.id,t.owner,t.scope,t.type,t.partyId,t.transactionDate,SUM(e.amount) balance
 FROM FinancialTransaction t JOIN PartyEntry e ON e.transactionId=t.id OR e.settlesTransactionId=t.id
 WHERE t.status='POSTED' AND t.paymentTiming='CREDIT'
 GROUP BY t.id;
