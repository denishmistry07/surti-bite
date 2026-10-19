const APP = {
  // This is the NEW Surti Bite Web Production spreadsheet.
  // If you make a copy of the Sheet later, replace this ID once.
  SPREADSHEET_ID: '17NEvr4zWjXeizKbt_-0pZBru41mtpH-6cyb233Ci3lM',
  TZ: 'Asia/Kolkata',
  CACHE_SECONDS: 300,
  REPORT_FOLDER: 'Surti Bite Reports',
  BACKUP_FOLDER: 'Surti Bite Backups',
  STALE_SESSION_HOURS: 18,
  SHEETS: {
    ITEMS: 'Items',
    ORDERS: 'Orders',
    SETTINGS: 'Settings',
    DAILY: 'DailySummary',
    MONTHLY: 'MonthlySummary',
    YEARLY: 'YearlySummary',
    REQUESTS: 'RequestLog',
    SESSIONS: 'StoreSessions',
    EXPENSES: 'Expenses',
    SETTLEMENTS: 'Settlements',
    EXPENSE_SUMMARY: 'ExpenseSummary'
  },
  HEADERS: {
    Items: ['ItemID','ItemName','Category','Price','Active','SortOrder','ImageURL','Description','WeightG'],
    Orders: ['OrderID','DateTime','ItemID','ItemName','Qty','UnitPrice','Total','Status','PaymentMethod','BusinessDate','SaleTime','SessionID','OrderType','OrderFor'],
    Settings: ['Key','Value'],
    DailySummary: ['Date','Orders','Dishes','Sales','BestSeller','ItemJSON','UpdatedAt','OnlineSales','OfflineSales'],
    MonthlySummary: ['Month','Orders','Dishes','Sales','BestSeller','ItemJSON','UpdatedAt','OnlineSales','OfflineSales'],
    YearlySummary: ['Year','Orders','Dishes','Sales','BestSeller','ItemJSON','UpdatedAt','OnlineSales','OfflineSales'],
    RequestLog: ['ClientRequestID','OrderID','CreatedAt'],
    StoreSessions: ['SessionID','BusinessDate','SessionName','OpenTime','CloseTime','Status'],
    Expenses: ['ExpenseID','DateTime','BusinessDate','ExpenseType','Frequency','Category','Description','Amount','PaymentMethod','Vendor','SessionID','Notes','PaidBy','SettlementType','FundOwner','FundRemaining'],
    Settlements: ['SettlementID','DateTime','BusinessDate','ExpenseID','FromPerson','ToPerson','Amount','PaymentMethod','Notes'],
    ExpenseSummary: ['Period','Sales','OperatingExpense','InvestmentExpense','TotalExpense','OperatingProfit','NetCashProfit','OnlineExpense','OfflineExpense']
  }
};

function ss_() {
  return SpreadsheetApp.openById(APP.SPREADSHEET_ID);
}

/**
 * ONE-TIME SETUP.
 * Run this manually from Apps Script after pasting Code.gs.
 * It creates/repairs required tabs, headers, dropdowns and default settings.
 * Existing order/expense data rows are not deleted.
 */
function setupSystem() {
  const ss = ss_();

  Object.keys(APP.HEADERS).forEach(name => {
    ensureSheet_(ss, name, APP.HEADERS[name]);
  });

  setDefaultSettings_();
  CacheService.getScriptCache().remove('settings-v1');
  setValidations_();
  seedItemsIfEmpty_();
  formatSheets_();
  installMonthlyBackupTrigger_();
  // Create Drive folders now so Google requests Drive permission during setup.
  getManagedFolder_(APP.REPORT_FOLDER);
  getManagedFolder_(APP.BACKUP_FOLDER);
  const cache = CacheService.getScriptCache();
  cache.remove('items-v3');
  cache.remove('items-v4');
  cache.remove('items-v5');
  cache.remove('settings-v1');
  cache.remove('open-session-v1');
  cache.remove('orders-schema-v2');

  return {
    ok: true,
    spreadsheetId: APP.SPREADSHEET_ID,
    message: 'Surti Bite setup complete.'
  };
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  const callback = safeCallback_(p.callback);

  try {
    const action = String(p.action || 'health');
    let result;

    if (action === 'health') {
      result = {success:true, data:{status:'online', spreadsheetId:APP.SPREADSHEET_ID}};
    } else if (action === 'operationalStatus') {
      result = {success:true,data:getOperationalStatus_()};
    } else if (action === 'bootstrap') {
      result = {success:true, data:getBootstrap_()};
    } else if (action === 'items') {
      result = {success:true, data:getItemsPayload_()};
    } else if (action === 'manageItems') {
      result = {success:true, data:getManageItems_()};
    } else if (action === 'session') {
      result = {success:true, data:getOpenSession_()};
    } else if (action === 'today') {
      result = {success:true, data:getToday_()};
    } else if (action === 'allTimeSales') {
      result = {success:true, data:getAllTimeSales_()};
    } else if (action === 'history') {
      result = {success:true, data:getHistory_(
        Number(p.offset || 0),
        Number(p.limit || 20),
        {q:p.q, from:p.from, to:p.to, payment:p.payment, orderType:p.orderType,
          status:p.status, minAmount:p.minAmount, maxAmount:p.maxAmount, sort:p.sort}
      )};
    } else if (action === 'expenses') {
      result = {success:true, data:getExpenses_(
        String(p.value || p.businessDate || getActiveBusinessDate_()),
        String(p.period || 'day')
      )};
    } else if (action === 'report') {
      result = {success:true, data:getReport_(
        String(p.type || 'day'),
        String(p.value || getActiveBusinessDate_())
      )};
    } else {
      // Portable static-host mutations.
      // Browser <script> requests are not blocked by CORS like fetch/XHR.
      const body = parsePayload_(p.payload);

      if (action === 'openSession') {
        result = {success:true, data:openSession_(body)};
      } else if (action === 'closeSession') {
        result = {success:true, data:closeSession_()};
      } else if (action === 'saveOrder') {
        result = {success:true, data:saveOrder_(body)};
      } else if (action === 'updateOrder') {
        result = {success:true, data:updateOrder_(body)};
      } else if (action === 'cancelOrder') {
        result = {success:true, data:cancelOrder_(body.orderId)};
      } else if (action === 'deleteOrder') {
        result = {success:true, data:deleteOrder_(body.orderId)};
      } else if (action === 'addExpense') {
        result = {success:true, data:addExpense_(body)};
      } else if (action === 'updateExpense') {
        result = {success:true, data:updateExpense_(body)};
      } else if (action === 'deleteExpense') {
        result = {success:true, data:deleteExpense_(body.expenseId)};
      } else if (action === 'addSettlement') {
        result = {success:true, data:addSettlement_(body)};
      } else if (action === 'saveItem') {
        result = {success:true, data:saveItem_(body)};
      } else if (action === 'deleteItem') {
        result = {success:true, data:deleteItem_(body.itemId)};
      } else if (action === 'updateNavigationSettings') {
        result = {success:true, data:updateNavigationSettings_(body)};
      } else if (action === 'saveReportPdf') {
        result = {success:true, data:saveReportPdf_(body)};
      } else if (action === 'backupData') {
        result = {success:true, data:backupData_()};
      } else {
        result = {success:false, error:'Unknown action'};
      }
    }

    return respond_(result, callback);
  } catch (err) {
    return respond_({success:false, error:errorMessage_(err)}, callback);
  }
}

/**
 * doPost is kept for compatibility/testing, but the portable frontend does
 * not depend on POST because direct cross-origin fetch to Apps Script is
 * blocked by browser CORS rules.
 */
function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = String(body.action || '');

    if (action === 'openSession') return respond_({success:true, data:openSession_(body)}, '');
    if (action === 'closeSession') return respond_({success:true, data:closeSession_()}, '');
    if (action === 'saveOrder') return respond_({success:true, data:saveOrder_(body)}, '');
    if (action === 'updateOrder') return respond_({success:true, data:updateOrder_(body)}, '');
    if (action === 'cancelOrder') return respond_({success:true, data:cancelOrder_(body.orderId)}, '');
    if (action === 'deleteOrder') return respond_({success:true, data:deleteOrder_(body.orderId)}, '');
    if (action === 'addExpense') return respond_({success:true, data:addExpense_(body)}, '');
    if (action === 'updateExpense') return respond_({success:true, data:updateExpense_(body)}, '');
    if (action === 'deleteExpense') return respond_({success:true, data:deleteExpense_(body.expenseId)}, '');
    if (action === 'addSettlement') return respond_({success:true, data:addSettlement_(body)}, '');
    if (action === 'saveItem') return respond_({success:true, data:saveItem_(body)}, '');
    if (action === 'deleteItem') return respond_({success:true, data:deleteItem_(body.itemId)}, '');
    if (action === 'updateNavigationSettings') return respond_({success:true, data:updateNavigationSettings_(body)}, '');
    if (action === 'saveReportPdf') return respond_({success:true, data:saveReportPdf_(body)}, '');
    if (action === 'backupData') return respond_({success:true, data:backupData_()}, '');

    return respond_({success:false, error:'Unknown POST action'}, '');
  } catch (err) {
    return respond_({success:false, error:errorMessage_(err)}, '');
  }
}

function parsePayload_(payload) {
  if (!payload) return {};
  try {
    return JSON.parse(String(payload));
  } catch (err) {
    throw new Error('Invalid request payload.');
  }
}

function safeCallback_(name) {
  name = String(name || '');
  if (!name) return '';
  if (!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(name)) {
    throw new Error('Invalid callback.');
  }
  return name;
}

