-- Normalize the legacy dual-label records to the new model.
-- scope remains the internal operational type: PERSONAL = Household, BUSINESS = Business.
UPDATE FinancialTransaction
SET household = CASE WHEN type IN ('EXPENSE','ACCRUED_EXPENSE') AND scope='PERSONAL' THEN 1 ELSE 0 END;

UPDATE FinancialTransaction
SET taxScope = CASE
  WHEN type IN ('EXPENSE','ACCRUED_EXPENSE') AND scope='BUSINESS' THEN 'BUSINESS'
  WHEN taxScope IS NULL THEN scope
  ELSE taxScope
END
WHERE type IN ('INCOME','EXPENSE','ACCRUED_EXPENSE');

UPDATE AccruedExpense a JOIN FinancialTransaction t ON t.accrualId=a.id
SET a.scope=t.scope;
