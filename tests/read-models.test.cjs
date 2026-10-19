const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const context={console};
vm.createContext(context);
for(const file of ['Code.gs','Performance.gs'])vm.runInContext(fs.readFileSync('apps-script/'+file,'utf8'),context);
const properties=new Map(),cache=new Map(),sheets=new Map(),reads=[];
let failSheet='';
function sheet(name){
  if(sheets.has(name))return sheets.get(name);
  const target={name,rows:[[]],getLastRow(){let n=this.rows.length;while(n>1&&!this.rows[n-1].some(v=>v!==''))n--;return n;},getMaxRows:()=>10000,insertRowsAfter(){},getRange(row,col,height=1,width=1){
    return {getValues:()=>{reads.push({name,row,col,height,width});return Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>target.rows[row-1+i]?.[col-1+j]??''));},setValues:values=>{
      if(failSheet===name)throw new Error('simulated write failure');
      values.forEach((values,i)=>{const out=target.rows[row-1+i]||(target.rows[row-1+i]=[]);values.forEach((value,j)=>out[col-1+j]=value);});
    }}}
  };
  sheets.set(name,target);return target;
}
context.ss_=()=>({getSheetByName:name=>sheets.get(name)||null});
context.ensureSheet_=(ss,name,headers)=>{const result=sheet(name);result.rows[0]=headers;return result;};
context.ensureOrderSchema_=()=>{};
context.LockService={getScriptLock:()=>({waitLock(){},releaseLock(){}})};
context.PropertiesService={getScriptProperties:()=>({getProperties:()=>Object.fromEntries(properties),getProperty:key=>properties.get(key)||null,setProperty:(key,value)=>properties.set(key,value),deleteProperty:key=>properties.delete(key)})};
context.CacheService={getScriptCache:()=>({get:key=>cache.get(key)||null,put:(key,value)=>cache.set(key,value),remove:key=>cache.delete(key),removeAll:keys=>keys.forEach(key=>cache.delete(key))})};
context.Utilities={getUuid:()=>String(Math.random()),formatDate:(date,tz,format)=>date.toISOString().slice(0,10)};
context.getSessionMeta_=()=>({});
const orders=sheet('Orders');
for(let i=0;i<501;i++){
  const date=i<250?'2026-10-15':'2026-10-16';
  orders.rows.push(['O'+i,date+'T12:00:00Z','L1','Locho',1,50,50,i===0?'Cancelled':'Closed','Online',date,'12:00','S'+date,'Dine-in','']);
}
orders.rows.push(['O500','2026-10-16T12:00:00Z','ADJUSTMENT','Adjusted amount',0,20,20,'Closed','Online','2026-10-16','12:00','S2026-10-16','Dine-in','']);
sheet('Expenses').rows.push(['E1','2026-10-15','2026-10-15','Operating','','','',10,'Offline']);
sheet('DailySummary');sheet('MonthlySummary');sheet('YearlySummary');sheet('ExpenseSummary');
const original=JSON.stringify(orders.rows);
context.reconcileReadModels();
assert.equal(JSON.stringify(orders.rows),original,'reconciliation must not write source orders');
assert.equal(properties.get('history-index-count'),'501');
reads.length=0;
const page=context.readIndexedHistory_(0,20,{});
assert.equal(page.orders.length,20);
assert.equal(page.total,501);
assert.equal(page.filteredSales,25020);
assert.equal(page.nextOffset,20);
assert.equal(reads.length,1);
assert.equal(reads[0].height,20,'default History reads exactly one page');
assert.equal(reads[0].name,'OrderIndex');
assert.equal(context.readIndexedHistory_(500,20,{}).orders.length,1);
assert.equal(context.readIndexedHistory_(501,20,{}).orders.length,0);
assert.throws(()=>context.replaceDerivedRows_('Orders',[],[]),/source-data sheet/);
reads.length=0;
const monthly=context.getReport_('month','2026-10');
assert.equal(monthly.sales,25020);
assert.equal(monthly.orders,500);
assert.equal(monthly.dishes,500);
assert.equal(monthly.totalExpense,10);
assert.equal(monthly.operatingProfit,25010);
assert.equal(context.getAllTimeSales_().sales,25020);
assert.equal(context.getAllTimeExpense_(),10);
assert(!reads.some(read=>read.name==='Orders'),'monthly reports never scan source orders');
reads.length=0;
const filtered=context.readIndexedHistory_(0,20,{q:'O500'});
assert.equal(filtered.filteredTotal,1);
assert.equal(filtered.orders[0].totalAmount,70);
assert(reads.every(read=>read.height<=250),'search uses bounded blocks');
context.invalidateBusinessDateCaches_('2026-10-16',true);
assert(properties.get('dirty-day-2026-10-16'));
assert(!reads.some(read=>read.name==='Orders'),'queueing summary work does not scan orders');
failSheet='OrderIndex';
assert.throws(()=>context.refreshReadModels(),/simulated write failure/);
assert(properties.get('dirty-day-2026-10-16'),'failed refresh retains durable dirty marker');
assert.equal(JSON.stringify(orders.rows),original,'failed refresh preserves original orders');
failSheet='';
context.refreshReadModels();
assert(!properties.has('dirty-day-2026-10-16'));
// Manual source correction is picked up by nightly reconciliation, without a dirty marker.
orders.rows[2][6]=80;
context.reconcileReadModels();
assert.equal(context.getReport_('year','2026').sales,25050);
assert.equal(context.readIndexedHistory_(0,20,{q:'O1',minAmount:80}).filteredTotal,1);
// Cancellation and deletion remove revenue without losing the remaining source records.
orders.rows[3][7]='Cancelled';
orders.rows=orders.rows.filter(row=>row[0]!=='O3');
const correctedSource=JSON.stringify(orders.rows);
context.invalidateBusinessDateCaches_('2026-10-15',true);
context.refreshReadModels();
assert.equal(JSON.stringify(orders.rows),correctedSource);
assert.equal(context.getReport_('month','2026-10').sales,24950);
assert.equal(context.readIndexedHistory_(0,20,{status:'Cancelled'}).filteredTotal,2);
assert.equal(context.readIndexedHistory_(0,20,{}).total,500);
console.log('PASS: 501 orders, 20-row paging, bounded search, daily aggregates, cancellations, adjustments, durable retries, manual edits, source preservation');