function respond_(obj, callback) {
  const json = JSON.stringify(obj);

  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function errorMessage_(err) {
  return (err && err.message) ? err.message : String(err || 'Unknown error');
}

function getBootstrap_() {
  const itemPayload = getItemsPayload_();
  return {
    settings: getSettings_(),
    items: itemPayload.items,
    showImages: itemPayload.showImages,
    session: getOpenSession_()
  };
}

function getSettings_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('settings-v1');
  if (cached) return JSON.parse(cached);

  const sheet = ss_().getSheetByName(APP.SHEETS.SETTINGS);
  if (!sheet || sheet.getLastRow() < 2) return {};

  const values = sheet.getRange(2,1,sheet.getLastRow()-1,2).getValues();
  const obj = {};
  values.forEach(r => {
    if (r[0]) obj[String(r[0])] = String(r[1] == null ? '' : r[1]);
  });
  cache.put('settings-v1', JSON.stringify(obj), APP.CACHE_SECONDS);
  return obj;
}

function getItemsPayload_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('items-v5');
  if (cached) return JSON.parse(cached);

  const settings = getSettings_();
  const showImages = String(settings.ShowItemImages || 'No').toLowerCase() === 'yes';
  const sheet = ss_().getSheetByName(APP.SHEETS.ITEMS);
  if (!sheet || sheet.getLastRow() < 2) return {showImages:showImages, items:[]};

  const rows = sheet.getRange(2,1,sheet.getLastRow()-1,9).getValues();
  const items = rows
    .filter(r => String(r[4] || '').toLowerCase() === 'yes')
    .map(r => ({
      id: String(r[0] || ''),
      name: String(r[1] || ''),
      category: String(r[2] || 'Other'),
      price: Number(r[3]) || 0,
      sortOrder: Number(r[5]) || 999,
      imageUrl: showImages ? String(r[6] || '') : '',
      description: String(r[7] || '').trim(),
      weightG: Math.max(0, Number(r[8]) || 0)
    }))
    .filter(i => i.id && i.name)
    .sort((a,b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const payload = {showImages:showImages, items:items};
  cache.put('items-v5', JSON.stringify(payload), APP.CACHE_SECONDS);
  return payload;
}

function getManageItems_() {
  const sheet = ss_().getSheetByName(APP.SHEETS.ITEMS);
  if (!sheet || sheet.getLastRow() < 2) return {items:[]};
  const items = sheet.getRange(2,1,sheet.getLastRow()-1,APP.HEADERS.Items.length).getValues()
    .filter(r => String(r[0] || '').trim())
    .map(r => ({
      id:String(r[0] || ''), name:String(r[1] || ''), category:String(r[2] || 'Other'),
      price:Number(r[3]) || 0, active:String(r[4] || 'Yes'), sortOrder:Number(r[5]) || 999,
      imageUrl:String(r[6] || ''), description:String(r[7] || ''), weightG:Math.max(0,Number(r[8]) || 0)
    }))
    .sort((a,b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  return {items:items};
}

function saveItem_(body) {
  const itemId = String(body.itemId || '').trim();
  const originalItemId = String(body.originalItemId || '').trim();
  const name = String(body.name || '').trim();
  const category = String(body.category || 'Other').trim();
  const price = Number(body.price);
  const active = String(body.active || 'Yes') === 'No' ? 'No' : 'Yes';
  const sortOrder = Math.max(0, Number(body.sortOrder) || 999);
  if (!itemId) throw new Error('Item ID is required.');
  if (!name) throw new Error('Item name is required.');
  if (!(price >= 0)) throw new Error('Enter a valid price.');

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = ss_().getSheetByName(APP.SHEETS.ITEMS);
    const lookupId = originalItemId || itemId;
    const rowIndex = findIdRow_(sheet, lookupId);
    if (originalItemId && originalItemId !== itemId && findIdRow_(sheet, itemId)) throw new Error('Item ID already exists.');
    if (!originalItemId && rowIndex) throw new Error('Item ID already exists. Edit the existing item instead.');
    const weightG = Math.max(0,Number(body.weightG) || 0);
    const row = [itemId,name,category,price,active,sortOrder,String(body.imageUrl || '').trim(),String(body.description || '').trim(),weightG];
    if (rowIndex) sheet.getRange(rowIndex,1,1,row.length).setValues([row]);
    else sheet.appendRow(row);
    CacheService.getScriptCache().remove('items-v5');
    return {itemId:itemId, updated:Boolean(rowIndex), menu:getItemsPayload_(), managed:getManageItems_()};
  } finally {
    lock.releaseLock();
  }
}

function deleteItem_(itemId) {
  itemId = String(itemId || '').trim();
  if (!itemId) throw new Error('Item ID is required.');
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = ss_().getSheetByName(APP.SHEETS.ITEMS);
    const rowIndex = findIdRow_(sheet,itemId);
    if (!rowIndex) throw new Error('Item not found.');
    sheet.deleteRow(rowIndex);
    CacheService.getScriptCache().remove('items-v5');
    return {itemId:itemId,deleted:true,menu:getItemsPayload_(),managed:getManageItems_()};
  } finally {
    lock.releaseLock();
  }
}

function updateNavigationSettings_(body) {
  const keys = ['ShowTabToday','ShowTabReports','ShowTabHistory','ShowTabExpenses'];
  const sheet = ss_().getSheetByName(APP.SHEETS.SETTINGS);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    keys.forEach(key => {
      if (body[key] === undefined) return;
      const value = body[key] ? 'Yes' : 'No';
      const row = findKeyRow_(sheet, key);
      if (row) sheet.getRange(row,2).setValue(value);
      else sheet.appendRow([key,value]);
    });
    CacheService.getScriptCache().remove('settings-v1');
    return {settings:getSettings_()};
  } finally {
    lock.releaseLock();
  }
}

function getOpenSession_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('open-session-v1');
  if (cached) return JSON.parse(cached);

  const sheet = ss_().getSheetByName(APP.SHEETS.SESSIONS);
  if (!sheet || sheet.getLastRow() < 2) return null;

  const rows = sheet.getRange(2,1,sheet.getLastRow()-1,6).getValues();
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (String(r[5] || '').toLowerCase() === 'open') {
      const opened = toDate_(r[3]);
      const ageHours = opened ? ((Date.now() - opened.getTime()) / 3600000) : 0;
      const session = {
        sessionId: String(r[0]),
        businessDate: formatDate_(r[1]),
        sessionName: String(r[2] || 'Other'),
        openTime: formatDateTime_(r[3]),
        closeTime: '',
        status: 'Open',
        isStale: ageHours >= APP.STALE_SESSION_HOURS,
        ageHours: Math.max(0, Math.round(ageHours * 10) / 10)
      };
      cache.put('open-session-v1', JSON.stringify(session), 180);
      return session;
    }
  }
  return null;
}

function openSession_(body) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const existing = getOpenSession_();
    if (existing) throw new Error('A store session is already open. Close it first.');

    const now = new Date();
    const businessDate = normalizeBusinessDate_(
      body.businessDate || Utilities.formatDate(now, APP.TZ, 'yyyy-MM-dd')
    );
    const sessionName = String(body.sessionName || 'Evening').trim();
    if (!['Morning','Evening','Other'].includes(sessionName)) {
      throw new Error('Invalid session name.');
    }

    const token = Utilities.getUuid().slice(0,6).toUpperCase();
    const sessionId = 'SES-' + businessDate.replace(/-/g,'') + '-' + sessionName.toUpperCase() + '-' + token;

    ss_().getSheetByName(APP.SHEETS.SESSIONS)
      .appendRow([sessionId, businessDate, sessionName, now, '', 'Open']);

    return getOpenSession_();
  } finally {
    lock.releaseLock();
  }
}

function closeSession_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = ss_().getSheetByName(APP.SHEETS.SESSIONS);
    if (!sheet || sheet.getLastRow() < 2) throw new Error('No open session.');

    const rows = sheet.getRange(2,1,sheet.getLastRow()-1,6).getValues();
    for (let i = rows.length - 1; i >= 0; i--) {
      if (String(rows[i][5] || '').toLowerCase() === 'open') {
        const businessDate = formatDate_(rows[i][1]);
        sheet.getRange(i+2,5,1,2).setValues([[new Date(),'Closed']]);
        CacheService.getScriptCache().remove('open-session-v1');
        invalidateBusinessDateCaches_(businessDate,false);
        return {
          sessionId: String(rows[i][0]),
          businessDate: businessDate,
          closed: true
        };
      }
    }

    throw new Error('No open session.');
  } finally {
    lock.releaseLock();
  }
}

