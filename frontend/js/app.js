const state = {
  settings:{},
  items:[],
  adminItems:[],
  showImages:false,
  showItemDescriptions:true,
  showOrderReference:false,
  session:null,
  cart:Store.get('sb.cart',{}),
  payment:Store.get('sb.payment','Online'),
  openOrders:Store.get('sb.openOrders',[]),
  activeOrderId:Store.get('sb.activeOrderId',''),
  orderType:'Dine-in',
  orderFor:'',
  activeCategory:'All',
  itemView:Store.get('sb.itemView','grid') === 'list' ? 'list' : 'grid',
  search:'',
  historyOffset:0,
  nextHistoryOffset:null,
  historyLoading:false,
  loadingViews:new Set(),
  historyFilters:{q:'', from:'', to:'', payment:'', orderType:'', status:'', minAmount:'', maxAmount:'', sort:'newest'},
  reportType:'day',
  saving:false,
  expenses:[],
  expensePaidByFilter:'All',
  expensePaymentFilter:'All',
  expenseTypeFilter:'All',
  expenseSettlementFilter:'All',
  expensePeriod:'day',
  expensePeriodValue:'',
  expenseVisibleCount:20,
  editingExpenseId:'',
  report:null
};

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

document.addEventListener('DOMContentLoaded', init);

async function init(){
  initializeOpenOrders();
  bind();
  enhanceCustomControls(document);
  observeCartSheetSize();
  renderCart();
  renderOpenOrders();
  setDefaultReportInput();
  setOffline(!navigator.onLine);
  initializeLazyLoading();

  window.addEventListener('online',()=>setOffline(false));
  window.addEventListener('offline',()=>setOffline(true));

  await bootstrap();
}

function setViewLoading(view,loading,label='Loading data…'){
  const section = $('#view-'+view);
  if (!section) return;
  let loader = $('#globalViewLoader');
  if (!loader){
    loader = document.createElement('div');
    loader.id = 'globalViewLoader';
    loader.className = 'view-loader hidden';
    loader.innerHTML = '<span class="loader-spinner" aria-hidden="true"></span><strong></strong>';
    document.body.appendChild(loader);
  }
  if (loading) state.loadingViews.add(view);
  else state.loadingViews.delete(view);
  if (loading) loader.querySelector('strong').textContent = label;
  loader.classList.toggle('hidden',state.loadingViews.size === 0);
  section.setAttribute('aria-busy',String(loading));
}

function initializeLazyLoading(){
  if (!('IntersectionObserver' in window)) return;
  const loadMore = $('#loadMore');
  const loadMoreExpenses = $('#loadMoreExpenses');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting || entry.target.classList.contains('hidden')) return;
      if (entry.target === loadMore) loadMoreHistory();
      if (entry.target === loadMoreExpenses) loadMoreExpenseCards();
    });
  },{rootMargin:'240px 0px'});
  if (loadMore) observer.observe(loadMore);
  if (loadMoreExpenses) observer.observe(loadMoreExpenses);
}

function observeCartSheetSize(){
  if (!('ResizeObserver' in window)) return;
  const panel = $('#cartSheet .sheet-panel');
  if (!panel) return;
  const observer = new ResizeObserver(() => {
    if (!$('#cartSheet').classList.contains('hidden')) adjustCartSheetSpace();
  });
  observer.observe(panel);
}

function bind(){
  $$('.nav-item').forEach(b => b.onclick = () => showView(b.dataset.view));

  $('#searchToggle').onclick = toggleSearch;

  $('#search').oninput = e => {
    state.search = e.target.value.toLowerCase().trim();
    renderItems();
  };

  $('#items').onclick = e => {
    const button = e.target.closest('[data-step]');
    if (!button) return;
    changeQty(button.dataset.id, button.dataset.step === 'plus' ? 1 : -1);
  };

  $('#categories').onclick = e => {
    const button = e.target.closest('[data-category]');
    if (!button) return;
    state.activeCategory = button.dataset.category;
    renderCategories();
    renderItems();
  };

  $$('.view-mode-btn').forEach(button => button.onclick = () => {
    state.itemView = button.dataset.itemView === 'list' ? 'list' : 'grid';
    Store.set('sb.itemView',state.itemView);
    renderItems();
  });

  $('#newOpenOrder').onclick = startNewOpenOrder;
  $('#activateSessionBtn').onclick = renderSessionSheet;
  $('#openOrderTabs').onclick = e => {
    const remove = e.target.closest('[data-remove-open-order]');
    const select = e.target.closest('[data-open-order]');
    if (remove) removeOpenOrder(remove.dataset.removeOpenOrder);
    else if (select) switchOpenOrder(select.dataset.openOrder);
  };

  $$('.order-type').forEach(button => button.onclick = () => {
    state.orderType = button.dataset.orderType;
    persistCart();
    renderOrderContext();
    renderOpenOrders();
  });

  $('#orderFor').oninput = e => {
    state.orderFor = e.target.value;
    persistCart();
    renderOpenOrders();
  };

  $('#cartDetailsToggle').onclick = toggleCartDetails;
  $('#clearCart').onclick = async () => {
    if (!Object.keys(state.cart).length) return;
    if (!await showConfirm('Clear the current order?', {
      title:'Clear current order', confirmText:'Clear order', danger:true
    })) return;
    state.cart = {};
    persistCart();
    renderItems();
    renderCart();
  };

  $('#confirmCancel').onclick = () => resolveConfirm(false);
  $('#confirmBackdrop').onclick = () => resolveConfirm(false);
  $('#confirmAccept').onclick = () => resolveConfirm(true);
  $('#datePickerBackdrop').onclick = closeDatePicker;
  $('#calendarCancel').onclick = closeDatePicker;
  $('#calendarToday').onclick = () => selectCalendarDate(new Date());
  $('#calendarPrev').onclick = () => changeCalendarMonth(-1);
  $('#calendarNext').onclick = () => changeCalendarMonth(1);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('#confirmModal').classList.contains('hidden')) resolveConfirm(false);
    if (e.key === 'Escape' && !$('#datePickerModal').classList.contains('hidden')) closeDatePicker();
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.custom-select')) closeCustomSelects();
    if (!e.target.closest('.category-combobox')) closeMenuCategoryDropdown();
  });

  $$('[data-close-sheet]').forEach(x => x.onclick = closeSheets);

  $$('.pay').forEach(b => b.onclick = () => {
    state.payment = b.dataset.pay;
    Store.set('sb.payment',state.payment);
    persistCart();
    renderPayment();
  });

  $('#saveOrder').onclick = saveOrder;
  $('#sessionBtn').onclick = renderSessionSheet;
  $('#businessDateBtn').onclick = renderSessionSheet;
  $('#refreshToday').onclick = loadToday;
  $('#openMenuManager').onclick = openMenuManager;
  $('#newMenuItem').onclick = () => openMenuItemForm();
  $('#cancelMenuItem').onclick = closeMenuItemForm;
  $('#saveMenuItem').onclick = saveMenuItem;
  $('#menuItemCategory').onfocus = () => openMenuCategoryDropdown();
  $('#menuItemCategory').oninput = e => openMenuCategoryDropdown(e.target.value);
  $('#menuCategoryToggle').onclick = e => {
    e.stopPropagation();
    const menu = $('#menuCategoryOptions');
    if (menu.classList.contains('hidden')) openMenuCategoryDropdown($('#menuItemCategory').value);
    else closeMenuCategoryDropdown();
  };
  $('#menuCategoryOptions').onclick = e => {
    const option = e.target.closest('[data-menu-category]');
    if (!option) return;
    $('#menuItemCategory').value = option.dataset.menuCategory;
    closeMenuCategoryDropdown();
  };
  $('#menuManagerList').onclick = e => {
    const edit = e.target.closest('[data-edit-menu-item]');
    const del = e.target.closest('[data-delete-menu-item]');
    if (edit) openMenuItemForm(state.adminItems.find(item => item.id === edit.dataset.editMenuItem));
    if (del) deleteMenuItem(del.dataset.deleteMenuItem);
  };

  $('#openExpense').onclick = () => openExpenseForm();
  $('#cancelExpenseEdit').onclick = () => resetExpenseForm();
  $('#saveExpense').onclick = saveExpense;
  $('#expenseSettlementType').onchange = renderSettlementFields;
  $('#expensePaidBy').onchange = () => {
    if ($('#expenseSettlementType').value === 'Own funds') $('#expenseFundOwner').value = $('#expensePaidBy').value;
    syncCustomSelect($('#expenseFundOwner'));
  };

  $('#expenseList').onclick = e => {
    const edit = e.target.closest('[data-edit-expense]');
    const del = e.target.closest('[data-delete-expense]');
    const settle = e.target.closest('[data-settle-expense]');
    if (settle) return openSettlementForm(settle.dataset.settleExpense);
    if (edit) editExpense(edit.dataset.editExpense);
    if (del) deleteExpense(del.dataset.deleteExpense);
  };
  $('#saveSettlement').onclick = saveSettlement;
  $('#expenseFilterToggle').onclick = () => $('#expenseFilterPanel').classList.toggle('hidden');
  $('#expensePeriodValue').onchange = e => {
    state.expensePeriodValue = e.target.value;
    loadExpenses();
  };
  $('#expensePeriodTabs').onclick = e => {
    const button = e.target.closest('[data-expense-period]');
    if (!button) return;
    setExpensePeriod(button.dataset.expensePeriod);
  };
  $('#expensePayerFilters').onclick = e => {
    const button = e.target.closest('[data-expense-payer]');
    if (!button) return;
    state.expensePaidByFilter = button.dataset.expensePayer;
    state.expenseVisibleCount = 20;
    renderExpenses();
  };
  $('#expensePaymentFilters').onclick = e => {
    const button = e.target.closest('[data-expense-payment]');
    if (!button) return;
    state.expensePaymentFilter = button.dataset.expensePayment;
    state.expenseVisibleCount = 20;
    renderExpenses();
  };
  $('#expenseTypeFilters').onclick = e => {
    const button = e.target.closest('[data-expense-type]');
    if (!button) return;
    state.expenseTypeFilter = button.dataset.expenseType;
    state.expenseVisibleCount = 20;
    renderExpenses();
  };
  $('#expenseSettlementFilters').onclick = e => {
    const button = e.target.closest('[data-expense-settlement]');
    if (!button) return;
    state.expenseSettlementFilter = button.dataset.expenseSettlement;
    state.expenseVisibleCount = 20;
    renderExpenses();
  };
  $('#loadMoreExpenses').onclick = loadMoreExpenseCards;

  $('#history').onclick = e => {
    const cancel = e.target.closest('[data-cancel-order]');
    const del = e.target.closest('[data-delete-order]');
    if (cancel) cancelOrder(cancel.dataset.cancelOrder);
    if (del) deleteOrder(del.dataset.deleteOrder);
  };

  $('#loadMore').onclick = loadMoreHistory;
  $('#historyFilterToggle').onclick = () => $('#historyFilters').classList.toggle('hidden');
  $('#applyHistoryFilters').onclick = applyHistoryFilters;
  $('#clearHistoryFilters').onclick = clearHistoryFilters;
  $('#historyQuery').onkeydown = e => { if (e.key === 'Enter') applyHistoryFilters(); };
  $('#loadReport').onclick = loadReport;
  $('#saveReportPdf').onclick = saveReportPdf;
  $('#backupData').onclick = backupData;

  $$('#view-reports .segment').forEach(b => b.onclick = () => setReportType(b.dataset.report));
}

