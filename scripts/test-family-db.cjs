// Integration test against a disposable LOCAL database only. Never loads .env.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),mysql=require('mysql2/promise'),crypto=require('node:crypto');
const url=new URL(process.env.FAMILY_TEST_DATABASE_URL||'http://missing');
if(url.protocol!=='mysql:'||!['127.0.0.1','localhost'].includes(url.hostname)||!/^\/fin_family_test_[a-z0-9_]+$/.test(url.pathname))throw new Error('Provide FAMILY_TEST_DATABASE_URL for a disposable local fin_family_test_* schema.');
let viewer='ME';const cache=new Map();
const auth={currentOwner:async()=>viewer,requireSession:async()=>viewer,relativeRedirect:s=>s};
function load(file) {
  file=path.resolve(file);if(cache.has(file))return cache.get(file);
  const exports={};cache.set(file,exports);
  const mocks={'@/lib/auth':auth,'@/lib/route-auth':{requireApiSession:async()=>null}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,Buffer,URLSearchParams,process,global:{},require:n=>{
    if(Object.hasOwn(mocks,n))return mocks[n];
    if(n==='./auth'&&file.endsWith(path.join('lib','db.ts')))return auth;
    if(n.startsWith('@/'))return load('src/'+n.slice(2)+'.ts');
    if(n.startsWith('.'))return load(path.join(path.dirname(file),n+'.ts'));
    return require(n);
  }});return exports;
}
const request=f=>new Request('http://localhost/api/test',{method:'POST',body:new URLSearchParams(f)});
const post=(file,f,params)=>load('src/app/api/'+file+'/route.ts').POST(request(f),params&&{params:Promise.resolve(params)});
(async()=>{
  const adminUrl=new URL(url);adminUrl.pathname='/';const admin=await mysql.createConnection(adminUrl.toString());
  await admin.query('CREATE DATABASE `'+url.pathname.slice(1)+'`');await admin.end();
  const c=await mysql.createConnection(url.toString());
  try {
    for(const name of fs.readdirSync('prisma/migrations').sort())for(const sql of fs.readFileSync(`prisma/migrations/${name}/migration.sql`,'utf8').split(/;\s*(?:\r?\n|$)/).map(s=>s.trim()).filter(Boolean))await c.query(sql);
    process.env.DATABASE_URL=url.toString();const db=load('src/lib/db.ts');
    const raw=async(sql,v=[]) => (await c.execute(sql,v))[0];
    const one=async(sql,v=[]) => (await raw(sql,v))[0];
    const cashMe='fca00000-0000-4000-8000-000000000001',cashWife='fca00000-0000-4000-8000-000000000002';
    const ownAccounts={};
    for(const who of ['ME','WIFE']) {
      viewer=who;
      assert.ok((await post('accounts',{name:'Private bank',type:'BANK',scope:'PERSONAL',openingBalance:'20000',includeInAvailable:'on',owner:who==='ME'?'WIFE':'ME'})).includes('created=1'));
      ownAccounts[who]=(await db.rows('SELECT * FROM Account WHERE isSharedCash=0'))[0].id;
      assert.equal((await db.rows('SELECT * FROM Account WHERE isSharedCash=0'))[0].owner,who,'Posted owner cannot override session');
      assert.ok((await post('master-data',{entity:'PROJECT',intent:'create',name:who+' secret business',isActive:'on'})).includes('created=1'));
      assert.ok((await post('master-data',{entity:'CATEGORY',intent:'create',name:who+' food',kind:'EXPENSE',scope:'PERSONAL',isActive:'on'})).includes('created=1'));
      assert.ok((await post('business',{month:'2026-09',intent:'targets',revenue:who==='ME'?'100':'200',expenses:'',profit:''})).includes('saved=1'));
      assert.ok((await post('quick-entries',{type:'EXPENSE',amount:'123',description:who+' private draft'})).includes('captured=1'));
    }
    const cat=(await raw('SELECT id,owner FROM Category'));
    const create=async(p)=>post('transactions',{type:'EXPENSE',amount:'1000',transactionDate:'2026-09-09',scope:'PERSONAL',...p});
    for(const who of ['ME','WIFE']) {
      viewer=who;const other=who==='ME'?'WIFE':'ME';
      assert.equal((await db.rows('SELECT * FROM Project')).length,1);
      assert.equal((await db.rows('SELECT * FROM Project'))[0].owner,who);
      assert.equal((await db.rows('SELECT * FROM FinancialTransaction WHERE status=\'PENDING_REVIEW\''))[0].owner,who);
      assert.equal(JSON.parse((await db.rows('SELECT * FROM AppSetting'))[0].value).revenue,who==='ME'?100:200);
      assert.equal((await db.rows('SELECT * FROM Account WHERE id=?',[ownAccounts[other]])).length,0);
      assert.ok((await create({accountId:ownAccounts[other]})).includes('error=account'));
      assert.ok((await post('accounts/[id]',{intent:'update',name:'Hacked'},{id:ownAccounts[other]})).includes('error=1'));
      assert.ok((await create({type:'INCOME',accountId:ownAccounts[who],description:who+' income'})).includes('created=1'));
      assert.ok((await create({accountId:ownAccounts[who],description:who+' private expense'})).includes('created=1'));
      assert.ok((await create({accountId:ownAccounts[who],description:who+' household expense',household:'on',categoryId:cat.find(x=>x.owner===who).id})).includes('created=1'));
      assert.ok((await create({type:'TRANSFER',accountId:ownAccounts[who],destinationAccountId:who==='ME'?cashMe:cashWife,amount:'10000'})).includes('created=1'));
      assert.ok((await create({type:'TRANSFER',accountId:ownAccounts[who],destinationAccountId:who==='ME'?cashWife:cashMe,amount:'100'})).includes('error=accounts'));
      assert.ok((await create({type:'INCOME',accountId:who==='ME'?cashMe:cashWife})).includes('error='));
    }
    viewer='WIFE';
    assert.ok((await create({accountId:cashMe,amount:'12000',description:'Wife spends Ayya money',spentBy:'WIFE',household:'on'})).includes('created=1'));
    viewer='ME';
    assert.ok((await create({accountId:cashWife,amount:'3000',description:'Ayya spends Sudu money',spentBy:'ME',household:'on'})).includes('created=1'));
    const balance=async(id)=>Number((await one('SELECT COALESCE(SUM(amount),0) amount FROM AccountEntry WHERE accountId=?',[id])).amount);
    assert.equal(await balance(cashMe),-2000);assert.equal(await balance(cashWife),7000);
    for(const who of ['ME','WIFE']) {
      viewer=who;
      const shared=await db.cashRows('SELECT a.id,a.owner,COALESCE(SUM(e.amount),0) balance FROM Account a LEFT JOIN AccountEntry e ON e.accountId=a.id WHERE a.isSharedCash=1 GROUP BY a.id ORDER BY a.id');
      assert.deepEqual(shared.map(x=>Number(x.balance)),[-2000,7000]);
      const household=await db.householdRows('SELECT * FROM FinancialTransaction WHERE household=1');assert.equal(household.length,4);
      const privateRecords=await db.rows('SELECT * FROM FinancialTransaction');assert.ok(privateRecords.every(x=>x.owner===who));
      const target=await one('SELECT id FROM FinancialTransaction WHERE description=?',[who==='ME'?'WIFE private expense':'ME private expense']);
      assert.ok((await post('shared-transactions/[id]',{intent:'delete',revision:'0'},{id:target.id})).includes('error=1'));
    }
    viewer='ME';
    const expense=await one("SELECT * FROM FinancialTransaction WHERE description='Wife spends Ayya money'");
    const edit={intent:'update',revision:'0',amount:'11000',transactionDate:'2026-09-09',description:'Corrected shared expense',spentBy:'WIFE'};
    assert.ok((await post('shared-transactions/[id]',edit,{id:expense.id})).includes('saved=1'));
    assert.equal(await balance(cashMe),-1000);
    assert.ok((await post('shared-transactions/[id]',edit,{id:expense.id})).includes('error=1'),'Stale edit rejected');
    viewer='WIFE';
    assert.ok((await post('shared-transactions/[id]',{intent:'delete',revision:'1'},{id:expense.id})).includes('deleted=1'));
    assert.equal(await balance(cashMe),10000);
    const transfer=await one('SELECT * FROM FinancialTransaction WHERE destinationAccountId=? AND type=\'TRANSFER\'',[cashMe]);
    const beforeBank=await balance(ownAccounts.ME);
    assert.ok((await post('shared-transactions/[id]',{...edit,amount:'9000'},{id:transfer.id})).includes('saved=1'));
    assert.equal(await balance(cashMe),9000);assert.equal(await balance(ownAccounts.ME),beforeBank+1000);
    assert.ok((await post('shared-transactions/[id]',{intent:'delete',revision:'1'},{id:transfer.id})).includes('deleted=1'));
    assert.equal(await balance(cashMe),0);assert.equal(await balance(ownAccounts.ME),beforeBank+10000);
    // Shared master records, with private project links and private party ledgers.
    viewer='ME';
    const project=(await db.rows('SELECT id FROM Project'))[0];
    assert.ok((await post('master-data',{entity:'TASK',intent:'create',name:'Shared delivery task',scope:'BUSINESS',projectId:project.id,isActive:'on'})).includes('created=1'));
    const task=(await db.rows('SELECT * FROM Task'))[0];
    assert.equal(task.projectId,project.id);
    assert.ok((await post('parties',{name:'Shared supplier',kind:'SUPPLIER',isActive:'on'})).includes('saved=1'));
    const party=(await db.rows('SELECT * FROM Party'))[0];
    viewer='WIFE';
    assert.equal((await db.rows('SELECT * FROM Category')).length,2);
    assert.equal((await db.rows('SELECT * FROM Task'))[0].projectId,null,'Private project link hidden');
    assert.equal((await db.rows('SELECT * FROM Party'))[0].id,party.id);
    assert.ok((await post('master-data',{entity:'TASK',intent:'update',id:task.id,name:'Shared delivery task edited',scope:'BUSINESS',isActive:'on'})).includes('updated=1'));
    assert.equal((await one('SELECT projectId FROM Task WHERE id=?',[task.id])).projectId,project.id,'Editing shared task preserves partner project');
    viewer='ME';
    assert.ok((await create({type:'EXPENSE',paymentTiming:'CREDIT',partyId:party.id,amount:'5000',description:'Shared household bill',household:'on',taskId:task.id})).includes('created=1'));
    const bill=await one("SELECT * FROM FinancialTransaction WHERE description='Shared household bill'");
    const payId=crypto.randomUUID();
    assert.ok((await post('parties/settle',{submissionId:payId,transactionId:bill.id,accountId:ownAccounts.ME,amount:'2000',transactionDate:'2026-09-09'})).includes('saved=1'));
    const bankAfterPayment=await balance(ownAccounts.ME);
    viewer='WIFE';
    assert.equal((await db.rows('SELECT * FROM PartyEntry')).length,0,'Sharing supplier does not share its ledger');
    assert.ok((await post('parties',{id:party.id,name:party.name,kind:'CUSTOMER',isActive:'on'})).includes('error=1'),'Cannot reclassify supplier used by partner');
    assert.ok((await post('master-data',{entity:'TASK',intent:'delete',id:task.id})).includes('error=1'),'Cannot delete task used by partner');
    assert.ok((await post('shared-transactions/[id]',{...edit,amount:'1000'},{id:bill.id})).includes('error=1'),'Bill cannot fall below paid amount');
    assert.ok((await post('shared-transactions/[id]',{...edit,amount:'6000'},{id:bill.id})).includes('saved=1'));
    assert.equal(Number((await one('SELECT amount FROM AccruedExpense WHERE id=?',[bill.accrualId])).amount),6000);
    assert.ok((await post('shared-transactions/[id]',{intent:'delete',revision:'1'},{id:bill.id})).includes('deleted=1'));
    assert.equal(await balance(ownAccounts.ME),bankAfterPayment+2000,'Deleting shared bill reverses partner bank payment');
    assert.equal((await one('SELECT status FROM FinancialTransaction WHERE id=?',[payId])).status,'VOID');
    assert.equal((await raw('SELECT * FROM PartyEntry WHERE transactionId=? OR settlesTransactionId=?',[bill.id,bill.id])).length,0);
    const finance=load('src/lib/finance.ts');
    for(const who of ['ME','WIFE']) {
      viewer=who;const dashboard=await finance.getDashboardData();
      assert.ok(dashboard.accounts.every(a=>a.owner===who));
      const actual=Number((await one('SELECT SUM(e.amount) amount FROM AccountEntry e JOIN Account a ON a.id=e.accountId WHERE a.owner=?',[who])).amount);
      assert.equal(dashboard.assets,actual,'Custodial partner cash excluded from own assets');
    }
    await db.pool.end();
    console.log('Local database integration passed: all migrations, both owners, spoofed ownership, private reads/writes, distinct settings, shared household, two-way funding/spending, negative balances, cross-login edits/deletes, stale revisions and both transfer legs.');
    console.log('Disposable test schema: '+url.pathname.slice(1));
  } finally {await c.end();}
})().catch(e=>{console.error(e);process.exitCode=1});