function saveOrder_(body) {
  const items = Array.isArray(body.items) ? body.items : [];
  const adjustedAmount = Number(body.adjustedAmount || 0);
  const paymentMethod = String(body.paymentMethod || '').trim();
  const orderType = String(body.orderType || '').trim();
  const orderFor = String(body.orderFor || '').trim().slice(0,60);
  const clientRequestId = String(body.clientRequestId || '').trim();

  if (!items.length) throw new Error('Order is empty.');
  if (!['Online','Offline'].includes(paymentMethod)) {
    throw new Error('Choose Online or Offline payment.');
  }
  if (!['Dine-in','Takeaway'].includes(orderType)) {
    throw new Error('Choose Dine-in or Takeaway.');
  }
  if (!clientRequestId) throw new Error('Missing request ID.');
  if (!isFinite(adjustedAmount) || adjustedAmount < 0 || adjustedAmount > 100000) {
    throw new Error('Adjusted amount must be between ₹0 and ₹100,000.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    // Resolve the active session under the same lock used by open/close.
    const session = getOpenSession_();
    if (!session) throw new Error('Open a store session before saving orders.');

    const ss = ss_();
    const requestSheet = ss.getSheetByName(APP.SHEETS.REQUESTS);
    const duplicateOrderId = findRequest_(requestSheet, clientRequestId);
    if (duplicateOrderId) {
      return {duplicate:true, orderId:duplicateOrderId};
    }

    const itemMap = {};
    getItemsPayload_().items.forEach(i => itemMap[i.id] = i);

    const validated = items.map(x => {
      const item = itemMap[String(x.id || '')];
      const qty = parseInt(x.qty, 10);
      if (!item) throw new Error('An item is invalid or inactive. Refresh and try again.');
      if (!Number.isInteger(qty) || qty <= 0 || qty > 999) throw new Error('Invalid quantity.');
      return {
        id:item.id,
        name:item.name,
        price:item.price,
        qty:qty,
        total:item.price * qty
      };
    });

    if (adjustedAmount > 0) {
      validated.push({
        id:'ADJUSTMENT',
        name:'Adjusted amount',
        price:adjustedAmount,
        qty:0,
        total:adjustedAmount
      });
    }

    const now = new Date();
    const orderSheet = ss.getSheetByName(APP.SHEETS.ORDERS);
    ensureOrderSchema_(orderSheet);
    const orderId = nextOrderId_(orderSheet, session.businessDate);
    const saleTime = Utilities.formatDate(now, APP.TZ, 'hh:mm a');

    const rows = validated.map(i => [
      orderId,
      now,
      i.id,
      i.name,
      i.qty,
      i.price,
      i.total,
      'Closed',
      paymentMethod,
      session.businessDate,
      saleTime,
      session.sessionId,
      orderType,
      orderFor
    ]);

    orderSheet.getRange(orderSheet.getLastRow()+1,1,rows.length,APP.HEADERS.Orders.length).setValues(rows);
    requestSheet.appendRow([clientRequestId, orderId, now]);
    invalidateBusinessDateCaches_(session.businessDate,true);

    // Keep the checkout path limited to the two essential writes above.
    // Reports read live order data, and summary tabs are rebuilt on session close.

    return {
      duplicate:false,
      orderId:orderId,
      businessDate:session.businessDate,
      saleTime:saleTime,
      paymentMethod:paymentMethod,
      orderType:orderType,
      orderFor:orderFor,
      status:'Closed',
      totalAmount:validated.reduce((sum,i) => sum + i.total, 0),
      totalQty:validated.reduce((sum,i) => sum + i.qty, 0)
    };
  } finally {
    lock.releaseLock();
  }
}

function updateOrder_(body) {
  const orderId = String(body.orderId || '').trim();
  const items = Array.isArray(body.items) ? body.items : [];
  const paymentMethod = String(body.paymentMethod || '').trim();
  const orderType = String(body.orderType || '').trim();
  const orderFor = String(body.orderFor || '').trim().slice(0,60);
  const adjustedAmount = Number(body.adjustedAmount || 0);

  if (!orderId) throw new Error('Order ID required.');
  if (!items.length) throw new Error('Order is empty.');
  if (!['Online','Offline'].includes(paymentMethod)) throw new Error('Choose Online or Offline payment.');
  if (!['Dine-in','Takeaway'].includes(orderType)) throw new Error('Choose Dine-in or Takeaway.');
  if (!isFinite(adjustedAmount) || adjustedAmount < 0 || adjustedAmount > 100000) {
    throw new Error('Adjusted amount must be between ₹0 and ₹100,000.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = ss_().getSheetByName(APP.SHEETS.ORDERS);
    if (!sheet || sheet.getLastRow() < 2) throw new Error('Order not found.');
    ensureOrderSchema_(sheet);

    const width = APP.HEADERS.Orders.length;
    const existingRows = sheet.getRange(2,1,sheet.getLastRow()-1,width).getValues();
    const rowNumbers = [];
    let original = null;
    existingRows.forEach((row,index) => {
      if (String(row[0] || '') !== orderId) return;
      if (!original) original = row;
      rowNumbers.push(index + 2);
    });
    if (!original) throw new Error('Order not found.');
    if (String(original[7] || '').toLowerCase() === 'cancelled') throw new Error('Cancelled orders cannot be edited.');

    const itemMap = {};
    getItemsPayload_().items.forEach(item => itemMap[item.id] = item);
    const validated = items.map(entry => {
      const item = itemMap[String(entry.id || '')];
      const qty = parseInt(entry.qty,10);
      if (!item) throw new Error('An item is invalid or inactive. Refresh and try again.');
      if (!Number.isInteger(qty) || qty <= 0 || qty > 999) throw new Error('Invalid quantity.');
      const historical = existingRows.find(row => String(row[0]) === orderId && String(row[2]) === item.id);
      const price = historical ? Number(historical[5]) : item.price;
      return {id:item.id,name:item.name,price:price,qty:qty,total:price * qty};
    });
    if (adjustedAmount > 0) {
      validated.push({id:'ADJUSTMENT',name:'Adjusted amount',price:adjustedAmount,qty:0,total:adjustedAmount});
    }

    const replacementRows = validated.map(item => [
      orderId,
      original[1],
      item.id,
      item.name,
      item.qty,
      item.price,
      item.total,
      'Closed',
      paymentMethod,
      original[9],
      original[10],
      original[11],
      orderType,
      orderFor
    ]);

    // Replace in one write: the original order remains intact until setValues succeeds.
    const updatedRows = existingRows.filter(row => String(row[0] || '') !== orderId).concat(replacementRows);
    while (updatedRows.length < existingRows.length) updatedRows.push(Array(width).fill(''));
    if (sheet.getMaxRows() < updatedRows.length + 1) {
      sheet.insertRowsAfter(sheet.getMaxRows(),updatedRows.length + 1 - sheet.getMaxRows());
    }
    sheet.getRange(2,1,updatedRows.length,width).setValues(updatedRows);
    const businessDate = formatDate_(original[9]);
    if (businessDate) invalidateBusinessDateCaches_(businessDate,true);

    return {
      orderId:orderId,
      updated:true,
      totalAmount:validated.reduce((sum,item) => sum + item.total,0),
      totalQty:validated.reduce((sum,item) => sum + item.qty,0)
    };
  } finally {
    lock.releaseLock();
  }
}

function cancelOrder_(orderId) {
  orderId = String(orderId || '').trim();
  if (!orderId) throw new Error('Order ID required.');

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = ss_().getSheetByName(APP.SHEETS.ORDERS);
    if (!sheet || sheet.getLastRow() < 2) throw new Error('Order not found.');

    const orderWidth = APP.HEADERS.Orders.length;
    const rows = sheet.getRange(2,1,sheet.getLastRow()-1,orderWidth).getValues();
    let found = false;
    let alreadyCancelled = true;
    let businessDate = '';

    rows.forEach(r => {
      if (String(r[0]) === orderId) {
        found = true;
        businessDate = String(r[9] || businessDate);
        if (String(r[7]).toLowerCase() !== 'cancelled') {
          r[7] = 'Cancelled';
          alreadyCancelled = false;
        }
      }
    });

    if (!found) throw new Error('Order not found.');
    if (!alreadyCancelled) sheet.getRange(2,1,rows.length,orderWidth).setValues(rows);

    if (businessDate) invalidateBusinessDateCaches_(businessDate,true);

    return {
      orderId:orderId,
      cancelled:true,
      alreadyCancelled:alreadyCancelled
    };
  } finally {
    lock.releaseLock();
  }
}

function deleteOrder_(orderId) {
  orderId = String(orderId || '').trim();
  if (!orderId) throw new Error('Order ID required.');

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = ss_();
    const orderSheet = ss.getSheetByName(APP.SHEETS.ORDERS);
    if (!orderSheet || orderSheet.getLastRow() < 2) throw new Error('Order not found.');

    const rows = orderSheet.getRange(2,1,orderSheet.getLastRow()-1,APP.HEADERS.Orders.length).getValues();
    const rowsToDelete = [];
    let businessDate = '';

    rows.forEach((row,index) => {
      if (String(row[0] || '') === orderId) {
        rowsToDelete.push(index + 2);
        businessDate = formatDate_(row[9]) || businessDate;
      }
    });

    if (!rowsToDelete.length) throw new Error('Order not found.');
    rowsToDelete.sort((a,b) => b-a).forEach(row => orderSheet.deleteRow(row));

    const requestSheet = ss.getSheetByName(APP.SHEETS.REQUESTS);
    if (requestSheet && requestSheet.getLastRow() >= 2) {
      const requestRows = requestSheet.getRange(2,1,requestSheet.getLastRow()-1,2).getDisplayValues();
      const requestRowsToDelete = [];
      requestRows.forEach((row,index) => {
        if (String(row[1] || '') === orderId) requestRowsToDelete.push(index + 2);
      });
      requestRowsToDelete.sort((a,b) => b-a).forEach(row => requestSheet.deleteRow(row));
    }

    if (businessDate) invalidateBusinessDateCaches_(businessDate,true);

    return {orderId:orderId, deleted:true, businessDate:businessDate};
  } finally {
    lock.releaseLock();
  }
}

function addExpense_(body) {
  // If an edit ID reaches the add route (for example from a stale frontend),
  // update that row instead of creating a duplicate expense.
  if (String(body && body.expenseId || '').trim()) return updateExpense_(body);
  return saveExpenseRow_(null, body);
}