async function bootstrap(){
  setViewLoading('order',true,'Loading menu…');
  try{
    const data = await Api.bootstrap();
    state.settings = data.settings || {};
    state.items = data.items || [];
    state.showImages = Boolean(data.showImages) || String(state.settings.ShowItemImages || 'No').toLowerCase() === 'yes';
    state.showItemDescriptions = String(state.settings.ShowItemDescriptions || 'Yes').toLowerCase() === 'yes';
    state.showOrderReference = String(state.settings.ShowOrderReference || 'No').toLowerCase() === 'yes';
    state.session = data.session || null;

    renderSessionButton();
    renderSessionWarning();
    renderCategories();
    renderItems();
    renderCart();
  }catch(e){
    toast(e.message || 'Could not connect to server.', true);
  }finally{
    setViewLoading('order',false);
  }
}

function showView(view){
  $$('.view').forEach(v => v.classList.remove('active'));
  $('#view-'+view).classList.add('active');
  document.body.classList.toggle('menu-view-active',view === 'menu');
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  if (view !== 'order') setSearchOpen(false);
  ensureCartSheetVisible();

  if (view === 'today') loadToday();
  if (view === 'history') loadHistory(true);
  if (view === 'expenses') loadExpenses();
  if (view === 'reports') loadReport();
  if (view === 'menu') loadMenuManager();
}

function toggleSearch(){
  if (!$('#view-order').classList.contains('active')) showView('order');
  setSearchOpen(!$('#searchRow').classList.contains('open'));
}

function setSearchOpen(open){
  const row = $('#searchRow');
  const button = $('#searchToggle');
  row.classList.toggle('open',open);
  button.classList.toggle('active',open);
  button.setAttribute('aria-expanded',String(open));
  if (open) window.setTimeout(() => $('#search').focus(),180);
}

function renderCategories(){
  const categories = ['All',...new Set(state.items.map(i => i.category || 'Other'))];
  if (!categories.includes(state.activeCategory)) state.activeCategory = 'All';

  $('#categories').innerHTML = categories.map(c =>
    `<button class="chip ${c === state.activeCategory ? 'active' : ''}" data-category="${esc(c)}">${esc(c)}</button>`
  ).join('');
}

function visibleItems(){
  return state.items.filter(item => {
    const inCategory = state.activeCategory === 'All' || item.category === state.activeCategory;
    const matchesSearch = !state.search || item.name.toLowerCase().includes(state.search);
    return inCategory && matchesSearch;
  });
}

function renderItems(){
  const list = visibleItems();
  $('#emptyItems').classList.toggle('hidden',!!list.length);
  const container = $('#items');
  container.classList.toggle('list-view',state.itemView === 'list');
  $$('.view-mode-btn').forEach(button => {
    const active = button.dataset.itemView === state.itemView;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });

  const groups = [];
  list.forEach(item => {
    const category = item.category || 'Other';
    let group = groups.find(entry => entry.category === category);
    if (!group){
      group = {category:category,items:[]};
      groups.push(group);
    }
    group.items.push(item);
  });

  container.innerHTML = groups.map(group => `<section class="menu-category-section">
    <div class="menu-category-heading"><span>${esc(group.category)}</span></div>
    <div class="items-grid">${group.items.map(item => {
    const qty = Number(state.cart[item.id] || 0);
    const image = state.showImages && item.imageUrl
      ? `<img class="item-image" loading="lazy" decoding="async" src="${esc(item.imageUrl)}" alt="${esc(item.name)}">`
      : '';
    const description = state.showItemDescriptions && item.description
      ? `<div class="item-desc">${esc(item.description)}</div>`
      : '';

    return `<article class="item-card ${qty ? 'selected' : ''}" data-item-card="${esc(item.id)}">
      ${image}
      <div class="item-card-content">
        <div class="item-name">${esc(item.name)}</div>
        <div class="item-price">₹${money(item.price)}</div>
        ${description}
      </div>
      <div class="qty-row">
        <div class="card-stepper" aria-label="Quantity for ${esc(item.name)}">
          <button class="qty-btn" data-step="minus" data-id="${esc(item.id)}" aria-label="Remove one ${esc(item.name)}">−</button>
          <div class="qty-num">${qty}</div>
          <button class="qty-btn plus" data-step="plus" data-id="${esc(item.id)}" aria-label="Add one ${esc(item.name)}">+</button>
        </div>
        <button class="add-btn" data-step="plus" data-id="${esc(item.id)}">Add</button>
      </div>
    </article>`;
    }).join('')}</div>
  </section>`).join('');
}

function openMenuManager(){
  showView('menu');
}

async function loadMenuManager(){
  closeMenuItemForm();
  $('#menuManagerList').innerHTML = '<div class="menu-manager-loading"><span class="loader-spinner"></span><strong>Loading items…</strong></div>';
  try{
    const data = await Api.manageItems();
    state.adminItems = data.items || [];
    renderMenuCategoryOptions();
    renderMenuManager();
  }catch(e){
    $('#menuManagerList').innerHTML = '<div class="empty">Could not load menu items.</div>';
    toast(e.message || 'Could not load menu items.',true);
  }
}

function menuCategories(){
  return [...new Set(state.adminItems.map(item => String(item.category || '').trim()).filter(Boolean))]
    .sort((a,b) => a.localeCompare(b));
}

function renderMenuCategoryOptions(filter=''){
  const query = String(filter || '').trim().toLowerCase();
  const categories = menuCategories().filter(category => !query || category.toLowerCase().includes(query));
  $('#menuCategoryOptions').innerHTML = categories.length
    ? categories.map(category => `<button class="category-dropdown-option" data-menu-category="${esc(category)}" type="button" role="option">${esc(category)}</button>`).join('')
    : '<div class="category-dropdown-empty">Type to create this new category</div>';
}

function openMenuCategoryDropdown(filter=''){
  renderMenuCategoryOptions(filter);
  $('#menuCategoryOptions').classList.remove('hidden');
  $('#menuItemCategory').setAttribute('aria-expanded','true');
  $('#menuCategoryToggle').classList.add('open');
}

function closeMenuCategoryDropdown(){
  $('#menuCategoryOptions')?.classList.add('hidden');
  $('#menuItemCategory')?.setAttribute('aria-expanded','false');
  $('#menuCategoryToggle')?.classList.remove('open');
}

