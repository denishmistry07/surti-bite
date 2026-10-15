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
    EXPENSE_SUMMARY: 'ExpenseSummary'
  },
  HEADERS: {
    Items: ['ItemID','ItemName','Category','Price','Active','SortOrder','ImageURL'],
    Orders: ['OrderID','DateTime','ItemID','ItemName','Qty','UnitPrice','Total','Status','PaymentMethod','BusinessDate','SaleTime','SessionID','OrderType','OrderFor'],
    Settings: ['Key','Value'],
    DailySummary: ['Date','Orders','Dishes','Sales','BestSeller','ItemJSON','UpdatedAt','OnlineSales','OfflineSales'],
    MonthlySummary: ['Month','Orders','Dishes','Sales','BestSeller','ItemJSON','UpdatedAt','OnlineSales','OfflineSales'],
    YearlySummary: ['Year','Orders','Dishes','Sales','BestSeller','ItemJSON','UpdatedAt','OnlineSales','OfflineSales'],
    RequestLog: ['ClientRequestID','OrderID','CreatedAt'],
    StoreSessions: ['SessionID','BusinessDate','SessionName','OpenTime','CloseTime','Status'],
    Expenses: ['ExpenseID','DateTime','BusinessDate','ExpenseType','Frequency','Category','Description','Amount','PaymentMethod','Vendor','SessionID','Notes'],
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
  setValidations_();
  seedItemsIfEmpty_();
  formatSheets_();
  // Create Drive folders now so Google requests Drive permission during setup.
  getOrCreateFolder_(APP.REPORT_FOLDER);
  getOrCreateFolder_(APP.BACKUP_FOLDER);
  const cache = CacheService.getScriptCache();
  cache.remove('items-v3');
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
    } else if (action === 'bootstrap') {
      result = {success:true, data:getBootstrap_()};
    } else if (action === 'items') {
      result = {success:true, data:getItemsPayload_()};
    } else if (action === 'session') {
      result = {success:true, data:getOpenSession_()};
    } else if (action === 'today') {
      result = {success:true, data:getToday_()};
    } else if (action === 'history') {
      result = {success:true, data:getHistory_(
        Number(p.offset || 0),
        Number(p.limit || 20)
      )};
    } else if (action === 'expenses') {
      result = {success:true, data:getExpenses_(
        String(p.businessDate || getActiveBusinessDate_())
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
    if (action === 'cancelOrder') return respond_({success:true, data:cancelOrder_(body.orderId)}, '');
    if (action === 'deleteOrder') return respond_({success:true, data:deleteOrder_(body.orderId)}, '');
    if (action === 'addExpense') return respond_({success:true, data:addExpense_(body)}, '');
    if (action === 'updateExpense') return respond_({success:true, data:updateExpense_(body)}, '');
    if (action === 'deleteExpense') return respond_({success:true, data:deleteExpense_(body.expenseId)}, '');
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
  const cached = cache.get('items-v3');
  if (cached) return JSON.parse(cached);

  const settings = getSettings_();
  const showImages = String(settings.ShowItemImages || 'No').toLowerCase() === 'yes';
  const sheet = ss_().getSheetByName(APP.SHEETS.ITEMS);
  if (!sheet || sheet.getLastRow() < 2) return {showImages:showImages, items:[]};

  const rows = sheet.getRange(2,1,sheet.getLastRow()-1,7).getValues();
  const items = rows
    .filter(r => String(r[4] || '').toLowerCase() === 'yes')
    .map(r => ({
      id: String(r[0] || ''),
      name: String(r[1] || ''),
      category: String(r[2] || 'Other'),
      price: Number(r[3]) || 0,
      sortOrder: Number(r[5]) || 999,
      imageUrl: showImages ? String(r[6] || '') : ''
    }))
    .filter(i => i.id && i.name)
    .sort((a,b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const payload = {showImages:showImages, items:items};
  cache.put('items-v3', JSON.stringify(payload), APP.CACHE_SECONDS);
  return payload;
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
        rebuildSummariesForBusinessDate_(businessDate);
        rebuildExpenseSummary_(businessDate);
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

    if (businessDate) {
      rebuildSummariesForBusinessDate_(businessDate);
      rebuildExpenseSummary_(businessDate);
    }

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

    if (businessDate) {
      rebuildSummariesForBusinessDate_(businessDate);
      rebuildExpenseSummary_(businessDate);
    }

    return {orderId:orderId, deleted:true, businessDate:businessDate};
  } finally {
    lock.releaseLock();
  }
}

function addExpense_(body) {
  return saveExpenseRow_(null, body);
}

function updateExpense_(body) {
  const expenseId = String(body.expenseId || '').trim();
  if (!expenseId) throw new Error('Expense ID required.');
  return saveExpenseRow_(expenseId, body);
}

function saveExpenseRow_(expenseId, body) {
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
    String(body.notes || '').trim()
  ];

  const sheet = ss_().getSheetByName(APP.SHEETS.EXPENSES);
  let oldBusinessDate = '';

  if (expenseId) {
    const rowIndex = findIdRow_(sheet, expenseId);
    if (!rowIndex) throw new Error('Expense not found.');
    oldBusinessDate = formatDate_(sheet.getRange(rowIndex,3).getValue());
    // Preserve the original created DateTime while updating the rest.
    rowValues[1] = sheet.getRange(rowIndex,2).getValue() || now;
    sheet.getRange(rowIndex,1,1,12).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  rebuildSummariesForBusinessDate_(businessDate);
  rebuildExpenseSummary_(businessDate);
  if (oldBusinessDate && oldBusinessDate !== businessDate) {
    rebuildSummariesForBusinessDate_(oldBusinessDate);
    rebuildExpenseSummary_(oldBusinessDate);
  }

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

    rebuildSummariesForBusinessDate_(businessDate);
    rebuildExpenseSummary_(businessDate);

    return {expenseId:expenseId, deleted:true};
  } finally {
    lock.releaseLock();
  }
}

function getExpenses_(businessDate) {
  businessDate = normalizeBusinessDate_(businessDate);
  const rows = getExpenseRows_()
    .filter(r => formatDate_(r[2]) === businessDate)
    .map(r => ({
      expenseId:String(r[0]),
      dateTime:formatDateTime_(r[1]),
      businessDate:formatDate_(r[2]),
      expenseType:String(r[3] || ''),
      frequency:String(r[4] || ''),
      category:String(r[5] || ''),
      description:String(r[6] || ''),
      amount:Number(r[7]) || 0,
      paymentMethod:String(r[8] || ''),
      vendor:String(r[9] || ''),
      sessionId:String(r[10] || ''),
      notes:String(r[11] || '')
    }))
    .sort((a,b) => b.dateTime.localeCompare(a.dateTime));

  return {
    businessDate:businessDate,
    items:rows,
    totals:calcExpenseTotals_(rows)
  };
}

function getToday_() {
  return getReport_('day', getActiveBusinessDate_());
}

function getReport_(type, value) {
  type = String(type || 'day');
  value = String(value || '');
  validateReportInput_(type, value);

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

    if (!itemMap[itemId]) itemMap[itemId] = {id:itemId, name:itemName, qty:0, sales:0};
    itemMap[itemId].qty += qty;
    itemMap[itemId].sales += total;

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

  return {
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
}

function getHistory_(offset, limit) {
  offset = Math.max(0, Number(offset) || 0);
  limit = Math.min(100, Math.max(1, Number(limit) || 20));

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

  const all = Object.keys(map)
    .map(k => map[k])
    .sort((a,b) => {
      const at = a.dateValue ? a.dateValue.getTime() : 0;
      const bt = b.dateValue ? b.dateValue.getTime() : 0;
      return bt - at;
    })
    .map(x => {
      delete x.dateValue;
      return x;
    });

  return {
    orders:all.slice(offset, offset + limit),
    nextOffset:(offset + limit < all.length) ? offset + limit : null
  };
}

function saveReportPdf_(body) {
  const type = String(body.type || 'day');
  const value = String(body.value || getActiveBusinessDate_());
  const report = getReport_(type, value);
  const settings = getSettings_();
  const html = buildReportHtml_(report, settings);

  const fileName = 'Surti-Bite-' + type + '-report-' + value + '.pdf';
  const blob = Utilities.newBlob(html, MimeType.HTML, fileName + '.html').getAs(MimeType.PDF).setName(fileName);
  const folder = getReportFolder_(value);
  const file = folder.createFile(blob).setName(fileName);

  return {
    fileId:file.getId(),
    fileName:file.getName(),
    url:file.getUrl(),
    folderName:folder.getName()
  };
}

function backupData_() {
  const now = new Date();
  const name = 'Surti Bite Backup ' + Utilities.formatDate(now, APP.TZ, 'yyyy-MM-dd HH-mm-ss');
  const folder = getOrCreateFolder_(APP.BACKUP_FOLDER);
  const source = DriveApp.getFileById(APP.SPREADSHEET_ID);
  const copy = source.makeCopy(name, folder);
  return {
    fileId:copy.getId(),
    fileName:copy.getName(),
    url:copy.getUrl(),
    folderName:folder.getName()
  };
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

function getOrderRows_() {
  const sheet = ss_().getSheetByName(APP.SHEETS.ORDERS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  ensureOrderSchema_(sheet);
  return sheet.getRange(2,1,sheet.getLastRow()-1,APP.HEADERS.Orders.length).getValues();
}

function getExpenseRows_() {
  const sheet = ss_().getSheetByName(APP.SHEETS.EXPENSES);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2,1,sheet.getLastRow()-1,12).getValues();
}

function getSessionMeta_() {
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
  return out;
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
  const root = getOrCreateFolder_(APP.REPORT_FOLDER);
  const year = String(value || Utilities.formatDate(new Date(), APP.TZ, 'yyyy')).slice(0,4);
  return getOrCreateChildFolder_(root, year);
}

function getOrCreateFolder_(name) {
  const folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(name);
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
    ShowItemImages:'No'
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
  sheet.getRange(2,1,6,7).setValues([
    ['L001','Sada Locho','Locho',50,'Yes',1,''],
    ['L002','Oil Locho','Locho',60,'Yes',2,''],
    ['L003','Butter Locho','Locho',80,'Yes',3,''],
    ['L004','Cheese Locho','Locho',100,'Yes',4,''],
    ['L005','Amul Cheese Butter Locho','Locho',120,'Yes',5,''],
    ['L006','Double Cheese Locho','Locho',150,'Yes',6,'']
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

  ss.getSheetByName(APP.SHEETS.ITEMS).getRange('E2:E1000').setDataValidation(yesNo);
  ss.getSheetByName(APP.SHEETS.ORDERS).getRange('I2:I2000').setDataValidation(payment);
  ss.getSheetByName(APP.SHEETS.SESSIONS).getRange('C2:C500').setDataValidation(sessionNames);
  ss.getSheetByName(APP.SHEETS.SESSIONS).getRange('F2:F500').setDataValidation(sessionStatus);
  ss.getSheetByName(APP.SHEETS.EXPENSES).getRange('D2:D2000').setDataValidation(expenseType);
  ss.getSheetByName(APP.SHEETS.EXPENSES).getRange('E2:E2000').setDataValidation(frequency);
  ss.getSheetByName(APP.SHEETS.EXPENSES).getRange('F2:F2000').setDataValidation(categories);
  ss.getSheetByName(APP.SHEETS.EXPENSES).getRange('I2:I2000').setDataValidation(payment);
  const orders = ss.getSheetByName(APP.SHEETS.ORDERS);
  orders.getRange(2,13,Math.max(1,orders.getMaxRows()-1),1).setDataValidation(orderTypes);

  const settingsSheet = ss.getSheetByName(APP.SHEETS.SETTINGS);
  const row = findKeyRow_(settingsSheet, 'ShowItemImages');
  if (row) settingsSheet.getRange(row,2).setDataValidation(yesNo);
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

  const orders = ss.getSheetByName(APP.SHEETS.ORDERS);
  orders.setColumnWidth(13,100);
  orders.setColumnWidth(14,150);

  const expenses = ss.getSheetByName(APP.SHEETS.EXPENSES);
  expenses.setColumnWidth(7,220);
  expenses.setColumnWidth(12,220);

  // Orders already have a dedicated SaleTime column, so DateTime is displayed
  // as date-only there. Other timestamp columns display both date and time.
  const dateTimeFormat = 'dd/MM/yyyy hh:mm AM/PM';
  ss.getSheetByName(APP.SHEETS.ORDERS).getRange('B2:B').setNumberFormat('dd/MM/yyyy');
  ss.getSheetByName(APP.SHEETS.ORDERS).getRange('J2:J').setNumberFormat('dd/MM/yyyy');
  ss.getSheetByName(APP.SHEETS.SESSIONS).getRange('D2:E').setNumberFormat(dateTimeFormat);
  ss.getSheetByName(APP.SHEETS.EXPENSES).getRange('B2:B').setNumberFormat(dateTimeFormat);
  ss.getSheetByName(APP.SHEETS.REQUESTS).getRange('C2:C').setNumberFormat(dateTimeFormat);
  ss.getSheetByName(APP.SHEETS.DAILY).getRange('G2:G').setNumberFormat(dateTimeFormat);
  ss.getSheetByName(APP.SHEETS.MONTHLY).getRange('G2:G').setNumberFormat(dateTimeFormat);
  ss.getSheetByName(APP.SHEETS.YEARLY).getRange('G2:G').setNumberFormat(dateTimeFormat);
}
