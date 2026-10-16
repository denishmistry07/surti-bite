window.Api = {
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
          try { delete window[callback]; } catch (_) { window[callback] = undefined; }
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

    return this.jsonp(action, {
      params,
      payload: body,
      retries,
      timeout
    });
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
    return this.request('openSession',{body});
  },

  closeSession(){
    return this.request('closeSession',{body:{}});
  },

  saveOrder(body){
    return this.request('saveOrder',{body});
  },

  cancelOrder(orderId){
    return this.request('cancelOrder',{body:{orderId}});
  },

  deleteOrder(orderId){
    return this.request('deleteOrder',{body:{orderId}});
  },

  addExpense(body){
    return this.request('addExpense',{body});
  },

  updateExpense(body){
    return this.request('updateExpense',{body});
  },

  deleteExpense(expenseId){
    return this.request('deleteExpense',{body:{expenseId}});
  },

  addSettlement(body){
    return this.request('addSettlement',{body});
  },

  saveItem(body){
    return this.request('saveItem',{body});
  },

  deleteItem(itemId){
    return this.request('deleteItem',{body:{itemId}});
  },

  saveReportPdf(type,value){
    return this.request('saveReportPdf',{body:{type,value},retries:0});
  },

  backupData(){
    return this.request('backupData',{body:{},retries:0});
  }
};
