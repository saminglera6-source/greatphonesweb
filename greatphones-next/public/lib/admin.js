// =========== ADMIN ===========
// NOTE: Several functions defined here are overwritten by render.js (which loads later):
//   adminTab, renderAdminContent, editProduct, showToast
// The render.js versions are the canonical ones; changes should be made there.
// Functions in this file that are NOT overwritten are still active.
var API_URL=window.API_URL||(window.location.hostname==='localhost'?window.location.protocol+'//'+window.location.host:window.location.origin);

// Polling helper: espera hasta que `fnName` exista en window y la ejecuta.
// Necesario porque el shell legacy tiene scripts con `defer` que pueden no haber
// cargado cuando AdminPageClient invoca renderAdminContent(tab) desde useEffect.
function waitForFn(fnName,cb){
  if(typeof window[fnName]==='function'){cb();return;}
  var iv=setInterval(function(){
    if(typeof window[fnName]==='function'){clearInterval(iv);cb();}
  },100);
  setTimeout(function(){clearInterval(iv);},10000);
}

function adminLogin(){notAvailable();}
function adminLogout(){}
function showAdmin(){nav('admin');}

function adminTab(tab,btn){
  window.currentAdminTab=tab;
  document.querySelectorAll('.fchip[id^="adm-"]').forEach(function(c){c.classList.remove('act');});
  document.querySelectorAll('.atab').forEach(function(c){c.classList.remove('act');});
  document.querySelectorAll('.admin-sec').forEach(function(s){s.classList.remove('act');});
  if(btn)btn.classList.add('act');
  var sec=document.getElementById('as-'+tab);
  if(sec)sec.classList.add('act');
  if(tab==='chat'){
    loadAdminConversations();
    initChatSocket();
  }
  renderAdminContent(tab);
}

// Renombrada para evitar colision con render.js. El wrapper renderAdminContent
// de render.js delega a esta funcion para tabs != dashboard.
function _renderAdminLegacy(tab){
  var content=document.getElementById('adminContent');
  if(!content){
    console.log('adminContent not found');
    content=document.getElementById('adminTabs');
  }
  if(!content){
    console.log('adminTabs not found either');
    return;
  }
  if(tab==='prods'){
    var dolarVal=window.dolarRate||'';
    content.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:8px">'+
        '<h3 style="font-size:16px" id="adm-prods-title">Productos</h3>'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'+
          '<input type="text" id="adminProdSearch" placeholder="🔍 Buscar por nombre..." oninput="renderAdminProductsFiltered(this.value)" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;outline:none;min-width:200px">'+
          '<button class="btn btn-o btn-sm" onclick="showAddProductByImeiModal()">+ Agregar producto</button>'+
          '<button class="btn btn-g btn-sm" onclick="exportProductLog()">📥 Exportar</button>'+
        '</div>'+
      '</div>'+
      '<div style="display:flex;gap:12px;align-items:flex-end;margin-bottom:1rem;flex-wrap:wrap">'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap" id="adm-prods-quickfilters">'+
          '<button class="ord-btn ord-btn-act" onclick="setAdmProdFilter(\'all\',this)">Todos</button>'+
          '<button class="ord-btn" onclick="setAdmProdFilter(\'offer\',this)">Ofertas</button>'+
          '<button class="ord-btn" onclick="setAdmProdFilter(\'nostock\',this)">Sin stock</button>'+
          '<button class="ord-btn" onclick="setAdmProdFilter(\'low\',this)">Stock bajo</button>'+
        '</div>'+
        '<div><label style="font-size:10px;font-weight:600;color:var(--gray);display:block;margin-bottom:4px">Ordenar por</label>'+
          '<select id="admProdsSort" onchange="renderAdminProductsFiltered(document.getElementById(\'adminProdSearch\').value)" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:12px;background:#fff">'+
            '<option value="name">Nombre</option>'+
            '<option value="price">Precio venta</option>'+
            '<option value="cost">Costo</option>'+
            '<option value="profit">Ganancia</option>'+
            '<option value="stock">Stock</option>'+
          '</select></div>'+
        '<div><label style="font-size:10px;font-weight:600;color:var(--gray);display:block;margin-bottom:4px">Cotización USD</label>'+
          '<input type="number" id="adminDolarRate" value="'+dolarVal+'" placeholder="Ej: 1200" oninput="window.dolarRate=parseFloat(this.value)||0;localStorage.setItem(\'dolarRate\',this.value);renderAdminProductsFiltered(document.getElementById(\'adminProdSearch\').value)" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:12px;width:120px;outline:none"></div>'+
      '</div>'+
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px" id="admin-prods-grid"></div>';
    waitForFn('renderAdminProductsFiltered',function(){
      renderAdminProductsFiltered('');
      // Cargar cotización de dólar automáticamente (dolarapi.com) si el admin
      // no definió un valor manual guardado en localStorage.
      if(typeof loadDolarRate==='function'){
        var manual=parseFloat(localStorage.getItem('dolarRate'));
        if(manual>0){window.dolarRate=manual;renderAdminProductsFiltered(document.getElementById('adminProdSearch')?document.getElementById('adminProdSearch').value:'');}
        else loadDolarRate();
      }
    });
  }else if(tab==='acc'){
    var accs=window.ACCS||[];
    content.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:8px">'+
        '<h3 style="font-size:16px" id="adm-acc-title">Accesorios</h3>'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'+
          '<input type="text" id="adminAccSearch" placeholder="🔍 Buscar accesorio..." oninput="renderAdminAccFiltered(this.value)" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;outline:none;min-width:200px">'+
          '<button class="btn btn-o btn-sm" onclick="window.isEditingAcc=false;nav(\'admin-acc\')">+ Agregar accesorio</button>'+
        '</div>'+
      '</div>'+
      '<div style="display:flex;gap:12px;align-items:flex-end;margin-bottom:1rem;flex-wrap:wrap">'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap" id="adm-acc-quickfilters">'+
          '<button class="ord-btn ord-btn-act" onclick="setAdmAccFilter(\'all\',this)">Todos</button>'+
          '<button class="ord-btn" onclick="setAdmAccFilter(\'offer\',this)">Ofertas</button>'+
          '<button class="ord-btn" onclick="setAdmAccFilter(\'nostock\',this)">Sin stock</button>'+
          '<button class="ord-btn" onclick="setAdmAccFilter(\'low\',this)">Stock bajo</button>'+
        '</div>'+
        '<div><label style="font-size:10px;font-weight:600;color:var(--gray);display:block;margin-bottom:4px">Ordenar por</label>'+
          '<select id="admAccSort" onchange="renderAdminAccFiltered(document.getElementById(\'adminAccSearch\').value)" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:12px;background:#fff">'+
            '<option value="name">Nombre</option>'+
            '<option value="price">Precio venta</option>'+
            '<option value="stock">Stock</option>'+
          '</select></div>'+
      '</div>'+
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px" id="admin-acc-grid"></div>';
    waitForFn('renderAdminAccFiltered',function(){
      renderAdminAccFiltered('');
      if(typeof loadDolarRate==='function'){
        var manual=parseFloat(localStorage.getItem('dolarRate'));
        if(manual>0){window.dolarRate=manual;renderAdminAccFiltered('');}
        else loadDolarRate();
      }
      if(typeof loadAccSuppliers==='function')loadAccSuppliers();
    });
  }else if(tab==='orders'){
    content.innerHTML='<div style="display:flex;gap:8px;margin-bottom:1rem;flex-wrap:wrap;align-items:center">'+
      '<button class="ord-btn ord-btn-act" id="btnPendingOrders" onclick="loadPendingOrders()">Pedidos en Espera</button>'+
      '<button class="ord-btn" id="btnAcceptedOrders" onclick="loadAcceptedOrders()">Pedidos Aceptados</button>'+
      '<button class="ord-btn" id="btnHistoryOrders" onclick="loadOrderHistory()">Historial</button>'+
    '</div>'+
    '<div style="margin-bottom:1rem;display:flex;gap:8px;align-items:center">'+
      '<input type="text" id="orderSearchInput" placeholder="Buscar por DNI, email, nombre o código de orden..." oninput="searchOrders(this.value)" style="flex:1;max-width:500px;padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;outline:none">'+
    '</div>'+
    '<div class="adm-list" id="orderList"></div><div id="orderPagination"></div>';
    loadPendingOrders();
  }else if(tab==='inventory'){
    content.innerHTML='<div style="text-align:center;padding:2rem;color:var(--gray)"><p style="font-size:40px;margin-bottom:1rem">📋</p><p style="font-size:16px;font-weight:600;margin-bottom:8px">El inventario ahora se gestiona desde Productos</p><p style="font-size:13px;margin-bottom:1rem">Agregá y administrá los IMEIs desde la sección de productos</p><button class="btn btn-o" onclick="adminTab(\'prods\',document.getElementById(\'adm-prods\'))">Ir a Productos</button></div>';
  }else if(tab==='preventa'){
    content.innerHTML='<div id="preventa-view"></div>';
    if(typeof renderPreventaTab==='function')renderPreventaTab('catalogo');
  }else if(tab==='instore'){
    loadInStoreHistory();
  }else if(tab==='quotes'){
    content.innerHTML='<div style="display:flex;gap:8px;margin-bottom:1rem;flex-wrap:wrap;align-items:center">'+
      '<button class="ord-btn ord-btn-act" id="quoteBtnAll" onclick="loadQuotes(\'all\')">Todas</button>'+
      '<button class="ord-btn" id="quoteBtnPending" onclick="loadQuotes(\'PENDING\')">Pendientes</button>'+
      '<button class="ord-btn" id="quoteBtnApproved" onclick="loadQuotes(\'APPROVED\')">Aceptadas</button>'+
      '<button class="ord-btn" id="quoteBtnRejected" onclick="loadQuotes(\'REJECTED\')">Rechazadas</button>'+
      '<input type="text" id="quoteSearchInput" placeholder="Buscar por nombre, telefono o codigo..." oninput="searchQuotes(this.value)" style="flex:1;max-width:400px;padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;outline:none">'+
      '<a href="/admin/comprados" class="btn btn-o btn-sm" style="display:inline-flex;align-items:center;gap:6px;text-decoration:none"><span class="material-symbols-outlined" style="font-size:15px">space_dashboard</span> Cotizaciones Dashboard</a>'+
    '</div>'+
    '<div class="adm-list" id="quoteList"></div><div id="quotePagination"></div>';
    waitForFn('loadQuotes',function(){loadQuotes('all');});
  }else if(tab==='users'){
    content.innerHTML='<div class="loader-spinner"><span>Cargando...</span></div><div id="adminUsersList"></div>';
    waitForFn('loadAdminUsers',function(){loadAdminUsers();});
  }else if(tab==='sales'){
    if(typeof loadSalesHistory==='function')loadSalesHistory();
  }else if(tab==='stock'){
    var sBrands=Array.from(new Set([].concat(PRODUCTS.map(function(p){return p.brand;})).concat((window.ACCS||[]).map(function(a){return a.brand;})).filter(Boolean)));
    var sBrandsHtml=sBrands.map(function(b){return'<option value="'+b+'">'+b+'</option>';}).join('');
    content.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:12px">'+
      '<h3 style="font-size:16px">Gestion de Stock</h3>'+
      '<div style="display:flex;gap:12px;align-items:center">'+
        '<div><label style="font-size:10px;font-weight:600;color:var(--gray);display:block;margin-bottom:4px">Tipo</label><select id="stockFilterType" onchange="window._stockPage=1;renderStockList()" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:12px;background:#fff"><option value="todos">Todos</option><option value="productos">Productos</option><option value="accesorios">Accesorios</option></select></div>'+
        '<div><label style="font-size:10px;font-weight:600;color:var(--gray);display:block;margin-bottom:4px">Marca</label><select id="stockFilterBrand" onchange="window._stockPage=1;renderStockList()" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:12px;background:#fff"><option value="">Todas</option>'+sBrandsHtml+'</select></div>'+
        '<div style="display:flex;gap:8px;align-items:flex-end"><button onclick="undoAllStock()" class="btn btn-g btn-sm">Deshacer</button><button onclick="saveAllStock()" class="btn btn-o btn-sm">Guardar</button></div>'+
      '</div>'+
    '</div>'+
    '<div id="stockStatsRow" style="display:flex;gap:12px;margin-bottom:1rem"></div>'+
    '<div id="stockTotalLabel" style="font-size:12px;color:var(--gray);margin-bottom:8px"></div>'+
    '<div style="display:grid;gap:8px" id="stockList"></div>'+
    '<div id="stockPagination"></div>';
    window._stockPage=1;
    window._stockLimit=20;
    waitForFn('renderStockList',function(){renderStockList();});
  }else if(tab==='promos'){
    var pBrands=Array.from(new Set([].concat(PRODUCTS.map(function(p){return p.brand;})).concat((window.ACCS||[]).map(function(a){return a.brand;})).filter(Boolean)));
    var pBrandsHtml=pBrands.map(function(b){return'<option value="'+b+'">'+b+'</option>';}).join('');
    content.innerHTML='<div style="margin-bottom:2rem">'+
      '<h3 style="font-size:24px;font-family:\'Playfair Display\',Georgia,serif;margin-bottom:.5rem">Crear Promoción</h3>'+
      '<p style="font-size:13px;color:var(--gray);margin-bottom:1.5rem">Diseña ofertas exclusivas para tu colección.</p>'+
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:1rem;background:#fff;padding:20px;border-radius:12px;border:1px solid var(--border)">'+
        '<div><label style="font-size:11px;font-weight:600;display:block;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;color:var(--gray)">Tipo</label><select id="promoItemType" onchange="renderPromoProducts()" style="width:100%;padding:12px;border:1.5px solid var(--border);border-radius:8px;font-size:14px"><option value="todos">Todos</option><option value="productos">Productos</option><option value="accesorios">Accesorios</option></select></div>'+
        '<div><label style="font-size:11px;font-weight:600;display:block;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;color:var(--gray)">Marca</label><select id="promoBrand" onchange="renderPromoProducts()" style="width:100%;padding:12px;border:1.5px solid var(--border);border-radius:8px;font-size:14px"><option value="">Todas las Marcas</option>'+pBrandsHtml+'</select></div>'+
        '<div><label style="font-size:11px;font-weight:600;display:block;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;color:var(--gray)">Categoría</label><select id="promoType" onchange="renderPromoProducts()" style="width:100%;padding:12px;border:1.5px solid var(--border);border-radius:8px;font-size:14px"><option value="">Todas</option></select></div>'+
        '<div><label style="font-size:11px;font-weight:600;display:block;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;color:var(--gray)">% Descuento</label><div style="position:relative"><input id="promoDiscount" type="number" placeholder="0" min="0" max="100" style="width:100%;padding:12px;border:1.5px solid var(--border);border-radius:8px;font-size:14px"><span style="position:absolute;right:16px;top:50%;transform:translateY(-50%);font-weight:700;color:var(--orange)">%</span></div></div>'+
        '<div><label style="font-size:11px;font-weight:600;display:block;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;color:var(--gray)">Fecha de inicio</label><input id="promoOfferStartDate" type="datetime-local" style="width:100%;padding:12px;border:1.5px solid var(--border);border-radius:8px;font-size:14px"></div>'+
        '<div><label style="font-size:11px;font-weight:600;display:block;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;color:var(--gray)">Fecha de fin</label><input id="promoOfferEndDate" type="datetime-local" style="width:100%;padding:12px;border:1.5px solid var(--border);border-radius:8px;font-size:14px"></div>'+
      '</div>'+
      '<div style="margin-bottom:1rem">'+
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">'+
          '<h4 style="font-size:18px;font-weight:600">Seleccionar Productos</h4>'+
          '<div style="display:flex;gap:8px">'+
            '<button onclick="selectAllPromo(true)" style="background:var(--green);color:#fff;padding:8px 16px;border-radius:20px;font-size:12px;font-weight:600;border:none;cursor:pointer">Seleccionar todos</button>'+
            '<button onclick="selectAllPromo(false)" style="background:var(--cream2);color:var(--dk);padding:8px 16px;border-radius:20px;font-size:12px;font-weight:600;border:1px solid var(--border);cursor:pointer">Deseleccionar todos</button>'+
          '</div>'+
        '</div>'+
        '<div id="promoProductList" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px"></div>'+
      '</div>'+
      '<button onclick="applyPromo()" style="width:100%;background:var(--orange);color:#fff;padding:16px;border-radius:12px;font-size:14px;font-weight:700;border:none;cursor:pointer;margin-top:1rem">Publicar Promoción</button>'+
      '<div style="margin-top:3rem;border-top:1px solid var(--border);padding-top:2rem">'+
        '<h3 style="font-size:24px;font-family:\'Playfair Display\',Georgia,serif;margin-bottom:.5rem">Administrar Promociones Activas</h3>'+
        '<div style="height:4px;width:80px;background:var(--orange);border-radius:2px;margin-bottom:1.5rem"></div>'+
        '<div style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid var(--border)">'+
          '<table style="width:100%;text-align:left;border-collapse:collapse"><tbody id="activePromosTable"></tbody></table>'+
        '</div>'+
        '<button onclick="deleteSelectedPromos()" style="width:100%;margin-top:12px;padding:14px;background:var(--red);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer">Eliminar promoción</button>'+
      '</div>'+
    '</div>';
    waitForFn('renderPromoProducts',function(){renderPromoProducts();if(typeof renderActivePromos==='function')renderActivePromos();});
  }else if(tab==='cupones'){
    content.innerHTML=
      '<div style="margin-bottom:2rem">'+
        '<div style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:12px;margin-bottom:1.5rem">'+
          '<div>'+
            '<h3 style="font-size:24px;font-family:\'Playfair Display\',Georgia,serif;margin-bottom:.25rem">Cupones</h3>'+
            '<p style="font-size:13px;color:var(--gray);margin:0">Generá cupones, asignalos a usuarios y seguí la ganancia que aportan a la tienda.</p>'+
          '</div>'+
          '<button onclick="openCuponModal()" style="display:inline-flex;align-items:center;gap:8px;background:var(--orange);color:#fff;padding:12px 20px;border-radius:12px;font-size:14px;font-weight:700;border:none;cursor:pointer;box-shadow:0 4px 12px rgba(255,107,44,.3)">+ Crear cupón</button>'+
        '</div>'+
        '<div id="cuponStatsRow" style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:1.5rem"></div>'+
        '<div style="display:flex;gap:8px;margin-bottom:1rem;flex-wrap:wrap;align-items:center;justify-content:space-between">'+
          '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
            '<button class="ord-btn ord-btn-act" id="cupBtnAll" onclick="filterCuponTable(null)">Todos</button>'+
            '<button class="ord-btn" id="cupBtnActive" onclick="filterCuponTable(\'ACTIVE\')">Activos</button>'+
            '<button class="ord-btn" id="cupBtnUsed" onclick="filterCuponTable(\'USED\')">Usados</button>'+
            '<button class="ord-btn" id="cupBtnExpired" onclick="filterCuponTable(\'EXPIRED\')">Expirados</button>'+
          '</div>'+
          '<input type="text" id="cuponSearchInput" placeholder="Buscar por código, email o nombre..." oninput="loadAdminCoupons(this.value)" style="flex:1;max-width:340px;padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;outline:none">'+
        '</div>'+
        '<div id="cuponTableWrap"></div>'+
        '<div id="cuponPagination"></div>'+
      '</div>'+
      '<div id="cuponModalHost"></div>';
    waitForFn('loadAdminCoupons',function(){loadAdminCoupons();loadCuponUsers();});
  }else if(tab==='arrep'){
    content.innerHTML='<div style="display:flex;gap:8px;margin-bottom:1rem;flex-wrap:wrap;align-items:center">'+
      '<button class="ord-btn ord-btn-act" id="arrepBtnPendientes" onclick="loadArrepPendientes()">Pendientes</button>'+
      '<button class="ord-btn" id="arrepBtnAceptados" onclick="loadArrepAceptados()">Aceptados</button>'+
      '<button class="ord-btn" id="arrepBtnRechazados" onclick="loadArrepRechazados()">Rechazados</button>'+
    '</div><div class="adm-list" id="arrepList"></div>';
    waitForFn('loadArrepPendientes',function(){loadArrepPendientes();});
  }else if(tab==='chat'){
    content.innerHTML='<div style="display:flex;gap:0;height:calc(100vh - 140px);background:#fff;border-radius:12px;border:1px solid var(--border);overflow:hidden">'+
      '<div style="width:280px;border-right:1px solid var(--border);overflow-y:auto">'+
        '<div style="padding:14px;border-bottom:1px solid var(--border)"><h3 style="font-size:15px;font-weight:700">Conversaciones</h3></div>'+
        '<div id="adminConvList"></div>'+
      '</div>'+
      '<div style="flex:1;display:flex;flex-direction:column;background:var(--cream)">'+
        '<div id="adminChatHeader" style="padding:14px;background:#fff;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">'+
          '<div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">'+
            '<span id="adminChatName" style="font-size:13px;font-weight:600;color:var(--gray);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Seleccioná una conversación</span>'+
          '</div>'+
        '</div>'+
        '<div id="adminMsgList" style="flex:1;overflow-y:auto;padding:14px"></div>'+
        '<div id="adminChatInputArea" style="padding:12px;border-top:1px solid var(--border);background:#fff"></div>'+
      '</div>'+
    '</div>';
    waitForFn('loadAdminConversations',function(){
      loadAdminConversations();
      if(typeof initChatSocket==='function')initChatSocket();
      if(typeof initChatSound==='function')initChatSound();
    });
  }else{
    content.innerHTML='<div style="text-align:center;padding:2rem;color:var(--gray)">Sección en desarrollo</div>';
  }
}

