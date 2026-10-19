window.Api = {
  pendingReads: new Map(),
  buildUrl(action, params = {}, payload = null, callback = '') {
    const base = String(APP_CONFIG.APPS_SCRIPT_URL || '').trim();

    if (!base || base.includes('PASTE_NEW_APPS_SCRIPT_EXEC_URL_HERE')) {
      throw new Error('Set the Apps Script /exec URL in js/config.js first.');
    }

    const url = new URL(base);
    url.searchParams.set('action', action);

    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });

    if (payload && Object.keys(payload).length) {
      url.searchParams.set('payload', JSON.stringify(payload));
    }

    if (callback) {
      url.searchParams.set('callback', callback);
    }

    // Prevent stale GET/script caching.
    url.searchParams.set('_ts', String(Date.now()));

    return url.toString();
  },

  jsonp(action, {
    params = {},
    payload = null,
    retries = APP_CONFIG.RETRIES,
    timeout = APP_CONFIG.TIMEOUT_MS
  } = {}) {
    return new Promise((resolve, reject) => {
      let attempt = 0;

      const run = () => {
        const callback = '__sb_jsonp_' +
          Date.now().toString(36) + '_' +
          Math.random().toString(36).slice(2);

        const script = document.createElement('script');
        let finished = false;

        const cleanup = () => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          if (script.parentNode) script.parentNode.removeChild(script);
          // Apps Script can finish after the browser timeout, especially on a cold start.
          // Keep a short-lived no-op callback so that a late JSONP response cannot throw
          // an uncaught ReferenceError in the page.
          const lateResponseGuard = () => {};
          window[callback] = lateResponseGuard;
          setTimeout(() => {
            if (window[callback] !== lateResponseGuard) return;
            try { delete window[callback]; } catch (_) { window[callback] = undefined; }
          },60000);
        };

        const fail = (error) => {
          cleanup();

          if (attempt < retries) {
            attempt++;
            setTimeout(run, 500 * attempt);
          } else {
            reject(error);
          }
        };

        window[callback] = (response) => {
          cleanup();

          if (!response || response.success !== true) {
            reject(new Error(response?.error || 'Request failed.'));
            return;
          }

          resolve(response.data ?? response);
        };

        script.async = true;
        script.src = this.buildUrl(action, params, payload, callback);
        script.onerror = () => fail(new Error('Could not reach Apps Script. Check deployment access and URL.'));

        const timer = setTimeout(
          () => fail(new Error('Apps Script request timed out.')),
          timeout
        );

        document.head.appendChild(script);
      };

      run();
    });
  },

  request(action, options = {}) {
    const {
      params = {},
      body = null,
      retries = APP_CONFIG.RETRIES,
      timeout = APP_CONFIG.TIMEOUT_MS
    } = options;

    const readOnly = ['bootstrap','manageItems','today','allTimeSales','history','expenses','report'].includes(action);
    const requestKey = readOnly ? JSON.stringify([action,params,timeout,retries]) : null;
    if (readOnly && this.pendingReads.has(requestKey)) return this.pendingReads.get(requestKey);

    const started = performance.now();
    const recordTiming = ok => {
      try{
        const samples=Store.get('sb.requestTimings',[]);
        samples.push({action,ms:Math.round(performance.now()-started),ok,at:Date.now()});
        Store.set('sb.requestTimings',samples.slice(-40));
      }catch(_){}
    };
    const request = this.jsonp(action, {
      params,
      payload: body,
      retries,
      timeout
    }).then(result=>{recordTiming(true);return result;},error=>{recordTiming(false);throw error;});
    if (!readOnly) return request;
    const shared = request.finally(() => this.pendingReads.delete(requestKey));
    this.pendingReads.set(requestKey,shared);
    return shared;
  },

  bootstrap(){ return this.request('bootstrap'); },
  manageItems(){ return this.request('manageItems'); },
  today(){ return this.request('today'); },
  allTimeSales(){ return this.request('allTimeSales'); },

  history(offset=0, filters={}){
    return this.request('history', {
      params:{offset, limit:APP_CONFIG.HISTORY_LIMIT, ...filters}
    });
  },

  expenses(value,period='day'){
    return this.request('expenses', {
      params:{value,period}
    });
  },

  report(type,value){
    return this.request('report', {
      params:{type,value}
    });
  },

  openSession(body){
    return this.request('openSession',{body,retries:0});
  },

  closeSession(){
    return this.request('closeSession',{body:{},retries:0});
  },

  saveOrder(body){
    return this.request('saveOrder',{body,retries:0});
  },

  updateOrder(body){
    return this.request('updateOrder',{body,retries:0});
  },

  cancelOrder(orderId){
    return this.request('cancelOrder',{body:{orderId},retries:0});
  },

  deleteOrder(orderId){
    return this.request('deleteOrder',{body:{orderId},retries:0});
  },

  addExpense(body){
    return this.request('addExpense',{body,retries:0});
  },

  updateExpense(body){
    return this.request('updateExpense',{body,retries:0});
  },

  deleteExpense(expenseId){
    return this.request('deleteExpense',{body:{expenseId},retries:0});
  },

  addSettlement(body){
    return this.request('addSettlement',{body,retries:0});
  },

  saveItem(body){
    return this.request('saveItem',{body,retries:0});
  },

  deleteItem(itemId){
    return this.request('deleteItem',{body:{itemId},retries:0});
  },

  updateNavigationSettings(body){
    return this.request('updateNavigationSettings',{body,retries:0});
  },

  saveReportPdf(type,value){
    return this.request('saveReportPdf',{body:{type,value},retries:0});
  },

  backupData(){
    return this.request('backupData',{body:{},retries:0});
  }
};
