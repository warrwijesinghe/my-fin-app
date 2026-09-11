const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const output = ts.transpileModule(fs.readFileSync('src/lib/account-center.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exported = {};
vm.runInNewContext(output, { exports: exported });
const { buildStatement, summarizeStatement, portfolioTotals, isDebtAccount } = exported;
const row = (id, entryDate, amount, type = 'INCOME', extra = {}) => ({ id, transactionId: id, entryDate, createdAt: entryDate + ' 12:00:00', amount, type, status: 'POSTED', ...extra });
const ledger = buildStatement([
  row('4', '2026-09-04', -200, 'TRANSFER'),
  row('1', '2026-08-01', 1000, 'OPENING_BALANCE'),
  row('3', '2026-09-03', -150.25, 'EXPENSE', { category: 'Supplies' }),
  row('2', '2026-09-02', 500.10),
]);
assert.equal(ledger.at(-1).balance, 1149.85);
const september = summarizeStatement(ledger, '2026-09-01', '2026-09-30');
assert.equal(september.opening, 1000);
assert.equal(september.closing, 1149.85);
assert.equal(september.increases, 500.10);
assert.equal(september.decreases, 350.25);
assert.equal(september.expenses, 150.25, 'Transfers must not inflate spending');
assert.equal(september.income, 500.10);
assert.equal(september.categories[0].amount, 150.25);
assert.equal(september.entries.filter(r => r.type === 'EXPENSE')[0].balance, 1349.85, 'Hidden income still affects the row balance');
assert.equal(summarizeStatement(ledger, '2026-10-01').opening, 1149.85);
assert.equal(summarizeStatement(ledger, '2026-10-01').closing, 1149.85);
assert.equal(summarizeStatement(ledger, '', '2026-07-01').closing, 0);
assert.equal(summarizeStatement(ledger).months.length, 1, 'Opening balance excluded from movement chart');
const debt = buildStatement([row('1', '2026-09-01', 1000, 'OPENING_BALANCE'), row('2', '2026-09-02', 100, 'EXPENSE'), row('3', '2026-09-03', -400, 'DEBT_PAYMENT')]);
assert.equal(debt.at(-1).balance, 700);
assert.equal(summarizeStatement(debt).expenses, 100);
assert.equal(summarizeStatement(debt).months[0].increases, 100);
assert.equal(summarizeStatement(debt).months[0].decreases, 400);
assert.equal(buildStatement([row('a', '2026-09-01', .1), row('b', '2026-09-01', .2)]).at(-1).balance, .3);
assert.equal(buildStatement([row('b', '2026-09-01', 5), row('a', '2026-09-01', 7)])[0].id, 'a', 'Same-day ordering is deterministic');
assert.equal(summarizeStatement([]).closing, 0);
const account = (type, balance, isActive = true, includeInAvailable = true) => ({ type, balance, isActive, includeInAvailable });
const totals = portfolioTotals([account('BANK', 1000), account('SAVINGS', 200, false), account('CREDIT_CARD', 300), account('LOAN', 400)]);
assert.equal(totals.assets, 1200);
assert.equal(totals.available, 700, 'Included credit-card debt reduces available cash');
assert.equal(totals.net, 500);
const overpaidCard = portfolioTotals([account('BANK', 1000), account('CREDIT_CARD', -125)]);
assert.equal(overpaidCard.available, 1125, 'An overpaid card credit increases available cash');
assert.equal(isDebtAccount('CREDIT_CARD'), true);
assert.equal(isDebtAccount('BANK'), false);
console.log('Account Center checks passed: running balances, date carry-forward, debt signs, transfer exclusion, cent precision and portfolio totals.');