// Mantener el nombre original como alias para no romper nada que dependa de el.
function renderAdminContent(tab){
  if(typeof ADMIN_TITLES!=='undefined'&&ADMIN_TITLES[tab]){
    var t=document.getElementById('adminPageTitle');
    if(t)t.textContent=ADMIN_TITLES[tab];
  }
  _renderAdminLegacy(tab);
}

function loadAdminProducts(search,page){
  // Deprecated: la lista de productos admin ahora usa tarjetas en grilla
  // (renderAdminProductsFiltered en render.js). Mantenemos el nombre por
  // compatibilidad con callers legacy que puedan invocarlo.
  if(typeof renderAdminProductsFiltered==='function')renderAdminProductsFiltered(search||'');
}

function loadAdminAccessories(search,page){
  // Deprecated: la lista de accesorios admin ahora usa tarjetas en grilla
  // (renderAdminAccFiltered en render.js). Mantenemos el nombre por
  // compatibilidad con callers legacy que puedan invocarlo.
  if(typeof renderAdminAccFiltered==='function')renderAdminAccFiltered(search||'');
}

// =========== ORDERS ===========
window._currentOrders=[];
window._currentOrderTab='pending';

function setActiveOrderBtn(activeId){
  ['btnPendingOrders','btnAcceptedOrders','btnHistoryOrders'].forEach(function(id){
    var btn=document.getElementById(id);
    if(!btn)return;
    if(id===activeId){
      btn.classList.add('ord-btn-act');
      btn.classList.remove('ord-btn');
    }else{
      btn.classList.add('ord-btn');
      btn.classList.remove('ord-btn-act');
    }
  });
}

function loadPendingOrders(page){
  var list=document.getElementById('orderList');
  if(!list)return;
  setActiveOrderBtn('btnPendingOrders');
  window._currentOrderTab='pending';
  
  var url=API_URL+'/api/orders?admin=true&status=PENDING,PROCESSING&page='+(page||1)+'&limit=20';
  fetch(url,{headers:{}}).then(function(r){
    if(!r.ok)throw new Error('HTTP '+r.status);
    return r.json();
  }).then(function(res){
    if(res.error){list.innerHTML='<div style="text-align:center;padding:2rem;color:var(--red)">'+res.error+'</div>';return;}
    var ords=res.data||res;
    window._currentOrders=ords;
    window._currentOrderPage=res.page||1;
    window._currentOrderTotalPages=res.totalPages||1;
    renderOrdersList(ords);
    renderPagination('orderList',res.page,res.totalPages,function(p){loadPendingOrders(p);});
  }).catch(function(e){list.innerHTML='<div style="text-align:center;padding:2rem;color:var(--red)">Error cargando pedidos: '+e.message+'</div>';});
}

function loadAcceptedOrders(page){
  var list=document.getElementById('orderList');
  if(!list)return;
  setActiveOrderBtn('btnAcceptedOrders');
  window._currentOrderTab='accepted';
  
  var url=API_URL+'/api/orders?admin=true&status=SHIPPED&page='+(page||1)+'&limit=20';
  fetch(url,{headers:{}}).then(function(r){
    if(!r.ok)throw new Error('HTTP '+r.status);
    return r.json();
  }).then(function(res){
    if(res.error){list.innerHTML='<div style="text-align:center;padding:2rem;color:var(--red)">'+res.error+'</div>';return;}
    var ords=res.data||res;
    window._currentOrders=ords;
    window._currentOrderPage=res.page||1;
    window._currentOrderTotalPages=res.totalPages||1;
    renderOrdersList(ords);
    renderPagination('orderList',res.page,res.totalPages,function(p){loadAcceptedOrders(p);});
  }).catch(function(e){list.innerHTML='<div style="text-align:center;padding:2rem;color:var(--red)">Error cargando pedidos aceptados: '+e.message+'</div>';});
}

function loadOrderHistory(page){
  var list=document.getElementById('orderList');
  if(!list)return;
  setActiveOrderBtn('btnHistoryOrders');
  window._currentOrderTab='history';
  
  var url=API_URL+'/api/orders?admin=true&status=DELIVERED,CANCELLED&page='+(page||1)+'&limit=20';
  fetch(url,{headers:{}}).then(function(r){
    if(!r.ok)throw new Error('HTTP '+r.status);
    return r.json();
  }).then(function(res){
    if(res.error){list.innerHTML='<div style="text-align:center;padding:2rem;color:var(--red)">'+res.error+'</div>';return;}
    var ords=res.data||res;
    window._currentOrders=ords;
    window._currentOrderPage=res.page||1;
    window._currentOrderTotalPages=res.totalPages||1;
    renderOrdersList(ords);
    renderPagination('orderList',res.page,res.totalPages,function(p){loadOrderHistory(p);});
  }).catch(function(e){list.innerHTML='<div style="text-align:center;padding:2rem;color:var(--red)">Error cargando historial: '+e.message+'</div>';});
}

function searchOrders(query){
  var list=document.getElementById('orderList');
  if(!list)return;
  if(!query||!query.trim()){
    if(window._currentOrderTab==='pending')loadPendingOrders();
    else if(window._currentOrderTab==='accepted')loadAcceptedOrders();
    else loadOrderHistory();
    return;
  }
  var url=API_URL+'/api/orders?admin=true&search='+encodeURIComponent(query.trim())+'&page=1&limit=20';
  fetch(url,{headers:{}}).then(function(r){return r.json();}).then(function(res){
    var ords=res.data||res;
    window._currentOrders=ords;
    window._currentOrderPage=res.page||1;
    window._currentOrderTotalPages=res.totalPages||1;
    renderOrdersList(ords);
    renderPagination('orderList',res.page,res.totalPages,function(p){
      fetch(API_URL+'/api/orders?admin=true&search='+encodeURIComponent(query.trim())+'&page='+p+'&limit=20',{headers:{}})
        .then(function(r2){return r2.json();}).then(function(res2){
          window._currentOrders=res2.data||res2;
          renderOrdersList(res2.data||res2);
          renderPagination('orderList',res2.page,res2.totalPages,function(p2){searchOrders(query);});
        });
    });
  }).catch(function(){list.innerHTML='<div style="text-align:center;padding:2rem;color:var(--red)">Error buscando pedidos</div>';});
}

function renderPagination(containerId,currentPage,totalPages,onPageChange){
  var containerIdMap={prodList:'prodPagination',accList:'accPagination',orderList:'orderPagination'};
  var container=document.getElementById(containerIdMap[containerId]||'');
  if(!container||totalPages<=1){if(container)container.innerHTML='';return;}
  var html='<div style="display:flex;align-items:center;justify-content:center;gap:4px;margin-top:1rem;padding:1rem">';
  html+='<button onclick="('+onPageChange.toString()+')('+Math.max(1,currentPage-1)+')"'+(currentPage===1?' disabled style="opacity:.4;cursor:not-allowed"':'')+' style="padding:6px 12px;border:1px solid var(--border);border-radius:6px;background:#fff;font-size:13px;cursor:pointer">←</button>';
  var start=Math.max(1,currentPage-2);
  var end=Math.min(totalPages,currentPage+2);
  if(start>1)html+='<button onclick="('+onPageChange.toString()+')(1)" style="padding:6px 12px;border:1px solid var(--border);border-radius:6px;background:#fff;font-size:13px;cursor:pointer">1</button>';
  if(start>2)html+='<span style="padding:6px;color:var(--gray)">...</span>';
  for(var i=start;i<=end;i++){
    if(i===currentPage)html+='<span style="padding:6px 12px;border-radius:6px;background:var(--orange);color:#fff;font-size:13px;font-weight:600">'+i+'</span>';
    else html+='<button onclick="('+onPageChange.toString()+')('+i+')" style="padding:6px 12px;border:1px solid var(--border);border-radius:6px;background:#fff;font-size:13px;cursor:pointer">'+i+'</button>';
  }
  if(end<totalPages-1)html+='<span style="padding:6px;color:var(--gray)">...</span>';
  if(end<totalPages)html+='<button onclick="('+onPageChange.toString()+')('+totalPages+')" style="padding:6px 12px;border:1px solid var(--border);border-radius:6px;background:#fff;font-size:13px;cursor:pointer">'+totalPages+'</button>';
  html+='<button onclick="('+onPageChange.toString()+')('+Math.min(totalPages,currentPage+1)+')"'+(currentPage===totalPages?' disabled style="opacity:.4;cursor:not-allowed"':'')+' style="padding:6px 12px;border:1px solid var(--border);border-radius:6px;background:#fff;font-size:13px;cursor:pointer">→</button>';
  html+='</div>';
  container.innerHTML=html;
}

function renderOrdersList(ords){
  var list=document.getElementById('orderList');
  if(!list)return;

  if(!ords||ords.length===0){
    var emptyMsg='No hay pedidos';
    var emptyIcon='📦';
    if(window._currentOrderTab==='pending'){emptyMsg='No hay pedidos en espera';emptyIcon='📦';}
    else if(window._currentOrderTab==='accepted'){emptyMsg='No hay pedidos aceptados';emptyIcon='🚚';}
    else if(window._currentOrderTab==='history'){emptyMsg='No hay pedidos en el historial';emptyIcon='📜';}
    list.innerHTML='<div class="gp-empty"><div class="gp-empty-ico">'+emptyIcon+'</div><div class="gp-empty-title">'+emptyMsg+'</div><div class="gp-empty-sub">Los pedidos aparecerán aquí cuando los usuarios compren</div></div>';
    return;
  }

  var STATUS={
    PENDING:{label:'Esperando',bg:'var(--orange)',fg:'#fff'},
    PROCESSING:{label:'En preparación',bg:'#3b82f6',fg:'#fff'},
    SHIPPED:{label:'En camino',bg:'#8b5cf6',fg:'#fff'},
    DELIVERED:{label:'Entregado',bg:'var(--green)',fg:'#fff'},
    CANCELLED:{label:'Cancelado',bg:'var(--red)',fg:'#fff'}
  };

  list.innerHTML='<div class="gp-list">'+ords.map(function(o){
    var date=new Date(o.createdAt);
    var dateStr=date.toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'});
    var timeStr=date.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
    var userName=o.user?o.user.name:'Cliente';
    var userEmail=o.user?o.user.email:(o.clientEmail||'');
    var itemsCount=o.items?o.items.length:0;
    var itemsSummary=o.items?o.items.map(function(i){return i.productName||i.name;}).join(', '):'';
    if(itemsSummary.length>42)itemsSummary=itemsSummary.substring(0,42)+'…';
    var deliveryLabel='Retiro en tienda';
    var deliveryIco='🏪';
    if(o.shippingProvince&&o.shippingProvince!=='Buenos Aires'){deliveryLabel='Envío al interior';deliveryIco='🚚';}
    else if(o.shippingCity==='Bahia Blanca'||o.shippingProvince==='Buenos Aires'){deliveryLabel='Envío en Bahía Blanca';deliveryIco='🛵';}
    var st=STATUS[o.status]||{label:o.status,bg:'var(--gray)',fg:'#fff'};
    var arrepNote='';
    if(o.arrepStatus==='ARREP_OK')arrepNote='<div class="gp-field-value muted" style="color:#059669">↩ Con arrepentimiento aprobado</div>';
    else if(o.arrepStatus==='ARREP_RECHAZADO')arrepNote='<div class="gp-field-value muted" style="color:#dc2626">↩ Arrepentimiento rechazado</div>';
    var invoiceAction='';
    if(o.invoice){
      invoiceAction='<span class="gp-pill" style="--gp-pill-bg:#10b981;--gp-pill-fg:#fff;font-size:10px">🧾 '+esc(o.invoice.type)+' N° '+esc(o.invoice.number)+'</span>';
    }else{
      invoiceAction='<button class="gp-btn gp-btn-ghost" onclick="event.stopPropagation();openInvoiceModal(\''+o.id+'\')">🧾 Facturar</button>';
    }
    return'<div class="gp-card" style="--gp-accent:'+st.bg+'" onclick="openOrderDetail(\''+o.id+'\')">'+
      '<div class="gp-card-head">'+
        '<div style="min-width:0">'+
          '<div class="gp-card-title">'+esc(o.code)+'</div>'+
          '<div class="gp-card-sub">'+esc(userName)+'</div>'+
        '</div>'+
        '<span class="gp-pill" style="--gp-pill-bg:'+st.bg+';--gp-pill-fg:'+st.fg+'"><span class="gp-dot"></span>'+st.label+'</span>'+
      '</div>'+
      '<div class="gp-fields">'+
'<div class="gp-field"><div class="gp-field-label">Cliente</div><div class="gp-field-value">'+esc(userEmail||'—')+'</div></div>'+
          (o.clientDni?'<div class="gp-field"><div class="gp-field-label">DNI</div><div class="gp-field-value">'+esc(o.clientDni)+'</div></div>':'')+
        '<div class="gp-field"><div class="gp-field-label">Productos</div><div class="gp-field-value">'+itemsCount+' · '+esc(itemsSummary||'—')+'</div></div>'+
        '<div class="gp-field"><div class="gp-field-label">Entrega</div><div class="gp-field-value">'+deliveryIco+' '+deliveryLabel+'</div></div>'+
        '<div class="gp-field"><div class="gp-field-label">Fecha</div><div class="gp-field-value">'+dateStr+' '+timeStr+'</div></div>'+
        arrepNote+
      '</div>'+
      '<div class="gp-card-foot">'+
        '<div><span class="gp-total-label">Total del pedido</span><span class="gp-total-value">$'+o.total.toLocaleString('es-AR')+'</span></div>'+
        '<div class="gp-actions">'+
          invoiceAction+
          '<button class="gp-btn gp-btn-ghost" onclick="event.stopPropagation();openOrderDetail(\''+o.id+'\')">Ver detalle →</button>'+
        '</div>'+
      '</div>'+
    '</div>';
  }).join('')+'</div>';
}

function openOrderDetail(orderId){
  fetch(API_URL+'/api/orders?admin=true&page=1&limit=100',{headers:{}}).then(function(r){return r.json();}).then(function(res){
    var ords=res.data||res;
    var order=ords.find(function(o){return o.id===orderId;});
    if(!order){showToast('Pedido no encontrado');return;}
    showOrderModal(order);
  }).catch(function(e){showToast('Error cargando pedido: '+e.message);});
}

