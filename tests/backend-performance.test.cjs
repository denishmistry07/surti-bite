const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const context = {console};
vm.createContext(context);
vm.runInContext(fs.readFileSync('apps-script/Code.gs','utf8'),context);
vm.runInContext(fs.readFileSync('apps-script/Performance.gs','utf8'),context);
context.prepareReadModels_=()=>false;

let data = [
  ['ORD-1','2026-10-15','L001','Oil Locho',2,50,100,'Closed','Online','2026-10-15','09:00','SES-1','Dine-in',''],
  ['ORD-2','2026-10-16','L002','Butter Locho',1,60,60,'Closed','Offline','2026-10-16','10:00','SES-2','Dine-in','']
];
let failWrite = false;
let reads = 0;
const sheet = {
  getLastRow:()=>data.length+1,
  getMaxRows:()=>100,
  getRange:()=>({
    getValues:()=>{ reads++; return data.map(row=>row.slice()); },
    setValues:rows=>{ if(failWrite) throw new Error('write failed'); data=rows.map(row=>Array.from(row)); }
  })
};
context.ss_=()=>({getSheetByName:()=>sheet});
context.ensureOrderSchema_=()=>{};
context.LockService={getScriptLock:()=>({waitLock(){},releaseLock(){}})};
context.Utilities={formatDate:date=>date.toISOString()};
context.getItemsPayload_=()=>({items:[{id:'L001',name:'Oil Locho',price:75}]});
let invalidated='';
context.invalidateBusinessDateCaches_=date=>{invalidated=date;};
const payload={orderId:'ORD-1',items:[{id:'L001',qty:3}],paymentMethod:'Offline',orderType:'Takeaway',adjustedAmount:20};
const before=JSON.stringify(data);
failWrite=true;
assert.throws(()=>context.updateOrder_(payload),/write failed/);
assert.equal(JSON.stringify(data),before,'original rows survive failed replacement');
failWrite=false;
const result=context.updateOrder_(payload);
assert.equal(result.totalAmount,170,'existing item keeps historical ₹50 price');
assert.equal(result.totalQty,3,'adjustment does not count as a dish');
assert.equal(result.items.length,2,'confirmed response includes receipt rows');
assert.equal(result.items[0].total,150);
assert.equal(result.paymentMethod,'Offline');
assert.equal(data.filter(row=>row[0]==='ORD-1').length,2);
assert.equal(data.find(row=>row[0]==='ORD-1')[9],'2026-10-15');
assert.equal(invalidated,'2026-10-15');
reads=0;
vm.runInContext('requestReadSnapshot_ = {}',context);
context.getOrderRows_(); context.getOrderRows_();
assert.equal(reads,1,'source rows are read once per execution');
const cache=new Map();
context.CacheService={getScriptCache:()=>({get:key=>cache.get(key),put:(key,value)=>cache.set(key,value)})};
context.getExpenseRows_=()=>[['E','2026-10-15','2026-10-15','Operating','','','',10,'Offline']];
context.getSessionMeta_=()=>({});
const report=context.getReport_('day','2026-10-15');
assert.equal(report.sales,170);
assert.equal(report.dishes,3);
assert.equal(report.operatingProfit,160);
assert.equal(report.items.length,1);
assert.equal(report.offlineSales,170);
console.log('PASS: atomic replacement failure, historical prices, adjustment totals, metadata preservation, shared reads and report reconciliation');
