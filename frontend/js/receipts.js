// Shared print flag comes from Settings; paper/layout details remain device-local.
window.Receipts = (()=>{
  const defaults={enabled:false,paper:'80',type:'customer',shop:'Surti Bite',address:'',phone:'',footer:'Thank you! Visit again.'};
  const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const amount=value=>Number(value||0).toLocaleString('en-IN',{maximumFractionDigits:2});
  let sharedEnabled=false;
  let savingFlag=false;
  const get=()=>({...defaults,...Store.get('sb.receiptSettings',{}),enabled:sharedEnabled});
  function applySettings(settings){
    if(savingFlag)return;
    sharedEnabled=String(settings.PrintBillEnabled||'No').trim().toLowerCase()==='yes';
    const input=document.querySelector('#receiptEnabled');
    if(input){input.checked=sharedEnabled;input.disabled=false;}
    const button=document.querySelector('#saveReceiptSettings');
    if(button)button.disabled=false;
  }
  let active=false,previousFocus=null;
  const queue=[];
  function toggleStatus(message,error=false){
    const status=document.querySelector('#receiptToggleStatus');
    if(status){status.textContent=message;status.dataset.state=error?'error':'info';}
  }
  async function saveSharedFlag(enabled){
    if(savingFlag)return;
    const input=document.querySelector('#receiptEnabled');
    const button=document.querySelector('#saveReceiptSettings');
    const note=document.querySelector('#receiptSettingsNote');
    savingFlag=true;input.disabled=true;button.disabled=true;button.textContent='Saving…';
    note.textContent='Saving print on/off to Google Sheets…';
    toggleStatus('Saving to Google Sheets…');
    try{
      const result=await Api.request('updatePrintSettings',{body:{PrintBillEnabled:enabled},retries:0});
      const stored=String(result?.settings?.PrintBillEnabled||'').trim().toLowerCase();
      if(stored!==(enabled?'yes':'no'))throw new Error('Server did not confirm the selected value. Check the deployed backend version.');
      sharedEnabled=enabled;
      note.textContent=`Printing ${enabled?'ON':'OFF'} — confirmed in Google Sheets. Other devices apply it after reloading.`;
      toggleStatus(`Saved: printing ${enabled?'ON':'OFF'}.`);
    }catch(error){
      const detail=/unknown action/i.test(error.message||'')
        ? 'Backend update required: deploy the latest Code.gs as a New version of the existing deployment, then reload.'
        : (error.message||'Check your connection and retry.');
      note.textContent='Print setting not saved. '+detail;
      toggleStatus(`Not saved — still ${sharedEnabled?'ON':'OFF'}. ${detail}`,true);
    }finally{
      savingFlag=false;input.checked=sharedEnabled;input.disabled=false;button.disabled=false;button.textContent='Save print settings';
    }
  }
  function bind(){
    const prefs=get();
    document.querySelector('#receiptEnabled').checked=prefs.enabled;
    document.querySelector('#receiptEnabled').disabled=true;
    document.querySelector('#saveReceiptSettings').disabled=true;
    document.querySelector('#receiptEnabled').onchange=event=>saveSharedFlag(event.target.checked);
    for(const key of ['paper','type','shop','address','phone','footer'])document.querySelector('#receiptSetting-'+key).value=prefs[key];
    document.querySelector('#saveReceiptSettings').onclick=async()=>{
      try{
      const enabled=document.querySelector('#receiptEnabled').checked;
      const values={};
      for(const key of ['paper','type','shop','address','phone','footer'])values[key]=document.querySelector('#receiptSetting-'+key).value.trim();
      values.shop=values.shop||defaults.shop;
      Store.set('sb.receiptSettings',values);
      await saveSharedFlag(enabled);
      }catch(error){document.querySelector('#receiptSettingsNote').textContent='Could not save shared print setting. '+(error.message||'Please try again.');}
    };
    document.querySelector('#receiptPrint').onclick=()=>window.print();
    document.querySelector('#receiptContinue').onclick=close;
    document.querySelector('#receiptClose').onclick=close;
    document.querySelector('#receiptBackdrop').onclick=close;
    document.addEventListener('keydown',event=>{
      if(!active)return;
      if(event.key==='Escape'){event.preventDefault();close();}
      if(event.key==='Tab'){
        const buttons=['#receiptClose','#receiptPrint','#receiptContinue'].map(selector=>document.querySelector(selector));
        const current=buttons.indexOf(document.activeElement);
        event.preventDefault();buttons[(current+(event.shiftKey?-1:1)+buttons.length)%buttons.length].focus();
      }
    });
  }
  function markup(order,prefs){
    const kitchen=prefs.type==='kitchen';
    const items=(order.items||[]).filter(item=>!kitchen||Number(item.qty)>0);
    return `<header class="receipt-heading"><h1>${escape(prefs.shop)}</h1>${prefs.address?`<p>${escape(prefs.address)}</p>`:''}${prefs.phone?`<p>${escape(prefs.phone)}</p>`:''}<h2>${kitchen?'KITCHEN SLIP':'CUSTOMER BILL'}</h2></header>
      <div class="receipt-meta"><strong>${escape(order.orderId)}</strong><div>${escape(order.dateTime||order.saleTime||'')}</div><div>${escape(order.orderType||'')}${order.orderFor?` · ${escape(order.orderFor)}`:''}</div><div>Business date: ${escape(order.businessDate||'')}</div></div>
      <table><thead><tr><th>Item</th><th>Qty</th>${kitchen?'':'<th>Rate</th><th>Amount</th>'}</tr></thead><tbody>${items.map(item=>{
        const qty=Number(item.qty)||0,total=Number(item.total)||0;
        return `<tr><td>${escape(item.name)}</td><td>${qty||'—'}</td>${kitchen?'':`<td>${qty?amount(total/qty):'—'}</td><td>${amount(total)}</td>`}</tr>`;
      }).join('')}</tbody></table>
      ${kitchen?'':`<div class="receipt-total"><span>Total</span><strong>₹${amount(order.totalAmount)}</strong></div><p>Payment: ${escape(order.paymentMethod||'')}</p>`}
      <p>Dishes: ${amount(order.totalQty)}</p>${!kitchen&&prefs.footer?`<footer>${escape(prefs.footer)}</footer>`:''}`;
  }
  function show(order){
    if(active){queue.push(order);return;}
    previousFocus=document.activeElement;
    active=true;
    const prefs=get(),overlay=document.querySelector('#receiptPreview'),sheet=document.querySelector('#receiptPaper');
    sheet.dataset.paper=prefs.paper;
    sheet.innerHTML=markup(order,prefs);
    document.querySelector('#receiptPageStyle').textContent=`@media print { @page { size: ${prefs.paper==='A4'?'A4':'auto'}; margin: ${prefs.paper==='A4'?'12mm':'0'}; } }`;
    overlay.classList.remove('hidden');
    document.body.classList.add('receipt-preview-open');
    document.querySelector('#receiptPrint').focus();
  }
  function close(){
    document.querySelector('#receiptPreview').classList.add('hidden');
    document.body.classList.remove('receipt-preview-open');
    active=false;
    if(queue.length)show(queue.shift());else previousFocus?.focus();
  }
  async function saved(orderId,confirmedOrder){
    try{
      if(confirmedOrder && confirmedOrder.orderId===orderId && Array.isArray(confirmedOrder.items)){
        show(confirmedOrder);
        return;
      }
      // Compatibility fallback for older deployments and idempotent duplicate responses.
      const data=await Api.history(0,{q:orderId});
      const order=(data.orders||[]).find(item=>item.orderId===orderId);
      if(!order)throw new Error('Receipt not found');
      show(order);
    }catch(_){
      // The sale has already synced. Receipt lookup failure must not retry the sale.
      document.querySelector('#receiptSettingsNote').textContent='Order saved. Receipt could not load; use Print in History to retry.';
      if(typeof toast==='function')toast('Order saved. Use Print in History to retry the receipt.',true);
    }
  }
  return {bind,get,applySettings,show,saved,markup};
})();