function renderMenuManager(){
  if (!state.adminItems.length){
    $('#menuManagerList').innerHTML = '<div class="empty">No menu items. Add your first item.</div>';
    return;
  }
  const groups = [];
  state.adminItems.forEach(item => {
    const category = item.category || 'Other';
    let group = groups.find(entry => entry.category === category);
    if (!group){ group = {category,items:[]}; groups.push(group); }
    group.items.push(item);
  });
  $('#menuManagerList').innerHTML = groups.map(group => `<section class="menu-manager-category">
    <div class="menu-manager-category-title"><strong>${esc(group.category)}</strong><span>${group.items.length} item${group.items.length === 1 ? '' : 's'}</span></div>
    <div class="menu-manager-category-items">${group.items.map(item => `
      <div class="menu-manager-row ${item.active === 'No' ? 'inactive' : ''}">
        <div><strong>${esc(item.name)}</strong><small>${esc(item.id)} · Sort ${money(item.sortOrder)}${item.active === 'No' ? ' · Inactive' : ''}</small></div>
        <strong>₹${money(item.price)}</strong>
        <button class="small-btn" data-edit-menu-item="${esc(item.id)}" type="button">Edit</button>
        <button class="small-btn danger-text" data-delete-menu-item="${esc(item.id)}" type="button">Delete</button>
      </div>`).join('')}</div>
  </section>`).join('');
}

function openMenuItemForm(item=null){
  const value = item || {};
  $('#menuOriginalItemId').value = value.id || '';
  $('#menuItemId').value = value.id || '';
  $('#menuItemName').value = value.name || '';
  $('#menuItemCategory').value = value.category || '';
  $('#menuItemPrice').value = value.price ?? '';
  $('#menuItemActive').value = value.active || 'Yes';
  $('#menuItemSortOrder').value = value.sortOrder ?? (state.adminItems.length + 1);
  $('#menuItemImageUrl').value = value.imageUrl || '';
  $('#menuItemDescription').value = value.description || '';
  $('#menuItemForm').classList.remove('hidden');
  $('#menuManagerList').classList.add('hidden');
  $('#newMenuItem').classList.add('hidden');
  $('#saveMenuItem').textContent = item ? 'Update item' : 'Save item';
  syncCustomSelects();
  window.setTimeout(() => $('#menuItemName').focus(),100);
}

function closeMenuItemForm(){
  $('#menuItemForm').classList.add('hidden');
  $('#menuManagerList').classList.remove('hidden');
  $('#newMenuItem').classList.remove('hidden');
}

async function refreshMenuItems(){
  const data = await Api.bootstrap();
  state.items = data.items || [];
  state.showImages = Boolean(data.showImages) || String(state.settings.ShowItemImages || 'No').toLowerCase() === 'yes';
  renderCategories();
  renderItems();
}

async function saveMenuItem(){
  const body = {
    originalItemId:$('#menuOriginalItemId').value.trim(), itemId:$('#menuItemId').value.trim(),
    name:$('#menuItemName').value.trim(), category:$('#menuItemCategory').value.trim(),
    price:Number($('#menuItemPrice').value), active:$('#menuItemActive').value,
    sortOrder:Number($('#menuItemSortOrder').value), imageUrl:$('#menuItemImageUrl').value.trim(),
    description:$('#menuItemDescription').value.trim()
  };
  if (!body.itemId || !body.name || !body.category || !(body.price >= 0)) return toast('Complete Item ID, name, category and price.',true);
  const button = $('#saveMenuItem');
  try{
    button.disabled = true; button.textContent = 'Saving…';
    await Api.saveItem(body);
    await refreshMenuItems();
    const managed = await Api.manageItems();
    state.adminItems = managed.items || [];
    renderMenuCategoryOptions();
    closeMenuItemForm(); renderMenuManager(); toast(body.originalItemId ? 'Item updated.' : 'Item added.');
  }catch(e){ toast(e.message || 'Could not save item.',true); }
  finally{ button.disabled = false; button.textContent = body.originalItemId ? 'Update item' : 'Save item'; }
}

async function deleteMenuItem(itemId){
  const item = state.adminItems.find(x => x.id === itemId);
  if (!item || !await showConfirm(`Delete “${item.name}” from the menu? Past orders will remain unchanged.`,{title:'Delete menu item',confirmText:'Delete',danger:true})) return;
  try{
    await Api.deleteItem(itemId);
    state.adminItems = state.adminItems.filter(x => x.id !== itemId);
    renderMenuCategoryOptions();
    await refreshMenuItems(); renderMenuManager(); toast('Item deleted.');
  }catch(e){ toast(e.message || 'Could not delete item.',true); }
}

function changeQty(id, delta){
  state.cart[id] = Math.max(0, Number(state.cart[id] || 0) + delta);
  if (!state.cart[id]) delete state.cart[id];
  persistCart();
  updateItemCard(id);
  renderCart();
}

function updateItemCard(id){
  const card = $$('[data-item-card]').find(x => x.dataset.itemCard === String(id));
  if (!card) return;
  const qty = Number(state.cart[id] || 0);
  card.classList.toggle('selected', qty > 0);
  const value = card.querySelector('.qty-num');
  if (value) value.textContent = qty;
}

function persistCart(){
  Store.set('sb.cart',state.cart);
  const order = state.openOrders.find(item => item.id === state.activeOrderId);
  if (order){
    order.cart = {...state.cart};
    order.payment = state.payment;
    order.orderType = state.orderType;
    order.orderFor = state.orderFor;
    order.updatedAt = new Date().toISOString();
  }
  persistOpenOrders();
}

function newOpenOrderRecord(seed={}){
  return {
    id:'OPEN-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,7).toUpperCase(),
    status:'Open',
    orderFor:String(seed.orderFor || ''),
    orderType:seed.orderType === 'Takeaway' ? 'Takeaway' : 'Dine-in',
    cart:{...(seed.cart || {})},
    payment:seed.payment === 'Offline' ? 'Offline' : 'Online',
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };
}

function initializeOpenOrders(){
  if (!Array.isArray(state.openOrders)) state.openOrders = [];
  state.openOrders = state.openOrders.filter(order => order && order.id && order.status !== 'Closed');

  if (!state.openOrders.length){
    state.openOrders.push(newOpenOrderRecord({cart:state.cart,payment:state.payment}));
  }

  if (!state.openOrders.some(order => order.id === state.activeOrderId)){
    state.activeOrderId = state.openOrders[0].id;
  }
  loadActiveOpenOrder(false);
}

function persistOpenOrders(){
  Store.set('sb.openOrders',state.openOrders);
  Store.set('sb.activeOrderId',state.activeOrderId);
}

function loadActiveOpenOrder(shouldRender=true){
  const order = state.openOrders.find(item => item.id === state.activeOrderId) || state.openOrders[0];
  if (!order) return;
  state.activeOrderId = order.id;
  state.cart = {...(order.cart || {})};
  state.payment = order.payment === 'Offline' ? 'Offline' : 'Online';
  state.orderType = order.orderType === 'Takeaway' ? 'Takeaway' : 'Dine-in';
  state.orderFor = String(order.orderFor || '');
  Store.set('sb.cart',state.cart);
  Store.set('sb.payment',state.payment);
  persistOpenOrders();

  if (shouldRender){
    renderItems();
    renderCart();
    renderOpenOrders();
  }
}

function switchOpenOrder(id){
  if (state.saving) return;
  if (id === state.activeOrderId) return;
  persistCart();
  state.activeOrderId = id;
  loadActiveOpenOrder();
}

function startNewOpenOrder(){
  if (state.saving) return;
  persistCart();
  const current = state.openOrders.find(order => order.id === state.activeOrderId);
  const currentHasItems = current && Object.keys(current.cart || {}).length;
  if (current && !currentHasItems && !String(current.orderFor || '').trim()){
    toast('The current open order is still empty.');
    return;
  }
  const order = newOpenOrderRecord();
  state.openOrders.push(order);
  state.activeOrderId = order.id;
  loadActiveOpenOrder();
}

async function removeOpenOrder(id){
  if (state.saving) return;
  const order = state.openOrders.find(item => item.id === id);
  if (!order) return;
  const label = String(order.orderFor || '').trim() || 'this open order';
  if (Object.keys(order.cart || {}).length && !await showConfirm(`Discard ${label}?`, {
    title:'Discard open order', confirmText:'Discard', danger:true
  })) return;

  state.openOrders = state.openOrders.filter(item => item.id !== id);
  if (!state.openOrders.length) state.openOrders.push(newOpenOrderRecord());
  if (state.activeOrderId === id) state.activeOrderId = state.openOrders[0].id;
  loadActiveOpenOrder();
}

function closeActiveOpenOrder(closedId=state.activeOrderId){
  state.openOrders = state.openOrders.filter(order => order.id !== closedId);
  if (!state.openOrders.length) state.openOrders.push(newOpenOrderRecord());
  if (state.activeOrderId === closedId) state.activeOrderId = state.openOrders[0].id;
  loadActiveOpenOrder(false);
  persistOpenOrders();
}

function renderOpenOrders(){
  const host = $('#openOrderTabs');
  if (!host) return;
  host.innerHTML = state.openOrders.map((order,index) => {
    const qty = Object.values(order.cart || {}).reduce((sum,value) => sum + (Number(value) || 0), 0);
    const label = String(order.orderFor || '').trim() || `${order.orderType || 'Dine-in'} ${index + 1}`;
    const active = order.id === state.activeOrderId;
    return `<div class="open-order-chip ${active ? 'active' : ''}">
      <button type="button" data-open-order="${esc(order.id)}"><span>${esc(label)}</span><small>${qty} ${qty === 1 ? 'dish' : 'dishes'}</small></button>
      <button type="button" class="open-order-remove" data-remove-open-order="${esc(order.id)}" aria-label="Discard ${esc(label)}">×</button>
    </div>`;
  }).join('');
}

