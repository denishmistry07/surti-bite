// Read-only application smoke checks. No save/edit/delete routes are called.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const config=fs.readFileSync('frontend/js/config.js','utf8');
const base=config.match(/APPS_SCRIPT_URL:\s*"([^"]+)"/)[1];
async function request(action,params={}){
  const url=new URL(base);url.searchParams.set('action',action);
  for(const [key,value]of Object.entries(params))url.searchParams.set(key,value);
  const started=performance.now();
  const response=await fetch(url,{signal:AbortSignal.timeout(45000)});
  assert(response.ok,action+': HTTP '+response.status);
  const json=await response.json();
  assert(json.success,action+': '+json.error);
  console.log(action+': '+Math.round(performance.now()-started)+'ms');
  return json.data;
}
(async()=>{
  const health=await request('health');assert.equal(health.status,'online');
  const first=await request('history',{offset:0,limit:20});
  assert(first.orders.length<=20);
  if(first.nextOffset!==null){
    const next=await request('history',{offset:first.nextOffset,limit:20});
    const ids=new Set(first.orders.map(order=>order.orderId));
    assert(next.orders.every(order=>!ids.has(order.orderId)),'History pages overlap');
  }
  const today=await request('today');
  const monthly=await request('report',{type:'month',value:today.value.slice(0,7)});
  const yearly=await request('report',{type:'year',value:today.value.slice(0,4)});
  for(const report of [today,monthly,yearly]){
    assert.equal(report.sales,report.onlineSales+report.offlineSales);
    assert.equal(report.operatingProfit,report.sales-report.operatingExpense);
    assert.equal(report.netCashProfit,report.sales-report.totalExpense);
  }
  if(first.orders.length){
    const orderId=first.orders[0].orderId;
    const filtered=await request('history',{offset:0,limit:20,q:orderId});
    assert(filtered.orders.some(order=>order.orderId===orderId),'Search cannot find latest order');
  }
  console.log('PASS: live health, pagination, search, day/month/year report arithmetic. Save/edit flows intentionally not exercised against production.');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
