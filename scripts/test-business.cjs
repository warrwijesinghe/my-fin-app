const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,URLSearchParams,require:n=>Object.hasOwn(mocks,n)?mocks[n]:require(n)});return exports}
const expenses=load('src/lib/expenses.ts'),household=load('src/lib/household.ts',{'./expenses':expenses}),business=load('src/lib/business.ts',{'./household':household}),analytics=load('src/lib/analytics.ts');
const {businessPeriod,businessSummary,costChanges,dueBucket}=business;
const line=(patch={})=>({id:'sale',activityId:'sale',transactionDate:'2026-09-02',type:'INCOME',status:'POSTED',owner:'ME',scope:'BUSINESS',amount:1000,categoryId:'sales',category:'Sales',projectId:'project',project:'Tuition',...patch});
const data=[line(),line({id:'bill',activityId:'food',type:'ACCRUED_EXPENSE',amount:200,categoryId:'direct',category:'Materials'}),line({id:'bill',activityId:'power',type:'ACCRUED_EXPENSE',amount:100,categoryId:'overhead',category:'Power',projectId:null}),line({id:'fee',type:'EXPENSE',amount:50,categoryId:'finance',category:'Bank fees',projectId:null}),line({id:'tax',type:'EXPENSE',amount:25,categoryId:'tax',category:'Tax',projectId:null}),line({id:'old',transactionDate:'2026-08-02',amount:500}),line({id:'personal',scope:'PERSONAL',amount:99999}),line({id:'wife',owner:'WIFE',amount:99999}),line({id:'pending',status:'PENDING_REVIEW',amount:99999}),line({id:'void',status:'VOID',amount:99999}),line({id:'transfer',type:'TRANSFER',amount:99999}),line({id:'payment',type:'PARTY_PAYMENT',amount:99999})];
const mapping={direct:'DIRECT',overhead:'OVERHEAD',finance:'FINANCE',tax:'TAX'};
const summary=businessSummary(data,'2026-09-01','2026-09-07',mapping);
assert.equal(summary.revenue,1000);assert.equal(summary.expenses,375);assert.equal(summary.profit,625);assert.equal(summary.margin,62.5);assert.equal(summary.count,4,'Itemized bills count once');
assert.equal(summary.grossProfit,800);assert.equal(summary.operatingProfit,700);assert.equal(summary.beforeTax,650);
assert.equal(summary.projects.find(p=>p.id==='project').result,800);assert.equal(summary.projects.find(p=>p.id==='').result,-175);
assert.equal(summary.categories.reduce((s,c)=>s+c.amount,0),375);
assert.equal(businessSummary(data,'2026-09-01','2026-09-07').grossProfit,null);
assert.equal(businessSummary(data,'2026-09-01','2026-09-07').profit,625,'Classification must not change net profit');
assert.equal(businessSummary([line({type:'EXPENSE',amount:100})],'2026-09-01','2026-09-07').margin,null);
assert.equal(businessSummary([line({amount:0.1}),line({amount:0.2})],'2026-09-01','2026-09-07').revenue,0.3);
assert.equal(businessPeriod('2026-03','2026-03-31').previousEnd,'2026-02-28');
assert.equal(businessPeriod('2024-03','2024-03-31').previousEnd,'2024-02-29');
assert.equal(businessPeriod('2026-08','2026-09-07').previousEnd,'2026-07-31');
assert.equal(businessPeriod('2026-09','2026-09-07').previousEnd,'2026-08-07');
assert.equal(businessPeriod('2026-10','2026-09-07'),null);assert.equal(businessPeriod('invalid','2026-09-07'),null);
assert.equal(costChanges(summary,businessSummary(data,'2026-08-01','2026-08-07',mapping))[0].increase,200);
assert.equal(dueBucket(null,'2026-09-07'),'No due date');assert.equal(dueBucket('2026-09-07','2026-09-07'),'Not overdue');assert.equal(dueBucket('2026-08-31','2026-09-07'),'1–30 days overdue');assert.equal(dueBucket('2026-07-31','2026-09-07'),'31–60 days overdue');assert.equal(dueBucket('2026-01-01','2026-09-07'),'61+ days overdue');
(async()=>{
  const writes=[];
  const mocks={'@/lib/auth':{relativeRedirect:v=>v},'@/lib/route-auth':{requireApiSession:async()=>null},'@/lib/business':business,'@/lib/household':household,'@/lib/db':{rows:async()=>[{id:'overhead'}],execute:async(sql,v)=>{assert.equal((sql.match(/\?/g)||[]).length,v.length);writes.push(v)}}};
  const post=load('src/app/api/business/route.ts',mocks).POST,request=f=>new Request('http://localhost/api/business',{method:'POST',body:new URLSearchParams(f)});
  assert.equal(await post(request({month:'2026-09',intent:'targets',revenue:'1000',expenses:'0',profit:''})),'/business?month=2026-09&saved=1');
  assert.deepEqual(JSON.parse(writes[0][1]),{revenue:1000,expenses:0,profit:null});
  await post(request({month:'2026-09',intent:'cost',categoryId:'overhead',costGroup:'OVERHEAD'}));assert.equal(writes[1][0],'businessCost:overhead');assert.equal(JSON.parse(writes[1][1]),'OVERHEAD');
  for(const patch of [{month:'2026-13'},{revenue:'-1'},{expenses:'0.001'}])await post(request({month:'2026-09',intent:'targets',revenue:'100',expenses:'50',profit:'20',...patch}));
  assert.equal(writes.length,2);
  const denied=load('src/app/api/business/route.ts',{...mocks,'@/lib/route-auth':{requireApiSession:async()=>'unauthorized'}}).POST;
  assert.equal(await denied(request({})),'unauthorized');assert.equal(writes.length,2);
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
  const Link=({href,children,...props})=>React.createElement('a',{href,...props},children);
  const navigation=load('src/components/nav.tsx',{'next/link':Link,'next/navigation':{usePathname:()=>'/business',useRouter:()=>({back(){},push(){}})}});
  const navHTML=renderToStaticMarkup(React.createElement(navigation.Nav));
  const mobile=navHTML.match(/<nav class="mobile-nav"[\s\S]*?<\/nav>/)[0];
  assert.equal((mobile.match(/<a /g)||[]).length,3);assert.ok(mobile.includes('More'));assert.ok(!mobile.includes('Analytics'));assert.ok(navHTML.includes('href="/business"'));
  const queries=[];
  const page=load('src/app/business/page.tsx',{'next/link':Link,'@/components/nav':navigation,'@/components/export-business':{ExportBusiness:()=>React.createElement('button',{},'Export report')},'@/lib/auth':{requireSession:async()=>{}},'@/lib/business':business,'@/lib/household':household,'@/lib/analytics':analytics,'./business.css':{},'@/lib/db':{rows:async(sql,v=[])=>{
    assert.equal((sql.match(/\?/g)||[]).length,v.length,sql);queries.push(sql);
    if(sql.includes('FROM IncomeExpenseActivity')){assert.ok(sql.includes("t.scope='BUSINESS'"));assert.ok(sql.includes("t.owner='ME'"));return data;}
    if(sql.includes('FROM AppSetting'))return Object.entries(mapping).map(([id,value])=>({key:`businessCost:${id}`,value:JSON.stringify(value)}));
    if(sql.includes('FROM Category'))return [{id:'overhead',name:'Power'}];
    if(sql.includes('FROM AccountEntry')){assert.ok(sql.includes("t.scope='BUSINESS'"));assert.ok(sql.includes("a.type IN ('CASH','BANK','SAVINGS')"));return [{receipts:700,payments:100}];}
    if(sql.includes('FROM CreditOutstanding'))return [{id:'invoice',partyId:'customer',name:'Customer',amount:300,dueDate:'2026-09-01',description:'Credit sale'}];
    if(sql.includes('FROM AccruedExpense'))return [{id:'bill',partyId:null,name:'Supplier',amount:100,dueDate:null,description:'Unpaid bill'}];
    return [{count:2}];
  }}}).default;
  const html=renderToStaticMarkup(await page({searchParams:Promise.resolve({month:'2026-09'})}));
  for(const text of ['Profit &amp; loss','Recorded net profit','Project performance','Cost control','Monthly targets','Customers owe you','Customer','General business / no project','625.00'])assert.ok(html.includes(text),text);
  assert.equal(queries.length,7);
  if(process.env.BUSINESS_PREVIEW){fs.mkdirSync('generated',{recursive:true});fs.writeFileSync('generated/business-preview.html','<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Business dashboard preview</title><style>'+['src/app/globals.css','src/app/mobile.css','src/app/business/business.css'].map(p=>fs.readFileSync(p,'utf8')).join('\n')+'</style></head><body>'+html+'</body></html>');}
  console.log('Business checks passed: profit stages, unclassified costs, business/owner/status isolation, item totals, project overhead separation, month comparisons, overdue buckets, targets, authenticated settings, page rendering and compact mobile navigation (database mocked).');
})().catch(e=>{console.error(e);process.exitCode=1});
