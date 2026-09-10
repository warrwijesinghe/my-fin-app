const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');
const crypto=require('node:crypto');
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,URLSearchParams,crypto,require:n=>Object.hasOwn(mocks,n)?mocks[n]:require(n)});return exports}
const expenses=load('src/lib/expenses.ts'),analytics=load('src/lib/analytics.ts'),types=load('src/lib/types.ts');
const draftId='123e4567-e89b-42d3-a456-426614174000';
const supplier={id:'supplier',name:'Food City',kind:'SUPPLIER',isCash:false};
const customer={id:'customer',name:'Customer',kind:'CUSTOMER',isCash:false};
const accounts={cash:{id:'cash',type:'BANK',owner:'ME'},card:{id:'card',type:'CREDIT_CARD',owner:'ME'},wife:{id:'wife',type:'CASH',owner:'WIFE'}};
const line=(name,amount,quantity='',unit='')=>({name,amount,quantity,unit,categoryId:'food'});
const request=(form)=>new Request('http://localhost/api/test',{method:'POST',body:new URLSearchParams(form)});
function harness({draft=null,party=supplier,invoice=null,outstanding=0,denied=null,viewer="ME"}={}){
  const state={draft,invoice,outstanding,billPaid:invoice?invoice.amount-Math.abs(outstanding):0,writes:[],lines:[]};let chain=Promise.resolve();
  const execute=async(sql,v=[])=>{
    assert.equal((sql.match(/\?/g)||[]).length,v.length,sql);
    if(sql.startsWith('SELECT * FROM FinancialTransaction')&&sql.includes("PENDING_REVIEW"))return [[state.draft?.status==='PENDING_REVIEW'?structuredClone(state.draft):null].filter(Boolean)];
    if(sql.startsWith('SELECT * FROM FinancialTransaction'))return [[state.invoice].filter(Boolean)];
    if(sql.startsWith('SELECT settlesTransactionId'))return [state.writes.filter(w=>w.sql.startsWith('UPDATE FinancialTransaction SET settlesTransactionId=')&&w.v[3]===v[0]).map(w=>({settlesTransactionId:w.v[0]}))];
    if(sql.startsWith('SELECT amount,paidAmount,status FROM AccruedExpense'))return [[{amount:state.invoice.amount,paidAmount:state.billPaid,status:state.invoice.billStatus??(state.billPaid>=state.invoice.amount?'PAID':state.billPaid>0?'PARTIALLY_PAID':'OPEN')}]];
    if(sql.startsWith('SELECT COALESCE(SUM(amount)'))return [[{balance:state.outstanding}]];
    if(sql.startsWith('SELECT id,type,owner'))return [[accounts[v[0]]].filter(Boolean)];
    if(sql.startsWith('SELECT id,name,kind'))return [[party].filter(Boolean)];
    if(sql.startsWith('SELECT kind'))return [[{kind:'EXPENSE'}]];
    if(sql.startsWith('SELECT id,isActive FROM Item'))return [[{id:'item',isActive:true}]];
    if(sql.startsWith('SELECT'))return [[{id:'valid'}]];
    state.writes.push({sql,v});
    if(sql.startsWith('UPDATE FinancialTransaction SET type='))state.draft.status=v[1];
    if(sql.startsWith('UPDATE AccruedExpense')){state.billPaid+=v[0];if(!state.invoice.partyId)state.outstanding+=v[0];}
    if(sql.startsWith('INSERT INTO ExpenseLine'))state.lines.push(v);
    if(sql.startsWith('INSERT INTO PartyEntry')&&sql.includes('settlesTransactionId'))state.outstanding+=v[4];
    return [{affectedRows:1}];
  };
  const db={masterRecordInUse:async()=>false,transaction:fn=>{const work=chain.then(async()=>{const before=structuredClone(state);try{return await fn({execute})}catch(e){Object.assign(state,before);throw e}});chain=work.catch(()=>{});return work}};
  const mocks={'@/lib/auth':{currentOwner:async()=>viewer,relativeRedirect:v=>v},'@/lib/route-auth':{requireApiSession:async()=>denied},'@/lib/db':db,'@/lib/types':types,'@/lib/expenses':expenses,'@/lib/analytics':analytics};
  return {state,mocks,route:file=>load(file,mocks).POST};
}
const draft=()=>({id:draftId,owner:'ME',type:'EXPENSE',status:'PENDING_REVIEW',amount:12000});
const full={draftId,type:'EXPENSE',expenseKind:'BUSINESS',transactionDate:'2026-09-07',scope:'BUSINESS',description:'Food City bill',accountId:'cash',lines:JSON.stringify([line('Sugar',500,2,'kg'),line('Tea',750,200,'g'),line('Other groceries',10750)])};
(async()=>{
  const capture=harness(),quick=capture.route('src/app/api/quick-entries/route.ts');
  assert.equal(await quick(request({type:'EXPENSE',amount:12000,description:'Food City bill'})),'/?captured=1');
  assert.equal(capture.state.writes.length,3);assert.ok(capture.state.writes[0].sql.includes("'PENDING_REVIEW'"));
  assert.ok(!capture.state.writes.some(w=>/AccountEntry|PartyEntry|AccruedExpense/.test(w.sql)));
  const before=capture.state.writes.length;
  for(const amount of ['-1','0','0.001','NaN'])assert.equal(await quick(request({type:'EXPENSE',amount,description:'bill'})),'/?captureError=1');
  assert.equal(capture.state.writes.length,before);
  assert.equal(await quick(request({type:'INCOME',amount:20,description:'Sales'})),'/?captured=1');
  assert.equal(await harness({denied:'unauthorized'}).route('src/app/api/quick-entries/route.ts')(request({})),'unauthorized');

  const partial=harness({draft:draft()}),save=partial.route('src/app/api/transactions/route.ts');
  assert.equal(await save(request({...full,intent:'saveDraft',accountId:'',lines:JSON.stringify([line('Sugar',500,2,'kg'),line('Tea',750,200,'g')])})),`/review/${draftId}?saved=1`);
  assert.equal(partial.state.draft.status,'PENDING_REVIEW');assert.equal(partial.state.lines.length,2);
  assert.ok(!partial.state.writes.some(w=>/INSERT INTO (AccountEntry|PartyEntry|AccruedExpense)/.test(w.sql)));
  const missing=harness({draft:draft()});
  assert.ok((await missing.route('src/app/api/transactions/route.ts')(request({...full,lines:JSON.stringify([line('Sugar',500)])}))).endsWith('error=item-total'));
  assert.equal(missing.state.writes.length,0);
  const over=harness({draft:draft()});
  assert.ok((await over.route('src/app/api/transactions/route.ts')(request({...full,intent:'saveDraft',lines:JSON.stringify([line('Too much',12001)])}))).endsWith('error=item-total'));
  assert.equal(over.state.writes.length,0);

  const posted=harness({draft:draft()}),post=posted.route('src/app/api/transactions/route.ts');
  const results=await Promise.all([post(request(full)),post(request(full))]);
  assert.equal(results.filter(r=>r==='/review?posted=1').length,1);
  assert.equal(results.filter(r=>r.endsWith('error=already-posted')).length,1);
  assert.equal(posted.state.writes.filter(w=>w.sql.startsWith('INSERT INTO AccountEntry')).length,1);
  assert.equal(posted.state.writes.find(w=>w.sql.startsWith('INSERT INTO AccountEntry')).v[3],-12000);
  assert.equal(posted.state.lines.reduce((s,l)=>s+Number(l[6]),0),12000);
  const legacy=harness({draft:draft()});
  assert.equal(await legacy.route('src/app/api/review/[id]/route.ts')(request({accountId:'cash'}),{params:Promise.resolve({id:draftId})}),`/review/${draftId}`);
  assert.equal(legacy.state.writes.length,0);

  const credit=harness(),create=credit.route('src/app/api/transactions/route.ts');
  const bill={type:'EXPENSE',expenseKind:'BUSINESS',amount:12000,transactionDate:'2026-09-07',scope:'BUSINESS',paymentTiming:'CREDIT',partyId:'supplier'};
  assert.equal(await create(request(bill)),'/?created=1');
  assert.equal(credit.state.writes.find(w=>w.sql.startsWith('INSERT INTO PartyEntry')).v[3],-12000);
  assert.ok(credit.state.writes.some(w=>w.sql.startsWith('INSERT INTO AccruedExpense')));
  assert.ok(!credit.state.writes.some(w=>w.sql.startsWith('INSERT INTO AccountEntry')));
  const sale=harness({party:customer});
  assert.equal(await sale.route('src/app/api/transactions/route.ts')(request({...bill,type:'INCOME',partyId:'customer'})),'/?created=1');
  assert.equal(sale.state.writes.find(w=>w.sql.startsWith('INSERT INTO PartyEntry')).v[3],12000);
  for(const party of [null,{...supplier,isCash:true},customer]){
    const invalid=harness({party});assert.ok((await invalid.route('src/app/api/transactions/route.ts')(request(bill))).includes('error='));assert.equal(invalid.state.writes.length,0);
  }
  const cash=harness({party:{...supplier,isCash:true}});
  assert.equal(await cash.route('src/app/api/transactions/route.ts')(request({...bill,paymentTiming:'PAID',accountId:'cash'})),'/?created=1');
  assert.ok(!cash.state.writes.some(w=>w.sql.startsWith('INSERT INTO PartyEntry')));
  const transfer=harness();
  await transfer.route('src/app/api/transactions/route.ts')(request({type:'TRANSFER',amount:100,transactionDate:'2026-09-07',scope:'PERSONAL',accountId:'cash',destinationAccountId:'card'}));
  assert.deepEqual(transfer.state.writes.filter(w=>w.sql.startsWith('INSERT INTO AccountEntry')).map(w=>w.v[3]),[-100,-100]);

  const invoice={id:draftId,type:'ACCRUED_EXPENSE',amount:12000,partyId:'supplier',transactionDate:'2026-09-07',owner:'ME',accrualId:'accrual',scope:'BUSINESS',taxScope:'BUSINESS',counterparty:'Food City',description:'Bill',household:false,projectId:null,taskId:null};
  const settlement=harness({invoice,outstanding:-12000}),pay=settlement.route('src/app/api/parties/settle/route.ts');
  const payment={submissionId:crypto.randomUUID(),transactionId:draftId,accountId:'cash',amount:5000,transactionDate:'2026-09-08'};
  assert.ok((await pay(request(payment))).includes('saved=1'));
  assert.equal(settlement.state.outstanding,-7000);
  assert.equal(settlement.state.writes.find(w=>w.sql.startsWith('INSERT INTO AccountEntry')).v[3],-5000);
  assert.equal(settlement.state.writes.find(w=>w.sql.startsWith('UPDATE AccruedExpense')).v[1],'PARTIALLY_PAID');
  const writes=settlement.state.writes.length;
  assert.ok((await pay(request(payment))).includes('saved=1'));assert.equal(settlement.state.writes.length,writes,'Repeated partial payment must not post twice');
  assert.ok((await pay(request({...payment,submissionId:crypto.randomUUID(),amount:7001}))).includes('error=1'));assert.equal(settlement.state.writes.length,writes);
  assert.ok((await pay(request({...payment,submissionId:crypto.randomUUID(),transactionDate:'2026-09-06'}))).includes('error=1'));
  assert.ok((await pay(request({...payment,submissionId:crypto.randomUUID(),accountId:'wife'}))).includes('error=1'));
  const paid=await Promise.all([pay(request({...payment,submissionId:crypto.randomUUID(),amount:7000})),pay(request({...payment,submissionId:crypto.randomUUID(),amount:7000}))]);
  assert.equal(paid.filter(v=>v.includes('saved=1')).length,1);assert.equal(settlement.state.outstanding,0);
  assert.equal(settlement.state.writes.filter(w=>w.sql.startsWith('UPDATE AccruedExpense')).at(-1).v[1],'PAID');
  assert.ok(settlement.state.writes.filter(w=>w.sql.startsWith('INSERT INTO FinancialTransaction')).every(w=>w.sql.includes("'PARTY_PAYMENT'")));
  const received=harness({invoice:{...invoice,type:'INCOME',partyId:'customer',accrualId:null},outstanding:12000});
  await received.route('src/app/api/parties/settle/route.ts')(request(payment));
  assert.equal(received.state.outstanding,7000);assert.equal(received.state.writes.find(w=>w.sql.startsWith('INSERT INTO AccountEntry')).v[3],5000);
  assert.ok(!received.state.writes.some(w=>w.sql.startsWith('UPDATE AccruedExpense')));
  assert.equal(await harness({denied:'unauthorized'}).route('src/app/api/parties/settle/route.ts')(request(payment)),'unauthorized');

  const legacyBill=harness({invoice:{...invoice,partyId:null,paymentTiming:'PAID'},outstanding:-9000}),payLegacy=legacyBill.route('src/app/api/parties/settle/route.ts');
  const legacyPayment={...payment,submissionId:crypto.randomUUID(),returnTo:'bills'};
  assert.ok((await payLegacy(request(legacyPayment))).startsWith('/bills?bill='));
  assert.equal(legacyBill.state.billPaid,8000);assert.equal(legacyBill.state.outstanding,-4000);
  assert.ok(!legacyBill.state.writes.some(w=>w.sql.startsWith('INSERT INTO PartyEntry')),'An old bill must not invent a supplier');
  const legacyWrites=legacyBill.state.writes.length;
  await payLegacy(request(legacyPayment));assert.equal(legacyBill.state.writes.length,legacyWrites,'Unlinked payments are idempotent too');
  await payLegacy(request({...legacyPayment,submissionId:crypto.randomUUID(),amount:4000,accountId:'card'}));
  assert.equal(legacyBill.state.billPaid,12000);assert.equal(legacyBill.state.outstanding,0);
  assert.equal(legacyBill.state.writes.filter(w=>w.sql.startsWith('INSERT INTO AccountEntry')).at(-1).v[3],4000,'Card settlement increases card debt');
  assert.equal(legacyBill.state.writes.filter(w=>w.sql.startsWith('UPDATE AccruedExpense')).at(-1).v[1],'PAID');
  const wifeBill=harness({viewer:'WIFE',invoice:{...invoice,partyId:null,owner:'WIFE'},outstanding:-12000});
  await wifeBill.route('src/app/api/parties/settle/route.ts')(request({...legacyPayment,submissionId:crypto.randomUUID(),accountId:'wife'}));
  assert.equal(wifeBill.state.billPaid,5000);assert.equal(wifeBill.state.writes.find(w=>w.sql.startsWith('INSERT INTO AccountEntry')).v[3],-5000);
  const voidBill=harness({invoice:{...invoice,partyId:null,billStatus:'VOID'},outstanding:-12000});
  assert.ok((await voidBill.route('src/app/api/parties/settle/route.ts')(request(legacyPayment))).includes('error=1'));assert.equal(voidBill.state.writes.length,0);

  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
  const billsPage=load('src/app/bills/page.tsx',{'next/link':({href,children,...p})=>React.createElement('a',{href,...p},children),'@/components/nav':{Nav:()=>null},'@/lib/auth':{requireSession:async()=>"ME"},'@/lib/format':{lkr:n=>Number(n).toFixed(2)},'@/lib/db':{rows:async(sql,v=[])=>{
    assert.equal((sql.match(/\?/g)||[]).length,v.length);
    if(sql.includes('FROM Account WHERE'))return [{id:'cash',name:'Cash',type:'CASH'}];
    if(sql.includes('t.settlesTransactionId=?'))return [{id:'payment',amount:5000,transactionDate:'2026-09-08',description:'Part payment',account:'Cash'}];
    return [{...invoice,partyId:null,status:'PARTIALLY_PAID',paidAmount:5000}];
  }}}).default;
  const billsHTML=renderToStaticMarkup(await billsPage({searchParams:Promise.resolve({bill:draftId})}));
  for(const text of ['Record bill payment','7000.00','5000.00','Food City','Payment history','Part payment'])assert.ok(billsHTML.includes(text),text);
  const expenseUI=load('src/components/expense-items.tsx',{'@/lib/expenses':expenses});
  const {QuickEntry}=load('src/components/quick-entry.tsx',{'./expense-items':expenseUI,'next/navigation':{useRouter:()=>({refresh(){}})}});
  const html=renderToStaticMarkup(React.createElement(QuickEntry,{draft:{...draft(),scope:'BUSINESS',owner:'ME',paymentTiming:'PAID',transactionDate:'2026-09-07',lines:[]},accounts:Object.values(accounts),projects:[],tasks:[],categories:[],items:[],parties:[supplier],today:'2026-09-07'}));
  assert.ok(html.includes('Captured amount: LKR '));assert.ok(html.includes('12000.00'));assert.ok(html.includes('Save progress in Review'));assert.ok(html.includes('Post reviewed transaction'));assert.ok(html.includes('General business / no project'));
  assert.ok(!html.match(/name="projectId"[^>]*required/));
  console.log('Draft and party checks passed: capture isolation, partial itemization, exact totals, single posting, optional business project, cash/credit masters, payable/receivable signs, partial/full settlements, overpayment and concurrent duplicate prevention, legacy bill payments, credit-card settlements, payment history links, authentication, and review rendering (database mocked).');
})().catch(e=>{console.error(e);process.exitCode=1});