function showOrderModal(order){
  var existing=document.getElementById('orderDetailModal');
  if(existing)existing.remove();
  
  var date=new Date(order.createdAt);
  var dateStr=date.toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  var userName=order.user?order.user.name:'Cliente';
  var userEmail=order.user?order.user.email:(order.clientEmail||'');
  var userPhone=order.user?order.user.phone:(order.clientPhone||'');
  var userDni=order.clientDni||'';
  
  var deliveryLabel='Retiro en tienda';
  var deliveryAddress='';
  if(order.shippingProvince&&order.shippingProvince!=='Buenos Aires'){
    deliveryLabel='Envio al pais';
    deliveryAddress=[order.shippingStreet,order.shippingNumber,order.shippingFloor,order.shippingCity,order.shippingProvince,order.shippingZip].filter(Boolean).join(', ');
  }else if(order.shippingCity==='Bahia Blanca'||order.shippingProvince==='Buenos Aires'){
    deliveryLabel='Envio en Bahia Blanca';
    deliveryAddress=[order.shippingStreet,order.shippingNumber,order.shippingFloor,order.shippingCity,order.shippingProvince,order.shippingZip].filter(Boolean).join(', ');
  }
  
  var itemsHtml=(order.items||[]).map(function(item){
    var img=item.productImage?'<img src="'+esc(item.productImage)+'" onclick="openLightbox(\''+jsStr(item.productImage)+'\')" style="width:48px;height:48px;object-fit:cover;border-radius:8px;cursor:zoom-in">':'<div style="width:48px;height:48px;background:var(--cream2);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:20px">📱</div>';
    return'<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">'+
      img+
      '<div style="flex:1">'+
        '<div style="font-size:13px;font-weight:600">'+esc(item.productName||item.name)+'</div>'+
        '<div style="font-size:11px;color:var(--gray)">'+esc(item.productBrand||'')+' '+esc(item.productSub||'')+'</div>'+
        '<div style="font-size:11px;color:var(--gray)">Cantidad: '+item.quantity+'</div>'+
      '</div>'+
      '<div style="text-align:right">'+
        '<div style="font-size:14px;font-weight:600">$'+(item.price*item.quantity).toLocaleString('es-AR')+'</div>'+
        '<div style="font-size:11px;color:var(--gray)">$'+item.price.toLocaleString('es-AR')+' c/u</div>'+
      '</div>'+
    '</div>';
  }).join('');
  
  var paymentLabel='Pago en 1 cuota';
  if(order.cuotas&&order.cuotas>1){
    paymentLabel='Pago en '+order.cuotas+' cuotas';
  }
  if(order.payment){
    paymentLabel=order.payment;
  }
  
  var warrantyLabel='Sin garantia';
  if(order.warranty){
    warrantyLabel='Garantia: '+order.warranty;
    if(order.warrantyCost&&order.warrantyCost>0){
      warrantyLabel+=' (+$'+order.warrantyCost.toLocaleString('es-AR')+')';
    }
  }

  var couponLabel='';
  if(order.orderCoupons&&order.orderCoupons.length>0){
    couponLabel=order.orderCoupons.map(function(oc){
      return '<div style="font-size:12px;color:#6366f1;margin-top:2px"><strong>Cupon:</strong> '+esc(oc.coupon.code)+' (-$'+oc.amountUsed.toLocaleString('es-AR')+')</div>';
    }).join('');
  }
  
  var invoiceBtn='';
  if(order.invoice){
    invoiceBtn='<div style="margin-top:12px;padding:12px;background:#f0fdf4;border-radius:10px">'+
      '<div style="font-size:12px;font-weight:600;color:#059669;margin-bottom:4px">🧾 Factura '+esc(order.invoice.type)+' N° '+esc(order.invoice.number)+'</div>'+
      '<div style="font-size:11px;color:#6b7280">CAE: '+esc(order.invoice.cae)+(order.invoice.caeExpiry?' · Vence el '+new Date(order.invoice.caeExpiry).toLocaleDateString('es-AR'):'')+'</div>'+
    '</div>';
  }else{
    invoiceBtn='<button onclick="openInvoiceModal(\''+order.id+'\')" style="width:100%;padding:12px;background:#0ea5a4;color:#fff;border:none;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;margin-top:1rem">🧾 Emitir factura ARCA</button>';
  }
  var actionBtn='';
  if(order.status==='PENDING'){
    actionBtn='<button onclick="acceptOrder(\''+order.id+'\')" style="width:100%;padding:14px;background:var(--orange);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;margin-top:1rem">Aceptar pedido</button>';
  }else if(order.status==='PROCESSING'){
    actionBtn='<div style="margin-top:1rem">'+
      '<button onclick="shipOrder(\''+order.id+'\')" style="width:100%;padding:14px;background:#8b5cf6;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:8px">Marcar como enviado</button>'+
      '<button onclick="finalizeOrder(\''+order.id+'\')" style="width:100%;padding:14px;background:var(--green);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer">Finalizar pedido</button>'+
    '</div>';
  }else if(order.status==='SHIPPED'){
    actionBtn='<button onclick="finalizeOrder(\''+order.id+'\')" style="width:100%;padding:14px;background:var(--green);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;margin-top:1rem">Finalizar pedido</button>';
  }
  
  var modal=document.createElement('div');
  modal.id='orderDetailModal';
  modal.style.cssText='display:flex;position:fixed;inset:0;z-index:900;align-items:center;justify-content:center;opacity:0;transition:opacity .3s';
  modal.innerHTML='<div style="position:absolute;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px)" onclick="closeOrderDetail()"></div>'+
    '<div style="position:relative;background:#fff;border-radius:20px;width:min(700px,95%);max-height:90vh;overflow-y:auto;box-shadow:0 25px 80px rgba(0,0,0,.35);transform:scale(.9);transition:transform .3s" class="order-detail-modal">'+
      '<div style="padding:1.5rem 2rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:#fff;z-index:10;border-radius:20px 20px 0 0" class="od-header">'+
        '<div>'+
          '<h3 style="font-family:\'Playfair Display\',Georgia,serif;font-size:20px;font-weight:700">'+esc(order.code)+'</h3>'+
          '<p style="font-size:12px;color:var(--gray)">'+dateStr+'</p>'+
        '</div>'+
        '<button onclick="closeOrderDetail()" style="background:none;border:none;font-size:24px;cursor:pointer;color:var(--gray);width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:50%" onmouseover="this.style.background=\'var(--cream2)\'" onmouseout="this.style.background=\'none\'">×</button>'+
      '</div>'+
      '<div style="padding:1.5rem 2rem" class="od-content">'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1.5rem" class="od-grid">'+
          '<div style="background:var(--cream2);border-radius:12px;padding:1rem">'+
            '<div style="font-size:11px;font-weight:600;color:var(--gray);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Cliente</div>'+
            '<div style="font-size:14px;font-weight:600">'+esc(userName)+'</div>'+
            '<div style="font-size:12px;color:var(--gray)">'+esc(userEmail)+'</div>'+
            (userPhone?'<div style="font-size:12px;color:var(--gray)">'+esc(userPhone)+'</div>':'')+
            (userDni?'<div style="font-size:12px;color:var(--gray)">DNI: '+esc(userDni)+'</div>':'')+
          '</div>'+
          '<div style="background:var(--cream2);border-radius:12px;padding:1rem">'+
            '<div style="font-size:11px;font-weight:600;color:var(--gray);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Envio</div>'+
            '<div style="font-size:14px;font-weight:600">'+deliveryLabel+'</div>'+
            (deliveryAddress?'<div style="font-size:12px;color:var(--gray);margin-top:4px">'+esc(deliveryAddress)+'</div>':'')+
            (order.trackingNumber?'<div style="font-size:12px;color:#8b5cf6;margin-top:6px;font-weight:600">Tracking: '+esc(order.trackingNumber)+'</div>':'')+
            (order.shippedAt?'<div style="font-size:11px;color:var(--gray);margin-top:2px">Enviado el '+new Date(order.shippedAt).toLocaleDateString('es-AR')+'</div>':'')+
          '</div>'+
        '</div>'+
        '<div style="font-size:11px;font-weight:600;color:var(--gray);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Productos</div>'+
        '<div style="border:1px solid var(--border);border-radius:12px;padding:0 1rem">'+itemsHtml+'</div>'+
        '<div style="margin-top:1.5rem;border-top:2px solid var(--dk);padding-top:1rem">'+
          '<div style="display:flex;justify-content:space-between;font-size:13px;color:var(--gray);margin-bottom:6px">'+
            '<span>Subtotal</span><span>$'+order.subtotal.toLocaleString('es-AR')+'</span>'+
          '</div>'+
          (order.warrantyCost>0?'<div style="display:flex;justify-content:space-between;font-size:13px;color:var(--gray);margin-bottom:6px"><span>Garantia</span><span>+$'+order.warrantyCost.toLocaleString('es-AR')+'</span></div>':'')+
          (order.deliveryCost>0?'<div style="display:flex;justify-content:space-between;font-size:13px;color:var(--gray);margin-bottom:6px"><span>Envio</span><span>+$'+order.deliveryCost.toLocaleString('es-AR')+'</span></div>':'')+
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">'+
            '<span style="font-size:16px;font-weight:700">Total</span>'+
            '<span style="font-size:22px;font-weight:700;font-family:\'Playfair Display\',serif;color:var(--orange)">$'+order.total.toLocaleString('es-AR')+'</span>'+
          '</div>'+
          (order.cuotas>1?'<div style="text-align:right;font-size:12px;color:var(--green);margin-top:4px">'+order.cuotas+'x sin interes de $'+Math.round(order.total/order.cuotas).toLocaleString('es-AR')+'</div>':'')+
          '<div style="margin-top:12px;padding:10px;background:var(--cream2);border-radius:8px">'+
            '<div style="font-size:12px;color:var(--gray)"><strong>Metodo de pago:</strong> '+esc(paymentLabel)+'</div>'+
            '<div style="font-size:12px;color:var(--gray);margin-top:4px">'+esc(warrantyLabel)+'</div>'+
            couponLabel+
        '</div>'+
        (order.arrepStatus==='ARREP_OK'?'<div style="margin-top:1rem;padding:12px;background:#f0fdf4;border-radius:10px">'+
          '<div style="font-size:12px;font-weight:600;color:#059669;margin-bottom:4px">Arrepentimiento aceptado</div>'+
          '<div style="font-size:11px;color:#6b7280">Devolucion procesada segun Ley 24.240. Reembolso total incluido.</div>'+
        '</div>':'')+
        (order.arrepStatus==='ARREP_RECHAZADO'?'<div style="margin-top:1rem;padding:12px;background:#fef2f2;border-radius:10px">'+
          '<div style="font-size:12px;font-weight:600;color:#dc2626;margin-bottom:6px">Arrepentimiento rechazado</div>'+
          '<div style="display:flex;flex-wrap:wrap;gap:4px">'+
            ((order.arrepReason||'').split(';').filter(Boolean).map(function(r){
              var clean=r.trim();
              if(clean.indexOf('Comentario:')!==-1)return'';
              return'<span style="display:inline-block;padding:3px 8px;background:#fef2f2;color:#dc2626;border-radius:5px;font-size:10px;font-weight:500">'+esc(clean)+'</span>';
            }).join(''))+
          '</div>'+
          (((order.arrepReason||'').split(';').filter(Boolean).find(function(r){return r.indexOf('Comentario:')!==-1})||'').split('Comentario:')[1]?'<div style="font-size:11px;color:var(--gray);margin-top:6px;padding-top:6px;border-top:1px solid #fecaca"><strong>Comentario:</strong> '+esc((((order.arrepReason||'').split(';').filter(Boolean).find(function(r){return r.indexOf('Comentario:')!==-1})||'').split('Comentario:')[1]).trim())+'</div>':'')+
        '</div>':'')+
        invoiceBtn+
        actionBtn+
      '</div>'+
    '</div>';
  
  document.body.appendChild(modal);
  modal.offsetHeight;
  setTimeout(function(){
    modal.style.opacity='1';
    modal.querySelector('div:nth-child(2)').style.transform='scale(1)';
  },10);
}

function closeOrderDetail(){
  var modal=document.getElementById('orderDetailModal');
  if(!modal)return;
  modal.style.opacity='0';
  modal.querySelector('div:nth-child(2)').style.transform='scale(.9)';
  setTimeout(function(){modal.remove();},300);
}

// =========== FACTURACIÓN ARCA ===========
function openInvoiceModal(orderId){
  fetch(API_URL+'/api/orders?admin=true&page=1&limit=100',{headers:{}}).then(function(r){return r.json();}).then(function(res){
    var ords=res.data||res;
    var order=ords.find(function(o){return o.id===orderId;});
    if(!order){showErrorToast('Error', 'Pedido no encontrado');return;}
    if(order.invoice){
      showAlert('Pedido ya facturado', 'Esta orden ya tiene la factura '+order.invoice.type+' N° '+order.invoice.number+(order.invoice.cae?' · CAE '+order.invoice.cae:''), 'success');
      return;
    }
    renderInvoiceModal(order);
  }).catch(function(e){showErrorToast('Error', 'No se pudo cargar el pedido: '+e.message);});
}

function renderInvoiceModal(order){
  var existing=document.getElementById('invoiceModal');
  if(existing)existing.remove();

  var defaultDoc=order.clientCuil||order.clientDni||'';

  var modal=document.createElement('div');
  modal.id='invoiceModal';
  modal.style.cssText='display:flex;position:fixed;inset:0;z-index:960;align-items:center;justify-content:center;opacity:0;transition:opacity .3s';
  modal.innerHTML='<div style="position:absolute;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px)" onclick="closeInvoiceModal()"></div>'+
    '<div style="position:relative;background:#fff;border-radius:20px;width:min(460px,95%);box-shadow:0 25px 80px rgba(0,0,0,.35);transform:scale(.9);transition:transform .3s" class="invoice-modal">'+
      '<div style="padding:1.5rem 2rem;border-bottom:1px solid var(--border)">'+
        '<h3 style="font-family:\'Playfair Display\',Georgia,serif;font-size:18px;font-weight:700;color:var(--orange)">🧾 Facturar pedido</h3>'+
        '<p style="font-size:12px;color:var(--gray);margin-top:4px">'+order.code+' · Total $'+order.total.toLocaleString('es-AR')+'</p>'+
      '</div>'+
      '<div style="padding:1.5rem 2rem" class="invoice-content">'+
        '<label style="font-size:12px;font-weight:600;color:var(--gray);display:block;margin-bottom:6px">Tipo de comprobante</label>'+
        '<select id="invoiceTipoInput" onchange="onInvoiceTipoChange()" style="width:100%;padding:12px 16px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;background:#fff;outline:none;box-sizing:border-box">'+
          '<option value="B">Factura B — Consumidor final</option>'+
          '<option value="A">Factura A — Requiere CUIT del cliente</option>'+
          '<option value="C">Factura C — Consumidor final</option>'+
        '</select>'+
        '<div id="invoiceDocField" style="display:none;margin-top:1rem">'+
          '<label style="font-size:12px;font-weight:600;color:var(--gray);display:block;margin-bottom:6px">CUIT del cliente</label>'+
          '<input type="text" id="invoiceDocInput" placeholder="Ej: 20123456789" value="'+defaultDoc+'" style="width:100%;padding:12px 16px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;box-sizing:border-box;outline:none" onfocus="this.style.borderColor=\'var(--orange)\'" onblur="this.style.borderColor=\'var(--border)\'">'+
        '</div>'+
        '<div style="background:var(--cream2);border-radius:10px;padding:10px 12px;margin-top:1rem">'+
          '<div style="font-size:11px;color:var(--gray)">El IVA y los totales se calculan automáticamente. El CAE y el número de comprobante los otorga ARCA.</div>'+
        '</div>'+
        '<div style="display:flex;gap:10px;margin-top:1.25rem">'+
          '<button onclick="closeInvoiceModal()" style="flex:1;padding:12px;background:var(--cream2);color:var(--dk);border:1px solid var(--border);border-radius:10px;font-size:13px;font-weight:600;cursor:pointer">Cancelar</button>'+
          '<button id="invoiceSubmitBtn" onclick="confirmInvoice(\''+order.id+'\',this)" style="flex:1;padding:12px;background:var(--orange);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">Emitir factura</button>'+
        '</div>'+
      '</div>'+
    '</div>';

  document.body.appendChild(modal);
  modal.offsetHeight;
  setTimeout(function(){
    modal.style.opacity='1';
    modal.querySelector('div:nth-child(2)').style.transform='scale(1)';
  },10);
}

function onInvoiceTipoChange(){
  var tipo=document.getElementById('invoiceTipoInput').value;
  var field=document.getElementById('invoiceDocField');
  if(field)field.style.display=(tipo==='A')?'block':'none';
}

function confirmInvoice(orderId,btn){
  var tipo=document.getElementById('invoiceTipoInput').value;
  var body={orderId:orderId,cbteTipo:tipo};
  if(tipo==='A'){
    var docNro=document.getElementById('invoiceDocInput').value.trim();
    if(docNro)body.docNro=parseInt(docNro.replace(/\D/g,''),10)||0;
  }
  if(btn){btn.disabled=true;btn.innerHTML='Facturando…';}
  fetch(API_URL+'/api/invoices',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(body)
  }).then(function(r){return r.json();}).then(function(res){
    if(res.error){
      var msg=res.error;
      if(res.details&&res.details.observaciones&&res.details.observaciones.length){
        msg+=' — '+res.details.observaciones.map(function(o){return '['+o.code+'] '+o.msg;}).join('; ');
      }
      showAlert('No se pudo facturar', msg, 'error');
      if(btn){btn.disabled=false;btn.innerHTML='Emitir factura';}
      return;
    }
    var inv=res.data;
    showSuccessToast('Factura emitida', inv.type+' N° '+inv.number+' · CAE '+inv.cae);
    closeInvoiceModal();
    if(window._currentOrderTab==='pending')loadPendingOrders();
    else if(window._currentOrderTab==='accepted')loadAcceptedOrders();
    else loadOrderHistory();
  }).catch(function(e){
    showAlert('No se pudo facturar', e.message, 'error');
    if(btn){btn.disabled=false;btn.innerHTML='Emitir factura';}
  });
}

