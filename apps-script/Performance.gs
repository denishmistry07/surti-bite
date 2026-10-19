// Derived data only. Orders and Expenses remain the source of truth.
let buildingReadModels_ = false;
const READ_MODEL_VERSION = '1';

function prepareReadModels_() {
  const properties = PropertiesService.getScriptProperties();
  const state = properties.getProperties();
  if (state['read-model-version'] === READ_MODEL_VERSION &&
      !Object.keys(state).some(key => key.indexOf('dirty-day-') === 0)) return true;
  refreshReadModels();
  return properties.getProperty('read-model-version') === READ_MODEL_VERSION;
}

function replaceDerivedRows_(name,headers,rows) {
  if(['DailyReports','OrderIndex','DailySummary','MonthlySummary','YearlySummary','ExpenseSummary'].indexOf(name)===-1) {
    throw new Error('Refusing to replace a source-data sheet.');
  }
  const sheet = ensureSheet_(ss_(),name,headers);
  const previous = Math.max(0,sheet.getLastRow()-1);
  const output = rows.map(row => row.slice());
  while (output.length < previous) output.push(Array(headers.length).fill(''));
  if (!output.length) return;
  if (sheet.getMaxRows() < output.length+1) {
    sheet.insertRowsAfter(sheet.getMaxRows(),output.length+1-sheet.getMaxRows());
  }
  sheet.getRange(2,1,output.length,headers.length).setValues(output);
}

function refreshReadModels() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { refreshReadModelsLocked_(false); PropertiesService.getScriptProperties().deleteProperty('read-model-error'); }
  catch(error){PropertiesService.getScriptProperties().setProperty('read-model-error',String(error.message||error));throw error;}
  finally { lock.releaseLock(); }
}

function reconcileReadModels() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { refreshReadModelsLocked_(true); PropertiesService.getScriptProperties().deleteProperty('read-model-error'); }
  catch(error){PropertiesService.getScriptProperties().setProperty('read-model-error',String(error.message||error));throw error;}
  finally { lock.releaseLock(); }
}