function updateExpense_(body) {
  const expenseId = String(body.expenseId || '').trim();
  if (!expenseId) throw new Error('Expense ID required.');
  return saveExpenseRow_(expenseId, body);
}

function saveExpenseRow_(expenseId, body) {
  const lock=LockService.getScriptLock();
  lock.waitLock(20000);
  try { return saveExpenseRowLocked_(expenseId,body); }
  finally { lock.releaseLock(); }
}

function saveExpenseRowLocked_(expenseId, body) {
  const amount = Number(body.amount);
  if (!(amount > 0)) throw new Error('Expense amount must be greater than zero.');

  const expenseType = String(body.expenseType || '').trim();
  const frequency = String(body.frequency || 'Other').trim();
  const category = String(body.category || 'Other').trim();
  const paymentMethod = String(body.paymentMethod || 'Offline').trim();

  if (!['Operating','Investment'].includes(expenseType)) {
    throw new Error('Choose Operating or Investment expense.');
  }
  if (!['Online','Offline'].includes(paymentMethod)) {
    throw new Error('Choose Online or Offline payment.');
  }

  const session = getOpenSession_();
  const now = new Date();
  const fallbackDate = session ? session.businessDate : Utilities.formatDate(now, APP.TZ, 'yyyy-MM-dd');
  const businessDate = normalizeBusinessDate_(body.businessDate || fallbackDate);

  const rowValues = [
    expenseId || ('EXP-' + Utilities.formatDate(now, APP.TZ, 'yyyyMMddHHmmss') + '-' + Utilities.getUuid().slice(0,4).toUpperCase()),
    now,
    businessDate,
    expenseType,
    frequency,
    category,
    String(body.description || '').trim(),
    amount,
    paymentMethod,
    String(body.vendor || '').trim(),
    session ? session.sessionId : String(body.sessionId || ''),
    String(body.notes || '').trim(),
    String(body.paidBy || '').trim(),
    String(body.settlementType || 'Own funds').trim(),
    String(body.fundOwner || body.paidBy || '').trim(),
    body.fundRemaining === '' || body.fundRemaining == null ? '' : Math.max(0, Number(body.fundRemaining) || 0)
  ];

  const sheet = ss_().getSheetByName(APP.SHEETS.EXPENSES);
  let oldBusinessDate = '';

  if (expenseId) {
    const rowIndex = findIdRow_(sheet, expenseId);
    if (!rowIndex) throw new Error('Expense not found.');
    oldBusinessDate = formatDate_(sheet.getRange(rowIndex,3).getValue());
    // Preserve the original created DateTime while updating the rest.
    rowValues[1] = sheet.getRange(rowIndex,2).getValue() || now;
    sheet.getRange(rowIndex,1,1,APP.HEADERS.Expenses.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  invalidateBusinessDateCaches_(businessDate,false);
  if (oldBusinessDate && oldBusinessDate !== businessDate) invalidateBusinessDateCaches_(oldBusinessDate,false);

  return {
    expenseId:String(rowValues[0]),
    businessDate:businessDate,
    amount:amount,
    updated:Boolean(expenseId)
  };
}

function deleteExpense_(expenseId) {
  expenseId = String(expenseId || '').trim();
  if (!expenseId) throw new Error('Expense ID required.');

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = ss_().getSheetByName(APP.SHEETS.EXPENSES);
    const rowIndex = findIdRow_(sheet, expenseId);
    if (!rowIndex) throw new Error('Expense not found.');

    const businessDate = formatDate_(sheet.getRange(rowIndex,3).getValue());
    sheet.deleteRow(rowIndex);

    invalidateBusinessDateCaches_(businessDate,false);

    return {expenseId:expenseId, deleted:true};
  } finally {
    lock.releaseLock();
  }
}

function getExpenses_(value, period) {
  period = ['day','month','year'].includes(period) ? period : 'day';
  value = String(value || '').trim();
  if (period === 'day') value = normalizeBusinessDate_(value || getActiveBusinessDate_());
  if (period === 'month' && !/^\d{4}-\d{2}$/.test(value)) throw new Error('Choose a valid month.');
  if (period === 'year' && !/^\d{4}$/.test(value)) throw new Error('Choose a valid year.');
  const cacheKey = readCacheKey_('expenses', {period:period, value:value});
  const cached = readCachedJson_(cacheKey);
  if (cached) return cached;
  const matchesPeriod = date => period === 'day' ? date === value : period === 'month' ? date.slice(0,7) === value : date.slice(0,4) === value;
  const rows = getExpenseRows_()
    .filter(r => matchesPeriod(formatDate_(r[2])))
    .map(r => ({
      expenseId:String(r[0]),
      dateTime:formatDateTime_(r[1]),
      sortTimestamp:toDate_(r[1]) ? toDate_(r[1]).getTime() : 0,
      businessDate:formatDate_(r[2]),
      expenseType:String(r[3] || ''),
      frequency:String(r[4] || ''),
      category:String(r[5] || ''),
      description:String(r[6] || ''),
      amount:Number(r[7]) || 0,
      paymentMethod:String(r[8] || ''),
      vendor:String(r[9] || ''),
      sessionId:String(r[10] || ''),
      notes:String(r[11] || ''),
      paidBy:String(r[12] || ''),
      settlementType:String(r[13] || 'Own funds'),
      fundOwner:String(r[14] || ''),
      fundRemaining:r[15] === '' ? null : Number(r[15]) || 0
    }))
    .sort((a,b) => b.sortTimestamp - a.sortTimestamp);

  const settlementsByExpense = {};
  getSettlementRows_().forEach(r => {
    const expenseId = String(r[3] || '');
    if (!settlementsByExpense[expenseId]) settlementsByExpense[expenseId] = [];
    settlementsByExpense[expenseId].push({
      settlementId:String(r[0] || ''), dateTime:formatDateTime_(r[1]),
      businessDate:formatDate_(r[2]), expenseId:expenseId,
      fromPerson:String(r[4] || ''), toPerson:String(r[5] || ''),
      amount:Number(r[6]) || 0, paymentMethod:String(r[7] || ''), notes:String(r[8] || '')
    });
  });
  rows.forEach(x => { x.settlements = settlementsByExpense[x.expenseId] || []; });

  const result = {
    period:period,
    value:value,
    businessDate:period === 'day' ? value : '',
    items:rows,
    totals:calcExpenseTotals_(rows),
    allTime:{
      sales:getAllTimeSales_().sales,
      expense:getAllTimeExpense_()
    }
  };
  writeCachedJson_(cacheKey, result, 20);
  return result;
}

function getSettlementSheet_() {
  return ensureSheet_(ss_(), APP.SHEETS.SETTLEMENTS, APP.HEADERS.Settlements);
}

function getSettlementRows_() {
  const sheet = getSettlementSheet_();
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2,1,sheet.getLastRow()-1,APP.HEADERS.Settlements.length).getValues();
}

function addSettlement_(body) {
  const expenseId = String(body.expenseId || '').trim();
  const amount = Number(body.amount);
  const paymentMethod = String(body.paymentMethod || '').trim();
  if (!expenseId) throw new Error('Expense ID required.');
  if (!(amount > 0)) throw new Error('Return amount must be greater than zero.');
  if (!['Online','Offline'].includes(paymentMethod)) throw new Error('Choose Online or Offline payment.');

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const expenseSheet = ss_().getSheetByName(APP.SHEETS.EXPENSES);
    const rowIndex = findIdRow_(expenseSheet, expenseId);
    if (!rowIndex) throw new Error('Linked expense not found.');
    const expense = expenseSheet.getRange(rowIndex,1,1,APP.HEADERS.Expenses.length).getValues()[0];
    const remaining = Number(expense[15]) || 0;
    if (remaining <= 0) throw new Error('This advance is already settled.');
    if (amount > remaining) throw new Error('Return amount cannot be more than ₹' + remaining + '.');

    const fromPerson = String(body.fromPerson || expense[12] || '').trim();
    const toPerson = String(body.toPerson || expense[14] || '').trim();
    if (!fromPerson || !toPerson || fromPerson === toPerson) throw new Error('Choose valid From and To people.');

    const now = new Date();
    const businessDate = normalizeBusinessDate_(body.businessDate || formatDate_(expense[2]));
    const settlementId = 'SET-' + Utilities.formatDate(now, APP.TZ, 'yyyyMMddHHmmss') + '-' + Utilities.getUuid().slice(0,4).toUpperCase();
    getSettlementSheet_().appendRow([
      settlementId, now, businessDate, expenseId, fromPerson, toPerson, amount,
      paymentMethod, String(body.notes || '').trim()
    ]);

    const newRemaining = Math.max(0, remaining - amount);
    expenseSheet.getRange(rowIndex,16).setValue(newRemaining);
    expenseSheet.getRange(rowIndex,14).setValue(newRemaining === 0 ? 'Settled' : 'Advance used');
    invalidateBusinessDateCaches_(businessDate,false);

    return {settlementId:settlementId, expenseId:expenseId, amount:amount, remaining:newRemaining, status:newRemaining === 0 ? 'Settled' : 'Partially settled'};
  } finally {
    lock.releaseLock();
  }
}

function getToday_() {
  return getReport_('day', getActiveBusinessDate_());
}

