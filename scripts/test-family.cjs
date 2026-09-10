const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');
const crypto=require('node:crypto');
function load(file,mocks={},extra={}) {
  const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{exports,Buffer,URLSearchParams,process,...extra,require:n=>Object.hasOwn(mocks,n)?mocks[n]:require(n)});return exports;
}
const access=load('src/lib/access.ts');
for(const viewer of ['ME','WIFE']) {
  for(const table of ['Account','FinancialTransaction','IncomeExpenseActivity','CreditOutstanding','Project','FinancialGoal','AppSetting']) {
    for(const source of [`SELECT * FROM ${table}`,`SELECT * FROM \`${table}\` WHERE id=?`,`SELECT a.* FROM ${table} AS a WHERE a.id=? FOR UPDATE`]) {
      const scoped=access.scopeSelect(source,viewer);
      assert.ok(scoped.includes(`WHERE owner='${viewer}'`),scoped);
      assert.equal((scoped.match(/\?/g)||[]).length,(source.match(/\?/g)||[]).length);
      assert.ok(!scoped.includes('``'),scoped);
    }
  }
  const joined=access.scopeSelect('SELECT a.*,e.amount FROM Account a LEFT JOIN AccountEntry e ON e.accountId=a.id WHERE a.id=? GROUP BY a.id',viewer);
  assert.ok(joined.includes(`SELECT id FROM Account WHERE owner='${viewer}'`));
  assert.ok(!joined.includes('isSharedCash=1'));
  assert.ok(access.scopeSelect('SELECT * FROM FinancialTransaction',viewer,'household').includes('OR household=1'));
  assert.ok(access.scopeSelect('SELECT * FROM FinancialTransaction',viewer,'cash').includes('isSharedCash=1'));
  for(const table of ['Party','Category','Item'])assert.ok(access.scopeSelect('SELECT * FROM '+table,viewer).includes('WHERE 1=1'));
  assert.ok(access.scopeSelect('SELECT * FROM Task',viewer).includes('ELSE NULL END AS projectId'));
  assert.ok(access.scopeSelect('SELECT * FROM PartyEntry',viewer).includes(`SELECT id FROM FinancialTransaction WHERE owner='${viewer}'`));
}
assert.equal(access.cashName('ME','ME'),'Cash at Sudu Manike');
assert.equal(access.cashName('ME','WIFE'),'Ayya Cash');
assert.equal(access.cashName('WIFE','ME'),'Sudu Manike Cash');
assert.equal(access.cashName('WIFE','WIFE'),'Cash at Ayya');

(async()=>{
  let cookie='';const salt=crypto.randomBytes(16).toString('hex');
  const auth=load('src/lib/auth.ts',{'next/headers':{cookies:async()=>({get:()=>({value:cookie})})}},{process:{env:{FIN_APP_PASSWORD:'husband-test',FIN_SESSION_SECRET:'test-secret',FIN_WIFE_PASSWORD_HASH:salt+':'+crypto.scryptSync('wife-test',salt,64).toString('hex')}}});
  assert.equal(auth.isCorrectPassword('husband-test','ME'),true);
  assert.equal(auth.isCorrectPassword('wife-test','WIFE'),true);
  assert.equal(auth.isCorrectPassword('wife-test','ME'),false);
  assert.equal(auth.isCorrectPassword('husband-test','WIFE'),false);
  assert.equal(auth.isCorrectPassword('é'.repeat(12),'ME'),false);
  for(const owner of ['ME','WIFE']) {cookie=auth.sessionCookie(owner).value;assert.equal(await auth.currentOwner(),owner);cookie=cookie.replace(owner,owner==='ME'?'WIFE':'ME');assert.equal(await auth.hasSession(),false);}
  cookie='';assert.equal(await auth.hasSession(),false);
  console.log('Family checks passed: distinct credentials, signed owner sessions, tamper rejection, account labels, private SQL scoping and explicit shared boundaries.');
})().catch(e=>{console.error(e);process.exitCode=1});