function refreshReadModelsLocked_(full) {
  const properties = PropertiesService.getScriptProperties();
  const state = properties.getProperties();
  const dirtyKeys = Object.keys(state).filter(key => key.indexOf('dirty-day-') === 0);
  if (!full && state['read-model-version'] === READ_MODEL_VERSION && !dirtyKeys.length) return;
  buildingReadModels_ = true;
  requestReadSnapshot_ = {};
  try {
    const orders = getOrderRows_();
    const expenses = getExpenseRows_();
    const dates = {};
    orders.forEach(row => { if(row[0]) dates[formatDate_(row[9])] = true; });
    expenses.forEach(row => { if(row[0]) dates[formatDate_(row[2])] = true; });
    const existingSummary=ss_().getSheetByName(APP.SHEETS.DAILY);
    if(existingSummary && existingSummary.getLastRow()>1)existingSummary.getRange(2,1,existingSummary.getLastRow()-1,1).getValues().forEach(row=>{if(row[0])dates[formatDate_(row[0])]=true;});
    const dailySheet = ss_().getSheetByName('DailyReports');
    const reports = {};
    if (dailySheet && dailySheet.getLastRow() > 1) {
      dailySheet.getRange(2,1,dailySheet.getLastRow()-1,2).getValues().forEach(row => {
        if(row[0]) { reports[formatDate_(row[0])] = JSON.parse(row[1]); dates[formatDate_(row[0])] = true; }
      });
    }
    const rebuildAll = full || state['read-model-version'] !== READ_MODEL_VERSION;
    const affected = rebuildAll ? Object.keys(dates) : dirtyKeys.map(key=>key.slice(10));
    const cache = CacheService.getScriptCache();
    const ordersByDate={},expensesByDate={};
    orders.forEach(row=>{const date=formatDate_(row[9]);(ordersByDate[date]||(ordersByDate[date]=[])).push(row);});
    expenses.forEach(row=>{const date=formatDate_(row[2]);(expensesByDate[date]||(expensesByDate[date]=[])).push(row);});
    affected.filter(date=>/^\d{4}-\d{2}-\d{2}$/.test(date)).forEach(date => {
      cache.remove(reportCacheKey_('day',date));
      requestReadSnapshot_.orders=ordersByDate[date]||[];
      requestReadSnapshot_.expenses=expensesByDate[date]||[];
      reports[date] = getReport_('day',date);
    });
    requestReadSnapshot_.orders=orders;
    requestReadSnapshot_.expenses=expenses;
    const sortedDates = Object.keys(reports).sort();
    // Build every payload before writing. Dirty markers are cleared only after all writes succeed.
    const dailyRows = sortedDates.map(date=>[date,JSON.stringify(reports[date])]);
    if (dailyRows.some(row=>row[1].length > 45000)) throw new Error('Daily report exceeds sheet cell size; source data is unchanged.');
    const map = {};
    orders.forEach(row => {
      const id = String(row[0] || '');
      if (!id) return;
      const order = map[id] || (map[id] = {
        orderId:id,dateTime:formatDateTime_(row[1]),timestamp:toDate_(row[1]) ? toDate_(row[1]).getTime() : 0,
        businessDate:formatDate_(row[9]),saleTime:formatTime_(row[10]),paymentMethod:String(row[8] || ''),
        status:String(row[7] || 'Closed'),sessionId:String(row[11] || ''),orderType:String(row[12] || 'Unspecified'),
        orderFor:String(row[13] || ''),items:[],totalAmount:0,totalQty:0
      });
      order.items.push({itemId:String(row[2] || ''),name:String(row[3] || ''),qty:Number(row[4]) || 0,total:Number(row[6]) || 0});
      order.totalAmount += Number(row[6]) || 0;
      order.totalQty += Number(row[4]) || 0;
      if(String(row[7]).toLowerCase()==='cancelled') order.status='Cancelled';
    });
    const history = Object.keys(map).map(id=>map[id]).sort((a,b)=>b.timestamp-a.timestamp || b.orderId.localeCompare(a.orderId));
    const historyRows = history.map(order=>[order.orderId,JSON.stringify(order)]);
    if(historyRows.some(row=>row[1].length > 45000)) throw new Error('Order index entry exceeds sheet cell size; source data is unchanged.');
    properties.setProperty('read-model-version','building');
    replaceDerivedRows_('DailyReports',['BusinessDate','ReportJSON'],dailyRows);
    replaceDerivedRows_('OrderIndex',['OrderID','OrderJSON'],historyRows);
    // Existing visible sheets remain useful for exports and manual inspection.
    const summaryRow=(key,report)=>[key,report.orders,report.dishes,report.sales,report.bestSeller,JSON.stringify(report.items||[]),new Date(),report.onlineSales,report.offlineSales];
    replaceDerivedRows_(APP.SHEETS.DAILY,APP.HEADERS.DailySummary,sortedDates.map(date=>summaryRow(date,reports[date])));
    replaceDerivedRows_(APP.SHEETS.EXPENSE_SUMMARY,APP.HEADERS.ExpenseSummary,sortedDates.map(date=>{
      const report=reports[date];
      return [date,report.sales,report.operatingExpense,report.investmentExpense,report.totalExpense,report.operatingProfit,report.netCashProfit,report.onlineExpense,report.offlineExpense];
    }));
    const months = {}, years = {};
    sortedDates.forEach(date=>{months[date.slice(0,7)]=true;years[date.slice(0,4)]=true;});
    replaceDerivedRows_(APP.SHEETS.MONTHLY,APP.HEADERS.MonthlySummary,Object.keys(months).sort().map(month=>summaryRow(month,combineDailyReports_('month',month,Object.values(reports)))));
    replaceDerivedRows_(APP.SHEETS.YEARLY,APP.HEADERS.YearlySummary,Object.keys(years).sort().map(year=>summaryRow(year,combineDailyReports_('year',year,Object.values(reports)))));
    properties.setProperty('history-index-sales',String(history.reduce((sum,order)=>sum+(order.status==='Cancelled'?0:order.totalAmount),0)));
    properties.setProperty('history-index-count',String(history.length));
    properties.setProperty('read-model-version',READ_MODEL_VERSION);
    properties.setProperty('read-model-updated-at',new Date().toISOString());
    dirtyKeys.forEach(key=>{if(properties.getProperty(key)===state[key])properties.deleteProperty(key);});
    bumpReadCacheVersion_();
    cache.removeAll(['all-time-sales-v1','all-time-expense-v1']);
  } finally { buildingReadModels_=false; }
}

function readDailyReports_(type,value) {
  const sheet=ss_().getSheetByName('DailyReports');
  const reports=requestReadSnapshot_.dailyReports || (requestReadSnapshot_.dailyReports=sheet && sheet.getLastRow()>1
    ? sheet.getRange(2,1,sheet.getLastRow()-1,2).getValues().filter(row=>row[0]).map(row=>JSON.parse(row[1])) : []);
  return combineDailyReports_(type,value,reports);
}

