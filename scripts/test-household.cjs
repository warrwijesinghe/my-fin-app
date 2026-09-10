const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,URLSearchParams,require:n=>Object.hasOwn(mocks,n)?mocks[n]:require(n)});return exports}
const expenses=load('src/lib/expenses.ts'),analytics=load('src/lib/analytics.ts'),types=load('src/lib/types.ts');
const household=load('src/lib/household.ts',{'./expenses':expenses});
const accountCenter=load('src/lib/account-center.ts');
const tax=load('src/lib/tax-report.ts',{'./analytics':analytics});
const line=(patch={})=>({id:'line',transactionId:'receipt',transactionDate:'2026-08-02',description:'Groceries',owner:'ME',type:'EXPENSE',status:'POSTED',household:true,amount:100,categoryId:'food',category:'Food',itemId:'rice',item:'Rice',quantity:1,unit:'kg',account:'Cash',...patch});
const data=[line(),line({id:'b',owner:'WIFE',quantity:500,unit:'g',amount:75}),line({id:'c',quantity:null,unit:'kg',amount:20}),line({id:'d',household:false,amount:9999}),line({id:'e',type:'ACCRUED_EXPENSE',amount:9999}),line({id:'f',status:'VOID',amount:9999})];
const totals=household.householdTotals(data);assert.equal(totals.total,195);assert.equal(totals.me,120);assert.equal(totals.wife,75);assert.equal(totals.count,1);
const rice=household.itemPurchases(data)[0];assert.equal(rice.quantity,1.5);assert.equal(rice.spend,195);assert.equal(rice.missing,1);assert.equal(rice.unitCost,175/1.5);
assert.equal(household.itemPurchases([line({unit:'pack'}),line({unit:'kg'})]).length,2);
assert.equal(household.categorySpending(data)[0].total,195);
assert.equal(household.shoppingPlan([line({quantity:6}),line({transactionDate:'2026-09-01',quantity:999})],'2026-09')[0].monthlyQuantity,2);
assert.equal(household.monthEnd('2024-02'),'2024-02-29');assert.equal(household.monthOffset('2026-01',-1),'2025-12');
assert.equal(expenses.lineSchema.safeParse({name:'Rice',categoryId:'food',amount:100,quantity:'',unit:''}).success,true);
assert.equal(expenses.lineSchema.safeParse({name:'Rice',categoryId:'food',amount:100,quantity:1,unit:''}).success,false);
assert.equal(expenses.lineSchema.safeParse({name:'Rice',categoryId:'food',amount:100,quantity:0,unit:'kg'}).success,false);
assert.equal(expenses.lineSchema.safeParse({name:'Rice',categoryId:'food',amount:0.001}).success,false);
assert.equal(expenses.normalizeItem('  Milk   POWDER '),'milk powder');
assert.equal(accountCenter.portfolioTotals([{owner:'ME',type:'CASH',balance:100,isActive:true,includeInAvailable:true},{owner:'WIFE',type:'CASH',balance:9999,isActive:true,includeInAvailable:true}]).net,100);
assert.equal(tax.incomeTaxReport([{...line(),scope:'PERSONAL',taxScope:'BUSINESS',owner:'WIFE'}],'BUSINESS').total.expenses,0);
assert.ok(household.csvText([['=HYPERLINK("bad")']]).includes("'=HYPERLINK"));