function closeInvoiceModal(){
  var modal=document.getElementById('invoiceModal');
  if(!modal)return;
  modal.style.opacity='0';
  modal.querySelector('div:nth-child(2)').style.transform='scale(.9)';
  setTimeout(function(){modal.remove();},300);
}

function acceptOrder(orderId){
  showConfirm(
    'Aceptar pedido',
    '¿Confirmas que aceptas este pedido?',
    { confirmText: 'Aceptar', confirmClass: 'primary' }
  ).then(function(confirmed){
    if(!confirmed) return;
    
    fetch(API_URL+'/api/orders?id='+orderId,{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({status:'PROCESSING'})
    }).then(function(r){return r.json();}).then(function(){
      showSuccessToast('Pedido aceptado', 'El pedido ha sido procesado correctamente');
      closeOrderDetail();
      loadPendingOrders();
    }).catch(function(){showErrorToast('Error', 'No se pudo aceptar el pedido');});
  });
}

function finalizeOrder(orderId){
  showConfirm(
    'Finalizar pedido',
    '¿Confirmas que el cliente recibió los productos? Esta acción marcará el pedido como finalizado.',
    { confirmText: 'Finalizar', confirmClass: 'primary' }
  ).then(function(confirmed){
    if(!confirmed) return;
    
    fetch(API_URL+'/api/orders?id='+orderId,{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({status:'DELIVERED'})
    }).then(function(r){return r.json();}).then(function(){
      showSuccessToast('Pedido finalizado', 'El pedido ha sido marcado como entregado');
      closeOrderDetail();
      loadAcceptedOrders();
    }).catch(function(){showErrorToast('Error', 'No se pudo finalizar el pedido');});
  });
}

function shipOrder(orderId){
  var existing=document.getElementById('shipOrderModal');
  if(existing)existing.remove();
  
  var modal=document.createElement('div');
  modal.id='shipOrderModal';
  modal.style.cssText='display:flex;position:fixed;inset:0;z-index:950;align-items:center;justify-content:center;opacity:0;transition:opacity .3s';
  modal.innerHTML='<div style="position:absolute;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px)" onclick="closeShipOrderModal()"></div>'+
    '<div style="position:relative;background:#fff;border-radius:20px;width:min(450px,95%);box-shadow:0 25px 80px rgba(0,0,0,.35);transform:scale(.9);transition:transform .3s" class="ship-modal">'+
      '<div style="padding:1.5rem 2rem;border-bottom:1px solid var(--border)">'+
        '<h3 style="font-family:\'Playfair Display\',Georgia,serif;font-size:18px;font-weight:700;color:#8b5cf6">Marcar como enviado</h3>'+
        '<p style="font-size:12px;color:var(--gray);margin-top:4px">Ingresa el numero de tracking del envio</p>'+
      '</div>'+
      '<div style="padding:1.5rem 2rem" class="ship-content">'+
        '<label style="font-size:12px;font-weight:600;color:var(--gray);display:block;margin-bottom:6px">Numero de tracking</label>'+
        '<input type="text" id="shipTrackingInput" placeholder="Ej: AR123456789AR" style="width:100%;padding:12px 16px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;box-sizing:border-box;outline:none" onfocus="this.style.borderColor=\'#8b5cf6\'">'+
        '<div style="display:flex;gap:10px;margin-top:1.25rem">'+
          '<button onclick="closeShipOrderModal()" style="flex:1;padding:12px;background:var(--cream2);color:var(--dk);border:1px solid var(--border);border-radius:10px;font-size:13px;font-weight:600;cursor:pointer">Cancelar</button>'+
          '<button onclick="confirmShipOrder(\''+orderId+'\')" style="flex:1;padding:12px;background:#8b5cf6;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">Enviar</button>'+
        '</div>'+
      '</div>'+
    '</div>';
  
  document.body.appendChild(modal);
  modal.offsetHeight;
  setTimeout(function(){
    modal.style.opacity='1';
    modal.querySelector('div:nth-child(2)').style.transform='scale(1)';
    var input=document.getElementById('shipTrackingInput');
    if(input)input.focus();
  },10);
}

function closeShipOrderModal(){
  var modal=document.getElementById('shipOrderModal');
  if(!modal)return;
  modal.style.opacity='0';
  modal.querySelector('div:nth-child(2)').style.transform='scale(.9)';
  setTimeout(function(){modal.remove();},300);
}

function confirmShipOrder(orderId){
  var tracking=document.getElementById('shipTrackingInput').value.trim();
  if(!tracking){
    showAlert('Tracking requerido', 'Ingresa un número de tracking para continuar', 'warning');
    return;
  }
  
  fetch(API_URL+'/api/orders?id='+orderId,{
    method:'PUT',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({status:'SHIPPED',trackingNumber:tracking})
  }).then(function(r){return r.json();}).then(function(){
    showSuccessToast('Pedido enviado', 'El pedido ha sido marcado como enviado');
    closeShipOrderModal();
    closeOrderDetail();
    loadAcceptedOrders();
  }).catch(function(){showErrorToast('Error', 'No se pudo marcar el pedido como enviado');});
}

function updateOrderStatus(orderId,status){
  fetch(API_URL+'/api/orders?id='+orderId,{
    method:'PUT',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({status:status})
  }).then(function(r){return r.json();}).then(function(){
    showToast('Estado actualizado a '+status);
    if(window._currentOrderTab==='pending'){
      loadPendingOrders();
    }else if(window._currentOrderTab==='accepted'){
      loadAcceptedOrders();
    }else{
      loadOrderHistory();
    }
  }).catch(function(){showToast('Error actualizando estado');});
}

// =========== ARREPENTIMIENTOS ===========
window._allArreps=[];

function setArrepBtnActive(activeId){
  ['arrepBtnPendientes','arrepBtnAceptados','arrepBtnRechazados'].forEach(function(id){
    var btn=document.getElementById(id);
    if(!btn)return;
    if(id===activeId){
      btn.classList.add('ord-btn-act');
      btn.classList.remove('ord-btn');
    }else{
      btn.classList.add('ord-btn');
      btn.classList.remove('ord-btn-act');
    }
  });
}

function loadArrepPendientes(){
  setArrepBtnActive('arrepBtnPendientes');
  fetch(API_URL+'/api/arrepentimiento',{headers:{}}).then(function(r){return r.json();}).then(function(list){
    window._allArreps=list;
    var pendientes=list.filter(function(a){return a.estado==='PENDIENTE';});
    renderArrepList(pendientes,'pendientes');
  }).catch(function(){
    var el=document.getElementById('arrepList');if(el)el.innerHTML='<div style="text-align:center;padding:2rem;color:var(--red)">Error cargando</div>';
    var loader=document.querySelector('#adminContent .loader-spinner');if(loader)loader.style.display='none';
  });
}

function loadArrepAceptados(){
  setArrepBtnActive('arrepBtnAceptados');
  fetch(API_URL+'/api/arrepentimiento',{headers:{}}).then(function(r){return r.json();}).then(function(list){
    window._allArreps=list;
    var aceptados=list.filter(function(a){return a.estado==='APROBADO';});
    renderArrepList(aceptados,'aceptados');
  }).catch(function(){
    var el=document.getElementById('arrepList');if(el)el.innerHTML='<div style="text-align:center;padding:2rem;color:var(--red)">Error cargando</div>';
    var loader=document.querySelector('#adminContent .loader-spinner');if(loader)loader.style.display='none';
  });
}

function loadArrepRechazados(){
  setArrepBtnActive('arrepBtnRechazados');
  fetch(API_URL+'/api/arrepentimiento',{headers:{}}).then(function(r){return r.json();}).then(function(list){
    window._allArreps=list;
    var rechazados=list.filter(function(a){return a.estado==='RECHAZADO';});
    renderArrepList(rechazados,'rechazados');
  }).catch(function(){
    var el=document.getElementById('arrepList');if(el)el.innerHTML='<div style="text-align:center;padding:2rem;color:var(--red)">Error cargando</div>';
    var loader=document.querySelector('#adminContent .loader-spinner');if(loader)loader.style.display='none';
  });
}

function renderArrepList(list,tab){
  var el=document.getElementById('arrepList');
  if(!el)return;
  var loader=document.querySelector('#adminContent .loader-spinner');
  if(loader)loader.style.display='none';

  if(!list||list.length===0){
    var msgs={
      pendientes:{icon:'📋',title:'No hay arrepentimientos pendientes',sub:'Las solicitudes aparecerán aquí cuando los clientes las envíen'},
      aceptados:{icon:'✅',title:'No hay arrepentimientos aceptados',sub:'Los arrepentimientos aceptados aparecerán aquí'},
      rechazados:{icon:'❌',title:'No hay arrepentimientos rechazados',sub:'Los arrepentimientos rechazados aparecerán aquí'}
    };
    var m=msgs[tab]||{icon:'📋',title:'No hay datos',sub:''};
    el.innerHTML='<div class="gp-empty"><div class="gp-empty-ico">'+m.icon+'</div><div class="gp-empty-title">'+m.title+'</div><div class="gp-empty-sub">'+m.sub+'</div></div>';
    return;
  }

  var PILL={
    PENDIENTE:{bg:'var(--orange)',fg:'#fff'},
    APROBADO:{bg:'var(--green)',fg:'#fff'},
    RECHAZADO:{bg:'var(--red)',fg:'#fff'}
  };

  el.innerHTML='<div class="gp-list">'+list.map(function(a){
    var dateStr=new Date(a.createdAt).toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'});
    var addr='';
    if(a.orderShipping){
      var parts=[a.orderShipping.street,a.orderShipping.number,a.orderShipping.city,a.orderShipping.province].filter(Boolean);
      addr=parts.join(', ');
    }
    var pill=PILL[a.estado]||{bg:'var(--gray)',fg:'#fff'};
    var estadoLabel=(a.estado||'').charAt(0)+(a.estado||'').slice(1).toLowerCase();

    var head='<div class="gp-card-head">'+
        '<div style="min-width:0">'+
          '<div class="gp-card-title" style="font-family:inherit;font-size:14px">'+esc(a.email)+'</div>'+
          '<div class="gp-card-sub">Solicitado el '+dateStr+'</div>'+
        '</div>'+
        '<span class="gp-pill" style="--gp-pill-bg:'+pill.bg+';--gp-pill-fg:'+pill.fg+'"><span class="gp-dot"></span>'+estadoLabel+'</span>'+
      '</div>';

    var fields='<div class="gp-fields">'+
        '<div class="gp-field"><div class="gp-field-label">DNI</div><div class="gp-field-value">'+esc(a.orderDni||'-')+'</div></div>'+
        '<div class="gp-field"><div class="gp-field-label">Teléfono</div><div class="gp-field-value">'+esc(a.telefono||a.orderPhone||'-')+'</div></div>'+
        '<div class="gp-field"><div class="gp-field-label">Devolución</div><div class="gp-field-value">'+esc(addr||'Retiro en tienda')+'</div></div>'+
      '</div>';

    var body=head+fields;

    if(a.motivo){
      body+='<div style="margin-bottom:12px;font-size:13px;color:var(--admin-text,#1a1208)"><span style="color:var(--admin-text-muted,#6b6259);font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;display:block;margin-bottom:2px">Motivo</span>'+esc(a.motivo)+'</div>';
    }

    var foot='';
    if(tab==='pendientes'){
      foot='<div class="gp-card-foot"><div class="gp-card-sub" style="margin:0">Decidí si aceptás la devolución</div>'+
        '<div class="gp-actions">'+
          '<button class="gp-btn gp-btn-ok" onclick="acceptArrep(\''+a.id+'\')">✓ Aceptar devolución</button>'+
          '<button class="gp-btn gp-btn-no" onclick="rejectArrep(\''+a.id+'\')">✕ Rechazar</button>'+
        '</div></div>';
    }else if(tab==='aceptados'){
      foot='<div class="gp-card-foot"><div class="gp-infobox ok" style="flex:1;margin:0"><span>✓</span><div>Devolución aceptada · Reembolso total según Ley 24.240</div></div></div>';
    }else if(tab==='rechazados'){
      var reasonsText=a.reason||'';
      var reasonsParts=reasonsText.split(';').filter(Boolean);
      var comment='';
      var lastPart=reasonsParts[reasonsParts.length-1];
      if(lastPart&&lastPart.indexOf('Comentario:')!==-1){
        comment=lastPart.split('Comentario:')[1].trim();
        reasonsParts.pop();
      }
      var reasonsHtml=reasonsParts.length?'<div class="gp-reasons">'+reasonsParts.map(function(r){return'<span class="gp-reason">'+esc(r.trim())+'</span>';}).join('')+'</div>':'';
      foot='<div class="gp-card-foot"><div class="gp-infobox no" style="flex:1;margin:0"><span>✕</span><div><div>Devolución rechazada</div>'+reasonsHtml+(comment?'<div style="font-weight:400;margin-top:4px">'+esc(comment)+'</div>':'')+'</div></div></div>';
    }

    return'<div class="gp-card" style="--gp-accent:'+pill.bg+'">'+body+foot+'</div>';
  }).join('')+'</div>';
}

function acceptArrep(id){
  showConfirm(
    'Aceptar arrepentimiento',
    'Se cancelará la orden y se notificará al cliente con instrucciones de devolución. Reembolso total según Ley 24.240.',
    { confirmText: 'Aceptar', confirmClass: 'primary' }
  ).then(function(confirmed){
    if(!confirmed) return;
    
    fetch(API_URL+'/api/arrepentimiento?id='+id,{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({estado:'APROBADO'})
    }).then(function(r){return r.json();}).then(function(data){
      if(data.success){
        showSuccessToast('Arrepentimiento aceptado', 'El cliente será notificado');
        loadArrepPendientes();
      }else{
        showErrorToast('Error', data.message || 'No se pudo aceptar el arrepentimiento');
      }
    }).catch(function(){showErrorToast('Error de conexión', 'No se pudo procesar la solicitud');});
  });
}

function rejectArrep(id){
  var existing=document.getElementById('rejectArrepModal');
  if(existing)existing.remove();
  
  var modal=document.createElement('div');
  modal.id='rejectArrepModal';
  modal.style.cssText='display:flex;position:fixed;inset:0;z-index:900;align-items:center;justify-content:center;opacity:0;transition:opacity .3s';
  modal.innerHTML='<div style="position:absolute;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px)" onclick="closeRejectArrepModal()"></div>'+
    '<div style="position:relative;background:#fff;border-radius:20px;width:min(500px,95%);max-height:90vh;overflow-y:auto;box-shadow:0 25px 80px rgba(0,0,0,.35);transform:scale(.9);transition:transform .3s">'+
      '<div style="padding:1.5rem 2rem;border-bottom:1px solid var(--border)">'+
        '<h3 style="font-family:\'Playfair Display\',Georgia,serif;font-size:18px;font-weight:700;color:var(--red)">Rechazar arrepentimiento</h3>'+
        '<p style="font-size:12px;color:var(--gray);margin-top:4px">Selecciona los motivos del rechazo</p>'+
      '</div>'+
      '<div style="padding:1.5rem 2rem">'+
        '<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:1rem">'+
          '<label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:var(--cream2);border-radius:8px;cursor:pointer">'+
            '<input type="checkbox" class="arrep-reason-cb" value="Plazo de 10 dias habiles vencido" style="margin-top:2px;accent-color:var(--red);width:18px;height:18px">'+
            '<span style="font-size:13px">Plazo de 10 dias habiles vencido</span>'+
          '</label>'+
          '<label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:var(--cream2);border-radius:8px;cursor:pointer">'+
            '<input type="checkbox" class="arrep-reason-cb" value="Producto danado por el consumidor" style="margin-top:2px;accent-color:var(--red);width:18px;height:18px">'+
            '<span style="font-size:13px">Producto danado por el consumidor</span>'+
          '</label>'+
          '<label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:var(--cream2);border-radius:8px;cursor:pointer">'+
            '<input type="checkbox" class="arrep-reason-cb" value="Producto sin empaque original" style="margin-top:2px;accent-color:var(--red);width:18px;height:18px">'+
            '<span style="font-size:13px">Producto sin empaque original</span>'+
          '</label>'+
          '<label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:var(--cream2);border-radius:8px;cursor:pointer">'+
            '<input type="checkbox" class="arrep-reason-cb" value="Producto usado o con senales de uso" style="margin-top:2px;accent-color:var(--red);width:18px;height:18px">'+
            '<span style="font-size:13px">Producto usado o con senales de uso</span>'+
          '</label>'+
          '<label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:var(--cream2);border-radius:8px;cursor:pointer">'+
            '<input type="checkbox" class="arrep-reason-cb" value="Producto personalizado o perecedero" style="margin-top:2px;accent-color:var(--red);width:18px;height:18px">'+
            '<span style="font-size:13px">Producto personalizado o perecedero</span>'+
          '</label>'+
          '<label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:var(--cream2);border-radius:8px;cursor:pointer">'+
            '<input type="checkbox" class="arrep-reason-cb" value="Falta documentacion o comprobante de compra" style="margin-top:2px;accent-color:var(--red);width:18px;height:18px">'+
            '<span style="font-size:13px">Falta documentacion o comprobante de compra</span>'+
          '</label>'+
        '</div>'+
        '<div style="margin-bottom:1rem">'+
          '<label style="font-size:12px;font-weight:600;color:var(--gray);display:block;margin-bottom:6px">Comentario adicional (opcional)</label>'+
          '<textarea id="arrepRejectComment" rows="3" placeholder="Agrega detalles adicionales sobre el rechazo..." style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;resize:vertical;box-sizing:border-box;outline:none;font-family:inherit"></textarea>'+
        '</div>'+
        '<div style="display:flex;gap:10px">'+
          '<button onclick="closeRejectArrepModal()" style="flex:1;padding:12px;background:var(--cream2);color:var(--dk);border:1px solid var(--border);border-radius:10px;font-size:13px;font-weight:600;cursor:pointer">Cancelar</button>'+
          '<button onclick="confirmRejectArrep(\''+id+'\')" style="flex:1;padding:12px;background:var(--red);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">Rechazar</button>'+
        '</div>'+
      '</div>'+
    '</div>';
  
  document.body.appendChild(modal);
  modal.offsetHeight;
  setTimeout(function(){
    modal.style.opacity='1';
    modal.querySelector('div:nth-child(2)').style.transform='scale(1)';
  },10);
}