function getAllTimeSales_() {
  if (!buildingReadModels_ && prepareReadModels_()) {
    const report=readDailyReports_('all','');
    return {sales:report.sales,orders:report.orders};
  }
  const cache = CacheService.getScriptCache();
  const cached = cache.get('all-time-sales-v1');
  if (cached) return JSON.parse(cached);
  const orderIds = {};
  let sales = 0;
  getOrderRows_().forEach(r => {
    if (String(r[7] || '').toLowerCase() === 'cancelled') return;
    orderIds[String(r[0] || '')] = true;
    sales += Number(r[6]) || 0;
  });
  const result = {sales:sales, orders:Object.keys(orderIds).filter(Boolean).length};
  cache.put('all-time-sales-v1', JSON.stringify(result), 300);
  return result;
}

function getAllTimeExpense_() {
  if (!buildingReadModels_ && prepareReadModels_()) return readDailyReports_('all','').totalExpense;
  const cache = CacheService.getScriptCache();
  const cached = cache.get('all-time-expense-v1');
  if (cached) return Number(cached) || 0;
  const total = getExpenseRows_().reduce((sum, row) => sum + (Number(row[7]) || 0), 0);
  cache.put('all-time-expense-v1', String(total), 300);
  return total;
}

function getReport_(type, value) {
  type = String(type || 'day');
  value = String(value || '');
  validateReportInput_(type, value);
  if (!buildingReadModels_ && prepareReadModels_()) {
    return readDailyReports_(type,value);
  }
  const cache = CacheService.getScriptCache();
  const cacheKey = reportCacheKey_(type,value);
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const orderRows = getOrderRows_().filter(r => {
    if (String(r[7] || '').toLowerCase() === 'cancelled') return false;
    return periodMatches_(formatDate_(r[9]), type, value);
  });

  const orderIds = {};
  const itemMap = {};
  const sessionMap = {};
  const orderTypeMap = {
    'Dine-in':{orders:{}, dishes:0, sales:0},
    'Takeaway':{orders:{}, dishes:0, sales:0},
    'Unspecified':{orders:{}, dishes:0, sales:0}
  };
  let sales = 0;
  let dishes = 0;
  let onlineSales = 0;
  let offlineSales = 0;

  orderRows.forEach(r => {
    const orderId = String(r[0] || '');
    const itemId = String(r[2] || r[3] || '');
    const itemName = String(r[3] || '');
    const qty = Number(r[4]) || 0;
    const total = Number(r[6]) || 0;
    const payment = String(r[8] || '');
    const sessionId = String(r[11] || 'Unassigned');
    const orderType = ['Dine-in','Takeaway'].includes(String(r[12] || '')) ? String(r[12]) : 'Unspecified';

    orderIds[orderId] = true;

    if (itemId !== 'ADJUSTMENT') {
      if (!itemMap[itemId]) itemMap[itemId] = {id:itemId, name:itemName, qty:0, sales:0};
      itemMap[itemId].qty += qty;
      itemMap[itemId].sales += total;
    }

    if (!sessionMap[sessionId]) {
      sessionMap[sessionId] = {
        sessionId:sessionId,
        sessionName:'Other',
        businessDate:formatDate_(r[9]),
        orders:{},
        dishes:0,
        sales:0,
        onlineSales:0,
        offlineSales:0
      };
    }
    sessionMap[sessionId].orders[orderId] = true;
    sessionMap[sessionId].dishes += qty;
    sessionMap[sessionId].sales += total;
    if (payment === 'Online') sessionMap[sessionId].onlineSales += total;
    if (payment === 'Offline') sessionMap[sessionId].offlineSales += total;

    orderTypeMap[orderType].orders[orderId] = true;
    orderTypeMap[orderType].dishes += qty;
    orderTypeMap[orderType].sales += total;

    dishes += qty;
    sales += total;
    if (payment === 'Online') onlineSales += total;
    if (payment === 'Offline') offlineSales += total;
  });

  const meta = getSessionMeta_();
  const sessions = Object.keys(sessionMap).map(id => {
    const s = sessionMap[id];
    const m = meta[id] || {};
    return {
      sessionId:id,
      sessionName:String(m.sessionName || s.sessionName || 'Other'),
      businessDate:String(m.businessDate || s.businessDate || ''),
      openTime:String(m.openTime || ''),
      closeTime:String(m.closeTime || ''),
      status:String(m.status || ''),
      orders:Object.keys(s.orders).length,
      dishes:s.dishes,
      sales:s.sales,
      onlineSales:s.onlineSales,
      offlineSales:s.offlineSales
    };
  }).sort((a,b) => a.openTime.localeCompare(b.openTime));

  const expenseObjects = getExpenseRows_()
    .filter(r => periodMatches_(formatDate_(r[2]), type, value))
    .map(r => ({
      expenseType:String(r[3] || ''),
      amount:Number(r[7]) || 0,
      paymentMethod:String(r[8] || '')
    }));

  const expenseTotals = calcExpenseTotals_(expenseObjects);
  const items = Object.keys(itemMap).map(k => itemMap[k]).sort((a,b) => b.qty - a.qty || b.sales - a.sales);
  const orderTypes = {};
  Object.keys(orderTypeMap).forEach(name => {
    orderTypes[name] = {
      orders:Object.keys(orderTypeMap[name].orders).length,
      dishes:orderTypeMap[name].dishes,
      sales:orderTypeMap[name].sales
    };
  });

  const result = {
    type:type,
    value:value,
    businessDate:type === 'day' ? value : '',
    orders:Object.keys(orderIds).length,
    dishes:dishes,
    sales:sales,
    onlineSales:onlineSales,
    offlineSales:offlineSales,
    bestSeller:items.length ? items[0].name : '-',
    items:items,
    sessions:sessions,
    orderTypes:orderTypes,
    operatingExpense:expenseTotals.operating,
    investmentExpense:expenseTotals.investment,
    totalExpense:expenseTotals.total,
    onlineExpense:expenseTotals.online,
    offlineExpense:expenseTotals.offline,
    operatingProfit:sales - expenseTotals.operating,
    netCashProfit:sales - expenseTotals.total
  };
  const serialized = JSON.stringify(result);
  if (serialized.length < 90000) cache.put(cacheKey, serialized, 300);
  return result;
}

function reportCacheKey_(type,value) {
  return 'report-v2-' + String(type) + '-' + String(value);
}

function invalidateBusinessDateCaches_(businessDate, salesChanged) {
  businessDate = String(businessDate || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) return;
  bumpReadCacheVersion_();
  const keys = [
    reportCacheKey_('day',businessDate),
    reportCacheKey_('month',businessDate.slice(0,7)),
    reportCacheKey_('year',businessDate.slice(0,4)),
    'all-time-expense-v1'
  ];
  if (salesChanged) keys.push('all-time-sales-v1');
  CacheService.getScriptCache().removeAll(keys);
  requestReadSnapshot_ = {};
  // Durable queue: do not scan historical orders or rebuild reports during checkout.
  PropertiesService.getScriptProperties().setProperty('dirty-day-' + businessDate,String(Date.now())+'-'+Utilities.getUuid());
}

function getHistory_(offset, limit, filters) {
  offset = Math.max(0, Number(offset) || 0);
  limit = Math.min(100, Math.max(1, Number(limit) || 20));
  filters = filters || {};
  const cacheKey = readCacheKey_('history', {offset:offset, limit:limit, filters:filters});
  const cached = readCachedJson_(cacheKey);
  if (cached) return cached;

  if (!buildingReadModels_ && prepareReadModels_()) {
    const indexed = readIndexedHistory_(offset,limit,filters);
    writeCachedJson_(cacheKey,indexed,20);
    return indexed;
  }

  const rows = getOrderRows_();
  const map = {};

  rows.forEach(r => {
    const id = String(r[0] || '');
    if (!id) return;

    if (!map[id]) {
      map[id] = {
        orderId:id,
        dateValue:toDate_(r[1]),
        dateTime:formatDateTime_(r[1]),
        businessDate:formatDate_(r[9]),
        saleTime:formatTime_(r[10]),
        paymentMethod:String(r[8] || ''),
        status:String(r[7] || 'Closed'),
        sessionId:String(r[11] || ''),
        orderType:String(r[12] || 'Unspecified'),
        orderFor:String(r[13] || ''),
        items:[],
        totalAmount:0,
        totalQty:0
      };
    }

    map[id].items.push({
      itemId:String(r[2] || ''),
      name:String(r[3] || ''),
      qty:Number(r[4]) || 0,
      total:Number(r[6]) || 0
    });
    map[id].totalAmount += Number(r[6]) || 0;
    map[id].totalQty += Number(r[4]) || 0;
    if (String(r[7] || '').toLowerCase() === 'cancelled') map[id].status = 'Cancelled';
  });

  const all = Object.keys(map).map(k => map[k]);
  const q = String(filters.q || '').trim().toLowerCase();
  const from = String(filters.from || '').trim();
  const to = String(filters.to || '').trim();
  const payment = String(filters.payment || '').trim().toLowerCase();
  const orderType = String(filters.orderType || '').trim().toLowerCase();
  const status = String(filters.status || '').trim().toLowerCase();
  const hasMin = filters.minAmount !== undefined && filters.minAmount !== null && String(filters.minAmount) !== '';
  const hasMax = filters.maxAmount !== undefined && filters.maxAmount !== null && String(filters.maxAmount) !== '';
  const minAmount = Number(filters.minAmount);
  const maxAmount = Number(filters.maxAmount);

  const filtered = all.filter(order => {
    const searchText = [order.orderId, order.sessionId, order.orderFor, order.paymentMethod,
      order.orderType, order.status].concat(order.items.map(item => item.itemId + ' ' + item.name)).join(' ').toLowerCase();
    return (!q || searchText.indexOf(q) !== -1) &&
      (!from || order.businessDate >= from) && (!to || order.businessDate <= to) &&
      (!payment || order.paymentMethod.toLowerCase() === payment) &&
      (!orderType || order.orderType.toLowerCase() === orderType) &&
      (!status || order.status.toLowerCase() === status) &&
      (!hasMin || isNaN(minAmount) || order.totalAmount >= minAmount) &&
      (!hasMax || isNaN(maxAmount) || order.totalAmount <= maxAmount);
  });

  const sort = String(filters.sort || 'newest');
  filtered.sort((a,b) => {
      if (sort === 'amountHigh') return b.totalAmount - a.totalAmount;
      if (sort === 'amountLow') return a.totalAmount - b.totalAmount;
      const at = a.dateValue ? a.dateValue.getTime() : 0;
      const bt = b.dateValue ? b.dateValue.getTime() : 0;
      return sort === 'oldest' ? at - bt : bt - at;
    });

  const page = filtered.slice(offset, offset + limit).map(x => {
      x = Object.assign({},x);
      delete x.dateValue;
      return x;
    });

  const result = {
    orders:page,
    total:all.length,
    filteredTotal:filtered.length,
    filteredSales:filtered.reduce((sum, order) => {
      return String(order.status || '').toLowerCase() === 'cancelled'
        ? sum
        : sum + (Number(order.totalAmount) || 0);
    }, 0),
    nextOffset:(offset + limit < filtered.length) ? offset + limit : null
  };
  writeCachedJson_(cacheKey, result, 20);
  return result;
}