function renderOrderContext(){
  $$('.order-type').forEach(button => {
    button.classList.toggle('active',button.dataset.orderType === state.orderType);
    button.disabled = state.saving;
  });

  const input = $('#orderFor');
  if (input){
    const showReference = Boolean(state.showOrderReference);
    input.classList.toggle('hidden', !showReference);

    if (!showReference){
      if (state.orderFor){
        state.orderFor = '';
        syncActiveOpenOrder();
      }
      input.value = '';
      input.disabled = true;
    }else{
      if (input.value !== state.orderFor) input.value = state.orderFor;
      input.disabled = state.saving;
    }
  }
}

function cartLines(){
  return state.items
    .filter(i => state.cart[i.id])
    .map(i => ({...i,qty:Number(state.cart[i.id]),total:Number(state.cart[i.id]) * Number(i.price)}));
}

function renderCart(){
  const lines = cartLines();
  const qty = lines.reduce((sum,i) => sum + i.qty,0);
  const total = lines.reduce((sum,i) => sum + i.total,0);

  $('#sheetQty').textContent = qty;
  $('#sheetTotal').textContent = '₹' + money(total);

  const titleCount = $('#cartTitleCount');
  if (titleCount) titleCount.textContent = `(${lines.length} ${lines.length === 1 ? 'item' : 'items'})`;

  const saveOrderTotal = $('#saveOrderTotal');
  if (saveOrderTotal) saveOrderTotal.innerHTML = `₹${money(total)}&nbsp;&nbsp; →`;

  $('#cartItems').innerHTML = lines.length
    ? lines.map(i => {
        const thumb = state.showImages && i.imageUrl
          ? `<img class="cart-thumb" loading="lazy" decoding="async" src="${esc(i.imageUrl)}" alt="">`
          : '';

        return `<div class="cart-item">
          <div>
            ${thumb}
            <div class="cart-item-name">${esc(i.name)}</div>
            <div class="cart-item-price">₹ ${money(i.price)}</div>
          </div>
          <div class="mini-stepper">
            <button onclick="changeQty('${esc(i.id)}',-1)">−</button>
            <span>${i.qty}</span>
            <button onclick="changeQty('${esc(i.id)}',1)">+</button>
          </div>
          <strong class="cart-line-total">₹${money(i.total)}</strong>
          <button class="cart-remove" onclick="removeCartItem('${esc(i.id)}')" aria-label="Remove">×</button>
        </div>`;
      }).join('')
    : '<div class="empty compact">No items selected.</div>';

  $('#saveOrder').disabled = !lines.length || state.saving;
  renderPayment();
  renderOrderContext();
  renderOpenOrders();

  if (!$('#cartSheet').classList.contains('hidden')){
    requestAnimationFrame(adjustCartSheetSpace);
  }

  ensureCartSheetVisible();
}

function toggleCartDetails(){
  const details = $('#cartDetails');
  const button = $('#cartDetailsToggle');
  const expanded = !details.classList.contains('expanded');
  details.classList.toggle('expanded', expanded);
  button.setAttribute('aria-expanded', String(expanded));
  button.textContent = expanded ? 'Hide details' : 'Show details';
  requestAnimationFrame(adjustCartSheetSpace);
  window.setTimeout(adjustCartSheetSpace, 340);
}

function removeCartItem(id){
  delete state.cart[id];
  persistCart();
  updateItemCard(id);
  renderCart();
}

function ensureCartSheetVisible(){
  const sheet = $('#cartSheet');
  const hasItems = cartLines().length > 0;
  const hasSession = Boolean(state.session);
  const orderViewActive = $('#view-order').classList.contains('active');
  const modalOpen = $$('.sheet:not(.cart-sheet):not(.hidden):not(.closing)').length > 0;

  if (hasItems && hasSession && orderViewActive && !modalOpen && sheet.classList.contains('hidden')){
    openSheet('cartSheet');
  }else if ((!hasItems || !hasSession || !orderViewActive) && !sheet.classList.contains('hidden')){
    if (!hasItems){
      $('#cartDetails').classList.remove('expanded');
      $('#cartDetailsToggle').setAttribute('aria-expanded','false');
      $('#cartDetailsToggle').textContent = 'Show details';
    }
    sheet.classList.add('hidden');
    sheet.classList.remove('closing');
    document.body.classList.remove('cart-sheet-open');
    document.documentElement.style.setProperty('--cart-sheet-height','0px');
  }
}

function renderPayment(){
  $$('.pay').forEach(b => b.classList.toggle('active',b.dataset.pay === state.payment));
}

async function saveOrder(){
  if (!state.session){
    closeSheets();
    renderSessionSheet();
    return;
  }

  const items = cartLines().map(i => ({id:i.id,qty:i.qty}));
  if (!items.length) return;
  const openOrderId = state.activeOrderId;
  const orderFor = state.showOrderReference ? String(state.orderFor || '').trim() : '';

  state.saving = true;
  renderCart();
  const saveLabel = $('#saveOrder .save-order-label'); if (saveLabel) saveLabel.textContent = 'Saving…';

  let pending = Store.get('sb.pendingOrder');
  const samePayload = pending &&
    JSON.stringify(pending.items) === JSON.stringify(items) &&
    pending.paymentMethod === state.payment &&
    pending.orderType === state.orderType &&
    pending.orderFor === orderFor;

  if (!samePayload){
    pending = {
      clientRequestId:'REQ-' + Date.now() + '-' + Math.random().toString(36).slice(2,8).toUpperCase(),
      items,
      paymentMethod:state.payment,
      orderType:state.orderType,
      orderFor:orderFor
    };
    Store.set('sb.pendingOrder',pending);
  }

  try{
    const result = await Api.saveOrder(pending);
    toast(result.duplicate ? `Already saved ${result.orderId}` : `Saved ${result.orderId}`);
    closeActiveOpenOrder(openOrderId);
    Store.remove('sb.pendingOrder');
    renderItems();
    renderOpenOrders();
    closeSheets();
  }catch(e){
    toast(e.message || 'Could not save order.', true);
  }finally{
    state.saving = false;
    const saveLabel = $('#saveOrder .save-order-label'); if (saveLabel) saveLabel.textContent = 'Save & Close';
    renderCart();
  }
}

function renderSessionButton(){
  const businessDate = state.session ? state.session.businessDate : localDateValue();

  const headerDate = $('#headerBusinessDate');
  if (headerDate) headerDate.textContent = shortDate(businessDate);

  const title = $('#sessionBannerTitle');
  const time = $('#sessionBannerTime');
  const live = $('#sessionLiveLabel');
  const openLabel = $('#sessionOpenLabel');

  if (state.session){
    $('#sessionBtn').classList.add('live');
    if (title) title.textContent = `${state.session.sessionName} Session`;
    if (time) time.textContent = sessionTimeLabel(state.session);
    if (live){
      live.textContent = 'Live';
      live.classList.add('live');
    }
    if (openLabel) openLabel.textContent = 'Store Open';
  }else{
    $('#sessionBtn').classList.remove('live');
    if (title) title.textContent = 'Session Closed';
    if (time) time.textContent = 'Tap to open store';
    if (live){
      live.textContent = 'Closed';
      live.classList.remove('live');
    }
    if (openLabel) openLabel.textContent = 'Store Closed';
  }
}

function sessionTimeLabel(session){
  if (!session) return '';
  const opened = String(session.openTime || '');
  const timeMatch = opened.match(/(\d{1,2}:\d{2}\s?[AP]M)/i);
  return timeMatch ? `Opened ${timeMatch[1]}` : 'Session in progress';
}

function renderSessionWarning(){
  const warning = $('#sessionWarning');
  if (!warning) return;

  const hasSession = Boolean(state.session);
  $('#orderWorkspace')?.classList.toggle('hidden', !hasSession);
  $('#sessionRequired')?.classList.toggle('hidden', hasSession);

  if (!state.session || !state.session.isStale){
    warning.classList.add('hidden');
    warning.textContent = '';
    return;
  }

  const hours = Number(state.session.ageHours || 0);
  warning.textContent = `This session has been open for ${hours} hours. Close it if the business day is finished.`;
  warning.classList.remove('hidden');
}

/**
 * Compatibility renderer.
 * Older cached UI code may still call renderSession().
 */
function renderSession(){
  renderSessionButton();
  renderSessionWarning();
}