function closeRejectArrepModal(){
  var modal=document.getElementById('rejectArrepModal');
  if(!modal)return;
  modal.style.opacity='0';
  modal.querySelector('div:nth-child(2)').style.transform='scale(.9)';
  setTimeout(function(){modal.remove();},300);
}

function confirmRejectArrep(id){
  var cbs=document.querySelectorAll('.arrep-reason-cb:checked');
  var reasons=[];
  cbs.forEach(function(cb){reasons.push(cb.value);});
  
  var commentEl=document.getElementById('arrepRejectComment');
  var comment=commentEl?commentEl.value.trim():'';
  
  if(reasons.length===0&&comment===''){
    showAlert('Motivo requerido', 'Selecciona al menos un motivo o agrega un comentario', 'warning');
    return;
  }
  
  var reasonText=reasons.join('; ');
  if(comment){
    reasonText=reasonText?(reasonText+' | Comentario: '+comment):comment;
  }
  
  fetch(API_URL+'/api/arrepentimiento?id='+id,{
    method:'PUT',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({estado:'RECHAZADO',rejectReason:reasonText})
  }).then(function(r){return r.json();}).then(function(data){
    if(data.success){
      showSuccessToast('Arrepentimiento rechazado', 'El cliente será notificado');
      closeRejectArrepModal();
      loadArrepPendientes();
    }else{
      showErrorToast('Error', data.message || 'No se pudo rechazar el arrepentimiento');
    }
  }).catch(function(){showErrorToast('Error de conexión', 'No se pudo procesar la solicitud');});
}

// =========== ACCESSORY FUNCTIONS ===========
window.accAdditionalImages=[];

function handleAccImageDrop(e){
  e.preventDefault();
  var files=e.dataTransfer.files;
  if(files.length>0)uploadAccImageFile(files[0]);
}

function uploadAccImage(input){
  if(input.files&&input.files[0])uploadAccImageFile(input.files[0]);
}

function uploadAccImageFile(file){
  validateImageFile(file, function(ok){
    if(!ok)return;
    var formData=new FormData();
    formData.append('file',file);
    fetch(API_URL+'/api/upload',{method:'POST',body:formData}).then(function(r){return r.json();}).then(function(data){
      if(data.url){
        document.getElementById('accImageUrl').value=data.url;
        document.getElementById('accImagePreview').innerHTML='<img src="'+data.url+'" style="width:100%;height:100%;object-fit:cover">';
      }
    }).catch(function(){alert('Error uploading image');});
  });
}

function uploadAccAdditionalImages(input){
  if(input.files){
    Array.from(input.files).forEach(function(file){
      validateImageFile(file, function(ok){
        if(!ok)return;
        var formData=new FormData();
        formData.append('file',file);
        fetch(API_URL+'/api/upload',{method:'POST',body:formData}).then(function(r){return r.json();}).then(function(data){
          if(data.url){
            window.accAdditionalImages.push(data.url);
            renderAccAdditionalImagesList();
          }
        });
      });
    });
  }
}

function removeAccImage(btn,url){
  var idx=window.accAdditionalImages.indexOf(url);
  if(idx>-1)window.accAdditionalImages.splice(idx,1);
  btn.parentElement.remove();
  if(!window.accAdditionalImages.length){
    var container=document.getElementById('accAdditionalImages');
    if(container&&!document.getElementById('addAccImgPlaceholder')){
      container.innerHTML='<div id="addAccImgPlaceholder" style="color:var(--gray);font-size:11px;padding:10px">Arrastra imagenes adicionales aqui</div>';
    }
  }
}

function saveAccessory(){
  var id=document.getElementById('accId').value;
  var rows=document.querySelectorAll('#accColorRows .var-row');
  var name=document.getElementById('accName').value;
  var price=parseInt(document.getElementById('accPrice').value)||0;
  if(!name||!price){showAlert('Campos requeridos', 'Nombre y precio son requeridos', 'warning');return;}

  // Collect base data (shared across all variants)
  var baseData={
    name:name,
    price:price,
    cost:parseInt((document.getElementById('accCost')?document.getElementById('accCost').value:0))||0,
    supplierId:(document.getElementById('accSupplier')?document.getElementById('accSupplier').value:null)||null,
    category:document.getElementById('accCategory').value,
    brand:document.getElementById('accBrand').value,
    description:document.getElementById('accDescription').value,
    modelGroup:document.getElementById('accModelGroup').value||null,
    compatibleModels:collectCompatModels()||null,
    ico:document.getElementById('accIco')?document.getElementById('accIco').value:'📦',
    images:window.accAdditionalImages||[],
    discount:parseInt(document.getElementById('accDiscount').value)||0,
    isOffer:document.getElementById('accIsOffer').checked||false,
    offerStart:combineDateTime('accOfferStartDate','accOfferStartTime'),
    offerEnd:combineDateTime('accOfferEndDate','accOfferEndTime'),
  };

  // If editing an existing record, just PUT the first row's data
  if(id){
    var firstRow=rows[0];
    var data=Object.assign({},baseData);
    data.color=firstRow?(firstRow.querySelector('.var-color-val')?firstRow.querySelector('.var-color-val').value.trim():''):document.getElementById('accColor').value;
    data.stock=firstRow?(firstRow.querySelector('.var-stock-val')?parseInt(firstRow.querySelector('.var-stock-val').value)||0:0):(parseInt(document.getElementById('accStock').value)||0);
    data.imageUrl=firstRow&&firstRow.querySelector('.var-img-val')?firstRow.querySelector('.var-img-val').value||(document.getElementById('accImageUrl').value):document.getElementById('accImageUrl').value;
    fetch(API_URL+'/api/accessories?id='+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
    .then(function(r){if(!r.ok)throw new Error('Error '+r.status);return r.json();})
    .then(function(){showSuccessToast('Actualizado','Accesorio guardado');resetAccessoryForm();nav('admin');refreshAdmin();})
    .catch(function(e){showErrorToast('Error',e.message||'No se pudo guardar');});
    return;
  }

  // Creating new — build payloads from each color row
  var payloads=[];
  if(rows.length>0){
    rows.forEach(function(r){
      var color=r.querySelector('.var-color-val');
      var stock=r.querySelector('.var-stock-val');
      var img=r.querySelector('.var-img-val');
      var c=color?color.value.trim():'';
      if(!c)return;
      var data=Object.assign({},baseData);
      data.color=c;
      data.stock=stock?parseInt(stock.value)||0:0;
      data.imageUrl=img&&img.value?img.value:document.getElementById('accImageUrl').value;
      payloads.push(data);
    });
  }else{
    var data=Object.assign({},baseData);
    data.color=document.getElementById('accColor').value;
    data.stock=parseInt(document.getElementById('accStock').value)||0;
    data.imageUrl=document.getElementById('accImageUrl').value;
    payloads.push(data);
  }

  if(!payloads.length){showAlert('Sin datos', 'Agregá al menos una variante de color', 'warning');return;}
  if(payloads.length>1&&!baseData.modelGroup){showAlert('Falta modelo/grupo', 'Poné un Modelo/Grupo para enlazar las variantes', 'warning');return;}

  // Save each payload
  var saved=0;
  payloads.forEach(function(p){
    fetch(API_URL+'/api/accessories',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)})
    .then(function(r){if(!r.ok)throw new Error('Error '+r.status);return r.json();})
    .then(function(){saved++;if(saved===payloads.length){showSuccessToast('Guardado',payloads.length>1?payloads.length+' variantes creadas':'Accesorio guardado');resetAccessoryForm();loadAccessories();nav('admin');renderAdminContent('acc');}})
    .catch(function(e){showErrorToast('Error',e.message||'No se pudo guardar');});
  });
}

function editAccessory(id){
  window.isEditingAcc=true;
  var accFromMemory=getById(window.ACCS||[],id);
  fetch(API_URL+'/api/accessories?id='+id,{headers:{}}).then(function(r){
    if(!r.ok)throw new Error('Network error');
    return r.json();
  }).then(function(a){
    if(!a)throw new Error('No data');
    fillAccForm(a);
  }).catch(function(){
    if(accFromMemory){
      fillAccForm(accFromMemory);
    }else{
      alert('Error cargando accesorio');
      window.isEditingAcc=false;
      return;
    }
  });
}
function loadAccSuppliers(){
  // Bug #16: accSupplier cambió de select a input text
  // Ya no es necesario poblar opciones - el usuario escribe directamente
}
function fillAccForm(a){
  document.getElementById('accId').value=a.id;
  document.getElementById('accName').value=a.name||'';
  document.getElementById('accPrice').value=a.price||'';
  var cEl=document.getElementById('accCost'); if(cEl)cEl.value=a.cost||'';
  (function setSup(){
    var sEl=document.getElementById('accSupplier');
    if(sEl){
      var loaded=sEl.options.length>1;
      sEl.value=a.supplierId||'';
      if(!loaded&&typeof loadAccSuppliers==='function'){
        loadAccSuppliers();
        setTimeout(function(){var s2=document.getElementById('accSupplier');if(s2){s2.value=a.supplierId||'';}},600);
      }
    }
  })();
  document.getElementById('accStock').value=a.stock||0;
  document.getElementById('accCategory').value=a.category||'Cargadores';
  document.getElementById('accBrand').value=a.brand||'';
  document.getElementById('accDescription').value=a.description||'';
  document.getElementById('accColor').value=a.color||'';
  var accIcoEl=document.getElementById('accIco');if(accIcoEl)accIcoEl.value=a.ico||'\uD83D\uDCE6';
  document.getElementById('accImageUrl').value=a.imageUrl||'';
  document.getElementById('accColor').value=a.color||'';
  document.getElementById('accModelGroup').value=a.modelGroup||'';
  var disEl=document.getElementById('accDiscount'); if(disEl){disEl.value=a.discount||0; disEl.disabled=!a.isOffer;}
  var isoEl=document.getElementById('accIsOffer'); if(isoEl)isoEl.checked=!!a.isOffer;
  var asEl=document.getElementById('accOfferStartDate'); if(asEl)asEl.value=a.offerStart?toDatetimeLocal(new Date(a.offerStart)).split('T')[0]:'';
  var astEl=document.getElementById('accOfferStartTime'); if(astEl)astEl.value=a.offerStart?toDatetimeLocal(new Date(a.offerStart)).split('T')[1]||'':'';
  var aeEl=document.getElementById('accOfferEndDate'); if(aeEl)aeEl.value=a.offerEnd?toDatetimeLocal(new Date(a.offerEnd)).split('T')[0]:'';
  var aetEl=document.getElementById('accOfferEndTime'); if(aetEl)aetEl.value=a.offerEnd?toDatetimeLocal(new Date(a.offerEnd)).split('T')[1]||'':'';
  buildCompatGrid(a.compatibleModels||'');
  window.accAdditionalImages=Array.isArray(a.images)?a.images.slice():[];
  var prevImg=document.getElementById('accImagePreview');if(prevImg&&a.imageUrl)prevImg.innerHTML='<img src="'+a.imageUrl+'" style="width:100%;height:100%;object-fit:cover">';
  // When editing, load all variants if modelGroup exists
  var rowsContainer=document.getElementById('accColorRows');
  if(rowsContainer&&a.modelGroup){
    var variants=(window.ACCS||[]).filter(function(acc){return acc.modelGroup===a.modelGroup;});
    if(variants.length>0){
      rowsContainer.innerHTML='';
      variants.forEach(function(v){addColorRow(v.color,v.stock,v.imageUrl);});
    }else{
      addColorRow(a.color,a.stock,a.imageUrl);
    }
  }else if(rowsContainer){
    rowsContainer.innerHTML='';
    addColorRow(a.color,a.stock,a.imageUrl);
  }
  document.getElementById('accFormTitle').textContent='Editar Accesorio';
  document.getElementById('accFormSubtitle').textContent=a.name;
  window.isEditingAcc=true;
  renderAccAdditionalImagesList();
  nav('admin-acc');
}

function renderAccAdditionalImagesList(){
  var container=document.getElementById('accAdditionalImages');
  if(!container)return;
  container.innerHTML='';
  if(!window.accAdditionalImages.length){
    container.innerHTML='<div id="addAccImgPlaceholder" style="color:var(--gray);font-size:11px;padding:10px">Arrastra imagenes adicionales aqui</div>';
    return;
  }
  window.accAdditionalImages.forEach(function(url){
    var div=document.createElement('div');
    div.style.cssText='width:60px;height:60px;border-radius:8px;overflow:hidden;position:relative;flex-shrink:0';
    div.innerHTML='<img src="'+url+'" style="width:100%;height:100%;object-fit:cover"><button onclick="removeAccImage(this,\''+url+'\')" style="position:absolute;top:2px;right:2px;width:20px;height:20px;border-radius:50%;background:var(--red);color:#fff;border:none;cursor:pointer;font-size:12px">\u00D7</button>';
    container.appendChild(div);
  });
}

function deleteAccessory(id){
  var a=getById(window.ACCS||[],id);
  var aname=a?a.name:'este accesorio';
  // Guardar una copia del accesorio para poder restaurarlo
  var accessoryBackup = a ? JSON.parse(JSON.stringify(a)) : null;
  var modal=document.getElementById('deleteAccessoryModal');
  if(!modal){
    var m=document.createElement('div');
    m.id='deleteAccessoryModal';
    m.style.cssText='display:none;position:fixed;inset:0;z-index:9999;align-items:center;justify-content:center;opacity:0;transition:opacity .3s ease';
    m.innerHTML='<div style="position:absolute;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(4px)" onclick="closeDeleteAccessoryModal()"></div>'+
      '<div style="position:relative;background:#fff;border-radius:20px;width:min(400px,90%);padding:2rem;box-shadow:0 20px 60px rgba(0,0,0,.3);text-align:center;transform:scale(.95);transition:transform .3s ease">'+
      '<div style="width:64px;height:64px;background:linear-gradient(135deg,#fee2e2,#fecaca);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem">'+
      '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/></svg>'+
      '</div>'+
      '<h3 style="font-family:\'Playfair Display\',Georgia,serif;font-size:20px;font-weight:700;margin-bottom:.5rem;color:var(--dk)">Eliminar accesorio</h3>'+
      '<p style="font-size:13px;color:var(--gray);margin-bottom:1.5rem;line-height:1.5">Estas por eliminar <strong style="color:var(--dk)" id="deleteAccessoryName">'+aname+'</strong>. Esta accion no se puede deshacer.</p>'+
      '<div style="display:flex;gap:10px">'+
      '<button onclick="closeDeleteAccessoryModal()" style="flex:1;padding:12px;background:var(--cream2);color:var(--dk);border:1px solid var(--border);border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;transition:all .15s">Cancelar</button>'+
      '<button id="btnConfirmDeleteAccessory" style="flex:1;padding:12px;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;transition:all .15s;box-shadow:0 4px 12px rgba(239,68,68,.3)">Eliminar</button>'+
      '</div>'+
      '</div>';
    document.body.appendChild(m);
    modal=m;
  }
  document.getElementById('deleteAccessoryName').textContent=aname;
  document.getElementById('btnConfirmDeleteAccessory').onclick=function(){
    closeDeleteAccessoryModal();
    fetch(API_URL+'/api/accessories?id='+id,{method:'DELETE',headers:{}}).then(function(r){return r.json();}).then(function(){
      showUndoToast('Accesorio eliminado', aname, function(){
        if(accessoryBackup){
          fetch(API_URL+'/api/accessories',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify(accessoryBackup)
          })          .then(function(){
            if(typeof refreshAdmin==='function')refreshAdmin();
            showSuccessToast('Accesorio restaurado', aname);
          }).catch(function(){
            showErrorToast('Error', 'No se pudo restaurar el accesorio');
          });
        }
      });
      if(typeof refreshAdmin==='function')refreshAdmin();
    }).catch(function(){showToast('Error eliminando');});
  };
  modal.style.display='flex';
  modal.offsetHeight;
  setTimeout(function(){
    modal.style.opacity='1';
    modal.querySelector('div:nth-child(2)').style.transform='scale(1)';
  },10);
}
function closeDeleteAccessoryModal(){
  var modal=document.getElementById('deleteAccessoryModal');
  if(!modal)return;
  modal.style.opacity='0';
  modal.querySelector('div:nth-child(2)').style.transform='scale(.95)';
  setTimeout(function(){modal.style.display='none';},300);
}

function resetAccessoryForm(){
  document.getElementById('accId').value='';
  document.getElementById('accName').value='';
  document.getElementById('accPrice').value='';
  document.getElementById('accStock').value='';
  document.getElementById('accCategory').value='Cargadores';
  document.getElementById('accBrand').value='';
  document.getElementById('accDescription').value='';
  document.getElementById('accColor').value='';
  var accIcoEl=document.getElementById('accIco');if(accIcoEl)accIcoEl.value='\u{1F4E6}';
  document.getElementById('accImageUrl').value='';
  document.getElementById('accImages').value='';
  document.getElementById('accModelGroup').value='';
  buildCompatGrid('');
  // Reset color rows
  var rowsContainer=document.getElementById('accColorRows');
  if(rowsContainer)rowsContainer.innerHTML='';
}