function getReadCacheVersion_() {
  const cache = CacheService.getScriptCache();
  const existing = cache.get('read-cache-version-v1');
  if (existing) return existing;
  const version = String(Date.now());
  cache.put('read-cache-version-v1', version, 21600);
  return version;
}

function bumpReadCacheVersion_() {
  const version = String(Date.now()) + '-' + Utilities.getUuid().slice(0,8);
  CacheService.getScriptCache().put('read-cache-version-v1', version, 21600);
}

function readCacheKey_(prefix, params) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    JSON.stringify(params || {})
  );
  const hash = Utilities.base64EncodeWebSafe(digest).replace(/=+$/,'').slice(0,32);
  return String(prefix) + '-' + getReadCacheVersion_() + '-' + hash;
}

function readCachedJson_(key) {
  const value = CacheService.getScriptCache().get(key);
  if (!value) return null;
  try { return JSON.parse(value); } catch (err) { return null; }
}

function writeCachedJson_(key, value, seconds) {
  const serialized = JSON.stringify(value);
  if (serialized.length < 90000) CacheService.getScriptCache().put(key, serialized, seconds);
}

function saveReportPdf_(body) {
  const type = String(body.type || 'day');
  const value = String(body.value || getActiveBusinessDate_());
  const report = getReport_(type,value);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const settings = getSettings_();
    const html = buildReportHtml_(report, settings);

    const fileName = fileNameSlug_(getFileNamePrefix_()) + '-' + type + '-report-' + value + '.pdf';
    const blob = Utilities.newBlob(html, MimeType.HTML, fileName + '.html').getAs(MimeType.PDF).setName(fileName);
    const folder = getReportFolder_(value);

    // Keep one current PDF for each report period. Old copies remain recoverable
    // from Drive trash instead of accumulating duplicate filenames.
    const existing = folder.getFilesByName(fileName);
    while (existing.hasNext()) existing.next().setTrashed(true);

    const file = folder.createFile(blob).setName(fileName);
    return {
      fileId:file.getId(),
      fileName:file.getName(),
      url:file.getUrl(),
      folderName:folder.getName()
    };
  } finally {
    lock.releaseLock();
  }
}

function backupData_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const now = new Date();
    const dayKey = Utilities.formatDate(now, APP.TZ, 'yyyy-MM-dd');
    const name = getFileNamePrefix_() + ' Backup ' + dayKey;
    const folder = getManagedFolder_(APP.BACKUP_FOLDER);

    // Keep one current manual backup per day. This also cleans up older
    // timestamped backups for the same day created by previous app versions.
    let replaced = false;
    const files = folder.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      if (file.getName().indexOf(name) === 0) {
        file.setTrashed(true);
        replaced = true;
      }
    }
    const copy = DriveApp.getFileById(APP.SPREADSHEET_ID).makeCopy(name, folder);

    return {
      fileId:copy.getId(),
      fileName:copy.getName(),
      url:copy.getUrl(),
      folderName:folder.getName(),
      replaced:replaced
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Runs automatically on the first day of each month and stores one snapshot
 * for the month that just ended. Safe to run manually as well.
 */
function runMonthlyBackup() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const now = new Date();
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthKey = Utilities.formatDate(previousMonth, APP.TZ, 'yyyy-MM');
    const name = getFileNamePrefix_() + ' Monthly Backup ' + monthKey;
    const folder = getManagedFolder_(APP.BACKUP_FOLDER);
    const existing = folder.getFilesByName(name);
    const copy = existing.hasNext()
      ? existing.next()
      : DriveApp.getFileById(APP.SPREADSHEET_ID).makeCopy(name, folder);

    return {
      fileId:copy.getId(),
      fileName:copy.getName(),
      url:copy.getUrl(),
      folderName:folder.getName(),
      month:monthKey
    };
  } finally {
    lock.releaseLock();
  }
}

/** Installs exactly one monthly backup trigger for this Apps Script project. */
function installMonthlyBackupTrigger_() {
  const handler = 'runMonthlyBackup';
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === handler) ScriptApp.deleteTrigger(trigger);
  });

  ScriptApp.newTrigger(handler)
    .timeBased()
    .onMonthDay(1)
    .atHour(2)
    .inTimezone(APP.TZ)
    .create();
}

function buildReportHtml_(r, settings) {
  const currency = escapeHtml_(settings.CurrencySymbol || '₹');
  const dineIn = (r.orderTypes && r.orderTypes['Dine-in']) || {orders:0,sales:0};
  const takeaway = (r.orderTypes && r.orderTypes.Takeaway) || {orders:0,sales:0};
  const sessionRows = (r.sessions || []).map(s =>
    '<tr>' +
      '<td>' + escapeHtml_(s.sessionName) + '</td>' +
      '<td>' + s.orders + '</td>' +
      '<td>' + s.dishes + '</td>' +
      '<td>' + currency + formatNumber_(s.sales) + '</td>' +
      '<td>' + currency + formatNumber_(s.onlineSales) + '</td>' +
      '<td>' + currency + formatNumber_(s.offlineSales) + '</td>' +
    '</tr>'
  ).join('');

  const itemRows = (r.items || []).map(i =>
    '<tr><td>' + escapeHtml_(i.name) + '</td><td>' + i.qty + '</td><td>' + currency + formatNumber_(i.sales) + '</td></tr>'
  ).join('');

  return '<!doctype html><html><head><meta charset="utf-8"><style>' +
    'body{font-family:Arial,sans-serif;color:#152018;padding:28px}h1{color:#0b5d2a;margin:0 0 4px}h2{font-size:16px;margin-top:26px}.muted{color:#6f766f;font-size:12px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:18px 0}.k{border:1px solid #dfe6df;border-radius:10px;padding:10px}.k small{color:#6f766f}.k b{display:block;font-size:18px;margin-top:4px}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border-bottom:1px solid #e5e9e5;padding:8px;text-align:left;font-size:12px}th{background:#f1f5f1}.profit{color:#0b5d2a}.loss{color:#a12b26}' +
    '</style></head><body>' +
    '<h1>' + escapeHtml_(settings.ShopName || 'Surti Bite') + '</h1>' +
    '<div class="muted">' + escapeHtml_(r.type.toUpperCase()) + ' report · ' + escapeHtml_(r.value) + ' · Generated ' + escapeHtml_(Utilities.formatDate(new Date(), APP.TZ, 'dd MMM yyyy, hh:mm a')) + '</div>' +
    '<div class="grid">' +
      pdfKpi_('Sales', currency + formatNumber_(r.sales)) +
      pdfKpi_('Orders', String(r.orders)) +
      pdfKpi_('Dishes', String(r.dishes)) +
      pdfKpi_('Best Seller', escapeHtml_(r.bestSeller)) +
      pdfKpi_('Online Sales', currency + formatNumber_(r.onlineSales)) +
      pdfKpi_('Offline Sales', currency + formatNumber_(r.offlineSales)) +
      pdfKpi_('Dine-in', dineIn.orders + ' · ' + currency + formatNumber_(dineIn.sales)) +
      pdfKpi_('Takeaway', takeaway.orders + ' · ' + currency + formatNumber_(takeaway.sales)) +
      pdfKpi_('Operating Expense', currency + formatNumber_(r.operatingExpense)) +
      pdfKpi_('Investment', currency + formatNumber_(r.investmentExpense)) +
      pdfKpi_('Operating Profit', currency + formatNumber_(r.operatingProfit)) +
      pdfKpi_('Net Cash Profit', currency + formatNumber_(r.netCashProfit)) +
    '</div>' +
    '<h2>Session Breakdown</h2><table><thead><tr><th>Session</th><th>Orders</th><th>Dishes</th><th>Sales</th><th>Online</th><th>Offline</th></tr></thead><tbody>' + (sessionRows || '<tr><td colspan="6">No session sales.</td></tr>') + '</tbody></table>' +
    '<h2>Item Sales</h2><table><thead><tr><th>Item</th><th>Qty</th><th>Sales</th></tr></thead><tbody>' + (itemRows || '<tr><td colspan="3">No sales.</td></tr>') + '</tbody></table>' +
    '</body></html>';
}