async function create(formPatch={},dbPatch={}) {
  const statements=[],items=new Map(),saved=[];let committed=false;
  const db={transaction:async fn=>{const result=await fn({execute:async(sql,values)=>{
    assert.equal((sql.match(/\?/g)||[]).length,values.length,sql);
    statements.push({sql,values});
    if(sql.startsWith('SELECT id,type,owner'))return [[{id:'cash',type:'CASH',owner:dbPatch.owner||'ME'}]];
    if(sql.startsWith('SELECT kind'))return dbPatch.badCategory?[[]]:[[{kind:'EXPENSE'}]];
    if(sql.startsWith('INSERT INTO Item')){const key=values[3]+':'+values[2];if(!items.has(key))items.set(key,{id:values[0],isActive:true});}
    if(sql.startsWith('SELECT id,isActive FROM Item'))return [[items.get(values[0]+':'+values[1])]];
    if(sql.startsWith('INSERT INTO ExpenseLine'))saved.push(values);
    return [[],[]];
  }});committed=true;return result;}};
  const route=load('src/app/api/transactions/route.ts',{'@/lib/auth':{currentOwner:async()=>dbPatch.viewer||'ME',relativeRedirect:v=>v},'@/lib/route-auth':{requireApiSession:async()=>null},'@/lib/db':db,'@/lib/types':types,'@/lib/expenses':expenses,'@/lib/analytics':analytics});
  const result=await route.POST(new Request('http://localhost/api/transactions',{method:'POST',body:new URLSearchParams({type:'EXPENSE',transactionDate:'2026-09-07',scope:'PERSONAL',taxScope:'BUSINESS',accountId:'cash',household:'on',returnTo:'household',lines:JSON.stringify([{name:'Rice',categoryId:'food',amount:100,quantity:1,unit:'kg'},{name:' RICE ',categoryId:'food',amount:50,quantity:'',unit:''}]),...formPatch})}));
  return {result,statements,items,saved,committed};
}
(async()=>{
  const own=await create();assert.equal(own.result,'/household?created=1');assert.equal(own.items.size,1);assert.equal(own.saved.length,2);assert.equal(own.saved[1][4],null);
  const tx=own.statements.find(s=>s.sql.startsWith('INSERT INTO FinancialTransaction'));assert.equal(tx.values[2],150);assert.equal(tx.values[6],'PERSONAL');assert.equal(tx.values[7],'PERSONAL');assert.equal(tx.values[8],'ME');assert.equal(tx.values[9],true);
  assert.equal(own.statements.find(s=>s.sql.startsWith('INSERT INTO AccountEntry')).values[3],-150);
  const wife=await create({owner:'WIFE'},{owner:'WIFE',viewer:'WIFE'});assert.equal(wife.committed,true);assert.equal(wife.statements.filter(s=>s.sql.startsWith('INSERT INTO AccountEntry')).length,1);assert.equal(wife.statements.find(s=>s.sql.startsWith('INSERT INTO FinancialTransaction')).values[8],'WIFE');
  assert.equal((await create({type:'INCOME',lines:'[]',amount:100},{owner:'WIFE'})).committed,false);
  assert.equal((await create({type:'ACCRUED_EXPENSE',accountId:''})).statements.filter(s=>s.sql.startsWith('INSERT INTO AccountEntry')).length,0);
  assert.equal((await create({}, {badCategory:true})).committed,false);
  assert.equal((await create({lines:'not json'})).statements.length,0);
  assert.equal((await create({transactionDate:'2026-02-30'})).statements.length,0);
  assert.equal((await create({lines:JSON.stringify([{name:'Rice',categoryId:'food',amount:1,quantity:2,unit:''}])})).statements.length,0);
  const finance=load('src/lib/finance.ts',{'@/lib/db':{rows:async(sql)=>{if(sql.startsWith('SELECT a.*'))return [{id:'me',type:'CASH',owner:'ME',balance:100,includeInAvailable:true}];return []}}});
  const dashboard=await finance.getDashboardData();assert.equal(dashboard.availableCash,100);assert.equal(dashboard.assets,100);
  const apiStatements=[];
  const execute=async(sql,values)=>{assert.equal((sql.match(/\?/g)||[]).length,values.length);apiStatements.push({sql,values});return [[{household:false}]]};
  const common={'@/lib/auth':{currentOwner:async()=> 'ME',relativeRedirect:v=>v},'@/lib/route-auth':{requireApiSession:async()=>null},'@/lib/db':{execute,householdRows:async()=>[{id:'food'}],rows:async()=>[{id:'food'}],transaction:async fn=>fn({execute})},'@/lib/household':household,'@/lib/expenses':expenses};
  const householdApi=load('src/app/api/household/route.ts',common);
  const request=body=>new Request('http://localhost/api/household',{method:'POST',body:new URLSearchParams(body)});
  assert.ok((await householdApi.POST(request({intent:'budget',month:'2026-09',amount:'5000'}))).includes('saved=1'));
  assert.equal(apiStatements.at(-1).values[2],5000);
  const before=apiStatements.length;
  await householdApi.POST(request({intent:'budget',month:'2026-09',amount:''}));assert.equal(apiStatements.length,before);
  await householdApi.POST(request({intent:'budget',month:'0000-01',amount:'1'}));assert.equal(apiStatements.length,before);
  await householdApi.POST(request({intent:'label',month:'2026-09',id:'123e4567-e89b-42d3-a456-426614174000',household:'on'}));
  assert.ok(apiStatements.some(s=>s.sql==='UPDATE FinancialTransaction SET household=?,updatedAt=NOW(3) WHERE id=?'));
  assert.ok(apiStatements.at(-1).values.includes('HOUSEHOLD_LABEL_CHANGED'));
  const itemApi=load('src/app/api/items/route.ts',common);
  await itemApi.POST(request({name:'Milk powder',categoryId:'food',defaultUnit:'g',isActive:'on'}));
  assert.equal(apiStatements.at(-1).values[2],'milk powder');
  const deniedApi=load('src/app/api/household/route.ts',{...common,'@/lib/route-auth':{requireApiSession:async()=>'unauthorized'}});
  assert.equal(await deniedApi.POST(request({intent:'budget',month:'2026-09',amount:1})),'unauthorized');
  // Render the actual Household component to catch missing props and invalid data handling.
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
  const {Household}=load('src/components/household.tsx',{'next/link':({href,children,...p})=>React.createElement('a',{href,...p},children),'@/lib/household':household,'@/lib/analytics':analytics});
  const html=renderToStaticMarkup(React.createElement(Household,{month:'2026-08',today:'2026-09-07',lines:data,budgets:[],categories:[{id:'food',name:'Food'}],unpaid:[],notice:''}));
  if(process.env.HOUSEHOLD_PREVIEW){fs.mkdirSync('generated',{recursive:true});fs.writeFileSync('generated/household-preview.html','<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+fs.readFileSync('src/app/globals.css','utf8')+fs.readFileSync('src/app/mobile.css','utf8')+'</style></head><body><main class="household-page">'+html+'</main></body></html>');}
  assert.ok(html.includes('Monthly item purchases'));assert.ok(html.includes('1.5 kg'));assert.ok(html.includes('Sudu Manike'));assert.ok(html.includes('195.00'));
  console.log('Household tests passed: payer isolation, optional quantity, normalized units, category/item totals, shopping averages, item deduplication, atomic writes, validation, accrual ledger exclusion, dashboard filtering and page rendering.');
})().catch(e=>{console.error(e);process.exitCode=1});