function createVariant(){
  var name=document.getElementById('accName').value;
  var brand=document.getElementById('accBrand').value;
  var price=document.getElementById('accPrice').value;
  var category=document.getElementById('accCategory').value;
  var modelGroup=document.getElementById('accModelGroup').value;
  var description=document.getElementById('accDescription').value;
  var imageUrl=document.getElementById('accImageUrl').value;
  var compatModels=document.getElementById('accCompatibleModels').value;
  // Reset only color, stock, image — keep the rest
  resetAccessoryForm();
  document.getElementById('accName').value=name;
  document.getElementById('accBrand').value=brand;
  document.getElementById('accPrice').value=price;
  document.getElementById('accCategory').value=category;
  document.getElementById('accModelGroup').value=modelGroup;
  document.getElementById('accDescription').value=description;
  document.getElementById('accFormTitle').textContent='Nueva variante';
  document.getElementById('accFormSubtitle').textContent='Crear variante de: '+name;
  if(document.getElementById('accImageUrl'))document.getElementById('accImageUrl').value=imageUrl;
  if(compatModels)document.getElementById('accCompatibleModels').value=compatModels;
  buildCompatGrid(compatModels||'');
}

// =========== COLOR STOCK ROWS ===========
var COLOR_PALETTE=['Negro','Blanco','Rojo','Azul','Verde','Amarillo','Naranja','Rosa','Gris','Plata','Dorado','Púrpura','Celeste','Beige','Marrón','Turquesa','Coral','Lavanda','Oliva','Carbón','Azul Marino','Verde Menta','Gris Oscuro','Crema'];
var COLOR_CSS={Negro:'#1a1a1a',Blanco:'#f0f0f0',Rojo:'#e53e3e',Azul:'#3182ce',Verde:'#38a169',Amarillo:'#ecc94b',Naranja:'#ed8936',Rosa:'#ed64a6',Gris:'#a0aec0',Plata:'#cbd5e0',Dorado:'#d69e2e','Púrpura':'#805ad5',Celeste:'#63b3ed',Beige:'#f5e6cc','Marrón':'#8b4513',Turquesa:'#4fd1c5',Coral:'#fc8181',Lavanda:'#b794f4',Oliva:'#68d391','Carbón':'#2d3748','Azul Marino':'#1a365d','Verde Menta':'#81e6d9','Gris Oscuro':'#4a5568',Crema:'#fefcbf'};
var _colorPickerTarget=null;

function _cssColor(name){return COLOR_CSS[name]||name||'#ccc'}

function addColorRow(color,stock,img){
  var container=document.getElementById('accColorRows');
  if(!container)return;
  var c=color||'';
  var s=stock!=null?stock:'';
  var imgUrl=img||'';
  var row=document.createElement('div');
  row.className='var-row';
  var colorBtn=c?'<span class="var-color-dot" style="background:'+_cssColor(c)+';flex-shrink:0"></span><span class="var-color-label">'+c+'</span>':'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg><span>Elegir color</span>';
  row.innerHTML=
    '<input type="hidden" class="var-color-val" value="'+c+'">'+
    '<button class="var-color-btn" onclick="openColorPicker(this)">'+colorBtn+'</button>'+
    '<label class="var-img-zone" ondragover="event.preventDefault();this.style.borderColor=\'var(--orange)\'" ondragleave="this.style.borderColor=\'var(--border)\'" ondrop="event.preventDefault();this.style.borderColor=\'var(--border)\';handleVarImageDrop(event,this)">'+
      '<input type="file" accept="image/*" style="display:none" onchange="uploadVarImage(this)">'+
      '<input type="hidden" class="var-img-val" value="'+imgUrl+'">'+
      (imgUrl?'<img src="'+imgUrl+'" style="width:100%;height:100%;object-fit:cover;border-radius:8px">':'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>')+
    '</label>'+
    '<input class="var-stock-val" value="'+s+'" type="number" placeholder="Stock" style="width:64px;padding:6px;border:1.5px solid var(--border);border-radius:8px;font-size:12px;outline:none;background:#fff;text-align:center;font-family:inherit">'+
    '<button onclick="this.parentElement.remove()" style="width:30px;height:30px;border:1px solid var(--border);border-radius:8px;background:#fff;color:var(--gray);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">✕</button>';
  container.appendChild(row);
}

function openColorPicker(btn){_colorPickerTarget=btn;var grid=document.getElementById('colorPickerGrid');if(grid)grid.innerHTML=COLOR_PALETTE.map(function(c){return'<div class="cp-dot" style="background:'+_cssColor(c)+'" title="'+c+'" onclick="selectColorFromPicker(\''+c+'\')"></div>';}).join('');document.getElementById('colorPickerModal').style.display='flex';var search=document.getElementById('colorPickerSearch');if(search)search.value='';}
function closeColorPicker(e){if(e&&e.target!==document.getElementById('colorPickerModal'))return;document.getElementById('colorPickerModal').style.display='none';}
function selectColorFromPicker(color){if(!_colorPickerTarget)return;var row=_colorPickerTarget.closest('.var-row');if(!row)return;var valInput=row.querySelector('.var-color-val');if(valInput)valInput.value=color;_colorPickerTarget.innerHTML='<span class="var-color-dot" style="background:'+_cssColor(color)+';flex-shrink:0"></span><span class="var-color-label">'+color+'</span>';document.getElementById('colorPickerModal').style.display='none';}
function selectCustomColor(){var input=document.getElementById('colorPickerCustom');if(!input||!input.value.trim())return;selectColorFromPicker(input.value.trim());}
function filterColorPicker(q){var grid=document.getElementById('colorPickerGrid');if(!grid)return;var ql=q.toLowerCase().trim();var items=grid.querySelectorAll('.cp-dot');items.forEach(function(item){item.style.display=(!ql||item.getAttribute('title').toLowerCase().indexOf(ql)>=0)?'':'none';});}
function handleVarImageDrop(e,zone){e.preventDefault();zone.style.borderColor='var(--border)';var files=e.dataTransfer.files;if(files.length>0)uploadVarImageFile(files[0],zone);}
function uploadVarImage(input){if(input.files&&input.files[0])uploadVarImageFile(input.files[0],input.parentElement);}
function uploadVarImageFile(file,zone){var formData=new FormData();formData.append('file',file);fetch(API_URL+'/api/upload',{method:'POST',body:formData}).then(function(r){return r.json();}).then(function(data){if(data.url){var imgInput=zone.querySelector('.var-img-val');if(imgInput)imgInput.value=data.url;zone.innerHTML='<input type="file" accept="image/*" style="display:none" onchange="uploadVarImage(this)"><input type="hidden" class="var-img-val" value="'+data.url+'"><img src="'+data.url+'" style="width:100%;height:100%;object-fit:cover;border-radius:8px">';}}).catch(function(e){console.error('Error uploading variant image:',e);});}

// =========== COMPATIBILITY GRID ===========
function getCompatModels(){
  var models=(window.SELL_MODELS&&window.SELL_MODELS['iPhone'])?window.SELL_MODELS['iPhone'].slice():[];
  var extra=[
    'iPhone','iPad','Mac','Android','Samsung',
    'AirPods','AirPods Pro','Apple Watch','MacBook','MacBook Pro','MacBook Air',
    'Apple Watch 38mm','Apple Watch 42mm','Apple Watch 45mm',
    'AirPods 1ra Gen','AirPods 2da Gen','AirPods 3ra Gen','AirPods Pro 1ra Gen','AirPods Pro 2da Gen'
  ];
  return models.concat(extra.filter(function(e){return models.indexOf(e)===-1;}));
}

function collectCompatModels(){
  var chips=document.querySelectorAll('#accCompatGrid .compat-chip.on');
  var selected=[];
  chips.forEach(function(c){var m=c.getAttribute('data-model');if(m)selected.push(m);});
  return selected.join(',');
}

function buildCompatGrid(existing){
  var grid=document.getElementById('accCompatGrid');
  if(!grid)return;
  var models=getCompatModels();
  var existingArr=existing?existing.split(',').map(function(s){return s.trim();}).filter(Boolean):[];
  var phones=models.filter(function(m){return m.indexOf('iPhone')>=0||m.indexOf('iPad')>=0;});
  var others=models.filter(function(m){return phones.indexOf(m)===-1;});
  // Modelos/marcas cargados a mano (via addCustomCompatModel) que no están
  // en la lista fija de getCompatModels() — sin esto se perderían al
  // reabrir el accesorio, porque buildCompatGrid solo dibujaba chips para
  // los modelos conocidos.
  var custom=existingArr.filter(function(m){return models.indexOf(m)===-1;});
  function renderGroup(label,list){
    if(!list.length)return'';
    return'<div class="compat-group"><div class="compat-group-label">'+label+'</div><div class="compat-group-chips">'+
      list.map(function(m){return'<div class="compat-chip'+(existingArr.indexOf(m)>=0?' on':'')+'" data-model="'+m+'" onclick="toggleCompatChip(this)">'+m+'</div>';}).join('')+'</div></div>';
  }
  grid.innerHTML=renderGroup('iPhone / iPad',phones)+renderGroup('Otros',others)+renderGroup('Personalizados',custom);
  updateCompatCount();
  populateCompatRange(models);
}

// Permite marcar compatibilidad con un modelo/marca que no está en la lista
// fija (ej. un modelo Samsung/Motorola/Xiaomi específico).
function addCustomCompatModel(){
  var input=document.getElementById('compatCustomInput');
  if(!input)return;
  var val=input.value.trim();
  if(!val)return;
  var grid=document.getElementById('accCompatGrid');
  if(!grid)return;
  var chips=grid.querySelectorAll('.compat-chip');
  var existingChip=null;
  chips.forEach(function(c){if(c.getAttribute('data-model')===val)existingChip=c;});
  if(existingChip){
    existingChip.classList.add('on');
  }else{
    var groups=grid.querySelectorAll('.compat-group');
    var customGroup=null;
    groups.forEach(function(g){
      var lbl=g.querySelector('.compat-group-label');
      if(lbl&&lbl.textContent==='Personalizados')customGroup=g;
    });
    if(!customGroup){
      grid.insertAdjacentHTML('beforeend','<div class="compat-group"><div class="compat-group-label">Personalizados</div><div class="compat-group-chips"></div></div>');
      customGroup=grid.lastElementChild;
    }
    var chipsWrap=customGroup.querySelector('.compat-group-chips');
    var chip=document.createElement('div');
    chip.className='compat-chip on';
    chip.setAttribute('data-model',val);
    chip.setAttribute('onclick','toggleCompatChip(this)');
    chip.textContent=val;
    chipsWrap.appendChild(chip);
  }
  input.value='';
  updateCompatCount();
}

function toggleCompatChip(el){
  el.classList.toggle('on');
  updateCompatCount();
}

function updateCompatCount(){
  var count=document.querySelectorAll('#accCompatGrid .compat-chip.on').length;
  var modalEl=document.getElementById('compatModalCount');
  if(modalEl)modalEl.textContent=count+' seleccionados';
  var triggerLabel=document.getElementById('compatTriggerLabel');
  var triggerCount=document.getElementById('compatTriggerCount');
  if(count>0){
    if(triggerLabel)triggerLabel.textContent='Dispositivos compatibles';
    if(triggerCount){triggerCount.textContent=count+' seleccionados';triggerCount.style.display='inline';}
  }else{
    if(triggerLabel)triggerLabel.textContent='Seleccionar modelos compatibles';
    if(triggerCount)triggerCount.style.display='none';
  }
}

function openCompatModal(){
  var models=getCompatModels();
  populateCompatRange(models);
  // Ensure grid is built if not already
  var grid=document.getElementById('accCompatGrid');
  if(grid&&!grid.children.length)buildCompatGrid('');
  document.getElementById('compatModal').style.display='flex';
  document.body.style.overflow='hidden';
}

function closeCompatModal(e){
  if(e&&e.target!==document.getElementById('compatModal'))return;
  document.getElementById('compatModal').style.display='none';
  document.body.style.overflow='';
  // Sync hidden input
  document.getElementById('accCompatibleModels').value=collectCompatModels();
}

function selectAllCompat(){
  document.querySelectorAll('#accCompatGrid .compat-chip').forEach(function(c){c.classList.add('on');});
  updateCompatCount();
}
function clearAllCompat(){
  document.querySelectorAll('#accCompatGrid .compat-chip').forEach(function(c){c.classList.remove('on');});
  updateCompatCount();
}

function populateCompatRange(models){
  var from=document.getElementById('compatRangeFrom');
  var to=document.getElementById('compatRangeTo');
  if(!from||!to)return;
  [from,to].forEach(function(s){s.innerHTML='<option value="">Seleccionar...</option>';});
  models.forEach(function(m){
    var opt='<option value="'+m+'">'+m+'</option>';
    from.innerHTML+=opt;
    to.innerHTML+=opt;
  });
}

function applyCompatRange(){
  var from=document.getElementById('compatRangeFrom');
  var to=document.getElementById('compatRangeTo');
  if(!from||!to||!from.value||!to.value)return;
  var models=getCompatModels();
  var fromIdx=models.indexOf(from.value);
  var toIdx=models.indexOf(to.value);
  if(fromIdx<0||toIdx<0||fromIdx>toIdx)return;
  var range=models.slice(fromIdx,toIdx+1);
  document.querySelectorAll('#accCompatGrid .compat-chip').forEach(function(c){
    var m=c.getAttribute('data-model');
    c.classList.toggle('on',m&&range.indexOf(m)>=0);
  });
  updateCompatCount();
}

// NOTA: editProduct() vive en render.js (carga antes que este archivo);
// esa versión ya popula todos los campos del form desde PRODUCTS[]. No
// redefinir acá — un editProduct() duplicado pisaría esa implementación.

function duplicateProduct(id){
  var p=getById(PRODUCTS,id);
  if(!p){showToast('Producto no encontrado');return;}
  var dupName=p.name+' (copia)';
  fetch(API_URL+'/api/products',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      name:dupName,
      price:p.price,
      stock:p.stock,
      brand:p.brand,
      description:p.description||p.sub||'',
      condition:p.condition,
      type:p.type,
      color:p.color,
      imageUrl:p.imageUrl,
      images:p.images||[],
      isOffer:p.isOffer||false,
      discount:p.discount||0,
    })
  }).then(function(r){return r.json();}).then(function(newP){
    showToast('Producto duplicado: '+dupName);
    loadProducts();
  }).catch(function(){showToast('Error duplicando producto');});
}

function deleteProduct(id){
  var p=getById(PRODUCTS,id);
  var pname=p?p.name:'este producto';
  // Guardar una copia del producto para poder restaurarlo
  var productBackup = p ? JSON.parse(JSON.stringify(p)) : null;
  var modal=document.getElementById('deleteProductModal');
  if(!modal){
    var m=document.createElement('div');
    m.id='deleteProductModal';
    m.style.cssText='display:none;position:fixed;inset:0;z-index:9999;align-items:center;justify-content:center;opacity:0;transition:opacity .3s ease';
    m.innerHTML='<div style="position:absolute;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(4px)" onclick="closeDeleteProductModal()"></div>'+
      '<div style="position:relative;background:#fff;border-radius:20px;width:min(400px,90%);padding:2rem;box-shadow:0 20px 60px rgba(0,0,0,.3);text-align:center;transform:scale(.95);transition:transform .3s ease">'+
      '<div style="width:64px;height:64px;background:linear-gradient(135deg,#fee2e2,#fecaca);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem">'+
      '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/></svg>'+
      '</div>'+
      '<h3 style="font-family:\'Playfair Display\',Georgia,serif;font-size:20px;font-weight:700;margin-bottom:.5rem;color:var(--dk)">Eliminar producto</h3>'+
      '<p style="font-size:13px;color:var(--gray);margin-bottom:1.5rem;line-height:1.5">Estas por eliminar <strong style="color:var(--dk)" id="deleteProductName">'+pname+'</strong>. Esta accion no se puede deshacer.</p>'+
      '<div style="display:flex;gap:10px">'+
      '<button onclick="closeDeleteProductModal()" style="flex:1;padding:12px;background:var(--cream2);color:var(--dk);border:1px solid var(--border);border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;transition:all .15s">Cancelar</button>'+
      '<button id="btnConfirmDeleteProduct" style="flex:1;padding:12px;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;transition:all .15s;box-shadow:0 4px 12px rgba(239,68,68,.3)">Eliminar</button>'+
      '</div>'+
      '</div>';
    document.body.appendChild(m);
    modal=m;
  }
  document.getElementById('deleteProductName').textContent=pname;
  document.getElementById('btnConfirmDeleteProduct').onclick=function(){
    closeDeleteProductModal();
    fetch(API_URL+'/api/products?id='+id,{method:'DELETE',headers:{}}).then(function(r){
      if(!r.ok)throw new Error('Error '+r.status);
      return r.json();
    }).then(function(){
      showUndoToast('Producto eliminado', pname, function(){
        if(productBackup){
          fetch(API_URL+'/api/products',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify(productBackup)
          })          .then(function(){
            if(typeof refreshAdmin==='function')refreshAdmin();
            showSuccessToast('Producto restaurado', pname);
          }).catch(function(){
            showErrorToast('Error', 'No se pudo restaurar el producto');
          });
        }
      });
      if(typeof refreshAdmin==='function')refreshAdmin();
    }).catch(function(e){showToast('Error eliminando: '+e.message);});
  };
  modal.style.display='flex';
  modal.offsetHeight;
  setTimeout(function(){
    modal.style.opacity='1';
    modal.querySelector('div:nth-child(2)').style.transform='scale(1)';
  },10);
}
function closeDeleteProductModal(){
  var modal=document.getElementById('deleteProductModal');
  if(!modal)return;
  modal.style.opacity='0';
  modal.querySelector('div:nth-child(2)').style.transform='scale(.95)';
  setTimeout(function(){modal.style.display='none';},300);
}

function exportProductLog(){
  var url=API_URL+'/api/products/export';
  fetch(url,{headers:{}})
    .then(function(r){
      if(!r.ok)throw new Error('Error al exportar');
      return r.blob();
    })
    .then(function(blob){
      var link=document.createElement('a');
      link.href=URL.createObjectURL(blob);
      link.download='productos_log_'+new Date().toISOString().split('T')[0]+'.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      showSuccessToast('Exportado','Excel descargado correctamente');
    })
    .catch(function(e){
      showErrorToast('Error',e.message);
    });
}

function renderDash(){notAvailable();}
function switchChart(period,btn){notAvailable();}

// =========== SALES HISTORY ===========
window._salesHistoryCache = {}