function combineDailyReports_(type,value,reports) {
  const fields=['orders','dishes','sales','onlineSales','offlineSales','operatingExpense','investmentExpense','totalExpense','onlineExpense','offlineExpense'];
  const out={type:type,value:value,businessDate:type==='day'?value:'',items:[],sessions:[],orderTypes:{}};
  fields.forEach(key=>out[key]=0);
  const items={},sessions={};
  reports.filter(report=>type==='all'||periodMatches_(report.value,type,value)).forEach(report=>{
    fields.forEach(key=>out[key]+=Number(report[key])||0);
    (report.items||[]).forEach(item=>{const dest=items[item.id]||(items[item.id]={id:item.id,name:item.name,qty:0,sales:0});dest.qty+=item.qty;dest.sales+=item.sales;});
    (report.sessions||[]).forEach(session=>{const dest=sessions[session.sessionId]||(sessions[session.sessionId]=Object.assign({},session,{orders:0,dishes:0,sales:0,onlineSales:0,offlineSales:0}));['orders','dishes','sales','onlineSales','offlineSales'].forEach(key=>dest[key]+=Number(session[key])||0);});
    Object.keys(report.orderTypes||{}).forEach(name=>{const dest=out.orderTypes[name]||(out.orderTypes[name]={orders:0,dishes:0,sales:0});['orders','dishes','sales'].forEach(key=>dest[key]+=Number(report.orderTypes[name][key])||0);});
  });
  ['Dine-in','Takeaway','Unspecified'].forEach(name=>{if(!out.orderTypes[name])out.orderTypes[name]={orders:0,dishes:0,sales:0};});
  out.items=Object.values(items).sort((a,b)=>b.qty-a.qty||b.sales-a.sales);
  out.sessions=Object.values(sessions).sort((a,b)=>String(a.openTime).localeCompare(String(b.openTime)));
  out.bestSeller=out.items.length?out.items[0].name:'-';
  out.operatingProfit=out.sales-out.operatingExpense;
  out.netCashProfit=out.sales-out.totalExpense;
  return out;
}

function readIndexedHistory_(offset,limit,filters) {
  const sheet=ss_().getSheetByName('OrderIndex');
  const properties=PropertiesService.getScriptProperties();
  const count=Number(properties.getProperty('history-index-count'))||0;
  const unfiltered=!Object.keys(filters).some(key=>key!=='sort' && filters[key]!=null && String(filters[key])!=='') && (!filters.sort||filters.sort==='newest');
  if(unfiltered){
    const size=Math.max(0,Math.min(limit,count-offset));
    const orders=size?sheet.getRange(offset+2,2,size,1).getValues().map(row=>JSON.parse(row[0])):[];
    return {orders:orders,total:count,filteredTotal:count,filteredSales:Number(properties.getProperty('history-index-sales'))||0,nextOffset:offset+limit<count?offset+limit:null};
  }
  // Search compact order records in bounded blocks; never read the source Orders tab here.
  const matches=[];
  for(let start=0;start<count;start+=250){
    sheet.getRange(start+2,2,Math.min(250,count-start),1).getValues().forEach(row=>{
      const order=JSON.parse(row[0]);
      const query=String(filters.q||'').trim().toLowerCase();
      const text=[order.orderId,order.sessionId,order.orderFor,order.paymentMethod,order.orderType,order.status].concat(order.items.map(item=>item.itemId+' '+item.name)).join(' ').toLowerCase();
      if(query && text.indexOf(query)===-1)return;
      if(filters.from && order.businessDate<filters.from || filters.to && order.businessDate>filters.to)return;
      for(const key of ['payment','orderType','status']){const field=key==='payment'?'paymentMethod':key;if(filters[key] && String(order[field]).toLowerCase()!==String(filters[key]).toLowerCase())return;}
      if(filters.minAmount!=null && String(filters.minAmount)!=='' && order.totalAmount<Number(filters.minAmount))return;
      if(filters.maxAmount!=null && String(filters.maxAmount)!=='' && order.totalAmount>Number(filters.maxAmount))return;
      matches.push(order);
    });
  }
  matches.sort((a,b)=>filters.sort==='amountHigh'?b.totalAmount-a.totalAmount:filters.sort==='amountLow'?a.totalAmount-b.totalAmount:filters.sort==='oldest'?a.timestamp-b.timestamp:b.timestamp-a.timestamp);
  return {orders:matches.slice(offset,offset+limit),total:count,filteredTotal:matches.length,filteredSales:matches.reduce((sum,order)=>sum+(order.status==='Cancelled'?0:order.totalAmount),0),nextOffset:offset+limit<matches.length?offset+limit:null};
}

// Run once in the Apps Script editor after deploying both .gs files.
function installPerformanceOptimizations() {
  // Unique, recoverable copy; do not replace or trash any existing backup.
  const folder=getManagedFolder_(APP.BACKUP_FOLDER);
  const backup=DriveApp.getFileById(APP.SPREADSHEET_ID).makeCopy(
    getFileNamePrefix_()+' Before Performance Upgrade '+Utilities.formatDate(new Date(),APP.TZ,'yyyyMMdd-HHmmss'),folder);
  reconcileReadModels();
  const existing=ScriptApp.getProjectTriggers().map(trigger=>trigger.getHandlerFunction());
  if(existing.indexOf('refreshReadModels')===-1)ScriptApp.newTrigger('refreshReadModels').timeBased().everyMinutes(5).create();
  if(existing.indexOf('reconcileReadModels')===-1)ScriptApp.newTrigger('reconcileReadModels').timeBased().atHour(3).everyDays(1).inTimezone(APP.TZ).create();
  return {ready:true,sourceRecordsUnchanged:true,backupUrl:backup.getUrl()};
}
