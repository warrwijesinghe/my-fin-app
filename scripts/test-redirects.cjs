const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function load(file, mocks = {}) {
  const source = fs.readFileSync(file, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const exported = {};
  vm.runInNewContext(output, {
    exports: exported, URL, URLSearchParams, Buffer, process,
    require: (name) => Object.hasOwn(mocks, name) ? mocks[name] : require(name),
  });
  return exported;
}

const { relativeRedirect } = load('src/lib/auth.ts');
const types = load('src/lib/types.ts');
const analytics = load('src/lib/analytics.ts');
const expenses = load('src/lib/expenses.ts');
const id = '123e4567-e89b-42d3-a456-426614174000';
const account = { id, name: 'Test account', type: 'BANK' };
const pending = { id, type: 'INCOME', amount: 25, transactionDate: '2026-09-06' };
const cases = [
  ['accounts', { name: 'Test account', type: 'BANK', scope: 'PERSONAL' }, '/master-data?created=1&section=ACCOUNT', [], 1],
  ['accounts', {}, '/master-data?error=1&section=ACCOUNT', [], 0],
  ['accounts/[id]', { name: 'Updated account' }, '/master-data?updated=1&section=ACCOUNT', [[account]], 1],
  ['accounts/[id]', { intent: 'delete' }, '/master-data?deleted=1&section=ACCOUNT', [[account], [{ count: 0 }]], 1],
  ['accounts/[id]', { intent: 'delete' }, '/master-data?has_entries=1&section=ACCOUNT', [[account], [{ count: 1 }]], 0],
  ['master-data', {}, '/master-data?error=1', [], 0],
  ...['PROJECT', 'CATEGORY', 'TASK'].flatMap((entity) => [
    ['master-data', { entity, intent: 'create', name: 'Test record', scope: 'PERSONAL' }, `/master-data?created=1&section=${entity}`, [], 1],
    ['master-data', { entity, intent: 'update', id, name: 'Updated record', scope: 'PERSONAL' }, `/master-data?updated=1&section=${entity}`, [], 1],
    ['master-data', { entity, intent: 'delete', id }, `/master-data?deleted=1&section=${entity}`, [], 1],
  ]),
  ['transactions', { type: 'INCOME', amount: '25', transactionDate: '2026-09-06', scope: 'PERSONAL', accountId: id }, '/?created=1', [[account]], 3],
  ['transactions', {}, '/transactions/new?error=invalid', [], 0],
  ['transactions', { type: 'INCOME', amount: '25', transactionDate: '2026-09-06', scope: 'BUSINESS' }, '/transactions/new?error=project', [], 0],
  ['transactions', { type: 'TRANSFER', amount: '25', transactionDate: '2026-09-06', scope: 'PERSONAL' }, '/transactions/new?error=accounts', [], 0],
  ['transactions', { type: 'INCOME', amount: '25', transactionDate: '2026-09-06', scope: 'PERSONAL' }, '/transactions/new?error=account', [], 0],
  ['review/[id]', { accountId: id }, '/', [[pending], [account]], 2],
  ['review/[id]', {}, '/review?error=invalid', [[], []], 0],
  ['goals', { target: '100', monthlyDebt: '10', monthlyWealth: '20' }, '/analytics?goalSaved=1#goals', [], 1],
  ['goals', {}, '/analytics?goalError=1#goals', [], 0],
];

(async () => {
  let checks = 0;
  for (const origin of ['http://localhost:4010', 'http://127.0.0.1:4010', 'https://fin.aplusict.lk']) {
    for (const [route, form, expected, rowResults, expectedWrites] of cases) {
      let writes = 0;
      const queue = [...rowResults];
      const execute = async (sql) => { if(sql.startsWith("SELECT")) return [queue.shift()??[]]; writes++; return [[],[]]; };
      const { POST } = load(`src/app/api/${route}/route.ts`, {
        '@/lib/auth': { relativeRedirect },
        '@/lib/route-auth': { requireApiSession: async () => null },
        '@/lib/types': types, '@/lib/analytics': analytics, '@/lib/expenses': expenses,
        '@/lib/db': { execute, rows: async () => queue.shift() ?? [], transaction: async (fn) => fn({ execute }) },
      });
      const request = new Request(`${origin}/api/${route.replace('[id]', id)}`, {
        method: 'POST', body: new URLSearchParams(form),
        headers: { host: 'fin.aplusict.lk', 'x-forwarded-proto': 'https' },
      });
      const response = await POST(request, { params: Promise.resolve({ id }) });
      const label = `${origin} ${route} ${expected}`;
      assert.equal(response.status, 303, label);
      assert.equal(response.headers.get('location'), expected, label);
      assert.equal(new URL(response.headers.get('location'), 'https://fin.aplusict.lk').origin, 'https://fin.aplusict.lk', label);
      assert.equal(writes, expectedWrites, label);
      checks++;
    }
  }
  console.log(`${checks} form redirect checks passed (database mocked; no records created).`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