function loadSalesHistory(page, filters) {
  var content = document.getElementById('adminContent')
  if (!content) return

  page = page || 1
  filters = filters || {}

  var params = 'page=' + page + '&limit=30'
  if (filters.startDate) params += '&startDate=' + filters.startDate
  if (filters.endDate) params += '&endDate=' + filters.endDate
  if (filters.saleChannel && filters.saleChannel !== 'all') params += '&saleChannel=' + filters.saleChannel
  if (filters.paymentMethod && filters.paymentMethod !== 'all') params += '&paymentMethod=' + filters.paymentMethod
  if (filters.status && filters.status !== 'all') params += '&status=' + filters.status
  if (filters.search) params += '&search=' + encodeURIComponent(filters.search)

  content.innerHTML = `
    <div class="sv-wrapper">
      <div class="sv-header">
        <h2 class="sv-title">Historial de Ventas</h2>
        <button onclick="exportSalesCSV()" class="btn btn-g" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px">📥 Exportar CSV</button>
      </div>

      <div class="sv-summary" id="svSummary">
        <div class="sv-stat"><div class="sv-stat-val" id="svStatRevenue">—</div><div class="sv-stat-label">Ingresos totales</div></div>
        <div class="sv-stat"><div class="sv-stat-val" id="svStatOrders">—</div><div class="sv-stat-label">Ventas totales</div></div>
        <div class="sv-stat"><div class="sv-stat-val" id="svStatToday">—</div><div class="sv-stat-label">Ventas hoy</div></div>
        <div class="sv-stat"><div class="sv-stat-val" id="svStatPending">—</div><div class="sv-stat-label">Pendientes</div></div>
      </div>

      <div class="sv-filters">
        <div class="sv-filters-row">
          <div class="sv-filter-group">
            <label>Desde</label>
            <input type="date" id="svf-start" class="sv-inp">
          </div>
          <div class="sv-filter-group">
            <label>Hasta</label>
            <input type="date" id="svf-end" class="sv-inp">
          </div>
          <div class="sv-filter-group">
            <label>Canal</label>
            <select id="svf-channel" class="sv-inp">
              <option value="all">Todos</option>
              <option value="online">Online</option>
              <option value="in-store">Tienda</option>
            </select>
          </div>
          <div class="sv-filter-group">
            <label>Pago</label>
            <select id="svf-payment" class="sv-inp">
              <option value="all">Todos</option>
              <option value="cash">Efectivo</option>
              <option value="transfer">Transferencia</option>
              <option value="mp">MercadoPago</option>
              <option value="card">Tarjeta</option>
            </select>
          </div>
          <div class="sv-filter-group">
            <label>Estado</label>
            <select id="svf-status" class="sv-inp">
              <option value="all">Todos</option>
              <option value="DELIVERED">Entregado</option>
              <option value="SHIPPED">Enviado</option>
              <option value="PROCESSING">Procesando</option>
              <option value="PENDING">Pendiente</option>
              <option value="CANCELLED">Cancelado</option>
            </select>
          </div>
          <button onclick="applySalesFilters()" class="btn btn-o" style="padding:8px 20px;align-self:flex-end">Filtrar</button>
        </div>
        <div class="sv-search-row">
          <span class="material-symbols-outlined" style="font-size:18px;color:var(--gray)">search</span>
          <input type="text" id="svf-search" placeholder="Buscar por código, cliente, DNI, email o teléfono..." onkeydown="if(event.key==='Enter')applySalesFilters()">
        </div>
      </div>

      <div class="sv-list" id="svList">
        <div class="loader-spinner"><span>Cargando ventas...</span></div>
      </div>

      <div class="sv-pagination" id="svPagination"></div>
    </div>
  `

  fetch(API_URL + '/api/admin/sales-history?' + params, {
    headers: {}
  })
    .then(function(r) { return r.json() })
    .then(function(res) {
      if (res.error) {
        document.getElementById('svList').innerHTML = '<div class="sv-empty">Error: ' + res.error + '</div>'
        return
      }
      window._salesHistoryCache = res
      renderSalesSummary(res.summary)
      renderSalesList(res.data)
      renderSalesPagination(res.page, res.totalPages)
    })
    .catch(function(err) {
      console.error('Error loading sales:', err)
      var list = document.getElementById('svList')
      if (list) list.innerHTML = '<div class="sv-empty">Error al cargar ventas</div>'
    })
}

function applySalesFilters() {
  loadSalesHistory(1, {
    startDate: document.getElementById('svf-start').value,
    endDate: document.getElementById('svf-end').value,
    saleChannel: document.getElementById('svf-channel').value,
    paymentMethod: document.getElementById('svf-payment').value,
    status: document.getElementById('svf-status').value,
    search: document.getElementById('svf-search').value
  })
}

function renderSalesSummary(summary) {
  if (!summary) return
  var el = document.getElementById('svStatRevenue')
  if (!el) return
  el.textContent = '$' + summary.totalRevenue.toLocaleString('es-AR')
  document.getElementById('svStatOrders').textContent = summary.totalOrders
  document.getElementById('svStatToday').textContent = summary.todayOrders
  document.getElementById('svStatPending').textContent = summary.pendingOrders
}