function pdfKpi_(label, value) {
  return '<div class="k"><small>' + escapeHtml_(label) + '</small><b>' + value + '</b></div>';
}

function getActiveBusinessDate_() {
  const session = getOpenSession_();
  return session ? session.businessDate : Utilities.formatDate(new Date(), APP.TZ, 'yyyy-MM-dd');
}

function nextOrderId_(sheet, businessDate) {
  const prefix = String(getSettings_().OrderPrefix || 'SB');
  const marker = prefix + '-' + businessDate.replace(/-/g,'') + '-';
  const properties = PropertiesService.getScriptProperties();
  const propertyKey = 'order-sequence-' + marker;
  const cachedSequence = parseInt(properties.getProperty(propertyKey), 10);
  let max = Number.isInteger(cachedSequence) ? cachedSequence : 0;

  // Only scan the sheet once for a date/prefix. The script lock around saving
  // makes subsequent property increments safe and avoids an ever-growing read.
  if (!Number.isInteger(cachedSequence) && sheet.getLastRow() >= 2) {
    const ids = sheet.getRange(2,1,sheet.getLastRow()-1,1).getDisplayValues();
    ids.forEach(r => {
      const id = String(r[0] || '');
      if (id.indexOf(marker) === 0) {
        const n = parseInt(id.slice(marker.length),10);
        if (Number.isInteger(n) && n > max) max = n;
      }
    });
  }

  const next = max + 1;
  properties.setProperty(propertyKey, String(next));
  return marker + String(next).padStart(3,'0');
}

function findRequest_(sheet, requestId) {
  if (!sheet || sheet.getLastRow() < 2) return '';
  const match = sheet.getRange(2,1,sheet.getLastRow()-1,1)
    .createTextFinder(requestId)
    .matchEntireCell(true)
    .findNext();
  return match ? String(sheet.getRange(match.getRow(),2).getDisplayValue() || '') : '';
}

function findIdRow_(sheet, id) {
  if (!sheet || sheet.getLastRow() < 2) return 0;
  const values = sheet.getRange(2,1,sheet.getLastRow()-1,1).getDisplayValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === id) return i + 2;
  }
  return 0;
}

let requestReadSnapshot_ = {};

function getOrderRows_() {
  if (requestReadSnapshot_.orders) return requestReadSnapshot_.orders;
  const sheet = ss_().getSheetByName(APP.SHEETS.ORDERS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  ensureOrderSchema_(sheet);
  return requestReadSnapshot_.orders = sheet.getRange(2,1,sheet.getLastRow()-1,APP.HEADERS.Orders.length).getValues();
}

function getExpenseRows_() {
  if (requestReadSnapshot_.expenses) return requestReadSnapshot_.expenses;
  const sheet = ss_().getSheetByName(APP.SHEETS.EXPENSES);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return requestReadSnapshot_.expenses = sheet.getRange(2,1,sheet.getLastRow()-1,APP.HEADERS.Expenses.length).getValues();
}

function getSessionMeta_() {
  if (requestReadSnapshot_.sessions) return requestReadSnapshot_.sessions;
  const sheet = ss_().getSheetByName(APP.SHEETS.SESSIONS);
  const out = {};
  if (!sheet || sheet.getLastRow() < 2) return out;

  const rows = sheet.getRange(2,1,sheet.getLastRow()-1,6).getValues();
  rows.forEach(r => {
    const id = String(r[0] || '');
    if (!id) return;
    out[id] = {
      sessionId:id,
      businessDate:formatDate_(r[1]),
      sessionName:String(r[2] || 'Other'),
      openTime:formatDateTime_(r[3]),
      closeTime:formatDateTime_(r[4]),
      status:String(r[5] || '')
    };
  });
  return requestReadSnapshot_.sessions = out;
}

function calcExpenseTotals_(items) {
  const out = expenseTotalsEmpty_();
  (items || []).forEach(x => {
    const amount = Number(x.amount != null ? x.amount : x[7]) || 0;
    const type = String(x.expenseType != null ? x.expenseType : x[3] || '');
    const payment = String(x.paymentMethod != null ? x.paymentMethod : x[8] || '');

    if (type === 'Operating') out.operating += amount;
    if (type === 'Investment') out.investment += amount;
    if (payment === 'Online') out.online += amount;
    if (payment === 'Offline') out.offline += amount;
    out.total += amount;
  });
  return out;
}

function expenseTotalsEmpty_() {
  return {operating:0, investment:0, total:0, online:0, offline:0};
}

function rebuildSummariesForBusinessDate_(businessDate) {
  if (!businessDate) return;
  const day = getReport_('day', businessDate);
  upsertSummary_(APP.SHEETS.DAILY, businessDate, day);

  const month = businessDate.slice(0,7);
  upsertSummary_(APP.SHEETS.MONTHLY, month, getReport_('month', month));

  const year = businessDate.slice(0,4);
  upsertSummary_(APP.SHEETS.YEARLY, year, getReport_('year', year));
}

// Run once after deployment to repair historical summaries without changing source records.
function repairAllSummaries() {
  return reconcileReadModels();
}

function upsertSummary_(sheetName, key, report) {
  const sheet = ss_().getSheetByName(sheetName);
  const row = [
    key,
    report.orders,
    report.dishes,
    report.sales,
    report.bestSeller,
    JSON.stringify(report.items || []),
    new Date(),
    report.onlineSales,
    report.offlineSales
  ];

  const target = findKeyRow_(sheet, key);
  if (target) sheet.getRange(target,1,1,row.length).setValues([row]);
  else sheet.appendRow(row);
}

function rebuildExpenseSummary_(businessDate) {
  if (!businessDate) return;
  const report = getReport_('day', businessDate);
  const row = [
    businessDate,
    report.sales,
    report.operatingExpense,
    report.investmentExpense,
    report.totalExpense,
    report.operatingProfit,
    report.netCashProfit,
    report.onlineExpense,
    report.offlineExpense
  ];

  const sheet = ss_().getSheetByName(APP.SHEETS.EXPENSE_SUMMARY);
  const target = findKeyRow_(sheet, businessDate);
  if (target) sheet.getRange(target,1,1,row.length).setValues([row]);
  else sheet.appendRow(row);
}

function findKeyRow_(sheet, key) {
  if (!sheet || sheet.getLastRow() < 2) return 0;
  const keys = sheet.getRange(2,1,sheet.getLastRow()-1,1).getDisplayValues();
  for (let i=0; i<keys.length; i++) {
    if (String(keys[i][0]) === String(key)) return i + 2;
  }
  return 0;
}

function periodMatches_(businessDate, type, value) {
  if (!businessDate) return false;
  if (type === 'day') return businessDate === value;
  if (type === 'month') return businessDate.indexOf(value + '-') === 0;
  if (type === 'year') return businessDate.indexOf(value + '-') === 0;
  return false;
}

function validateReportInput_(type, value) {
  if (!['day','month','year'].includes(type)) throw new Error('Invalid report type.');
  if (type === 'day' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid day value.');
  if (type === 'month' && !/^\d{4}-\d{2}$/.test(value)) throw new Error('Invalid month value.');
  if (type === 'year' && !/^\d{4}$/.test(value)) throw new Error('Invalid year value.');
}

function normalizeBusinessDate_(value) {
  const s = formatDate_(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('Invalid business date.');
  return s;
}

function toDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, APP.TZ, 'yyyy-MM-dd');
  }
  const s = String(value == null ? '' : value).trim();
  const match = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : s;
}

function formatDateTime_(value) {
  if (!value) return '';
  const d = toDate_(value);
  if (d) return Utilities.formatDate(d, APP.TZ, 'dd MMM yyyy, hh:mm a');
  return String(value);
}

function formatTime_(value) {
  if (!value) return '';
  const d = toDate_(value);
  if (d) return Utilities.formatDate(d, APP.TZ, 'hh:mm a');
  const s = String(value).trim();
  const match = s.match(/(\d{1,2}:\d{2}\s?[AP]M)/i);
  return match ? match[1].toUpperCase() : s;
}

function formatNumber_(value) {
  return Number(value || 0).toLocaleString('en-IN');
}

function escapeHtml_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function getReportFolder_(value) {
  const root = getManagedFolder_(APP.REPORT_FOLDER);
  const year = String(value || Utilities.formatDate(new Date(), APP.TZ, 'yyyy')).slice(0,4);
  return getOrCreateChildFolder_(root, year);
}

function getStorageParentFolder_() {
  const settings = getSettings_();
  const name = String(settings.DriveParentFolderName || 'Surti Bite').trim() || 'Surti Bite';
  return getOrCreateChildFolder_(DriveApp.getRootFolder(), name);
}

