const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const id = '12345678-1234-4234-8234-123456789abc';

async function run({entry = {}, invoice = null, bill = null, payments = [], visible = true, denied = null, revision = '2', confirm = 'delete', failAudit = false} = {}) {
  const record = {id, amount: 25, revision: 2, settlesTransactionId: null, ...entry};
  let writes = [], committed = false, rolledBack = false;
  const mocks = {
    '@/lib/auth': {currentOwner: async () => 'ME', relativeRedirect: url => url},
    '@/lib/route-auth': {requireApiSession: async () => denied},
    '@/lib/expenses': {moneyCents: amount => Math.round(Number(amount) * 100)},
    '@/lib/db': {
      sharedRows: async () => visible ? [record] : [],
      transaction: async (work, scope) => {
        assert.equal(scope, 'shared');
        try {
          await work({execute: async (sql, values) => {
            if (sql.startsWith('SELECT')) {
              if (sql.includes('FROM AccruedExpense')) return [[bill].filter(Boolean)];
              if (sql.includes('WHERE settlesTransactionId=')) return [payments];
              return [[values[0] === id ? record : invoice].filter(Boolean)];
            }
            if (failAudit && sql.startsWith('INSERT INTO AuditLog')) throw new Error('audit unavailable');
            writes.push({sql, values});
            return [{}];
          }});
          committed = true;
        } catch (error) { writes = []; rolledBack = true; throw error; }
      }
    }
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/api/transactions/[id]/delete/route.ts', 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true}}).outputText, {exports, require: name => mocks[name] || require(name)});
  const form = new FormData();
  if (revision !== null) form.set('revision', revision);
  form.set('confirm', confirm);
  let result, error;
  try { result = await exports.POST({formData: async () => form}, {params: Promise.resolve({id})}); } catch (e) { error = e; }
  return {result, error, writes, committed, rolledBack};
}

(async () => {
  const basic = await run();
  assert.ok(basic.committed);
  assert.match(basic.result, /deleted=1/);
  for (const table of ['AccountEntry', 'PartyEntry']) assert.ok(basic.writes.some(w => w.sql === `DELETE FROM ${table} WHERE transactionId=?` && w.values[0] === id));
  assert.ok(basic.writes.some(w => w.sql.includes("status='VOID'")));
  assert.ok(basic.writes.some(w => w.sql.startsWith('INSERT INTO AuditLog')));

  const billPayment = await run({entry: {settlesTransactionId: 'invoice'}, invoice: {id: 'invoice', accrualId: 'bill'}, bill: {amount: 100, paidAmount: 25}});
  const update = billPayment.writes.find(w => w.sql.includes('SET paidAmount=?'));
  assert.equal(update.values[0], 0);
  assert.equal(update.values[1], 'OPEN');
  const partial = await run({entry: {settlesTransactionId: 'invoice'}, invoice: {id: 'invoice', accrualId: 'bill'}, bill: {amount: 100, paidAmount: 100}});
  assert.equal(partial.writes.find(w => w.sql.includes('SET paidAmount=?')).values[0], 75);

  for (const accrualId of [null, 'bill']) {
    const cascade = await run({entry: {accrualId}, payments: [{id: 'payment', amount: 10}]});
    assert.equal(cascade.writes.filter(w => w.sql.startsWith('DELETE FROM AccountEntry')).length, 2);
    assert.equal(cascade.writes.filter(w => w.sql.startsWith('INSERT INTO AuditLog')).length, 2);
    if (accrualId) assert.ok(cascade.writes.some(w => w.sql.includes("SET status='VOID',paidAmount=0")));
  }
  for (const options of [{visible: false}, {revision: '1'}, {revision: null}, {confirm: ''}, {denied: 'unauthorized'}, {entry: {settlesTransactionId: 'missing'}}]) {
    const rejected = await run(options);
    assert.equal(rejected.committed, false);
    assert.equal(rejected.writes.length, 0);
  }
  const failed = await run({failAudit: true});
  assert.ok(failed.error);
  assert.ok(failed.rolledBack);
  assert.equal(failed.writes.length, 0);
  console.log('Transaction deletion checks passed: ledgers, bills, credit invoices, linked payments, confirmation, revisions, access rejection and rollback.');
})().catch(error => {console.error(error); process.exitCode = 1;});