function renderSessionSheet(){
  const content = $('#sessionContent');

  if (state.session){
    const warning = state.session.isStale
      ? `<div class="warning-box">This session looks old (${state.session.ageHours} hours). Close it if the business day is finished.</div>`
      : '';

    content.innerHTML = `
      <div class="sheet-head"><h3>Session Open</h3></div>
      ${warning}
      <div class="card">
        <div class="list-row"><div>Business Date<small>${esc(state.session.businessDate)}</small></div><strong>${esc(state.session.sessionName)}</strong></div>
        <div class="list-row"><div>Opened<small>${esc(state.session.openTime)}</small></div><strong class="status-live">Live</strong></div>
      </div>
      <button class="btn danger-outline full big" id="closeSessionBtn">Close Session</button>`;

    setTimeout(() => $('#closeSessionBtn').onclick = closeSession,0);
  }else{
    content.innerHTML = `
      <div class="sheet-head"><h3>Open Store Session</h3></div>
      <div class="form-grid">
        <label class="field-label">Business Date</label>
        <input id="sessionDate" class="input" type="date" value="${localDateValue()}">
        <label class="field-label">Session</label>
        <select id="sessionName" class="input">
          <option>Morning</option>
          <option selected>Evening</option>
          <option>Other</option>
        </select>
      </div>
      <button class="btn primary full big" id="openSessionBtn">Open Session</button>`;

    setTimeout(() => $('#openSessionBtn').onclick = openSession,0);
  }

  enhanceCustomControls(content);
  const sessionDate = $('#sessionDate');
  if (sessionDate) enhanceDateInput(sessionDate);
  openSheet('sessionSheet');
}

async function openSession(){
  try{
    const button = $('#openSessionBtn');
    button.disabled = true;
    button.textContent = 'Opening…';
    state.session = await Api.openSession({
      businessDate:$('#sessionDate').value,
      sessionName:$('#sessionName').value
    });
    renderSessionButton();
    renderSessionWarning();
    closeSheets();
    toast('Session opened.');
  }catch(e){
    toast(e.message || 'Could not open session.', true);
    const button = $('#openSessionBtn');
    if (button){button.disabled=false;button.textContent='Open Session';}
  }
}

async function closeSession(){
  if (!await showConfirm(`Close the ${state.session?.sessionName || ''} session for ${state.session?.businessDate || 'this business day'}?`, {
    title:'Close store session', confirmText:'Close session', danger:true
  })) return;

  try{
    const button = $('#closeSessionBtn');
    if (button){button.disabled=true;button.textContent='Closing…';}
    await Api.closeSession();
    state.session = null;
    renderSessionButton();
    renderSessionWarning();
    closeSheets();
    toast('Session closed.');
  }catch(e){
    toast(e.message || 'Could not close session.', true);
    const button = $('#closeSessionBtn');
    if (button){button.disabled=false;button.textContent='Close Session';}
  }
}

async function loadToday(){
  setViewLoading('today',true,'Loading today…');
  try{
    const data = await Api.today();
    $('#todayDate').textContent = displayDate(data.value);
    $('#todayStats').innerHTML = statsHtml(data);
    $('#todaySessions').innerHTML = sessionsHtml(data.sessions || []);
    $('#todayItems').innerHTML = itemsSalesHtml(data.items || []);
  }catch(e){
    toast(e.message || 'Could not load Today.', true);
  }finally{
    setViewLoading('today',false);
  }
}

