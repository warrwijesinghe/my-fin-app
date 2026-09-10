const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function load(file, mocks = {}) {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exported = {};
  vm.runInNewContext(output, { exports: exported, URLSearchParams, require: name => Object.hasOwn(mocks, name) ? mocks[name] : require(name) });
  return exported;
}
const analytics = load('src/lib/analytics.ts');
const types = load('src/lib/types.ts');
const expenses = load('src/lib/expenses.ts');
const tax = load('src/lib/tax-report.ts', { './analytics': analytics });
const row = (id, type, amount, scope, taxScope, status = 'POSTED') => ({ id, type, amount, scope, taxScope, status, category: 'General', transactionDate: '2026-09-07', description: id });
const records = [
  row('Business income', 'INCOME', 1000, 'BUSINESS', 'BUSINESS'),
  row('Personal expense assigned to business', 'EXPENSE', 200, 'PERSONAL', 'BUSINESS'),
  row('Business expense assigned to personal', 'EXPENSE', 50, 'BUSINESS', 'PERSONAL'),
  row('Legacy personal income', 'INCOME', 300, 'PERSONAL', null),
  row('Unpaid bill', 'ACCRUED_EXPENSE', 25, 'PERSONAL', 'BUSINESS'),
  ...['TRANSFER', 'DEBT_PAYMENT', 'OPENING_BALANCE', 'ADJUSTMENT'].map(type => row(type, type, 9999, 'BUSINESS', 'BUSINESS')),
  row('Pending expense', 'EXPENSE', 9999, 'BUSINESS', 'BUSINESS', 'PENDING_REVIEW'),
  row('Void income', 'INCOME', 9999, 'BUSINESS', 'BUSINESS', 'VOID'),
];
const snapshot = JSON.stringify(records);
const business = tax.incomeTaxReport(records, 'BUSINESS');
assert.equal(business.total.income, 1000);
assert.equal(business.total.expenses, 225);
assert.equal(business.total.net, 775);
assert.equal(business.total.count, 3);
const personal = tax.incomeTaxReport(records, 'PERSONAL');
assert.equal(personal.total.income, 300);
assert.equal(personal.total.expenses, 50);
assert.equal(personal.total.net, 250);
assert.equal(tax.incomeTaxReport([], 'BUSINESS').total.count, 0);
assert.equal(JSON.stringify(records), snapshot, 'Tax reports must never mutate actual labels');
const actualPersonal = records.filter(r => tax.isIncomeExpense(r) && r.scope === 'PERSONAL');
assert.equal(actualPersonal.reduce((sum, r) => sum + (r.type === 'INCOME' ? 0 : r.amount), 0), 225);
const csv = tax.incomeTaxCsv(records, 'BUSINESS', '2026-09-01', '2026-09-30');
assert.ok(csv.includes('"Personal expense assigned to business","General","PERSONAL","BUSINESS"'));
assert.ok(csv.includes('"Net income less expenses","775.00"'));
assert.ok(!csv.includes('Business expense assigned to personal'));
assert.ok(!csv.includes('Pending expense'));
assert.ok(tax.incomeTaxCsv([row('=HYPERLINK("bad")', 'INCOME', 1, 'BUSINESS', 'BUSINESS')], 'BUSINESS', '', '').includes("\"'=HYPERLINK"));

async function runCreate(extra) {
  const statements = [];
  const route = load('src/app/api/transactions/route.ts', {
    '@/lib/auth': { currentOwner:async()=> 'ME', relativeRedirect: value => value }, '@/lib/route-auth': { requireApiSession: async () => null }, '@/lib/types': types, '@/lib/analytics': analytics, '@/lib/expenses': expenses,
    '@/lib/db': { rows: async () => [{ id: 'account', type: 'BANK' }], transaction: async fn => fn({ execute: async (sql, values) => { if(sql.startsWith("SELECT"))return [[{id:"account",type:"BANK",owner:"ME"}]]; statements.push({sql,values}); return [[],[]]; } }) },
  });
  const result = await route.POST(new Request('http://localhost/api/transactions', { method: 'POST', body: new URLSearchParams({ type: 'EXPENSE', expenseKind: 'HOUSEHOLD', amount: '200', transactionDate: '2026-09-07', scope: 'PERSONAL', accountId: 'account', ...extra }) }));
  return { result, statements };
}

async function runUpdate(taxScope, item, denied = null) {
  const statements = [];
  const route = load('src/app/api/transactions/[id]/tax-label/route.ts', {
    '@/lib/auth': { currentOwner:async()=> 'ME', relativeRedirect: value => value }, '@/lib/route-auth': { requireApiSession: async () => denied }, '@/lib/types': types, '@/lib/analytics': analytics,
    '@/lib/db': { transaction: async fn => fn({ execute: async (sql, values) => { statements.push({ sql, values }); return [item ? [item] : []]; } }) },
  });
  const result = await route.POST(new Request('http://localhost/api/transactions/id/tax-label', { method: 'POST', body: new URLSearchParams({ taxScope, start: '2026-09-01', end: '2026-09-30', reportScope: 'BUSINESS' }) }), { params: Promise.resolve({ id: 'id' }) });
  return { result, statements };
}

(async () => {
  for (const taxScope of ['BUSINESS', 'PERSONAL', undefined]) {
    const { result, statements } = await runCreate(taxScope ? { taxScope } : {});
    assert.equal(result, '/?created=1');
    const insert = statements.find(s => s.sql.includes('INSERT INTO FinancialTransaction'));
    assert.equal(insert.values[6], 'PERSONAL');
    assert.equal(insert.values[7], taxScope ?? 'PERSONAL');
    assert.equal((insert.sql.match(/\?/g) ?? []).length, insert.values.length);
  }
  assert.equal((await runCreate({ taxScope: 'INVALID' })).statements.length, 0);
  const updated = await runUpdate('BUSINESS', { scope: 'PERSONAL', taxScope: 'PERSONAL' });
  assert.ok(updated.result.includes('saved=1'));
  assert.equal(updated.statements.length, 3);
  assert.ok(updated.statements[0].sql.includes('FOR UPDATE'));
  assert.equal(updated.statements[1].sql, 'UPDATE FinancialTransaction SET taxScope=?,updatedAt=NOW(3) WHERE id=?');
  const audit = JSON.parse(updated.statements[2].values[3]);
  assert.equal(audit.before, 'PERSONAL');
  assert.equal(audit.after, 'BUSINESS');
  assert.equal(audit.actualScope, 'PERSONAL');
  assert.equal((await runUpdate('INVALID', {})).statements.length, 0);
  assert.equal((await runUpdate('BUSINESS', null)).statements.length, 1);
  assert.equal((await runUpdate('PERSONAL', { scope: 'PERSONAL', taxScope: null })).statements.length, 1);
  assert.equal((await runUpdate('BUSINESS', {}, 'unauthorized')).statements.length, 0);
  console.log('Tax classification, report totals, exclusions, CSV, creation defaults, update isolation, audit and authentication checks passed (database mocked).');
})().catch(error => { console.error(error); process.exitCode = 1; });