function getFileNamePrefix_() {
  const settings = getSettings_();
  const prefix = String(settings.FileNamePrefix || settings.ShopName || 'Surti Bite').trim();
  return (prefix || 'Surti Bite').replace(/[\\/:*?"<>|]+/g, '-');
}

function fileNameSlug_(value) {
  return String(value || 'Surti Bite')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'Surti-Bite';
}

/**
 * Returns a managed child folder inside the configured Surti Bite parent.
 * Existing same-name folders at My Drive root are moved into the parent once.
 */
function getManagedFolder_(name) {
  const parent = getStorageParentFolder_();
  const nested = parent.getFoldersByName(name);
  if (nested.hasNext()) return nested.next();

  const rootMatches = DriveApp.getRootFolder().getFoldersByName(name);
  if (rootMatches.hasNext()) {
    const existing = rootMatches.next();
    existing.moveTo(parent);
    return existing;
  }

  return parent.createFolder(name);
}

function getOrCreateChildFolder_(parent, name) {
  const folders = parent.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return parent.createFolder(name);
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }
  if (sheet.getMaxRows() < 2) sheet.insertRowsAfter(sheet.getMaxRows(), 2 - sheet.getMaxRows());

  sheet.getRange(1,1,1,headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  return sheet;
}

function ensureOrderSchema_(sheet) {
  const cache = CacheService.getScriptCache();
  if (cache.get('orders-schema-v2')) return;

  const headers = APP.HEADERS.Orders;
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }
  sheet.getRange(1,1,1,headers.length).setValues([headers]);

  const orderTypes = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Dine-in','Takeaway'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2,13,Math.max(1,sheet.getMaxRows()-1),1).setDataValidation(orderTypes);
  sheet.setColumnWidth(13,100);
  sheet.setColumnWidth(14,150);
  cache.put('orders-schema-v2','ready',21600);
}

function setDefaultSettings_() {
  const defaults = {
    ShopName:'Surti Bite',
    Currency:'INR',
    CurrencySymbol:'₹',
    Timezone:'Asia/Kolkata',
    OrderPrefix:'SB',
    DriveParentFolderName:'Surti Bite',
    FileNamePrefix:'Surti Bite',
    ShowItemImages:'No',
    ShowItemDescriptions:'Yes',
    ShowOrderReference:'No',
    ShowTabToday:'Yes',
    ShowTabReports:'Yes',
    ShowTabHistory:'Yes',
    ShowTabExpenses:'Yes'
  };
  Object.keys(defaults).forEach(k => upsertSetting_(k, defaults[k]));
}

function upsertSetting_(key, value) {
  const sheet = ss_().getSheetByName(APP.SHEETS.SETTINGS);
  const row = findKeyRow_(sheet, key);
  if (row) {
    if (!String(sheet.getRange(row,2).getValue() || '').trim()) sheet.getRange(row,2).setValue(value);
  } else {
    sheet.appendRow([key,value]);
  }
}

function seedItemsIfEmpty_() {
  const sheet = ss_().getSheetByName(APP.SHEETS.ITEMS);
  if (sheet.getLastRow() >= 2) return;
  sheet.getRange(2,1,6,8).setValues([
    ['L001','Sada Locho','Locho',50,'Yes',1,'','Classic Surti Locho with authentic spices'],
    ['L002','Oil Locho','Locho',60,'Yes',2,'','Flavourful locho with special oil tadka'],
    ['L003','Butter Locho','Locho',80,'Yes',3,'','Rich and creamy with premium butter'],
    ['L004','Cheese Locho','Locho',100,'Yes',4,'','Delicious locho with melted cheese'],
    ['L005','Amul Cheese Butter Locho','Locho',120,'Yes',5,'','Cheese and butter locho'],
    ['L006','Double Cheese Locho','Locho',150,'Yes',6,'','Locho topped with extra cheese']
  ]);
}

function setValidations_() {
  const ss = ss_();
  const yesNo = SpreadsheetApp.newDataValidation().requireValueInList(['Yes','No'], true).setAllowInvalid(false).build();
  const payment = SpreadsheetApp.newDataValidation().requireValueInList(['Online','Offline'], true).setAllowInvalid(false).build();
  const sessionNames = SpreadsheetApp.newDataValidation().requireValueInList(['Morning','Evening','Other'], true).setAllowInvalid(false).build();
  const sessionStatus = SpreadsheetApp.newDataValidation().requireValueInList(['Open','Closed'], true).setAllowInvalid(false).build();
  const expenseType = SpreadsheetApp.newDataValidation().requireValueInList(['Operating','Investment'], true).setAllowInvalid(false).build();
  const orderTypes = SpreadsheetApp.newDataValidation().requireValueInList(['Dine-in','Takeaway'], true).setAllowInvalid(false).build();
  const frequency = SpreadsheetApp.newDataValidation().requireValueInList(['One-time','Daily','Weekly','Monthly','Other'], true).setAllowInvalid(false).build();
  const categories = SpreadsheetApp.newDataValidation().requireValueInList(['Ingredients','Packaging','Gas/Fuel','Transport','Rent','Utilities','Equipment','Marketing','Maintenance','Other'], true).setAllowInvalid(true).build();
  const expensePeople = SpreadsheetApp.newDataValidation().requireValueInList(['Biren','Denish','Tanvi','Chaitali'], true).setAllowInvalid(false).build();
  const settlementTypes = SpreadsheetApp.newDataValidation().requireValueInList(['Own funds','Advance used','Reimbursement due','Settled'], true).setAllowInvalid(false).build();

  ss.getSheetByName(APP.SHEETS.ITEMS).getRange('E2:E1000').setDataValidation(yesNo);
  ss.getSheetByName(APP.SHEETS.ORDERS).getRange('I2:I2000').setDataValidation(payment);
  ss.getSheetByName(APP.SHEETS.SESSIONS).getRange('C2:C500').setDataValidation(sessionNames);
  ss.getSheetByName(APP.SHEETS.SESSIONS).getRange('F2:F500').setDataValidation(sessionStatus);
  ss.getSheetByName(APP.SHEETS.EXPENSES).getRange('D2:D2000').setDataValidation(expenseType);
  ss.getSheetByName(APP.SHEETS.EXPENSES).getRange('E2:E2000').setDataValidation(frequency);
  ss.getSheetByName(APP.SHEETS.EXPENSES).getRange('F2:F2000').setDataValidation(categories);
  ss.getSheetByName(APP.SHEETS.EXPENSES).getRange('I2:I2000').setDataValidation(payment);
  ss.getSheetByName(APP.SHEETS.EXPENSES).getRange('M2:M2000').setDataValidation(expensePeople);
  ss.getSheetByName(APP.SHEETS.EXPENSES).getRange('N2:N2000').setDataValidation(settlementTypes);
  ss.getSheetByName(APP.SHEETS.EXPENSES).getRange('O2:O2000').setDataValidation(expensePeople);
  ss.getSheetByName(APP.SHEETS.SETTLEMENTS).getRange('E2:F2000').setDataValidation(expensePeople);
  ss.getSheetByName(APP.SHEETS.SETTLEMENTS).getRange('H2:H2000').setDataValidation(payment);
  const orders = ss.getSheetByName(APP.SHEETS.ORDERS);
  orders.getRange(2,13,Math.max(1,orders.getMaxRows()-1),1).setDataValidation(orderTypes);

  const settingsSheet = ss.getSheetByName(APP.SHEETS.SETTINGS);
  ['ShowItemImages','ShowItemDescriptions','ShowOrderReference','ShowTabToday','ShowTabReports','ShowTabHistory','ShowTabExpenses'].forEach(key => {
    const row = findKeyRow_(settingsSheet, key);
    if (row) settingsSheet.getRange(row,2).setDataValidation(yesNo);
  });
}

function formatSheets_() {
  const ss = ss_();
  Object.keys(APP.HEADERS).forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (!sheet) return;
    const width = APP.HEADERS[name].length;
    sheet.getRange(1,1,1,width)
      .setFontWeight('bold')
      .setBackground('#eeeeee');
  });

  const items = ss.getSheetByName(APP.SHEETS.ITEMS);
  items.setColumnWidth(2,190);
  items.setColumnWidth(7,300);
  items.setColumnWidth(8,280);

  const orders = ss.getSheetByName(APP.SHEETS.ORDERS);
  orders.setColumnWidth(13,100);
  orders.setColumnWidth(14,150);

  const expenses = ss.getSheetByName(APP.SHEETS.EXPENSES);
  expenses.setColumnWidth(7,220);
  expenses.setColumnWidth(12,220);
  expenses.setColumnWidths(13,3,120);
  expenses.setColumnWidth(16,110);
  expenses.getRange('P2:P').setNumberFormat('₹#,##0.00');
  const settlements = ss.getSheetByName(APP.SHEETS.SETTLEMENTS);
  settlements.setColumnWidth(4,180);
  settlements.setColumnWidths(5,2,110);
  settlements.setColumnWidth(9,220);
  settlements.getRange('G2:G').setNumberFormat('₹#,##0.00');

  // Orders already have a dedicated SaleTime column, so DateTime is displayed
  // as date-only there. Other timestamp columns display both date and time.
  const dateTimeFormat = 'dd/MM/yyyy hh:mm AM/PM';
  ss.getSheetByName(APP.SHEETS.ORDERS).getRange('B2:B').setNumberFormat('dd/MM/yyyy');
  ss.getSheetByName(APP.SHEETS.ORDERS).getRange('J2:J').setNumberFormat('dd/MM/yyyy');
  ss.getSheetByName(APP.SHEETS.SESSIONS).getRange('D2:E').setNumberFormat(dateTimeFormat);
  ss.getSheetByName(APP.SHEETS.EXPENSES).getRange('B2:B').setNumberFormat(dateTimeFormat);
  ss.getSheetByName(APP.SHEETS.SETTLEMENTS).getRange('B2:B').setNumberFormat(dateTimeFormat);
  ss.getSheetByName(APP.SHEETS.REQUESTS).getRange('C2:C').setNumberFormat(dateTimeFormat);
  ss.getSheetByName(APP.SHEETS.DAILY).getRange('G2:G').setNumberFormat(dateTimeFormat);
  ss.getSheetByName(APP.SHEETS.MONTHLY).getRange('G2:G').setNumberFormat(dateTimeFormat);
  ss.getSheetByName(APP.SHEETS.YEARLY).getRange('G2:G').setNumberFormat(dateTimeFormat);
}