function statsHtml(data){
  const dineIn = data.orderTypes?.['Dine-in'] || {orders:0,sales:0};
  const takeaway = data.orderTypes?.Takeaway || {orders:0,sales:0};
  return [
    ['Sales','₹'+money(data.sales),'good'],
    ['Orders',money(data.orders),''],
    ['Dishes',money(data.dishes),''],
    ['Best Seller',esc(data.bestSeller || '-'),''],
    ['Online','₹'+money(data.onlineSales),''],
    ['Offline','₹'+money(data.offlineSales),''],
    ['Dine-in',`${money(dineIn.orders)} · ₹${money(dineIn.sales)}`,''],
    ['Takeaway',`${money(takeaway.orders)} · ₹${money(takeaway.sales)}`,'']
  ].map(x => `<div class="stat ${x[2]}"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
}

function sessionsHtml(sessions){
  if (!sessions.length) return '<div class="empty compact">No session sales.</div>';
  return sessions.map(s => `<div class="session-row">
    <div>
      <strong>${esc(s.sessionName)}</strong>
      <small>${s.orders} orders · ${s.dishes} dishes</small>
    </div>
    <div class="session-money">
      <strong>₹${money(s.sales)}</strong>
      <small>₹${money(s.onlineSales)} online · ₹${money(s.offlineSales)} offline</small>
    </div>
  </div>`).join('');
}

function itemsSalesHtml(items){
  if (!items.length) return '<div class="empty compact">No sales yet.</div>';
  return items.map(i => `<div class="list-row">
    <div>${esc(i.name)}<small>${i.qty} dishes</small></div>
    <strong>₹${money(i.sales)}</strong>
  </div>`).join('');
}

async function loadHistory(reset=false){
  if (state.historyLoading) return;
  state.historyLoading = true;
  if (reset){
    state.historyOffset = 0;
    $('#history').innerHTML = '';
    setViewLoading('history',true,'Loading orders…');
  }else{
    $('#loadMore').disabled = true;
    $('#loadMore').textContent = 'Loading…';
  }

  try{
    const data = await Api.history(state.historyOffset,state.historyFilters);
    const html = (data.orders || []).map(order => {
      const cancelled = String(order.status).toLowerCase() === 'cancelled';
      const orderItems = order.items || [];
      const productTitle = orderItems.length
        ? `${orderItems[0].name}${orderItems.length > 1 ? ` +${orderItems.length - 1} more` : ''}`
        : 'Order details';
      const itemDetails = orderItems.map(item => `
        <div class="history-item">
          <span><b>${money(item.qty)}×</b> ${esc(item.name)}</span>
          <strong>₹${money(item.total)}</strong>
        </div>`).join('');
      const cancelButton = cancelled
        ? '<span class="status-cancelled">Cancelled</span>'
        : `<button class="small-btn danger-text" data-cancel-order="${esc(order.orderId)}">Cancel</button>`;
      const deleteButton = `<button class="small-btn delete-order-btn" data-delete-order="${esc(order.orderId)}">Delete</button>`;
      const orderFor = String(order.orderFor || '').trim();
      const orderType = String(order.orderType || 'Unspecified');

      return `<div class="card history-card ${cancelled ? 'cancelled-card' : ''}">
        <div class="history-head">
          <div>
            <strong>${esc(productTitle)}</strong>
            <small>${esc(order.orderId)} · ${esc(order.dateTime)} · ${esc(order.saleTime)}</small>
          </div>
          <div class="history-total"><small>Order total</small><strong>₹${money(order.totalAmount)}</strong></div>
        </div>
        <div class="history-business-date">
          <strong>${esc(orderType)}${orderFor ? ` · ${esc(orderFor)}` : ''}</strong>
          <span>Business date: ${esc(order.businessDate)}</span>
        </div>
        <div class="history-items">${itemDetails || '<div class="empty compact">No item details.</div>'}</div>
        <div class="history-footer">
          <div><strong>${money(order.totalQty)} dishes</strong><small>${esc(order.paymentMethod)} payment</small></div>
          <div class="history-actions">${cancelButton}${deleteButton}</div>
        </div>
      </div>`;
    }).join('');

    if (reset) $('#history').innerHTML = html || '<div class="empty">No orders.</div>';
    else $('#history').insertAdjacentHTML('beforeend',html);

    state.nextHistoryOffset = data.nextOffset;
    $('#loadMore').classList.toggle('hidden',data.nextOffset == null);
    const filtered = Number(data.filteredTotal || 0);
    const total = Number(data.total || 0);
    $('#historyResultsMeta').textContent = filtered === total
      ? `${filtered} order${filtered === 1 ? '' : 's'}`
      : `${filtered} of ${total} orders`;
    $('#historyResultsMeta').classList.toggle('hidden',total === 0 && !activeHistoryFilterCount());
  }catch(e){
    toast(e.message || 'Could not load history.', true);
  }finally{
    state.historyLoading = false;
    setViewLoading('history',false);
    $('#loadMore').disabled = false;
    $('#loadMore').textContent = 'Load more';
  }
}

function readHistoryFilters(){
  return {
    q:$('#historyQuery').value.trim(),
    from:$('#historyFrom').value,
    to:$('#historyTo').value,
    payment:$('#historyPayment').value,
    orderType:$('#historyOrderType').value,
    status:$('#historyStatus').value,
    minAmount:$('#historyMinAmount').value,
    maxAmount:$('#historyMaxAmount').value,
    sort:$('#historySort').value || 'newest'
  };
}

function activeHistoryFilterCount(){
  return Object.entries(state.historyFilters).filter(([key,value]) => key !== 'sort' && String(value).trim()).length;
}

function updateHistoryFilterCount(){
  const count = activeHistoryFilterCount();
  $('#historyFilterCount').textContent = count ? `(${count})` : '';
  $('#historyFilterToggle').classList.toggle('active',count > 0);
}

function applyHistoryFilters(){
  const filters = readHistoryFilters();
  if (filters.from && filters.to && filters.from > filters.to){
    toast('From date cannot be after To date.',true);
    return;
  }
  if (filters.minAmount && filters.maxAmount && Number(filters.minAmount) > Number(filters.maxAmount)){
    toast('Minimum amount cannot be greater than maximum amount.',true);
    return;
  }
  state.historyFilters = filters;
  updateHistoryFilterCount();
  loadHistory(true);
}

function clearHistoryFilters(){
  ['historyQuery','historyFrom','historyTo','historyMinAmount','historyMaxAmount'].forEach(id => $('#'+id).value = '');
  $('#historyPayment').value = '';
  $('#historyOrderType').value = '';
  $('#historyStatus').value = '';
  $('#historySort').value = 'newest';
  state.historyFilters = {q:'', from:'', to:'', payment:'', orderType:'', status:'', minAmount:'', maxAmount:'', sort:'newest'};
  ['historyPayment','historyOrderType','historyStatus','historySort'].forEach(id => syncCustomSelect($('#'+id)));
  updateHistoryFilterCount();
  loadHistory(true);
}

async function cancelOrder(orderId){
  if (!await showConfirm(`Cancel order ${orderId}? Sales and profit summaries will be recalculated.`, {
    title:'Cancel order', confirmText:'Cancel order', danger:true
  })) return;
  try{
    await Api.cancelOrder(orderId);
    toast(`Cancelled ${orderId}`);
    loadHistory(true);
  }catch(e){
    toast(e.message || 'Could not cancel order.', true);
  }
}

async function deleteOrder(orderId){
  if (!await showConfirm(`Permanently delete order ${orderId} from the Orders sheet? This cannot be undone.`, {
    title:'Delete order permanently', confirmText:'Delete order', danger:true
  })) return;

  try{
    await Api.deleteOrder(orderId);
    toast(`Deleted ${orderId}`);
    loadHistory(true);
  }catch(e){
    toast(e.message || 'Could not delete order.', true);
  }
}

function loadMoreHistory(){
  if (state.nextHistoryOffset != null){
    state.historyOffset = state.nextHistoryOffset;
    loadHistory(false);
  }
}

function setExpensePeriod(period){
  state.expensePeriod = ['day','month','year'].includes(period) ? period : 'day';
  const today = state.session?.businessDate || localDateValue();
  const input = $('#expensePeriodValue');
  input.type = state.expensePeriod === 'day' ? 'date' : state.expensePeriod === 'month' ? 'month' : 'number';
  if (state.expensePeriod === 'day') input.value = today;
  if (state.expensePeriod === 'month') input.value = today.slice(0,7);
  if (state.expensePeriod === 'year') {
    input.min = '2020'; input.max = '2100'; input.step = '1'; input.value = today.slice(0,4);
  }
  state.expensePeriodValue = input.value;
  $$('#expensePeriodTabs [data-expense-period]').forEach(button => button.classList.toggle('active',button.dataset.expensePeriod === state.expensePeriod));
  state.expenseVisibleCount = 20;
  loadExpenses();
}

function expensePeriodLabel(period,value){
  if (period === 'day') return displayDate(value);
  if (period === 'month') {
    const [year,month] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('en-IN',{month:'long',year:'numeric'}).format(new Date(year,month-1,1));
  }
  return value;
}

function loadMoreExpenseCards(){
  if ($('#loadMoreExpenses').classList.contains('hidden')) return;
  state.expenseVisibleCount += 20;
  renderExpenses();
}

async function loadExpenses(){
  setViewLoading('expenses',true,'Loading expenses…');
  try{
    if (!state.expensePeriodValue) {
      const today = state.session ? state.session.businessDate : localDateValue();
      state.expensePeriodValue = state.expensePeriod === 'day' ? today : state.expensePeriod === 'month' ? today.slice(0,7) : today.slice(0,4);
      $('#expensePeriodValue').value = state.expensePeriodValue;
    }
    const [data,earnings] = await Promise.all([
      Api.expenses(state.expensePeriodValue,state.expensePeriod),
      Api.allTimeSales()
    ]);
    state.expenses = data.items || [];
    state.expenseVisibleCount = 20;
    $('#expenseBusinessDate').textContent = expensePeriodLabel(data.period,data.value);

    $('#expenseOverview').innerHTML = `
      <div><span>Total Expense</span><strong>₹${money(data.totals.total)}</strong></div>
      <div><span>Overall Income</span><strong>₹${money(earnings.sales)}</strong></div>`;

    renderExpenses();
  }catch(e){
    toast(e.message || 'Could not load expenses.', true);
  }finally{
    setViewLoading('expenses',false);
  }
}

function renderExpenses(){
  $$('#expensePayerFilters [data-expense-payer]').forEach(button => {
    button.classList.toggle('active',button.dataset.expensePayer === state.expensePaidByFilter);
  });
  $$('#expensePaymentFilters [data-expense-payment]').forEach(button => {
    button.classList.toggle('active',button.dataset.expensePayment === state.expensePaymentFilter);
  });
  $$('#expenseTypeFilters [data-expense-type]').forEach(button => {
    button.classList.toggle('active',button.dataset.expenseType === state.expenseTypeFilter);
  });
  $$('#expenseSettlementFilters [data-expense-settlement]').forEach(button => {
    button.classList.toggle('active',button.dataset.expenseSettlement === state.expenseSettlementFilter);
  });
  const activeFilterCount = Number(state.expensePaidByFilter !== 'All') + Number(state.expensePaymentFilter !== 'All') + Number(state.expenseTypeFilter !== 'All') + Number(state.expenseSettlementFilter !== 'All');
  $('#expenseFilterCount').textContent = activeFilterCount ? `(${activeFilterCount})` : '';
  $('#expenseFilterToggle').classList.toggle('active',activeFilterCount > 0);

  const expenseOwner = x => {
    const settlementType = String(x.settlementType || 'Own funds');
    return settlementType !== 'Own funds' && String(x.fundOwner || '').trim()
      ? String(x.fundOwner).trim()
      : String(x.paidBy || '').trim();
  };
  const filtered = state.expenses.filter(x => {
    const ownerMatches = state.expensePaidByFilter === 'All' || expenseOwner(x) === state.expensePaidByFilter;
    const paymentMatches = state.expensePaymentFilter === 'All' || String(x.paymentMethod || '') === state.expensePaymentFilter;
    const typeMatches = state.expenseTypeFilter === 'All' || String(x.expenseType || '') === state.expenseTypeFilter;
    const remaining = Number(x.fundRemaining) || 0;
    const returned = (x.settlements || []).reduce((sum,s) => sum + (Number(s.amount) || 0),0);
    const settlementStatus = String(x.settlementType || 'Own funds') === 'Own funds' ? 'Own funds' : remaining === 0 ? 'Settled' : returned > 0 ? 'Partially settled' : 'Pending';
    const settlementMatches = state.expenseSettlementFilter === 'All' || settlementStatus === state.expenseSettlementFilter;
    return ownerMatches && paymentMatches && typeMatches && settlementMatches;
  });
  const filteredTotal = filtered.reduce((sum,x) => sum + (Number(x.amount) || 0),0);
  const filterLabel = [
    state.expensePaidByFilter === 'All' ? '' : `${state.expensePaidByFilter} funds`,
    state.expensePaymentFilter === 'All' ? '' : state.expensePaymentFilter,
    state.expenseTypeFilter === 'All' ? '' : state.expenseTypeFilter,
    state.expenseSettlementFilter === 'All' ? '' : state.expenseSettlementFilter
  ].filter(Boolean).join(' · ');
  $('#expenseFilterSummary').innerHTML = `<span>${filterLabel ? `${esc(filterLabel)} · ` : ''}${filtered.length} expense${filtered.length === 1 ? '' : 's'}</span><strong>₹${money(filteredTotal)}</strong>`;
  const visible = filtered.slice(0,state.expenseVisibleCount);
  $('#loadMoreExpenses').classList.toggle('hidden',visible.length >= filtered.length);

  $('#expenseList').innerHTML = visible.length
      ? visible.map(x => {
        const paidBy = String(x.paidBy || '').trim();
        const settlementType = String(x.settlementType || 'Own funds');
        const isSettlement = settlementType !== 'Own funds';
        const payerLine = paidBy ? `<div class="expense-paid">Paid by <strong>${esc(paidBy)}</strong></div>` : '';
        const remaining = Number(x.fundRemaining) || 0;
        const returned = (x.settlements || []).reduce((sum,s) => sum + (Number(s.amount) || 0),0);
        const settlementStatus = remaining === 0 ? 'Settled' : returned > 0 ? 'Partially settled' : 'Pending';
        const settlementLine = isSettlement ? `<div class="expense-settlement">
          <strong>${esc(settlementStatus)}</strong>
          <span>${esc(paidBy || 'Someone')} used ${esc(x.fundOwner || 'fund')} funds · ₹${money(returned)} returned · ₹${money(remaining)} remaining</span>
        </div>` : '';
        return `<div class="card expense-card">
          <div class="expense-top">
            <div>
              <strong>${esc(x.description || x.category)}</strong>
              <small>${esc(x.expenseType)} · ${esc(x.frequency)} · ${esc(x.paymentMethod)}</small>
            </div>
            <strong>₹${money(x.amount)}</strong>
          </div>
          ${payerLine}${settlementLine}
          <div class="expense-actions">
            ${isSettlement && remaining > 0 ? `<button class="small-btn settlement-return-btn" data-settle-expense="${esc(x.expenseId)}">Return advance</button>` : ''}
            <button class="small-btn" data-edit-expense="${esc(x.expenseId)}">Edit</button>
            <button class="small-btn danger-text" data-delete-expense="${esc(x.expenseId)}">Delete</button>
          </div>
        </div>`;
      }).join('')
      : `<div class="empty">No expenses match these filters.</div>`;
}

function openSettlementForm(expenseId){
  const expense = state.expenses.find(x => x.expenseId === expenseId);
  if (!expense) return toast('Expense not found. Refresh the list.', true);
  const remaining = Number(expense.fundRemaining) || 0;
  if (remaining <= 0) return toast('This advance is already settled.', true);
  $('#settlementExpenseId').value = expense.expenseId;
  $('#settlementFrom').value = expense.paidBy || 'Chaitali';
  $('#settlementTo').value = expense.fundOwner || 'Tanvi';
  $('#settlementAmount').value = remaining;
  $('#settlementAmount').max = remaining;
  $('#settlementPayment').value = 'Online';
  $('#settlementNotes').value = 'Return of unused advance';
  $('#settlementSummary').innerHTML = `<span>${esc(expense.description || expense.category)}</span><strong>₹${money(remaining)} remaining</strong>`;
  syncCustomSelects();
  openSheet('settlementSheet');
}

async function saveSettlement(){
  const expenseId = $('#settlementExpenseId').value;
  const expense = state.expenses.find(x => x.expenseId === expenseId);
  const body = {
    expenseId,
    businessDate:expense?.businessDate || localDateValue(),
    fromPerson:$('#settlementFrom').value,
    toPerson:$('#settlementTo').value,
    amount:Number($('#settlementAmount').value),
    paymentMethod:$('#settlementPayment').value,
    notes:$('#settlementNotes').value.trim()
  };
  if (!(body.amount > 0)) return toast('Enter a valid return amount.', true);
  if (body.fromPerson === body.toPerson) return toast('Returned by and returned to must be different.', true);
  const button = $('#saveSettlement');
  try{
    button.disabled = true;
    button.textContent = 'Saving…';
    const result = await Api.addSettlement(body);
    closeSheets();
    toast(result.remaining === 0 ? 'Advance fully settled.' : `Return saved. ₹${money(result.remaining)} remaining.`);
    loadExpenses();
  }catch(e){
    toast(e.message || 'Could not save return.', true);
  }finally{
    button.disabled = false;
    button.textContent = 'Save Return';
  }
}

function openExpenseForm(expense=null){
  resetExpenseForm();

  if (expense){
    state.editingExpenseId = String(expense.expenseId || '');
    $('#expenseId').value = expense.expenseId;
    $('#saveExpense').dataset.expenseId = state.editingExpenseId;
    $('#expenseType').value = expense.expenseType;
    $('#expenseFrequency').value = expense.frequency;
    $('#expenseCategory').value = expense.category;
    $('#expenseAmount').value = expense.amount;
    $('#expensePayment').value = expense.paymentMethod;
    $('#expenseDesc').value = expense.description || '';
    $('#expenseVendor').value = expense.vendor || '';
    $('#expenseNotes').value = expense.notes || '';
    $('#expensePaidBy').value = expense.paidBy || 'Biren';
    $('#expenseSettlementType').value = expense.settlementType || 'Own funds';
    $('#expenseFundOwner').value = expense.fundOwner || expense.paidBy || 'Biren';
    $('#expenseFundRemaining').value = Number(expense.fundRemaining) || '';
    $('#expenseSheetTitle').textContent = 'Edit Expense';
    $('#saveExpense').textContent = 'Update Expense';
    $('#cancelExpenseEdit').classList.remove('hidden');
  }

  syncCustomSelects();
  renderSettlementFields();
  openSheet('expenseSheet');
}

function editExpense(expenseId){
  const expense = state.expenses.find(x => x.expenseId === expenseId);
  if (!expense){
    toast('Expense not found. Refresh the list.', true);
    return;
  }
  openExpenseForm(expense);
}

function resetExpenseForm(){
  state.editingExpenseId = '';
  $('#expenseId').value = '';
  delete $('#saveExpense').dataset.expenseId;
  $('#expenseType').value = 'Operating';
  $('#expenseFrequency').value = 'Daily';
  $('#expenseCategory').value = 'Ingredients';
  $('#expenseAmount').value = '';
  $('#expensePayment').value = 'Online';
  $('#expenseDesc').value = '';
  $('#expenseVendor').value = '';
  $('#expenseNotes').value = '';
  $('#expensePaidBy').value = 'Biren';
  $('#expenseSettlementType').value = 'Own funds';
  $('#expenseFundOwner').value = 'Biren';
  $('#expenseFundRemaining').value = '';
  $('#expenseSheetTitle').textContent = 'Add Expense';
  $('#saveExpense').textContent = 'Save Expense';
  $('#cancelExpenseEdit').classList.add('hidden');
  syncCustomSelects();
  renderSettlementFields();
}

function renderSettlementFields(){
  const ownFunds = $('#expenseSettlementType').value === 'Own funds';
  $('#settlementFormFields').classList.toggle('hidden',ownFunds);
  if (ownFunds){
    $('#expenseFundOwner').value = $('#expensePaidBy').value;
    $('#expenseFundRemaining').value = '';
    syncCustomSelect($('#expenseFundOwner'));
  }
}

async function saveExpense(){
  const expenseId = String(state.editingExpenseId || $('#saveExpense').dataset.expenseId || $('#expenseId').value || '').trim();
  const body = {
    expenseId,
    expenseType:$('#expenseType').value,
    frequency:$('#expenseFrequency').value,
    category:$('#expenseCategory').value,
    amount:Number($('#expenseAmount').value),
    paymentMethod:$('#expensePayment').value,
    description:$('#expenseDesc').value.trim(),
    vendor:$('#expenseVendor').value.trim(),
    notes:$('#expenseNotes').value.trim(),
    paidBy:$('#expensePaidBy').value,
    settlementType:$('#expenseSettlementType').value,
    fundOwner:$('#expenseSettlementType').value === 'Own funds' ? $('#expensePaidBy').value : $('#expenseFundOwner').value,
    fundRemaining:$('#expenseSettlementType').value === 'Own funds' ? '' : Number($('#expenseFundRemaining').value || 0)
  };

  if (!(body.amount > 0)){
    toast('Enter an expense amount.', true);
    return;
  }

  try{
    const button = $('#saveExpense');
    button.disabled = true;
    button.textContent = expenseId ? 'Updating…' : 'Saving…';

    if (expenseId) await Api.updateExpense(body);
    else await Api.addExpense(body);

    closeSheets();
    resetExpenseForm();
    toast(expenseId ? 'Expense updated.' : 'Expense saved.');
    loadExpenses();
  }catch(e){
    toast(e.message || 'Could not save expense.', true);
  }finally{
    $('#saveExpense').disabled = false;
    $('#saveExpense').textContent = $('#expenseId').value ? 'Update Expense' : 'Save Expense';
  }
}

async function deleteExpense(expenseId){
  const expense = state.expenses.find(x => x.expenseId === expenseId);
  if (!expense) return;
  if (!await showConfirm(`Delete the ₹${money(expense.amount)} expense “${expense.description || expense.category}”?`, {
    title:'Delete expense', confirmText:'Delete', danger:true
  })) return;

  try{
    await Api.deleteExpense(expenseId);
    toast('Expense deleted.');
    loadExpenses();
  }catch(e){
    toast(e.message || 'Could not delete expense.', true);
  }
}

function setDefaultReportInput(){
  $('#reportValue').value = localDateValue();
}

function setReportType(type){
  state.reportType = type;
  $$('#view-reports .segment').forEach(b => b.classList.toggle('active',b.dataset.report === type));

  const input = $('#reportValue');
  const today = localDateValue();

  if (type === 'day'){
    input.type = 'date';
    input.value = state.session?.businessDate || today;
  }else if (type === 'month'){
    input.type = 'month';
    input.value = (state.session?.businessDate || today).slice(0,7);
  }else{
    input.type = 'number';
    input.min = '2020';
    input.max = '2100';
    input.step = '1';
    input.value = (state.session?.businessDate || today).slice(0,4);
  }

  loadReport();
}

async function loadReport(){
  setViewLoading('reports',true,'Loading report…');
  try{
    const value = String($('#reportValue').value || '').trim();
    if (!value) return;

    const data = await Api.report(state.reportType,value);
    state.report = data;
    $('#reportStats').innerHTML = statsHtml(data);
    $('#reportSessions').innerHTML = sessionsHtml(data.sessions || []);
    $('#reportItems').innerHTML = itemsSalesHtml(data.items || []);
  }catch(e){
    toast(e.message || 'Could not load report.', true);
  }finally{
    setViewLoading('reports',false);
  }
}

async function saveReportPdf(){
  const value = String($('#reportValue').value || '').trim();
  if (!value) return;

  try{
    const button = $('#saveReportPdf');
    button.disabled = true;
    button.textContent = 'Saving…';
    const result = await Api.saveReportPdf(state.reportType,value);
    toast(`PDF saved: ${result.fileName}`);
  }catch(e){
    toast(e.message || 'Could not save PDF.', true);
  }finally{
    const button = $('#saveReportPdf');
    button.disabled = false;
    button.textContent = 'Save PDF to Drive';
  }
}

async function backupData(){
  if (!await showConfirm('Create a complete Google Sheet backup in Drive now?', {
    title:'Create Drive backup', confirmText:'Create backup'
  })) return;

  try{
    const button = $('#backupData');
    button.disabled = true;
    button.textContent = 'Backing up…';
    const result = await Api.backupData();
    toast(`${result.replaced ? 'Backup updated' : 'Backup created'} · ${result.fileName}`);
  }catch(e){
    toast(e.message || 'Could not create backup.', true);
  }finally{
    const button = $('#backupData');
    button.disabled = false;
    button.textContent = 'Backup Sheet';
  }
}

function openSheet(id){
  const sheet = $('#'+id);
  sheet.classList.remove('hidden','closing');

  if (id === 'cartSheet'){
    document.body.classList.add('cart-sheet-open');

    requestAnimationFrame(() => {
      adjustCartSheetSpace();

      const selected = document.querySelector('.item-card.selected:last-of-type');
      if (selected){
        const panel = $('#cartSheet .sheet-panel');
        const panelTop = panel ? panel.getBoundingClientRect().top : window.innerHeight;
        const cardBottom = selected.getBoundingClientRect().bottom;

        if (cardBottom > panelTop - 12){
          selected.scrollIntoView({behavior:'smooth',block:'center'});
        }
      }
    });
  }else{
    document.body.classList.add('modal-sheet-open');
  }
}

function adjustCartSheetSpace(){
  const sheet = $('#cartSheet');

  if (!sheet || sheet.classList.contains('hidden')){
    document.documentElement.style.setProperty('--cart-sheet-height','0px');
    return;
  }

  const panel = sheet.querySelector('.sheet-panel');
  if (!panel) return;

  const height = Math.ceil(panel.getBoundingClientRect().height);
  document.documentElement.style.setProperty('--cart-sheet-height', height + 'px');
}

function closeSheets(){
  const closeDelay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220;
  $$('.sheet:not(.hidden)').forEach(sheet => {
    sheet.classList.add('closing');
    window.setTimeout(() => {
      if (!sheet.classList.contains('closing')) return;
      sheet.classList.add('hidden');
      sheet.classList.remove('closing');
      window.setTimeout(ensureCartSheetVisible, 0);
    }, closeDelay);
  });
  document.body.classList.remove('cart-sheet-open','modal-sheet-open');
  document.documentElement.style.setProperty('--cart-sheet-height','0px');
}

window.addEventListener('resize', () => {
  if (!$('#cartSheet').classList.contains('hidden')){
    adjustCartSheetSpace();
  }
});

function setOffline(isOffline){
  $('#offlineBanner').classList.toggle('hidden',!isOffline);
}

function money(value){
  return Number(value || 0).toLocaleString('en-IN',{maximumFractionDigits:2});
}

function esc(value){
  return String(value ?? '').replace(/[&<>"']/g, m => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[m]));
}

function localDateValue(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function displayDate(value){
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return value || '';
  const d = new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));
  return new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric'}).format(d);
}

function shortDate(value){
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return value || '';
  const d = new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));
  return new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short'}).format(d);
}

let toastTimer;
let confirmResolver = null;

function showConfirm(message,{title='Confirm action',confirmText='Confirm',danger=false}={}){
  if (confirmResolver) resolveConfirm(false);
  const modal = $('#confirmModal');
  $('#confirmTitle').textContent = title;
  $('#confirmMessage').textContent = message;
  const accept = $('#confirmAccept');
  accept.textContent = confirmText;
  accept.classList.toggle('danger-button',danger);
  modal.classList.remove('hidden');
  requestAnimationFrame(() => accept.focus());
  return new Promise(resolve => { confirmResolver = resolve; });
}

function resolveConfirm(value){
  const modal = $('#confirmModal');
  if (!modal || modal.classList.contains('hidden')) return;
  modal.classList.add('closing');
  window.setTimeout(() => {
    modal.classList.add('hidden');
    modal.classList.remove('closing');
  }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
  const resolve = confirmResolver;
  confirmResolver = null;
  if (resolve) resolve(Boolean(value));
}

function enhanceCustomControls(root){
  root.querySelectorAll('select:not([data-customized])').forEach(enhanceSelect);
}

function enhanceSelect(select){
  select.dataset.customized = 'true';
  select.classList.add('native-control-hidden');

  const wrapper = document.createElement('div');
  wrapper.className = 'custom-select';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'custom-select-trigger';
  trigger.setAttribute('aria-haspopup','listbox');
  trigger.setAttribute('aria-expanded','false');
  const menu = document.createElement('div');
  menu.className = 'custom-select-menu hidden';
  menu.setAttribute('role','listbox');

  [...select.options].forEach(option => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'custom-select-option';
    item.dataset.value = option.value;
    item.textContent = option.textContent;
    item.onclick = e => {
      e.stopPropagation();
      select.value = option.value;
      select.dispatchEvent(new Event('change',{bubbles:true}));
      syncCustomSelect(select);
      closeCustomSelects();
    };
    menu.appendChild(item);
  });

  trigger.onclick = e => {
    e.stopPropagation();
    const opening = menu.classList.contains('hidden');
    closeCustomSelects();
    if (opening){
      const rect = trigger.getBoundingClientRect();
      const estimatedHeight = Math.min(230, (select.options.length * 40) + 12);
      const spaceBelow = window.innerHeight - rect.bottom;
      menu.classList.toggle('open-up', spaceBelow < estimatedHeight && rect.top > spaceBelow);
    }
    menu.classList.toggle('hidden',!opening);
    trigger.setAttribute('aria-expanded',String(opening));
  };

  select.insertAdjacentElement('afterend',wrapper);
  wrapper.append(trigger,menu);
  syncCustomSelect(select);
}

function syncCustomSelect(select){
  if (!select || !select.dataset.customized) return;
  const wrapper = select.nextElementSibling;
  const selected = select.options[select.selectedIndex];
  wrapper.querySelector('.custom-select-trigger').textContent = selected ? selected.textContent : '';
  wrapper.querySelectorAll('.custom-select-option').forEach(item => {
    item.classList.toggle('selected',item.dataset.value === select.value);
  });
}

function syncCustomSelects(){
  $$('select[data-customized]').forEach(syncCustomSelect);
}

function closeCustomSelects(){
  $$('.custom-select-menu').forEach(menu => menu.classList.add('hidden'));
  $$('.custom-select-trigger').forEach(trigger => trigger.setAttribute('aria-expanded','false'));
}

let datePickerTarget = null;
let calendarCursor = new Date();

function enhanceDateInput(input){
  if (input.dataset.customizedDate) return;
  input.dataset.customizedDate = 'true';
  input.type = 'hidden';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'custom-date-trigger';
  button.onclick = () => openDatePicker(input);
  input.insertAdjacentElement('afterend',button);
  syncDateTrigger(input);
}

function syncDateTrigger(input){
  const trigger = input.nextElementSibling;
  if (trigger?.classList.contains('custom-date-trigger')) trigger.textContent = displayDate(input.value) || 'Select date';
}

function openDatePicker(input){
  datePickerTarget = input;
  const match = String(input.value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  calendarCursor = match ? new Date(Number(match[1]),Number(match[2])-1,1) : new Date();
  renderCalendar();
  $('#datePickerModal').classList.remove('hidden','closing');
}

function changeCalendarMonth(delta){
  calendarCursor = new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+delta,1);
  renderCalendar();
}

function renderCalendar(){
  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();
  $('#calendarMonth').textContent = new Intl.DateTimeFormat('en-IN',{month:'long',year:'numeric'}).format(calendarCursor);
  const firstDay = new Date(year,month,1).getDay();
  const daysInMonth = new Date(year,month+1,0).getDate();
  const selected = datePickerTarget?.value || '';
  let html = '';
  for (let i=0;i<firstDay;i++) html += '<span></span>';
  for (let day=1;day<=daysInMonth;day++){
    const value = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    html += `<button type="button" class="calendar-day ${value === selected ? 'selected' : ''}" data-date="${value}">${day}</button>`;
  }
  $('#calendarDays').innerHTML = html;
  $$('.calendar-day').forEach(button => button.onclick = () => selectCalendarDate(button.dataset.date));
}

function selectCalendarDate(value){
  if (!datePickerTarget) return;
  const date = value instanceof Date ? localDateValueFromDate(value) : value;
  datePickerTarget.value = date;
  datePickerTarget.dispatchEvent(new Event('change',{bubbles:true}));
  syncDateTrigger(datePickerTarget);
  closeDatePicker();
}

function localDateValueFromDate(date){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function closeDatePicker(){
  const modal = $('#datePickerModal');
  if (modal.classList.contains('hidden')) return;
  modal.classList.add('closing');
  window.setTimeout(() => modal.classList.add('hidden'), window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
  window.setTimeout(() => modal.classList.remove('closing'),200);
}

function toast(message,error=false){
  const el = $('#toast');
  el.textContent = message;
  el.setAttribute('role',error ? 'alert' : 'status');
  el.classList.toggle('error',error);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'),2800);
}