function renderSalesList(orders) {
  var list = document.getElementById('svList')
  if (!list) return

  if (!orders || orders.length === 0) {
    list.innerHTML = '<div class="sv-empty">No se encontraron ventas</div>'
    return
  }

  list.innerHTML = orders.map(function(order) {
    var channelLabel = order.saleChannel === 'in-store' ? 'Tienda' : 'Online'
    var channelClass = order.saleChannel === 'in-store' ? 'sv-badge-tienda' : 'sv-badge-online'
    var statusClass = getSalesStatusClass(order.status)
    var statusLabel = getSalesStatusLabel(order.status)
    var itemCount = (order.items || []).length
    var adminName = order.admin ? order.admin.name : (order.saleChannel === 'online' ? 'Web' : '—')

    return '<div class="sv-row" onclick="openSaleDetail(\'' + order.id + '\')">' +
      '<div class="sv-row-main">' +
        '<div class="sv-row-top">' +
          '<span class="sv-code">' + esc(order.code) + '</span>' +
          '<span class="sv-badge ' + channelClass + '">' + channelLabel + '</span>' +
          '<span class="sv-badge sv-status ' + statusClass + '">' + statusLabel + '</span>' +
        '</div>' +
        '<div class="sv-row-info">' +
          '<span><strong>' + esc(order.clientName || '—') + '</strong> · DNI: ' + esc(order.clientDni || '—') + '</span>' +
          '<span class="sv-meta">' + svFormatDate(order.createdAt) + '</span>' +
        '</div>' +
        '<div class="sv-row-items-preview">' +
          '<span>' + itemCount + ' artículo' + (itemCount !== 1 ? 's' : '') + '</span>' +
          (order.payment ? '<span class="sv-dot">·</span><span>' + esc(order.payment) + '</span>' : '') +
          (adminName !== '—' ? '<span class="sv-dot">·</span><span>Admin: ' + esc(adminName) + '</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="sv-row-amount">' +
        '<span class="sv-price">$' + order.total.toLocaleString('es-AR') + '</span>' +
        (order.currency === 'USD' ? '<span class="sv-currency">USD</span>' : '') +
        (order.cuotas > 1 ? '<span class="sv-cuotas">' + order.cuotas + ' cuotas</span>' : '') +
        '<span class="sv-arrow material-symbols-outlined">chevron_right</span>' +
      '</div>' +
    '</div>'
  }).join('')
}

function renderSalesPagination(currentPage, totalPages) {
  var pagination = document.getElementById('svPagination')
  if (!pagination || totalPages <= 1) {
    if (pagination) pagination.innerHTML = ''
    return
  }

  var html = ''
  for (var i = 1; i <= totalPages; i++) {
    html += '<button onclick="loadSalesHistory(' + i + ', getCurrentSalesFilters())" class="btn ' + (i === currentPage ? 'btn-primary' : 'btn-o') + '" style="min-width:36px;padding:6px 10px;font-size:12px">' + i + '</button>'
  }
  pagination.innerHTML = html
}

function getCurrentSalesFilters() {
  return {
    startDate: document.getElementById('svf-start')?.value || '',
    endDate: document.getElementById('svf-end')?.value || '',
    saleChannel: document.getElementById('svf-channel')?.value || 'all',
    paymentMethod: document.getElementById('svf-payment')?.value || 'all',
    status: document.getElementById('svf-status')?.value || 'all',
    search: document.getElementById('svf-search')?.value || ''
  }
}

function getSalesStatusClass(status) {
  switch (status) {
    case 'DELIVERED': return 'sv-status-delivered'
    case 'SHIPPED': return 'sv-status-shipped'
    case 'PROCESSING': return 'sv-status-processing'
    case 'PENDING': return 'sv-status-pending'
    case 'CANCELLED': return 'sv-status-cancelled'
    default: return ''
  }
}

function getSalesStatusLabel(status) {
  switch (status) {
    case 'DELIVERED': return 'Entregado'
    case 'SHIPPED': return 'Enviado'
    case 'PROCESSING': return 'Procesando'
    case 'PENDING': return 'Pendiente'
    case 'CANCELLED': return 'Cancelado'
    default: return status
  }
}

function svFormatDate(dateStr) {
  if (!dateStr) return '—'
  var d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// =========== SALE DETAIL MODAL ===========
function openSaleDetail(orderId) {
  var order = null
  if (window._salesHistoryCache && window._salesHistoryCache.data) {
    order = window._salesHistoryCache.data.find(function(o) { return o.id === orderId })
  }
  if (!order) return

  var overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.onclick = function(e) { if (e.target === overlay) closeSaleModal(overlay) }

  var itemsHtml = (order.items || []).map(function(item) {
    var name = item.customName || (item.product ? item.product.name : 'Producto #' + (item.productId || ''))
    var imgHtml = item.product && item.product.imageUrl
      ? '<img src="' + esc(item.product.imageUrl) + '" style="width:36px;height:36px;border-radius:6px;object-fit:cover">'
      : '<span style="font-size:20px">📱</span>'
    var lineTotal = (item.price || 0) * (item.quantity || 1)
    return '<div class="sv-modal-item">' +
      '<div class="sv-modal-item-img">' + imgHtml + '</div>' +
      '<div class="sv-modal-item-info">' +
        '<div class="sv-modal-item-name">' + esc(name) + '</div>' +
        '<div class="sv-modal-item-sub">$' + (item.price || 0).toLocaleString('es-AR') + ' x ' + (item.quantity || 1) + '</div>' +
      '</div>' +
      '<div class="sv-modal-item-price">$' + lineTotal.toLocaleString('es-AR') + '</div>' +
    '</div>'
  }).join('')

  var channelLabel = order.saleChannel === 'in-store' ? 'Venta en tienda' : 'Venta online'
  var statusLabel = getSalesStatusLabel(order.status)
  var statusClass = getSalesStatusClass(order.status)

  overlay.innerHTML = '<div class="sv-modal">' +
    '<div class="sv-modal-hdr">' +
      '<div>' +
        '<div class="sv-modal-title">' + esc(order.code) + '</div>' +
        '<div class="sv-modal-sub">' + channelLabel + ' · ' + svFormatDate(order.createdAt) + '</div>' +
      '</div>' +
      '<button onclick="closeSaleModal(this.parentElement.parentElement.parentElement)" class="sv-modal-close material-symbols-outlined">close</button>' +
    '</div>' +

    '<div class="sv-modal-body">' +
      '<div class="sv-modal-grid">' +
        '<div class="sv-modal-info-card">' +
          '<div class="sv-modal-info-label">Cliente</div>' +
          '<div class="sv-modal-info-val">' + esc(order.clientName || '—') + '</div>' +
          '<div class="sv-modal-info-sub">DNI: ' + esc(order.clientDni || '—') + '</div>' +
          (order.clientPhone ? '<div class="sv-modal-info-sub">Tel: ' + esc(order.clientPhone) + '</div>' : '') +
          (order.clientEmail ? '<div class="sv-modal-info-sub">Email: ' + esc(order.clientEmail) + '</div>' : '') +
          (order.clientAddress ? '<div class="sv-modal-info-sub">Dir: ' + esc(order.clientAddress) + '</div>' : '') +
          (order.clientCuil ? '<div class="sv-modal-info-sub">CUIL: ' + esc(order.clientCuil) + '</div>' : '') +
        '</div>' +
        '<div class="sv-modal-info-card">' +
          '<div class="sv-modal-info-label">Pago y Estado</div>' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
            '<span class="sv-badge sv-status ' + statusClass + '">' + statusLabel + '</span>' +
          '</div>' +
          '<div class="sv-modal-info-sub">Método: ' + esc(order.payment || '—') + '</div>' +
          (order.cuotas > 1 ? '<div class="sv-modal-info-sub">Cuotas: ' + order.cuotas + '</div>' : '') +
          (order.cashReceived ? '<div class="sv-modal-info-sub">Recibido: $' + order.cashReceived.toLocaleString('es-AR') + '</div>' : '') +
          (order.change ? '<div class="sv-modal-info-sub">Vuelto: $' + order.change.toLocaleString('es-AR') + '</div>' : '') +
          '<div class="sv-modal-info-sub">Moneda: ' + esc(order.currency || 'ARS') + '</div>' +
        '</div>' +
        '<div class="sv-modal-info-card">' +
          '<div class="sv-modal-info-label">Resumen</div>' +
          '<div class="sv-modal-info-sub">Subtotal: $' + (order.subtotal || 0).toLocaleString('es-AR') + '</div>' +
          (order.deliveryCost > 0 ? '<div class="sv-modal-info-sub">Envío: $' + order.deliveryCost.toLocaleString('es-AR') + '</div>' : '') +
          (order.warrantyCost > 0 ? '<div class="sv-modal-info-sub">Garantía: $' + order.warrantyCost.toLocaleString('es-AR') + '</div>' : '') +
          '<div class="sv-modal-info-total">Total: $' + (order.total || 0).toLocaleString('es-AR') + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="sv-modal-section-title">Artículos</div>' +
      '<div class="sv-modal-items">' + itemsHtml + '</div>' +

      (order.notes ? '<div class="sv-modal-notes"><strong>Notas:</strong> ' + esc(order.notes) + '</div>' : '') +
      (order.trackingNumber ? '<div class="sv-modal-notes"><strong>Tracking:</strong> ' + esc(order.trackingNumber) + (order.trackingUrl ? ' (<a href="' + esc(order.trackingUrl) + '" target="_blank">ver</a>)' : '') + '</div>' : '') +
    '</div>' +

    '<div class="sv-modal-footer">' +
      '<button onclick="closeSaleModal(this.parentElement.parentElement.parentElement)" class="btn btn-o">Cerrar</button>' +
    '</div>' +
  '</div>'

  document.body.appendChild(overlay)
  setTimeout(function() { overlay.classList.add('show') }, 10)
}

function closeSaleModal(el) {
  if (el) {
    el.classList.remove('show')
    setTimeout(function() { el.remove() }, 200)
  }
}

// =========== EXPORT SALES CSV ===========
function exportSalesCSV() {
  var data = window._salesHistoryCache && window._salesHistoryCache.data
  if (!data || data.length === 0) {
    showToast('No hay datos para exportar', 'warning')
    return
  }

  var headers = ['Codigo', 'Cliente', 'DNI', 'Email', 'Telefono', 'Canal', 'Estado', 'Pago', 'Total', 'Moneda', 'Cuotas', 'Fecha', 'Admin']
  var rows = data.map(function(o) {
    return [
      o.code,
      (o.clientName || '').replace(/,/g, ' '),
      o.clientDni || '',
      o.clientEmail || '',
      o.clientPhone || '',
      o.saleChannel === 'in-store' ? 'Tienda' : 'Online',
      getSalesStatusLabel(o.status),
      o.payment || '',
      o.total,
      o.currency || 'ARS',
      o.cuotas || 1,
      svFormatDate(o.createdAt),
      o.admin ? o.admin.name : ''
    ].join(',')
  })

  var csv = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n')
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  var link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = 'ventas_' + new Date().toISOString().slice(0, 10) + '.csv'
  link.click()
  URL.revokeObjectURL(link.href)
  showToast('CSV exportado correctamente', 'success')
}

function showToast(msg, type) {
  if (typeof window.showToast === 'function') {
    window.showToast(msg, type || 'info')
  }
}
window.__adminLoaded = true;

// =========== ADMIN CUPONES ===========

var _cuponPage = 1
var _cuponLimit = 25
var _cuponAll = []
var _cuponStats = null
var cuponUsersCache = null

function loadCuponUsers() {
  fetch(API_URL + '/api/admin/users?page=1&limit=200', { headers: {} })
    .then(function (r) { return r.json() })
    .then(function (res) {
      cuponUsersCache = (res.users || [])
      cuponLoadUserDatalist()
    })
    .catch(function () { cuponUsersCache = [] })
}

function cuFmt(n) { return '$' + Number(n || 0).toLocaleString('es-AR') }

function cupStatusLabel(s) {
  return { ACTIVE: 'Activo', USED: 'Usado', EXPIRED: 'Expirado' }[s] || s
}
function cupStatusColor(s) {
  return { ACTIVE: 'var(--green)', USED: 'var(--gray)', EXPIRED: 'var(--red)' }[s] || 'var(--gray)'
}
function cuFmtDate(d) {
  if (!d) return '—'
  var dt = new Date(d)
  if (isNaN(dt.getTime())) return '—'
  return dt.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function loadAdminCoupons(search) {
  var url = API_URL + '/api/admin/coupons?page=' + _cuponPage + '&limit=' + _cuponLimit
  if (search && String(search).trim()) url += '&search=' + encodeURIComponent(String(search).trim())
  fetch(url, { headers: {} })
    .then(function (r) { return r.json() })
    .then(function (res) {
      if (res.error) { showToast(res.error, 'error'); return }
      _cuponAll = res.coupons || []
      _cuponStats = res.stats || null
      renderAdminCoupons(res)
    })
    .catch(function () {
      var el = document.getElementById('cuponTableWrap')
      if (el) el.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--red)">Error al cargar cupones</div>'
    })
}

function renderAdminCoupons(res) {
  renderCuponStats(_cuponStats || res.stats)
  renderCuponList(res.coupons || [])
  renderCuponPagination(res.page || _cuponPage, res.totalPages || 1, res.total || 0)
}

function renderCuponStats(stats) {
  var el = document.getElementById('cuponStatsRow')
  if (!el) return
  var s = stats || {}
  var cards = [
    { label: 'Ingreso generado', val: cuFmt(s.emitido), sub: 'total emitido', color: 'var(--dk)', icon: '💰' },
    { label: 'Usado en compras', val: cuFmt(s.usado), sub: 'descontado del total', color: 'var(--orange)', icon: '🧾' },
    { label: 'Pendiente por usar', val: cuFmt(s.pendiente), sub: 'emitido - usado', color: 'var(--green)', icon: '⏳' },
  ]
  el.innerHTML = cards.map(function (c) {
    return '<div style="background:#fff;border:1px solid var(--border);border-radius:14px;padding:18px;position:relative;overflow:hidden">' +
      '<div style="font-size:10px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;display:flex;align-items:center;gap:6px"><span>' + c.label + '</span></div>' +
      '<div style="font-size:26px;font-weight:700;font-family:\'Playfair Display\',serif;color:' + c.color + ';line-height:1.1">' + c.val + '</div>' +
      '<div style="font-size:11px;color:var(--gray);margin-top:6px">' + c.sub + '</div>' +
      '<div style="display:flex;gap:8px;align-items:center;margin-top:12px;padding-top:12px;border-top:1px solid var(--border);font-size:11px;color:var(--gray)">' +
        '<span>Activos <strong style="color:var(--green)">' + (s.counts && s.counts.ACTIVE || 0) + '</strong></span>' +
        '<span>· Usados <strong style="color:var(--gray)">' + (s.counts && s.counts.USED || 0) + '</strong></span>' +
        '<span>· Expirados <strong style="color:var(--red)">' + (s.counts && s.counts.EXPIRED || 0) + '</strong></span>' +
      '</div>' +
      '</div>'
  }).join('')
}

function cupBadge(c) {
  var giftBadge = c.countsToProfit === false ? '<span style="font-size:10px;color:var(--red);font-weight:600;background:#fef2f2;border:1px solid #fecaca;padding:2px 8px;border-radius:8px;margin-left:6px">regalo</span>' : ''
  var srcLabel = c.source === 'ADMIN' ? 'Admin' : (c.source || '—')
  return '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px">' +
    '<span style="font-family:monospace;font-weight:700;color:var(--dk)">' + esc(c.code) + '</span>' + giftBadge +
    '<span style="font-size:10px;color:var(--gray);background:var(--cream2);padding:2px 8px;border-radius:8px">' + esc(srcLabel) + '</span>' +
    '</div>'
}

function renderCuponList(cupones) {
  var el = document.getElementById('cuponTableWrap')
  if (!el) return
  if (!cupones || cupones.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--gray)">No hay cupones</div>'
    return
  }
  var html = '<div style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid var(--border)">' +
    '<table style="width:100%;text-align:left;border-collapse:collapse;font-size:13px">' +
    '<thead><tr style="border-bottom:2px solid var(--border)">' +
    '<th style="padding:12px 16px;color:var(--gray);font-weight:600;font-size:10px;text-transform:uppercase">Cupón</th>' +
    '<th style="padding:12px 16px;color:var(--gray);font-weight:600;font-size:10px;text-transform:uppercase">Usuario</th>' +
    '<th style="padding:12px 16px;color:var(--gray);font-weight:600;font-size:10px;text-transform:uppercase;text-align:right">Emitido</th>' +
    '<th style="padding:12px 16px;color:var(--gray);font-weight:600;font-size:10px;text-transform:uppercase;text-align:right">Usado</th>' +
    '<th style="padding:12px 16px;color:var(--gray);font-weight:600;font-size:10px;text-transform:uppercase;text-align:right">Restante</th>' +
    '<th style="padding:12px 16px;color:var(--gray);font-weight:600;font-size:10px;text-transform:uppercase">Estado</th>' +
    '<th style="padding:12px 16px;color:var(--gray);font-weight:600;font-size:10px;text-transform:uppercase">Vence</th>' +
    '<th style="padding:12px 16px;color:var(--gray);font-weight:600;font-size:10px;text-transform:uppercase;text-align:center">Acciones</th>' +
    '</tr></thead><tbody>'
  html += cupones.map(function (c) {
    var user = c.user ? (esc(c.user.name || '') + '<br><span style="font-size:11px;color:var(--gray)">' + esc(c.user.email || '') + '</span>') : '<span style="color:var(--gray)">—</span>'
    var statusColor = cupStatusColor(c.status)
    return '<tr style="border-bottom:1px solid var(--border)">' +
      '<td style="padding:14px 16px">' + cupBadge(c) + (c.note ? '<div style="font-size:11px;color:var(--gray);margin-top:4px">' + esc(c.note) + '</div>' : '') + '</td>' +
      '<td style="padding:14px 16px">' + user + '</td>' +
      '<td style="padding:14px 16px;text-align:right;font-weight:600">' + cuFmt(c.originalAmount) + '</td>' +
      '<td style="padding:14px 16px;text-align:right;color:var(--orange);font-weight:600">' + cuFmt(c.usedAmount) + '</td>' +
      '<td style="padding:14px 16px;text-align:right;color:var(--green);font-weight:600">' + cuFmt(c.remainingAmount) + '</td>' +
      '<td style="padding:14px 16px"><span style="font-weight:700;color:' + statusColor + '">' + cupStatusLabel(c.status) + '</span></td>' +
      '<td style="padding:14px 16px;color:var(--gray);font-size:12px">' + cuFmtDate(c.expiresAt) + '</td>' +
      '<td style="padding:14px 16px;text-align:center;white-space:nowrap">' + cupRowActions(c) + '</td>' +
      '</tr>'
  }).join('')
  html += '</tbody></table></div>'
  el.innerHTML = html
}

function cupRowActions(c) {
  var btns = []
  if (c.status === 'ACTIVE') {
    btns.push(cupActionBtn('EXPIRED', 'Expirar', 'var(--red)', c.id))
    if (!c.expiresAt) btns.push(cupActionBtn('EXTEND', 'Extender', 'var(--green)', c.id))
  } else if (c.status === 'EXPIRED' || c.status === 'USED') {
    btns.push(cupActionBtn('ACTIVE', 'Reactivar', 'var(--green)', c.id))
  }
  return btns.join('')
}
function cupActionBtn(action, label, color, id) {
  return '<button onclick="updateAdminCoupon(\'' + action + '\')" data-cid="' + id + '" style="background:none;border:1px solid ' + color + ';color:' + color + ';padding:5px 10px;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;margin:0 2px;font-family:inherit">' + label + '</button>'
}

function renderCuponPagination(page, totalPages, total) {
  var el = document.getElementById('cuponPagination')
  if (!el) return
  var html = '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 4px;font-size:12px;color:var(--gray)">'
  html += '<span>' + total + ' cupón' + (total === 1 ? '' : 'es') + '</span>'
  html += '<span style="display:flex;gap:6px;align-items:center">'
  html += '<button onclick="cuponChangePage(' + (page - 1) + ')" ' + (page <= 1 ? 'disabled' : '') + ' style="padding:5px 12px;border:1px solid var(--border);border-radius:8px;background:#fff;cursor:pointer;font-size:12px">← Anterior</button>'
  html += '<span>Página ' + page + ' de ' + totalPages + '</span>'
  html += '<button onclick="cuponChangePage(' + (page + 1) + ')" ' + (page >= totalPages ? 'disabled' : '') + ' style="padding:5px 12px;border:1px solid var(--border);border-radius:8px;background:#fff;cursor:pointer;font-size:12px">Siguiente →</button>'
  html += '</span></div>'
  el.innerHTML = html
}

function cuponChangePage(p) {
  if (p < 1) return
  _cuponPage = p
  loadAdminCoupons(document.getElementById('cuponSearchInput') ? document.getElementById('cuponSearchInput').value : '')
}

function filterCuponTable(status) {
  var shown = _cuponAll
  if (status) shown = _cuponAll.filter(function (c) { return c.status === status })
  renderCuponList(shown)
  document.querySelectorAll('#cupBtnAll,#cupBtnActive,#cupBtnUsed,#cupBtnExpired').forEach(function (b) { b.classList.remove('ord-btn-act') })
  if (status) {
    var btn = document.getElementById('cupBtn' + status.charAt(0) + status.slice(1).toLowerCase())
    if (btn) btn.classList.add('ord-btn-act')
  } else {
    var allBtn = document.getElementById('cupBtnAll')
    if (allBtn) allBtn.classList.add('ord-btn-act')
  }
}

// Buscador de usuarios para asignar cupones
function cuponLoadUserDatalist() {
  if (!cuponUsersCache) return
  var dl = document.getElementById('cuponUsersList')
  if (dl) dl.innerHTML = cuponUsersCache.map(function (u) { return '<option value="' + esc(u.name) + ' · ' + esc(u.email) + '">' }).join('')
}

function cuponFindUser(text) {
  if (!text) return null
  var needle = String(text).trim().toLowerCase()
  if (!cuponUsersCache) return null
  for (var i = 0; i < cuponUsersCache.length; i++) {
    var u = cuponUsersCache[i]
    var name = (u.name || '').toLowerCase()
    var email = (u.email || '').toLowerCase()
    // El input guarda "Nombre · email" (datalist). Aceptamos coincidencia de
    // email dentro del texto, nombre exacto, o texto == email.
    if (needle === email || (email && needle.indexOf(email) >= 0) || needle === name) return u
  }
  return null
}

function openCuponModal() {
  loadCuponUsers()
  var host = document.getElementById('cuponModalHost')
  if (!host) return
  host.innerHTML =
    '<div id="cuponModalOverlay" style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:1200;display:flex;align-items:flex-start;justify-content:center;padding:8vh 16px 16px;overflow-y:auto">' +
      '<div style="background:#fff;border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.2);width:100%;max-width:560px;overflow:hidden;font-family:inherit">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-bottom:1px solid var(--border);background:var(--cream)">' +
          '<div>' +
            '<div style="font-size:18px;font-weight:700;color:var(--dk);font-family:\'Playfair Display\',serif">Crear cupón</div>' +
            '<div style="font-size:12px;color:var(--gray);margin-top:2px">Asigná un cupón a un usuario y notificalo por email e in-app</div>' +
          '</div>' +
          '<button onclick="closeCuponModal()" aria-label="Cerrar" style="background:none;border:none;font-size:24px;line-height:1;color:var(--gray);cursor:pointer;padding:4px 8px">×</button>' +
        '</div>' +
        '<div style="padding:22px;display:flex;flex-direction:column;gap:16px">' +
          '<div>' +
            '<label style="font-size:11px;font-weight:700;display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px;color:var(--gray)">Usuario *</label>' +
            '<input id="cuponUserSearch" list="cuponUsersList" placeholder="Buscar por nombre o email..." style="width:100%;padding:12px 14px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;outline:none;box-sizing:border-box">' +
            '<datalist id="cuponUsersList"></datalist>' +
            '<div style="font-size:11px;color:var(--gray);margin-top:4px">Elegí el usuario del listado que aparece al escribir.</div>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">' +
            '<div>' +
              '<label style="font-size:11px;font-weight:700;display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px;color:var(--gray)">Monto ($) *</label>' +
              '<input id="cuponAmount" type="number" min="1" placeholder="10000" style="width:100%;padding:12px 14px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;outline:none;box-sizing:border-box">' +
            '</div>' +
            '<div>' +
              '<label style="font-size:11px;font-weight:700;display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px;color:var(--gray)">Vencimiento</label>' +
              '<input id="cuponExpires" type="datetime-local" style="width:100%;padding:12px 14px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;outline:none;box-sizing:border-box">' +
            '</div>' +
          '</div>' +
          '<div style="background:var(--cream2);border:1px solid var(--border);border-radius:12px;padding:14px">' +
            '<label style="font-size:11px;font-weight:700;display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px;color:var(--gray)">Suma a la ganancia de la tienda</label>' +
            '<select id="cuponCountsProfit" style="width:100%;padding:11px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;background:#fff">' +
              '<option value="true" selected>✓ Sí, suma a la ganancia</option>' +
              '<option value="false">✗ No (es un regalo)</option>' +
            '</select>' +
            '<div style="font-size:11px;color:var(--gray);margin-top:6px">Si es un regalo promocional, no se cuenta como ingreso de la tienda.</div>' +
          '</div>' +
          '<div>' +
            '<label style="font-size:11px;font-weight:700;display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px;color:var(--gray)">Nota (opcional)</label>' +
            '<textarea id="cuponNote" rows="2" placeholder="Ej: regalo por cumpleaños, compensación..." style="width:100%;padding:11px 14px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;outline:none;box-sizing:border-box;resize:vertical"></textarea>' +
          '</div>' +
          '<div id="cuponFormFeedback" style="font-size:12px;min-height:0"></div>' +
        '</div>' +
        '<div style="padding:16px 22px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:10px">' +
          '<button onclick="closeCuponModal()" style="padding:11px 18px;background:none;border:1.5px solid var(--border);color:var(--gray);border-radius:10px;font-size:14px;font-weight:600;cursor:pointer">Cancelar</button>' +
          '<button id="cuponSubmitBtn" onclick="createAdminCoupon()" style="padding:11px 22px;background:var(--orange);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">Generar y notificar</button>' +
        '</div>' +
      '</div>' +
    '</div>'
  var overlay = document.getElementById('cuponModalOverlay')
  if (overlay) overlay.addEventListener('click', function (e) { if (e.target === overlay) closeCuponModal() })
  var input = document.getElementById('cuponUserSearch')
  if (input) { setTimeout(function () { input.focus() }, 30) }
}

function closeCuponModal() {
  var host = document.getElementById('cuponModalHost')
  if (host) host.innerHTML = ''
}

function createAdminCoupon() {
  var userInput = document.getElementById('cuponUserSearch')
  var amountInput = document.getElementById('cuponAmount')
  var expiresInput = document.getElementById('cuponExpires')
  var countsSel = document.getElementById('cuponCountsProfit')
  var noteInput = document.getElementById('cuponNote')
  var fb = document.getElementById('cuponFormFeedback')
  if (fb) fb.innerHTML = ''

  var user = cuponFindUser(userInput ? userInput.value : '')
  if (!user) {
    if (fb) { fb.innerHTML = '<span style="color:var(--red)">Seleccioná un usuario válido (por nombre o email) del listado.</span>' }
    return
  }
  var amount = parseInt(amountInput ? amountInput.value : '0', 10)
  if (!amount || amount <= 0) {
    if (fb) { fb.innerHTML = '<span style="color:var(--red)">Ingresá un monto válido.</span>' }
    return
  }

  var payload = {
    userId: user.id,
    amount: amount,
    countsToProfit: countsSel ? countsSel.value !== 'false' : true,
    note: noteInput ? (noteInput.value || undefined) : undefined,
  }
  if (expiresInput && expiresInput.value) payload.expiresAt = new Date(expiresInput.value).toISOString()

  var btn = document.getElementById('cuponSubmitBtn')
  if (btn) { btn.disabled = true; btn.textContent = 'Generando...' }

  fetch(API_URL + '/api/admin/coupons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then(function (r) { return r.json() })
    .then(function (res) {
      if (btn) { btn.disabled = false; btn.textContent = 'Generar y notificar' }
      if (res.error) { if (fb) fb.innerHTML = '<span style="color:var(--red)">' + esc(res.error) + '</span>'; return }
      if (fb) fb.innerHTML = '<span style="color:var(--green)">Cupón <strong>' + esc(res.coupon.code) + '</strong> generado. ' + (res.emailSent ? 'Email enviado.' : (res.notice || 'Email no enviado.')) + '</span>'
      _cuponPage = 1
      closeCuponModal()
      loadAdminCoupons()
      showToast('Cupón ' + res.coupon.code + ' generado', 'success')
    })
    .catch(function (e) {
      if (btn) { btn.disabled = false; btn.textContent = 'Generar y notificar' }
      if (fb) fb.innerHTML = '<span style="color:var(--red)">Error al generar cupón: ' + esc(e.message) + '</span>'
    })
}

function updateAdminCoupon(action) {
  var btn = event && event.target ? event.target : null
  var id = null
  // El botón no lleva el id; lo resolvemos por el código más reciente no es fiable.
  // Mejor: cada botón guarda el id del cupón en un atributo data.
  if (btn && btn.getAttribute('data-cid')) id = btn.getAttribute('data-cid')

  // Fallback: resolver el cupón por fila/clic es complejo. Requerimos data-cid.
  if (!id) { showToast('Error: falta identificador del cupón', 'error'); return }

  var payload = {}
  if (action === 'ACTIVE') payload.status = 'ACTIVE'
  else if (action === 'EXPIRED') payload.status = 'EXPIRED'
  else if (action === 'EXTEND') {
    var defaultExp = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString()
    var newExp = prompt('Nueva fecha de vencimiento (YYYY-MM-DD):', defaultExp.slice(0, 10))
    if (!newExp) return
    payload.expiresAt = new Date(newExp + 'T23:59:59').toISOString()
    payload.status = 'ACTIVE'
  } else return

  fetch(API_URL + '/api/admin/coupons/' + id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then(function (r) { return r.json() })
    .then(function (res) {
      if (res.error) { showToast(res.error, 'error'); return }
      showToast('Cupón actualizado', 'success')
      loadAdminCoupons(document.getElementById('cuponSearchInput') ? document.getElementById('cuponSearchInput').value : '')
    })
    .catch(function (e) { showToast(e.message, 'error') })
}

// onAdminIphoneModelChange y updateProductFields viven en render.js (versión
// genérica: soporta cualquier marca vía SELL_MODELS, no solo iPhone). No
// redeclarar acá — al ser scripts clásicos en el mismo scope global, una
// declaración `function` en este archivo pisaría la de render.js porque
// admin.js se carga después.
