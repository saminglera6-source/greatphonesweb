// =========== RENDER ===========
var API_URL=window.API_URL||(window.location.hostname==='localhost'?window.location.protocol+'//'+window.location.host:window.location.origin);
var PRODUCTS=[];
var currentProd=null;
var currentAcc=null;

var detWMult=0,detDExtra=0,selCuotas=1;

function fmt(n){return'$'+n.toLocaleString('es-AR');}

var detailBackTarget='shop';
var _accImages=[];

function goBackFromDetail(){
  if(window.history.length>1){window.history.back();return;}
  var backMap={home:'/',shop:'/productos',accesorios:'/accesorios',favoritos:'/favoritos',ofertas:'/ofertas',preventas:'/preventas'};
  window.location.href=backMap[detailBackTarget]||'/productos';
}

function detIco(key){
  var P={
    check:'<path d="M20 6L9 17l-5-5"/>',
    battery:'<rect x="1" y="6" width="18" height="12" rx="2"/><line x1="23" y1="10" x2="23" y2="14"/>',
    color:'<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
    ram:'<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
    storage:'<line x1="22" y1="12" x2="2" y2="12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/><line x1="6" y1="16" x2="6.01" y2="16"/><line x1="10" y1="16" x2="10.01" y2="16"/>',
    cpu:'<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>',
    screen:'<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
    date:'<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    stock:'<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
    status:'<path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
    phone:'<rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
    shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    star:'<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    percent:'<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    dev:'<path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'
  };
  var body=P[key]||P.stock;
  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+body+'</svg>';
}

function detFavBtnHtml(isFav){
  return '<button id="detFavBtn" onclick="toggleDetFav()" class="fav-btn'+(isFav?' saved':'')+'" style="position:absolute;top:16px;right:16px;width:44px;height:44px;border-radius:50%;background:#fff;border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:20px;z-index:10;color:var(--gray)">'+(isFav?'\u2665':'\u2661')+'</button>';
}

function detMainImgHTML(imgUrl, isFav, total, currentIdx, accMode){
  var idx=currentIdx||0;
  total=total||1;
  var show=total>1?'flex':'none';
  var prevIdx=(idx-1+total)%total, nextIdx=(idx+1)%total;
  var prevOn=accMode?'switchAccMainImg('+prevIdx+')':'prevDetailImage()';
  var nextOn=accMode?'switchAccMainImg('+nextIdx+')':'nextDetailImage()';
  var counter=total>1?'<span class="det-img-counter" id="detImgCounter">'+(idx+1)+' / '+total+'</span>':'';
  var prev='<button id="detImgPrev" onclick="'+prevOn+'" aria-label="Imagen anterior" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.9);border:1px solid var(--border);display:'+show+';align-items:center;justify-content:center;cursor:pointer;font-size:18px;z-index:10;color:var(--dk);box-shadow:0 2px 8px rgba(0,0,0,.1)">\u2190</button>';
  var next='<button id="detImgNext" onclick="'+nextOn+'" aria-label="Imagen siguiente" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.9);border:1px solid var(--border);display:'+show+';align-items:center;justify-content:center;cursor:pointer;font-size:18px;z-index:10;color:var(--dk);box-shadow:0 2px 8px rgba(0,0,0,.1)">\u2192</button>';
  return detFavBtnHtml(isFav)+prev+next+counter+
    '<div style="position:relative;width:100%;height:100%;overflow:hidden;cursor:zoom-in" onclick="openLightbox(\''+imgUrl+'\')" onmousemove="handleImageZoom(event,this)" onmouseleave="resetImageZoom(this)">'+
      '<img loading="lazy" src="'+imgUrl+'" style="width:100%;height:100%;object-fit:contain;transition:transform .2s ease;pointer-events:none" id="detZoomImg">'+
      '<div class="det-img-zoom"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--dk)" stroke-width="2.5"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg></div>'+
    '</div>';
}

function cleanPreorderName(p){
  var name=(p.name||p.modelGroup||'');
  var b=(p.brand||'');
  if(b&&name.indexOf(b)===0&&name.trim()!==b.trim())name=name.slice(b.length).replace(/^\s+/,'');
  return name||p.modelGroup||'';
}

// Contador visual de días hasta la disponibilidad de la preventa.
function preorderCountdown(p){
  if(!p.availableFrom)return { html:'<div class="pcard-preorder-avail">Próximamente</div>', days:null };
  var d=new Date(p.availableFrom);
  var now=new Date();
  var days=Math.ceil((d-now)/86400000);
  if(days<=1)return { html:'<div class="pcard-preorder-avail pcard-preorder-count">Listo muy pronto</div>', days:0 };
  var label=days<60?('En '+days+' días'):('En ~'+Math.round(days/30)+' meses');
  return { html:'<div class="pcard-preorder-avail pcard-preorder-count"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg> '+label+'</div>', days:days };
}

function buildSpecsForProduct(p){
  var specs=[];
  var type=(p.type||'').toLowerCase();
  var cond=p.condition||'';
  if(type==='celular'||type==='tablet'){
    if(cond==='Nuevo'){specs.push({key:'check',label:'Estado',val:'Nuevo',color:'var(--green)'});}
    else if(cond){specs.push({key:'status',label:'Estado',val:cond,color:'var(--orange)'});}
    if(p.battery){var batPct=p.battery;var batColor=batPct>=90?'var(--green)':batPct>=75?'var(--orange)':'var(--red)';specs.push({key:'battery',label:'Bateria',val:batPct+'%',color:batColor});}
    else if(p.isPreorder||p.batteryFrom){specs.push({key:'battery',label:'Bateria',val:'Entre '+((p.batteryFrom)||85)+' y '+((p.batteryTo)||95)+' %',color:'var(--green)'});}
    if(p.color)specs.push({key:'color',label:'Color',val:p.color});
    if(p.ram)specs.push({key:'ram',label:'RAM',val:p.ram});
  }else if(type==='laptop'||type==='desktop'){
    if(p.processor)specs.push({key:'cpu',label:'Procesador',val:p.processor});
    else if(p.sub){var cpuMatch=p.sub.match(/(M\d|Intel|AMD|Core\s*[i]\w+)/i);if(cpuMatch)specs.push({key:'cpu',label:'Procesador',val:cpuMatch[0]});}
    if(p.ram)specs.push({key:'ram',label:'RAM',val:p.ram});
    if(p.screen)specs.push({key:'screen',label:'Pantalla',val:p.screen+'"'});
  }
  if(p.stock!==undefined){
    if(p.isPreorder){
      // Disponibilidad como card común (no ancha), antes del almacenamiento
      specs.push({key:'date',label:'Disponibilidad',val:preorderShortDate(p.availableFrom),color:'var(--orange)'});
    }else{
      var stockColor=p.stock>5?'var(--green)':p.stock>0?'var(--orange)':'var(--red)';
      specs.push({key:'stock',label:'Stock',val:p.stock>0?p.stock+' disponibles':'Agotado',color:stockColor});
    }
  }
  if(p.storage)specs.push({key:'storage',label:'Almacenamiento',val:p.storage});
  return specs;
}

function preorderShortDate(d){
  if(!d)return 'Próximamente';
  var dt=new Date(d);
  var days=Math.ceil((dt-new Date())/86400000);
  if(days<=1)return 'Pronto';
  if(days<60)return '~'+days+' días';
  return dt.toLocaleDateString('es-AR',{day:'numeric',month:'short'});
}

function renderSpecsGrid(specs){
  var el=document.getElementById('detSpecs');if(!el)return;
  var section=document.getElementById('detSpecsSection');
  if(!specs.length){
    el.style.display='none';
    if(section)section.style.display='none';
    return;
  }
  el.style.display='grid';
  if(section)section.style.display='block';
  el.innerHTML=specs.map(function(s){
    var wide=(s.key==='storage'||s.key==='stock')?' sp-wide':'';
    return '<div class="sp-card'+wide+'">'+
      '<div class="sp-ico">'+detIco(s.key||'stock')+'</div>'+
      '<div class="sp-text"><div class="sp-label">'+s.label+'</div>'+
      '<div class="sp-val"'+(s.color?' style="color:'+s.color+'"':'')+'>'+s.val+'</div></div></div>';
  }).join('');
}

function renderDetBadges(p,extraCond){
  var el=document.getElementById('detBadges');if(!el)return;
  var type=(p.type||'').toLowerCase();
  var badges=[];
  var isPromo=isOfferValid(p);
  if(isPromo){
    badges.push({ico:'percent',text:p.discount+'% OFF',c:'red'});
  }
  badges.push({ico:'check',text:'Cable + funda gratis',c:'green'});
  if(type==='celular')badges.splice(1,0,{ico:'phone',text:'IMEI Verificado',c:'green'});
  if(p.isPreorder){
    var dateStr=p.availableFrom?new Date(p.availableFrom).toLocaleDateString('es-AR',{month:'long',year:'numeric'}):'Próximamente';
    badges.unshift({ico:'star',text:'Preventa — Disponible '+dateStr,c:'orange'});
  }
  el.innerHTML=badges.map(function(b){
    return '<div class="det-pill" data-c="'+b.c+'">'+detIco(b.ico||'check')+' '+b.text+'</div>';
  }).join('');
}

function addToCartAcc(id,triggerEl){
  var a=getById(window.ACCS,id);if(!a)return;
  var existing=Cart.find(function(item){return item.id===id;});
  if(existing){existing.qty++;}else{Cart.push({id:id,qty:1});}
  saveCart();updCartBadge();
  if(triggerEl&&typeof svBtnSuccess==='function')svBtnSuccess(triggerEl);
  openCart();showToast('Agregado al carrito');
}
var _loadingBarEl=null;
function showLoadingBar(){
  if(!_loadingBarEl){
    _loadingBarEl=document.createElement('div');
    _loadingBarEl.id='loadingBar';
    _loadingBarEl.style.width='0%';
    document.body.appendChild(_loadingBarEl);
  }
  _loadingBarEl.style.width='0%';
  _loadingBarEl.style.display='block';
  requestAnimationFrame(function(){_loadingBarEl.style.width='60%';});
}
function hideLoadingBar(){
  if(_loadingBarEl){
    _loadingBarEl.style.width='100%';
    setTimeout(function(){_loadingBarEl.style.display='none';_loadingBarEl.style.width='0%';},300);
  }
}

function renderSkeletonGrid(gid,count){
  var grid=document.getElementById(gid);
  if(!grid)return;
  var html='';
  for(var i=0;i<count;i++){
    html+='<div class="skeleton skeleton-card" style="aspect-ratio:auto">'+
      '<div class="skeleton skeleton-img"></div>'+
      '<div class="skeleton skeleton-line" style="width:80%"></div>'+
      '<div class="skeleton skeleton-line-sm"></div>'+
      '<div class="skeleton skeleton-line" style="width:50%"></div>'+
      '<div class="skeleton skeleton-btn"></div>'+
      '</div>';
  }
  grid.innerHTML=html;
}

function loadProducts(){
  // Use server pre-fetched data if available on first load
  if(!window._productsLoaded&&window.__INITIAL_PRODUCTS__&&window.__INITIAL_PRODUCTS__.length>0){
    PRODUCTS=window.__INITIAL_PRODUCTS__;
    window._productsLoaded=true;
    delete window.__INITIAL_PRODUCTS__;
    hideLoadingBar();
    renderHomeRail();
    renderOfferStrip();
    renderShopGrid();
    renderOfertasGrid();
    renderFeaturedGrid();
    if(document.getElementById('p-favoritos')&&document.getElementById('p-favoritos').classList.contains('act')){renderFavGrid();}
    if(document.getElementById('p-checkout')&&document.getElementById('p-checkout').classList.contains('act')){renderCheckoutSummary();}
    return Promise.resolve();
  }
  var useCache=!!window._productsLoaded;
  if(!useCache){
    renderSkeletonGrid('homeRail',4);
    renderSkeletonGrid('shopGrid',8);
    renderSkeletonGrid('ofertasGrid',4);
    renderSkeletonGrid('featuredGrid',4);
    showLoadingBar();
  }
  // limit=300: PRODUCTS es un array plano usado por catálogo público y admin
  // por igual, sin paginación real contra el server (todo filtro/orden pasa
  // client-side). El endpoint por default trae solo 20 — con >20 productos
  // activos el más viejo caía de la página 1 y desaparecía del panel admin
  // apenas se creaba uno nuevo (siempre ordenado por createdAt desc).
  return cachedFetch(API_URL+'/api/products?limit=300',null,60000).then(function(res){
    PRODUCTS=res.data||res;
    window._productsLoaded=true;
    // Re-render la grilla admin apenas hay datos (incluso en uso de caché, que
    // antes cortaba antes de llegar acá). Se detecta por presencia del grid,
    // no por currentAdminTab: en navegación client-side el orden de carga de
    // render.js/admin.js y el intervalo de AdminPageClient pueden hacer que
    // currentAdminTab aún no esté seteado cuando llegan los datos.
    if(document.getElementById('admin-prods-grid')&&typeof renderAdminProductsFiltered==='function'){
      renderAdminProductsFiltered(document.getElementById('adminProdSearch')?document.getElementById('adminProdSearch').value:'');
    }
    if(useCache)return; // Skip re-renders for background cache refresh
    hideLoadingBar();
    if(window.checkPendingDetail)window.checkPendingDetail();
    renderHomeRail();
    renderOfferStrip();
    renderShopGrid();
    renderOfertasGrid();
    renderFeaturedGrid();
    if(document.getElementById('p-favoritos')&&document.getElementById('p-favoritos').classList.contains('act')){renderFavGrid();}
    if(document.getElementById('p-checkout')&&document.getElementById('p-checkout').classList.contains('act')){renderCheckoutSummary();}
  }).catch(function(e){hideLoadingBar();console.error('Error loading products:',e);if(typeof showErrorToast==='function')showErrorToast('Error','No se pudieron cargar los productos');});
}

function loadAccessories(){
  // Use server pre-fetched data if available on first load
  if(!window._accLoaded&&window.__INITIAL_ACCESSORIES__&&window.__INITIAL_ACCESSORIES__.length>0){
    window.ACCS=window.__INITIAL_ACCESSORIES__;
    window._accLoaded=true;
    delete window.__INITIAL_ACCESSORIES__;
    if(document.getElementById('accGrid'))renderAccGrid();
    if(document.getElementById('p-detail')&&document.getElementById('p-detail').classList.contains('act')){renderRelatedAccs();}
    if(currentAcc&&typeof renderAccVariants==='function')renderAccVariants();
    if(document.getElementById('p-favoritos')&&document.getElementById('p-favoritos').classList.contains('act')){renderFavGrid();}
    if(document.getElementById('p-checkout')&&document.getElementById('p-checkout').classList.contains('act')){renderCheckoutSummary();}
    return;
  }
  var useCache=!!window._accLoaded;
  if(!useCache)renderSkeletonGrid('accGrid',8);
  cachedFetch(API_URL+'/api/accessories',null,60000).then(function(res){
    window.ACCS=res.data||res;
    window._accLoaded=true;
    // Grilla admin de accesorios: re-render apenas llegan los datos, incluso en
    // uso de caché (mismo caso que PRODUCTS en navegación client-side). Se
    // detecta por presencia del grid, no por currentAdminTab.
    if(document.getElementById('admin-acc-grid')&&typeof renderAdminAccFiltered==='function'){
      renderAdminAccFiltered(document.getElementById('adminAccSearch')?document.getElementById('adminAccSearch').value:'');
    }
    if(useCache)return;
    if(document.getElementById('accGrid'))renderAccGrid();
    if(document.getElementById('p-detail')&&document.getElementById('p-detail').classList.contains('act')){renderRelatedAccs();}
    if(currentAcc&&typeof renderAccVariants==='function')renderAccVariants();
    if(document.getElementById('p-favoritos')&&document.getElementById('p-favoritos').classList.contains('act')){renderFavGrid();}
    if(document.getElementById('p-checkout')&&document.getElementById('p-checkout').classList.contains('act')){renderCheckoutSummary();}
  }).catch(function(e){console.error('Error loading accessories:',e);if(typeof showErrorToast==='function')showErrorToast('Error','No se pudieron cargar los accesorios');});
}

function refreshAdmin(){
  window._productsLoaded=false;
  window._accLoaded=false;
  if(typeof invalidateCache==='function'){
    invalidateCache('/api/products');
    invalidateCache('/api/accessories');
    invalidateCache('/api/inventory');
  }
  // Esperar a que carguen los datos nuevos antes de re-renderizar el tab.
  // Antes se llamaba loadProducts() y loadAccessories() sin esperar, pero son
  // async; el render del tab se ejecutaba con datos viejos.
  var tab=window.currentAdminTab;
  Promise.all([
    Promise.resolve(loadProducts()),
    Promise.resolve(loadAccessories())
  ]).then(function(){
    // Re-renderizar el tab activo con los datos frescos.
    if(tab==='prods'&&typeof loadAdminProducts==='function')loadAdminProducts();
    if(tab==='acc'&&typeof renderAccGrid==='function')renderAccGrid();
    if(tab==='stock'&&typeof renderStockList==='function')renderStockList();
    if(tab==='promos'){
      if(typeof renderPromoProducts==='function')renderPromoProducts();
      if(typeof renderActivePromos==='function')renderActivePromos();
    }
    if(tab==='dashboard'&&typeof loadDashboard==='function')loadDashboard();
  });
}

function loadDashboard(){
  if(!currentUser||currentUser.role!=='ADMIN')return;
  if(window._dashRefreshInterval)clearInterval(window._dashRefreshInterval);
  if(window._dashDataChangedHandler){window.removeEventListener('admin:data-changed',window._dashDataChangedHandler);}
  if(window._dashVisibilityHandler){document.removeEventListener('visibilitychange',window._dashVisibilityHandler);}
  window._dashDataChangedHandler=function(){if(typeof loadDashboard==='function')loadDashboard();};
  window._dashVisibilityHandler=function(){if(!document.hidden&&typeof loadDashboard==='function')loadDashboard();};
  window.addEventListener('admin:data-changed',window._dashDataChangedHandler);
  document.addEventListener('visibilitychange',window._dashVisibilityHandler);
  fetch(API_URL+'/api/admin/dashboard',{
    headers:{}
  }).then(function(r){
    if(!r.ok)throw new Error('Error '+r.status);
    return r.json();
  }).then(function(d){
    // El usuario pudo haber navegado a otro tab mientras el fetch estaba
    // en vuelo. No pintar si ya no estamos en el dashboard.
    if(window.currentAdminTab!=='dashboard')return;
    var dashView=document.getElementById('dashboard-view');
    if(!dashView)return;
    window._dashData=d;
    renderDashStats();
    renderDashRecentOrders(d);
    renderDashTopProducts(d);
    renderDashStockAlerts(d);
    renderDashPaymentBreakdown(d);
    renderDashCharts();
  }).catch(function(e){
    console.error('Dashboard error:',e);if(typeof showErrorToast==='function')showErrorToast('Error','No se pudo cargar el dashboard');
  });
}

function setDashView(view){
  window.dashView=view;
  var btnM=document.getElementById('dashTabMensual');
  var btnA=document.getElementById('dashTabAnual');
  var sel=document.getElementById('dashMonthSelect');
  if(!btnM||!btnA||!sel)return;
  
  if(view==='mensual'){
    btnM.style.background='var(--orange)';btnM.style.color='#fff';
    btnA.style.background='transparent';btnA.style.color='var(--gray)';
    sel.style.display='';
  }else{
    btnA.style.background='var(--orange)';btnA.style.color='#fff';
    btnM.style.background='transparent';btnM.style.color='var(--gray)';
    sel.style.display='none';
  }
  renderDashStats();
}

function updateDashMonth(month){
  window.dashMonth=parseInt(month);
  renderDashStats();
}

function renderDashStats(){
  if(!window._dashData)return;
  if(!document.getElementById('kpi-revenue'))return;
  var d=window._dashData;
  var stats;
  var isMensual=window.dashView==='mensual';
  
  if(isMensual){
    stats=d.monthlyStats[window.dashMonth];
    var months=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    document.getElementById('kpi-revenue-label').textContent='Ingresos ('+months[window.dashMonth]+')';
    document.getElementById('kpi-orders-label').textContent='Pedidos ('+months[window.dashMonth]+')';
    document.getElementById('kpi-ticket-label').textContent='Ticket Promedio ('+months[window.dashMonth]+')';
    document.getElementById('kpi-users-label').textContent='Nuevos Usuarios ('+months[window.dashMonth]+')';
    document.getElementById('kpi-profit-label').textContent='Ganancia ('+months[window.dashMonth]+')';
    
    // Show change indicators for mensual
    document.getElementById('kpi-revenue-change-container').style.display='';
    document.getElementById('kpi-orders-change-container').style.display='';
    document.getElementById('kpi-ticket-change-container').style.display='';
    document.getElementById('kpi-users-change-container').style.display='';
    
    // Calculate changes vs previous month
    var prevMonth=window.dashMonth>0?window.dashMonth-1:11;
    var prevStats=d.monthlyStats[prevMonth];
    var revChange=prevStats.revenue>0?Math.round(((stats.revenue-prevStats.revenue)/prevStats.revenue)*100):0;
    var ordChange=prevStats.orders>0?Math.round(((stats.orders-prevStats.orders)/prevStats.orders)*100):0;
    var tickChange=prevStats.avgTicket>0?Math.round(((stats.avgTicket-prevStats.avgTicket)/prevStats.avgTicket)*100):0;
    var usrChange=prevStats.newUsers>0?Math.round(((stats.newUsers-prevStats.newUsers)/prevStats.newUsers)*100):0;
    
    document.getElementById('kpi-revenue-change').textContent=(revChange>=0?'+':'')+revChange+'% vs mes ant.';
    document.getElementById('kpi-orders-change').textContent=(ordChange>=0?'+':'')+ordChange+'% vs mes ant.';
    document.getElementById('kpi-ticket-change').textContent=(tickChange>=0?'+':'')+tickChange+'% vs mes ant.';
    document.getElementById('kpi-users-change').textContent=(usrChange>=0?'+':'')+usrChange+'% vs mes ant.';
  }else{
    stats=d.annualStats;
    var year=new Date().getFullYear();
    document.getElementById('kpi-revenue-label').textContent='Ingresos Totales ('+year+')';
    document.getElementById('kpi-orders-label').textContent='Pedidos Totales ('+year+')';
    document.getElementById('kpi-ticket-label').textContent='Ticket Promedio ('+year+')';
    document.getElementById('kpi-users-label').textContent='Nuevos Usuarios ('+year+')';
    document.getElementById('kpi-profit-label').textContent='Ganancia Total ('+year+')';
    
    // Hide change indicators for anual
    document.getElementById('kpi-revenue-change-container').style.display='none';
    document.getElementById('kpi-orders-change-container').style.display='none';
    document.getElementById('kpi-ticket-change-container').style.display='none';
    document.getElementById('kpi-users-change-container').style.display='none';
  }
  
  // Update values
  document.getElementById('kpi-revenue').textContent=fmt(stats.revenue);
  document.getElementById('kpi-orders').textContent=stats.orders;
  document.getElementById('kpi-ticket').textContent=fmt(stats.avgTicket);
  document.getElementById('kpi-users').textContent=stats.newUsers;
  var profit=stats.profit||0;
  document.getElementById('kpi-profit').textContent=fmt(profit);
  var profitUsd=window.dolarRate>0?Math.round(profit/window.dolarRate):0;
  document.getElementById('kpi-profit-usd').textContent=profitUsd>0?('US$ '+profitUsd.toLocaleString('es-AR')):'US$ 0';
}

function renderDashRecentOrders(d){
  var statusColors={PENDING:'var(--orange)',PROCESSING:'var(--blue)',SHIPPED:'#8b5cf6',DELIVERED:'var(--green)',CANCELLED:'var(--red)'};
  var statusLabels={PENDING:'Pendiente',PROCESSING:'Procesando',SHIPPED:'Enviado',DELIVERED:'Entregado',CANCELLED:'Cancelado'};
  var ordersTbody=document.getElementById('dashboard-recent-orders');
  if(ordersTbody){
    if(!d.recentOrders.length){
      ordersTbody.innerHTML='<tr><td colspan="4" style="padding:24px;text-align:center;color:var(--gray)">No hay pedidos</td></tr>';
    }else{
       ordersTbody.innerHTML=d.recentOrders.map(function(o){
        var sc=statusColors[o.status]||'var(--gray)';
        var sl=statusLabels[o.status]||o.status;
        var profit=o.profit||0;
        var methodColor='var(--gray)';
        if(o.payment==='Efectivo'||o.payment==='efectivo')methodColor='var(--green)';
        else if(o.payment==='Transferencia')methodColor='var(--orange)';
        else if(o.payment==='wallet')methodColor='#8b5cf6';
        return'<tr style="border-bottom:1px solid var(--border)">'+
          '<td style="padding:10px 14px;font-size:12px;font-weight:600">'+o.id+'</td>'+
          '<td style="padding:10px 14px;font-size:12px">'+escapeHtml(o.client||'')+'</td>'+
          '<td style="padding:10px 14px;font-size:12px;font-weight:600">'+fmt(o.total)+'</td>'+
          '<td style="padding:10px 14px;font-size:12px;font-weight:700;color:var(--green)">'+fmt(profit)+'</td>'+
          '<td style="padding:10px 14px"><span style="font-size:10px;font-weight:600;padding:3px 8px;border-radius:10px;background:'+methodColor+'15;color:'+methodColor+'">'+escapeHtml(o.payment||'—')+'</span></td>'+
          '<td style="padding:10px 14px"><span style="font-size:10px;font-weight:600;padding:3px 8px;border-radius:10px;background:'+sc+';color:#fff">'+sl+'</span></td>'+
        '</tr>';
      }).join('');
    }
  }
}

function renderDashTopProducts(d){
  var topUl=document.getElementById('dashboard-top-products');
  if(topUl){
    if(!d.topProducts.length){
      topUl.innerHTML='<li style="padding:16px;text-align:center;color:var(--gray)">Sin datos</li>';
    }else{
      topUl.innerHTML=d.topProducts.map(function(p,i){
        var imgHtml=p.imageUrl?'<img loading="lazy" src="'+p.imageUrl+'" style="width:100%;height:100%;object-fit:cover">':'<span style="font-size:24px">'+(p.ico||'\uD83D\uDCF1')+'</span>';
        return'<li style="display:flex;align-items:center;gap:12px;padding:10px;border-radius:8px;transition:background .15s" onmouseover="this.style.background=\'var(--cream2)\'" onmouseout="this.style.background=\'transparent\'">'+
          '<div style="width:44px;height:44px;border-radius:8px;background:var(--cream2);overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center">'+imgHtml+'</div>'+
          '<div style="flex:1;min-width:0">'+
            '<h4 style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(p.name)+'</h4>'+
            '<p style="font-size:11px;color:var(--gray)">'+esc(p.sub||p.brand||'')+'</p>'+
          '</div>'+
          '<div style="text-align:right">'+
            '<div style="font-size:14px;font-weight:700">'+p.sold+'</div>'+
            '<div style="font-size:10px;color:var(--gray)">uds.</div>'+
          '</div>'+
        '</li>';
      }).join('');
    }
  }
}

function renderDashPaymentBreakdown(d){
  var box=document.getElementById('dashboard-payment-breakdown');
  if(!box)return;
  var data=d.paymentBreakdown||[];
  if(!data.length){
    box.innerHTML='<div style="text-align:center;padding:1.5rem;color:var(--gray);font-size:13px">Sin datos de pagos este año</div>';
    return;
  }
  var maxRev=Math.max.apply(null,data.map(function(x){return x.revenue||0;}).concat([1]));
  var colors={'Efectivo':'var(--green)','Transferencia':'var(--orange)','wallet':'#8b5cf6','Mercado Pago':'#009ee3','Sin especificar':'var(--gray)'};
  box.innerHTML=data.map(function(x){
    var color=colors[x.method]||'var(--orange)';
    var pct=Math.round(((x.revenue||0)/maxRev)*100);
    var usd=window.dolarRate>0?Math.round((x.revenue||0)/window.dolarRate):0;
    return '<div>'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'+
        '<div style="display:flex;align-items:center;gap:8px">'+
          '<span style="font-size:12px;font-weight:600;color:var(--dk)">'+escapeHtml(x.method)+'</span>'+
          '<span style="font-size:10px;color:var(--gray);background:var(--cream2);padding:2px 8px;border-radius:10px">'+x.count+' ventas</span>'+
        '</div>'+
        '<div style="text-align:right">'+
          '<div style="font-size:13px;font-weight:800;color:'+color+'">'+fmt(x.revenue||0)+'</div>'+
          '<div style="font-size:10px;color:var(--green)">Ganancia: '+fmt(x.profit||0)+'</div>'+
        '</div>'+
      '</div>'+
      '<div style="height:8px;background:var(--cream2);border-radius:6px;overflow:hidden">'+
        '<div style="height:100%;border-radius:6px;background:'+color+';width:'+pct+'%"></div>'+
      '</div>'+
      (usd>0?'<div style="font-size:10px;color:var(--orange);margin-top:3px">US$ '+usd.toLocaleString('es-AR')+'</div>':'')+
    '</div>';
  }).join('');
}

function renderDashStockAlerts(d){
  var stockUl=document.getElementById('dashboard-stock-alerts');
  if(stockUl){
    if(!d.lowStock.length){
      stockUl.innerHTML='<li style="padding:16px;text-align:center;color:var(--green)">Todo el stock OK \u2705</li>';
    }else{
      stockUl.innerHTML=d.lowStock.map(function(p){
        var imgHtml=p.imageUrl?'<img loading="lazy" src="'+p.imageUrl+'" style="width:100%;height:100%;object-fit:cover">':'<span style="font-size:24px">'+(p.ico||'\uD83D\uDCF1')+'</span>';
        return'<li style="display:flex;align-items:center;gap:12px;padding:10px;border-radius:8px;transition:background .15s" onmouseover="this.style.background=\'rgba(239,68,68,.05)\'" onmouseout="this.style.background=\'transparent\'">'+
          '<div style="width:40px;height:40px;border-radius:8px;background:var(--cream2);overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center">'+imgHtml+'</div>'+
          '<div style="flex:1;min-width:0">'+
            '<h4 style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(p.name)+'</h4>'+
            '<p style="font-size:11px;color:var(--gray)">'+esc(p.brand||'')+' <span style="color:var(--orange)">['+esc(p.type)+']</span></p>'+
          '</div>'+
          '<div style="text-align:right">'+
            '<div style="font-size:16px;font-weight:800;color:'+((p.stock===0)?'var(--red)':'var(--orange)')+'">'+p.stock+'</div>'+
            '<div style="font-size:10px;color:var(--gray)">stock</div>'+
          '</div>'+
        '</li>';
      }).join('');
    }
  }
}

function renderDashCharts(){
  if(!window._dashData||!window.Chart)return;
  var d=window._dashData;
  
  // Revenue chart
  var revenueCanvas=document.getElementById('revenueChart');
  if(revenueCanvas&&window._revenueChart)window._revenueChart.destroy();
  if(revenueCanvas){
    var months=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    var revenueData=d.monthlyStats?d.monthlyStats.map(function(s){return s.revenue;}):[];
    window._revenueChart=new window.Chart(revenueCanvas,{
      type:'bar',
      data:{
        labels:months,
        datasets:[{
          label:'Ingresos',
          data:revenueData,
          backgroundColor:'rgba(255,107,44,0.7)',
          borderColor:'rgba(255,107,44,1)',
          borderWidth:1,
          borderRadius:6,
        }]
      },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        plugins:{legend:{display:false}},
        scales:{
          y:{beginAtZero:true,ticks:{callback:function(v){return'$'+(v/1000)+'k';}},grid:{color:'rgba(0,0,0,0.05)'}},
          x:{grid:{display:false}}
        }
      }
    });
  }
  
  // Status chart
  var statusCanvas=document.getElementById('statusChart');
  if(statusCanvas&&window._statusChart)window._statusChart.destroy();
  if(statusCanvas&&d.orderStatuses){
    var statusLabels={'PENDING':'Pendiente','PROCESSING':'En proceso','SHIPPED':'Enviado','DELIVERED':'Entregado','CANCELLED':'Cancelado'};
    var statusColors={'PENDING':'#f59e0b','PROCESSING':'#3b82f6','SHIPPED':'#8b5cf6','DELIVERED':'#22c55e','CANCELLED':'#ef4444'};
    var statusData=d.orderStatuses||[];
    window._statusChart=new window.Chart(statusCanvas,{
      type:'doughnut',
      data:{
        labels:statusData.map(function(s){return statusLabels[s.status]||s.status;}),
        datasets:[{
          data:statusData.map(function(s){return s.count;}),
          backgroundColor:statusData.map(function(s){return statusColors[s.status]||'#94a3b8';}),
          borderWidth:0,
        }]
      },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        plugins:{
          legend:{position:'bottom',labels:{padding:12,usePointStyle:true,pointStyle:'circle',font:{size:11}}}
        }
      }
    });
  }
  
  // Brand chart
  var brandCanvas=document.getElementById('brandChart');
  if(brandCanvas&&window._brandChart)window._brandChart.destroy();
  if(brandCanvas&&d.brandSales){
    var brandColors={'Apple':'#555','Samsung':'#1428a0','Motorola':'#0068ff','Xiaomi':'#ff6900','iPad':'#888','MacBook':'#666'};
    window._brandChart=new window.Chart(brandCanvas,{
      type:'bar',
      data:{
        labels:d.brandSales.map(function(b){return b.brand;}),
        datasets:[{
          label:'Ventas',
          data:d.brandSales.map(function(b){return b.count;}),
          backgroundColor:d.brandSales.map(function(b){return brandColors[b.brand]||'#94a3b8';}),
          borderRadius:6,
        }]
      },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        indexAxis:'y',
        plugins:{legend:{display:false}},
        scales:{
          x:{beginAtZero:true,grid:{color:'rgba(0,0,0,0.05)'}},
          y:{grid:{display:false}}
        }
      }
    });
  }
}

function renderGrid(gid,prods){
  var grid=document.getElementById(gid);
  if(!grid)return;
  var firstRender=!grid.dataset.svRevealed;
  if(firstRender)grid.classList.add('pgrid-reveal');else grid.classList.remove('pgrid-reveal');
  if(!prods.length){
    grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:3rem 1rem">'+
      '<svg width="64" height="64" viewBox="0 0 64 64" fill="none" style="margin-bottom:1rem;opacity:.3"><circle cx="28" cy="28" r="16" stroke="currentColor" stroke-width="2"/><path d="M40 40l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M22 28h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'+
      '<p style="font-family:\'Playfair Display\',serif;font-size:18px;font-weight:700;color:var(--dk);margin-bottom:.5rem">No encontramos resultados</p>'+
      '<p style="font-size:13px;color:var(--gray);margin-bottom:1rem">Intenta con otro termino de busqueda o explora nuestras categorias.</p>'+
      '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:1rem">'+
        '<button class="btn btn-ghost" style="font-size:12px;padding:8px 16px;color:var(--dk);border-color:var(--border)" onclick="navShop(\'iPhone\')">iPhone</button>'+
        '<button class="btn btn-ghost" style="font-size:12px;padding:8px 16px;color:var(--dk);border-color:var(--border)" onclick="navShop(\'Samsung\')">Samsung</button>'+
        '<button class="btn btn-ghost" style="font-size:12px;padding:8px 16px;color:var(--dk);border-color:var(--border)" onclick="nav(\'accesorios\')">Accesorios</button>'+
        '<button class="btn btn-ghost" style="font-size:12px;padding:8px 16px;color:var(--dk);border-color:var(--border)" onclick="navShop(\'ofertas\')">Ofertas</button>'+
      '</div>'+
      '<button class="btn btn-o" style="font-size:13px;padding:10px 24px" onclick="nav(\'shop\')">Ver todo el catalogo</button>'+
      '</div>';
    return;
  }
  var now=new Date();
  grid.innerHTML=prods.map(function(p){
    // --- Common helpers ---
    var isOutOfStock=p.stock===0;
    var isFav=isFavorite(p.id);
    var heartSvg='<svg width="16" height="16" viewBox="0 0 24 24" fill="'+(isFav?'var(--red)':'none')+'" stroke="'+(isFav?'var(--red)':'currentColor')+'" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';

    // Image HTML
    function imgHtml(url,ico,oos){
      if(url)return'<img loading="lazy" src="'+url+'" onerror="this.onerror=null;this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'" style="object-fit:contain;width:100%;height:100%'+(oos?';filter:grayscale(100%) opacity(.6)':'')+'"><span style="font-size:56px;display:none;align-items:center;justify-content:center;width:100%;height:100%">'+(ico||'\u{1F4F1}')+'</span>';
      return'<span style="font-size:56px'+(oos?';filter:grayscale(100%) opacity(.5)':'')+'">'+ico+'</span>';
    }

    // Badge
    function badgeHTML(p,oos){
      if(oos)return'<div class="pcard-badge pcard-badge--gray">Agotado</div>';
      var isPromo=isOfferValid(p);
      if(isPromo)return'<div class="pcard-badge">-'+p.discount+'%</div>';
      return'';
    }

    // Spec pills (condition-focused)
    function condPillsHTML(p){
      var pills=[];
      if(p.condition&&p.condition!=='Nuevo')pills.push('<span class="pcard-spec">Estado: '+esc(p.condition)+'</span>');
      if(p.battery!=null)pills.push('<span class="pcard-spec">Bateria: '+p.battery+'%</span>');
      if(p.ram)pills.push('<span class="pcard-spec">'+esc(p.ram)+'</span>');
      return pills.length?'<div class="pcard-specs">'+pills.join('')+'</div>':'';
    }

    // === ACCESSORY EN GRID MIXTO (búsqueda, favoritos) ===
    // Los accesorios tienen 'category' y NO 'condition'. Misma estructura que
    // la tarjeta de producto (con spacer de cuota) para alturas consistentes.
    if(p.category&&!p.condition){
      var accPromo=isOfferValid(p);
      var accFinal=accPromo?Math.round(p.price*(1-p.discount/100)):p.price;
      var accOos=p.stock===0;
      return '<a href="/detail/'+p.id+'" style="text-decoration:none;color:inherit;display:block"><article class="pcard'+(accOos?' pcard-out-of-stock':'')+'">'+
        '<div class="pcard-img">'+badgeHTML(p,accOos)+'<button class="pcard-fav '+(isFav?'on':'')+'" onclick="event.stopPropagation();event.preventDefault();toggleFavFromCard(\''+p.id+'\')">'+heartSvg+'</button>'+imgHtml(p.imageUrl,p.ico,accOos)+'</div>'+
        '<div class="pcard-body">'+
          '<div class="pcard-brand">'+esc(p.brand||'Accesorio')+'</div>'+
          '<div class="pcard-name">'+esc(p.name)+'</div>'+
          (p.category?'<div class="pcard-subtitle">'+esc(p.category)+'</div>':'')+
          '<div class="pcard-discount-row">'+(accPromo?'<span class="pcard-old">'+fmt(p.price)+'</span><span class="pcard-discount-badge">-'+p.discount+'%</span>':'')+'</div>'+
          '<span class="pcard-price">'+fmt(accFinal)+'</span>'+
          '<span class="pcard-cuota" aria-hidden="true"></span>'+
          (accOos?'<div style="width:100%;background:var(--gray);color:#fff;font-size:13px;font-weight:700;padding:12px 14px;border-radius:10px;text-align:center">Agotado</div>':'<button class="pcard-add" onclick="event.stopPropagation();event.preventDefault();addToCart(\''+p.id+'\',this)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg> Agregar al carrito</button>')+
          (p.stock<=5&&p.stock>0?'<span class="pcard-stock">Solo '+p.stock+' disponibles</span>':'')+
        '</div>'+
      '</article></a>';
    }

    // === GROUP CARD (solo preventa) ===
    // Los grupos de productos normales (mismo modelo, distinto color) NO
    // usan una card especial: caen al render de "SINGLE PRODUCT CARD" más
    // abajo, que ya sabe mostrar "Desde $X" cuando variantCount>1 y agrega
    // al carrito la variante más barata directo, igual que un producto
    // normal. El usuario elige el color real en la página de detalle
    // ("Variantes disponibles"), no en la card del catálogo.
    if(p.isGroup&&p.isPreorder){
      // Grupo de preventa: igual que una card normal, sin badge, mostrando
      // precio real (sin "Desde") y un contador de días hasta disponibilidad.
      var gInfo=preorderCountdown(p);
      var gSubParts=[];
      if(p.color)gSubParts.push(p.color);
      if(p.storage)gSubParts.push(p.storage);
      var gSub=gSubParts.length?gSubParts.join(' / '):(p.sub||'');
      return '<a href="/detail/'+p.id+'" style="text-decoration:none;color:inherit;display:block">'+
        '<article class="pcard pcard-group pcard-preorder">'+
        '<div class="pcard-img">'+
          '<button class="pcard-fav '+(isFav?'on':'')+'" onclick="event.stopPropagation();event.preventDefault();toggleFavFromCard(\''+p.id+'\')">'+heartSvg+'</button>'+
          imgHtml(p.imageUrl,p.ico,false)+
        '</div>'+
        '<div class="pcard-body">'+
          '<div class="pcard-brand">'+esc(preorderBrand(p))+'</div>'+
          '<div class="pcard-name">'+esc(p.name||p.modelGroup||'')+'</div>'+
          (gSub?'<div class="pcard-subtitle">'+esc(gSub)+'</div>':'')+
          preorderSpecsHTML(p)+
          '<div class="pcard-price-row"><span class="pcard-price">'+fmt(p.price)+'</span></div>'+
          '<div class="pcard-cuota"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg> 12x '+fmt(Math.round((p.price||0)/12))+' cuotas fijas</div>'+
          gInfo.html+
          '<button class="pcard-add" data-preorder="1" onclick="event.stopPropagation();event.preventDefault();addToCart(\''+p.id+'\',this,null,true,\''+(p.availableFrom||'')+'\')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg> Agregar al carrito</button>'+
        '</div>'+
      '</article></a>';
    }

    // === PREORDER CARDS ===
    // Un producto isPreorder se muestra en el catálogo con badge de preventa,
    // su fecha de disponibilidad más cercana y botón "Reservar".
function preorderDateLabel(p){
  if(!p.availableFrom)return { label:'Próximamente', days:null };
  var d=new Date(p.availableFrom);
  var now=new Date();
  var days=Math.ceil((d-now)/86400000);
  if(days<=1)return { label:'Pronto', days:0 };
  if(days<60)return { label:'en ~'+days+' días', days:days };
  return { label:'a partir del '+d.toLocaleDateString('es-AR',{day:'numeric',month:'long'}), days:days };
}

function preorderSpecsHTML(p){
  var pills=[];
  if(p.condition&&p.condition!=='Nuevo')pills.push('<span class="pcard-spec">Estado: '+esc(p.condition)+'</span>');
  else pills.push('<span class="pcard-spec">Estado: Nuevo</span>');
  var hasBattery=p.battery!=null&&p.battery>0&&p.battery<=100;
  var hasRange=p.batteryFrom!=null||p.batteryTo!=null;
  if(hasRange)pills.push('<span class="pcard-spec">Batería entre '+((p.batteryFrom)||85)+' y '+((p.batteryTo)||95)+' %</span>');
  else if(hasBattery)pills.push('<span class="pcard-spec">Batería '+p.battery+'%</span>');
  else pills.push('<span class="pcard-spec">Batería entre 85 y 95 %</span>');
  if(p.ram)pills.push('<span class="pcard-spec">'+esc(p.ram)+'</span>');
  return pills.length?'<div class="pcard-specs">'+pills.join('')+'</div>':'';
}

function preorderBrand(p){
  var b=(p.brand||'');
  if(b==='iPhone'||b==='Apple')return 'APPLE';
  return b||'';
}

    if(p.isPreorder){
      var avail=preorderCountdown(p);
      var subParts=[];
      if(p.storage)subParts.push(p.storage);
      if(p.color)subParts.push(p.color);
      var sub=subParts.length?subParts.join(' / '):(p.sub||'');
      return '<a href="/detail/'+p.id+'" style="text-decoration:none;color:inherit;display:block"><article class="pcard pcard-preorder">'+
        '<div class="pcard-img">'+
          '<button class="pcard-fav '+(isFav?'on':'')+'" onclick="event.stopPropagation();event.preventDefault();toggleFavFromCard(\''+p.id+'\')">'+heartSvg+'</button>'+
          imgHtml(p.imageUrl,p.ico,false)+
        '</div>'+
        '<div class="pcard-body">'+
          '<div class="pcard-brand">'+esc(preorderBrand(p))+'</div>'+
          '<div class="pcard-name">'+esc(p.name)+'</div>'+
          (sub?'<div class="pcard-subtitle">'+esc(sub)+'</div>':preorderSpecsHTML(p))+
          '<div class="pcard-discount-row"></div>'+
          '<span class="pcard-price">'+fmt(p.price)+'</span>'+
          '<div class="pcard-cuota"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg> 12x '+fmt(Math.round((p.price||0)/12))+' cuotas fijas</div>'+
          avail.html+
          '<button class="pcard-add" data-preorder="1" onclick="event.stopPropagation();event.preventDefault();addToCart(\''+p.id+'\',this,null,true,\''+(p.availableFrom||'')+'\')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg> Agregar al carrito</button>'+
        '</div>'+
      '</article></a>';
    }

    // === SINGLE PRODUCT CARD ===
    var isPromoActive=isOfferValid(p);
    var basePrice=displayBasePrice(p);
    // Sin "Desde": la card siempre muestra el precio real de la variante que
    // representa al grupo (la más barata), como un producto normal.
    var priceLabel='';
    var finalPrice=isPromoActive?Math.round(basePrice-basePrice*p.discount/100):basePrice;
    var cuota=Math.round(finalPrice/12);
    var badge=badgeHTML(p,isOutOfStock);
    var timerBadge='';
    if(isPromoActive&&p.offerEnd){
      var endD=new Date(p.offerEnd);
      var diff=Math.max(0,Math.floor((endD-new Date())/1000));
      if(diff>0){
        var dd=Math.floor(diff/86400);
        var dh=Math.floor((diff%86400)/3600);
        var label=dd>0?dd+'d '+dh+'h':dh+'h '+(Math.floor((diff%3600)/60))+'m';
        timerBadge='<span class="offer-countdown-pill">🔥 '+label+'</span>';
      }
    }
    // Subtitle: storage / color
    var subtParts=[];
    if(p.storage)subtParts.push(p.storage);
    if(p.color)subtParts.push(p.color);
    var subtitle=subtParts.length?subtParts.join(' / '):(p.sub||'');

    return '<a href="/detail/'+p.id+'" style="text-decoration:none;color:inherit;display:block"><article class="pcard'+(isOutOfStock?' pcard-out-of-stock':'')+'">'+
      '<div class="pcard-img">'+
        badge+
        '<button class="pcard-fav '+(isFav?'on':'')+'" onclick="event.stopPropagation();event.preventDefault();toggleFavFromCard(\''+p.id+'\')">'+heartSvg+'</button>'+
        imgHtml(p.imageUrl,p.ico,isOutOfStock)+
      '</div>'+
      '<div class="pcard-body">'+
        '<div class="pcard-brand">'+esc(p.brand||'')+'</div>'+
        '<div class="pcard-name">'+esc(p.name)+'</div>'+
        (subtitle?'<div class="pcard-subtitle">'+esc(subtitle)+'</div>':'')+
        condPillsHTML(p)+
        (timerBadge?'<div style="margin-bottom:4px">'+timerBadge+'</div>':'')+
        '<div class="pcard-discount-row">'+(isPromoActive?'<span class="pcard-old">'+fmt(basePrice)+'</span><span class="pcard-discount-badge">-'+p.discount+'%</span>':'')+'</div>'+
        '<span class="pcard-price">'+priceLabel+fmt(finalPrice)+'</span>'+
        '<span class="pcard-cuota"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg> 12x '+fmt(cuota)+' sin interes</span>'+
        (isOutOfStock?'<div style="width:100%;background:var(--gray);color:#fff;font-size:13px;font-weight:700;padding:12px 14px;border-radius:10px;text-align:center;margin-top:4px">Agotado</div>':'<button class="pcard-add" onclick="event.stopPropagation();event.preventDefault();addToCart(\''+p.id+'\',this)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg> Agregar al carrito</button>')+
        (p.stock<=5&&p.stock>0?'<span class="pcard-stock">Solo '+p.stock+' disponibles</span>':'')+
      '</div>'+
    '</article></a>';
  }).join('');
  if(window.GPAnim&&window.GPAnim.refresh)window.GPAnim.refresh();
}
function renderHomeRail(){
  var rail=document.getElementById('homeRail');
  if(!rail)return;
  var sorted=PRODUCTS.slice().filter(function(p){return !p.isPreorder;}).sort(function(a,b){
    var stockA=a.stock>0?0:1;
    var stockB=b.stock>0?0:1;
    if(stockA!==stockB)return stockA-stockB;
    return new Date(b.createdAt||0)-new Date(a.createdAt||0);
  });
  // Misma tarjeta que el catálogo (descripción, cuotas, specs) para que
  // "Los más vendidos" luzca igual que "Los más buscados".
  renderGrid('homeRail',sorted.slice(0,8));
}
function renderOfferStrip(){
  var strip=document.getElementById('offerStrip');
  if(!strip)return;
  var offers=PRODUCTS.filter(function(p){
    return !p.isPreorder && isOfferValid(p);
  });
  if(!offers.length){strip.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:3rem;color:rgba(255,255,255,.4);font-size:12px">No hay ofertas activas por ahora</div>';var tb=document.getElementById('offerTimerBanner');if(tb)tb.style.display='none';return;}

  // Show earliest-ending offer countdown
  var earliest=offers.reduce(function(best,p){
    if(!p.offerEnd)return best;
    var d=new Date(p.offerEnd);
    return(!best||d<best)?d:best;
  },null);
  var tb=document.getElementById('offerTimerBanner');
  if(tb&&earliest){
    var diff=Math.max(0,Math.floor((earliest-new Date())/1000));
    if(diff>0){
      var dd=Math.floor(diff/86400);
      var dh=Math.floor((diff%86400)/3600);
      var dm=Math.floor((diff%3600)/60);
      var label=dd>0?dd+'d '+dh+'h '+dm+'m':dh+'h '+dm+'m';
      tb.innerHTML='<span class="offer-countdown">🔥 La oferta termina en '+label+'</span>';
      tb.style.display='';
    }else{tb.style.display='none';}
  }else if(tb)tb.style.display='none';
  renderGrid('offerStrip',offers);
}
function shopFilterMatches(p,f){
  if(!p)return false;
  var fLower=(f||'').toLowerCase();
  if(fLower==='iphone'){
    var brand=(p.brand||'').toLowerCase();
    var type=(p.type||'').toLowerCase();
    if((brand==='apple'||brand==='iphone')&&(type==='celular'||type==='tablet'))return true;
    return (((p.name||'')+' '+(p.modelGroup||'')).toLowerCase().indexOf('iphone')>=0);
  }
  return !!(p.brand&&p.brand.toLowerCase()===fLower);
}
function renderShopGrid(){
  var grid=document.getElementById('shopGrid');
  var count=document.getElementById('shopCount');
  if(!grid)return;
  var prods=PRODUCTS.slice();
  if(!window.shopFilter)window.shopFilter='todos';
  if(window.shopFilter!=='todos'&&window.shopFilter!=='fav'){
    prods=prods.filter(function(p){return shopFilterMatches(p,window.shopFilter);});
  }
  if(window.shopFilter==='fav'){
    prods=prods.filter(function(p){return favorites.indexOf(p.id)!==-1;});
  }
  if(filterState.conditions.length>0){
    prods=prods.filter(function(p){return filterState.conditions.indexOf(p.condition)!==-1;});
  }
  if(filterState.storage.length>0){
    prods=prods.filter(function(p){return filterState.storage.some(function(s){return (p.storage&&p.storage.indexOf(s)!==-1)||(p.sub&&p.sub.indexOf(s)!==-1);});});
  }
  if(filterState.ram.length>0){
    prods=prods.filter(function(p){return p.ram&&filterState.ram.indexOf(p.ram)!==-1;});
  }
  if(filterState.batteryMin>0){
    prods=prods.filter(function(p){return p.battery&&p.battery>=filterState.batteryMin;});
  }
  if(filterState.priceMin){
    prods=prods.filter(function(p){return p.price>=filterState.priceMin;});
  }
  if(filterState.priceMax){
    prods=prods.filter(function(p){return p.price<=filterState.priceMax;});
  }
  if(filterState.hideNoStock){
    prods=prods.filter(function(p){return p.stock>0;});
  }
  // Group by modelGroup
  var groups={};
  var standalone=[];
  prods.forEach(function(p){
    if(p.modelGroup){
      if(!groups[p.modelGroup])groups[p.modelGroup]=[];
      groups[p.modelGroup].push(p);
    }else{
      standalone.push(p);
    }
  });
  var displayList=[];
  Object.keys(groups).forEach(function(key){
    var variants=groups[key];
    if(variants.length<=1){
      displayList.push(variants[0]);
      return;
    }
    variants.sort(function(a,b){return a.price-b.price;});
    var cheapest=variants[0];
    var inStock=variants.some(function(v){return v.stock>0;});
    var newestDate=variants.reduce(function(max,v){
      var d=new Date(v.createdAt||0);
      return d>max?d:max;
    },new Date(0));
    var maxBattery=variants.reduce(function(max,v){return Math.max(max,v.battery||0);},0);
    displayList.push({
      id:cheapest.id,
      isGroup:true,
      modelGroup:key,
      brand:cheapest.brand,
      // Preventa: `key` es el modelGroup (slug interno para agrupar
      // variantes), no un nombre para mostrar. Usar el nombre real del
      // producto más barato del grupo.
      name:cheapest.isPreorder?cheapest.name:key,
      sub:variants.length+' '+(variants.length===1?'variante':'variantes'),
      price:cheapest.price,
      imageUrl:cheapest.imageUrl,
      ico:cheapest.ico,
      stock:inStock?variants.reduce(function(s,v){return s+v.stock;},0):0,
      createdAt:newestDate.toISOString(),
      // La card representa a la variante más barata (mismo precio/imagen que
      // se muestra), así que su oferta también debe ser la de ESA variante
      // puntual, no el mayor descuento entre todos los colores del grupo
      // (eso mostraba el badge de oferta sin el isOffer/offerEnd real que
      // isOfferValid() necesita, y la card nunca aparecía en oferta aunque
      // la variante mostrada sí lo estuviera).
      isOffer:!!cheapest.isOffer,
      discount:cheapest.discount||0,
      offerStart:cheapest.offerStart||null,
      offerEnd:cheapest.offerEnd||null,
      // Preventa: exponer datos del más barato (disponibilidad, color, storage)
      isPreorder:!!cheapest.isPreorder,
      availableFrom:cheapest.isPreorder?cheapest.availableFrom:null,
      color:cheapest.isPreorder?cheapest.color:null,
      storage:cheapest.isPreorder?cheapest.storage:null,
      progroupCount:variants.length,
      progroupMin:cheapest.price,
      battery:maxBattery,
      condition:cheapest.condition,
      variantCount:variants.length,
      isPreorder:!!cheapest.isPreorder,
      progroupCount:variants.length,
      progroupMin:cheapest.price
    });
  });
  displayList=displayList.concat(standalone);
  // Sort display list
  if(currentSort==='asc'){
    displayList.sort(function(a,b){return a.price-b.price;});
  }else if(currentSort==='desc'){
    displayList.sort(function(a,b){return b.price-a.price;});
  }else if(currentSort==='new'){
    displayList.sort(function(a,b){return new Date(b.createdAt||0)-new Date(a.createdAt||0);});
  }else if(currentSort==='disc'){
    displayList.sort(function(a,b){return (b.discount||0)-(a.discount||0);});
  }else if(currentSort==='bat'){
    displayList.sort(function(a,b){return (b.battery||0)-(a.battery||0);});
  }else{
    displayList.sort(function(a,b){
      var stockA=a.stock>0?0:1;
      var stockB=b.stock>0?0:1;
      if(stockA!==stockB)return stockA-stockB;
      return new Date(b.createdAt||0)-new Date(a.createdAt||0);
    });
  }
  if(count)count.textContent=displayList.length+' productos';
  renderGrid('shopGrid',displayList);
  var sg=document.getElementById('shopGrid');if(sg)sg.dataset.svRevealed='1';
}
function renderOfertasGrid(){
  var grid=document.getElementById('ofertasGrid');
  if(!grid)return;
  var offers=PRODUCTS.filter(function(p){return !p.isPreorder && isOfferValid(p);});
  var accOffers=(window.ACCS||[]).filter(function(a){return isOfferValid(a);});
  var allOffers=offers.concat(accOffers);
  renderGrid('ofertasGrid',allOffers);
  var og=document.getElementById('ofertasGrid');if(og)og.dataset.svRevealed='1';
}
function renderRepairGrid(){
  var grid=document.getElementById('repairGrid');
  if(!grid)return;
  grid.innerHTML=REPAIRS.map(function(r){
    return '<div class="repair-card"><div class="rc-ico">'+r.ico+'</div><div class="rc-t">'+r.name+'</div><div class="rc-d">'+r.range+'</div></div>';
  }).join('');
}
function renderAccGrid(){
  var grid=document.getElementById('accGrid');
  if(!grid)return;
  var accs=(window.ACCS||[]).slice();
  if(!window.accFilter)window.accFilter='todos';
  if(!window.accDeviceFilter)window.accDeviceFilter='todos';
  buildAccDeviceFilter();
  if(window.accFilter!=='todos')accs=accs.filter(function(a){return a.category===window.accFilter;});
  if(window.accDeviceFilter!=='todos')accs=accs.filter(function(a){
    if(!a.compatibleModels)return false;
    return a.compatibleModels.split(',').map(function(s){return s.trim();}).indexOf(window.accDeviceFilter)>=0;
  });
  if(currentAccSort==='asc'){
    accs.sort(function(a,b){return a.price-b.price;});
  }else if(currentAccSort==='desc'){
    accs.sort(function(a,b){return b.price-a.price;});
  }else if(currentAccSort==='new'){
    accs.sort(function(a,b){return new Date(b.createdAt||0)-new Date(a.createdAt||0);});
  }else{
    accs.sort(function(a,b){
      var stockA=a.stock>0?0:1;
      var stockB=b.stock>0?0:1;
      if(stockA!==stockB)return stockA-stockB;
      return new Date(b.createdAt||0)-new Date(a.createdAt||0);
    });
  }

  // Group variants by modelGroup
  var grouped=[];
  var seenGroups={};
  accs.forEach(function(a){
    if(a.modelGroup){
      if(seenGroups[a.modelGroup]){
        seenGroups[a.modelGroup].push(a);
      }else{
        seenGroups[a.modelGroup]=[a];
        grouped.push({type:'group',name:a.name,modelGroup:a.modelGroup,variants:seenGroups[a.modelGroup]});
      }
    }else{
      grouped.push({type:'single',acc:a});
    }
  });
  // For each group, set the first variant as the default, compute group stock
  grouped.forEach(function(g){
    if(g.type==='group'){
      var totalStock=g.variants.reduce(function(s,v){return s+v.stock;},0);
      var first=g.variants[0];
      g.id=first.id;g.price=first.price;g.brand=first.brand;g.category=first.category;
      g.imageUrl=first.imageUrl;g.ico=first.ico;g.isOffer=first.isOffer;g.discount=first.discount;
      g.stock=totalStock;g.variantCount=g.variants.length;
    }
  });

  grid.innerHTML=grouped.map(function(g){
    var now=new Date();
    var isPromoActive=g.type==='single'?isOfferValid(g.acc):isOfferValid(g);
    var finalPrice=g.type==='single'?(isPromoActive?Math.round(g.acc.price*(1-g.acc.discount/100)):g.acc.price):(isPromoActive?Math.round(g.price*(1-g.discount/100)):g.price);
    var isOutOfStock=g.type==='single'?g.acc.stock===0:g.stock===0;
    var isFav=g.type==='single'?isFavorite(g.acc.id):isFavorite(g.id);
    var heartSvg='<svg width="16" height="16" viewBox="0 0 24 24" fill="'+(isFav?'var(--red)':'none')+'" stroke="'+(isFav?'var(--red)':'currentColor')+'" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
    var accData=g.type==='single'?g.acc:g;
    var imgHtml=accData.imageUrl?'<img loading="lazy" src="'+accData.imageUrl+'" onerror="this.onerror=null;this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'" style="object-fit:contain;width:100%;height:100%'+(isOutOfStock?';filter:grayscale(100%) opacity(.6)':'')+'"><span style="font-size:56px;display:none;align-items:center;justify-content:center;width:100%;height:100%">'+(accData.ico||'\u{1F4E6}')+'</span>':'<span style="font-size:56px'+(isOutOfStock?';filter:grayscale(100%) opacity(.5)':'')+'">'+(accData.ico||'\u{1F4E6}')+'</span>';
    var badge=isOutOfStock?'<div class="pcard-badge pcard-badge--gray">Agotado</div>':(isPromoActive?'<div class="pcard-badge">-'+accData.discount+'%</div>':'');
    var clickId=g.type==='single'?g.acc.id:g.id;
    var name=g.type==='single'?g.acc.name:g.name;
    var brand=g.type==='single'?(g.acc.brand||'Accesorio'):(g.brand||'Accesorio');
    var category=g.type==='single'?g.acc.category:g.category;
    var stockLine=isOutOfStock?'':(g.stock<=5&&g.stock>0?'<span class="pcard-stock">Solo '+g.stock+' disponibles</span>':'');

    if(g.type==='group'){
      return '<a href="/detail/'+g.id+'" style="text-decoration:none;color:inherit;display:block"><article class="pcard'+(isOutOfStock?' pcard-out-of-stock':'')+'">'+
        '<div class="pcard-img">'+
          badge+
          '<button class="pcard-fav '+(isFav?'on':'')+'" onclick="event.stopPropagation();event.preventDefault();toggleFavFromCard(\''+g.id+'\')">'+heartSvg+'</button>'+
          imgHtml+
          '<div class="pcard-var-badge">'+g.variantCount+' colores</div>'+
        '</div>'+
        '<div class="pcard-body">'+
          '<div class="pcard-brand">'+brand+'</div>'+
          '<div class="pcard-name">'+name+'</div>'+
          (category?'<div class="pcard-subtitle">'+category+'</div>':'')+
          '<div class="pcard-discount-row">'+(isPromoActive?'<span class="pcard-old">'+fmt(accData.price)+'</span><span class="pcard-discount-badge">-'+accData.discount+'%</span>':'')+'</div>'+
          '<span class="pcard-price">'+fmt(finalPrice)+'</span>'+
          '<span class="pcard-cuota" aria-hidden="true"></span>'+
          (isOutOfStock?'<div style="width:100%;background:var(--gray);color:#fff;font-size:13px;font-weight:700;padding:12px 14px;border-radius:10px;text-align:center">Agotado</div>':'<button class="pcard-add" onclick="event.stopPropagation();event.preventDefault();openAccDetail(\''+g.id+'\')">Ver variantes</button>')+
          stockLine+
        '</div>'+
      '</article></a>';
    }

    // Single accessory card
    return '<a href="/detail/'+accData.id+'" style="text-decoration:none;color:inherit;display:block"><article class="pcard'+(isOutOfStock?' pcard-out-of-stock':'')+'">'+
      '<div class="pcard-img">'+
        badge+
        '<button class="pcard-fav '+(isFav?'on':'')+'" onclick="event.stopPropagation();event.preventDefault();toggleFavFromCard(\''+accData.id+'\')">'+heartSvg+'</button>'+
        imgHtml+
      '</div>'+
      '<div class="pcard-body">'+
        '<div class="pcard-brand">'+brand+'</div>'+
        '<div class="pcard-name">'+name+'</div>'+
        (category?'<div class="pcard-subtitle">'+category+'</div>':'')+
        '<div class="pcard-discount-row">'+(isPromoActive?'<span class="pcard-old">'+fmt(accData.price)+'</span><span class="pcard-discount-badge">-'+accData.discount+'%</span>':'')+'</div>'+
        '<span class="pcard-price">'+fmt(finalPrice)+'</span>'+
        '<span class="pcard-cuota" aria-hidden="true"></span>'+
        (isOutOfStock?'<div style="width:100%;background:var(--gray);color:#fff;font-size:13px;font-weight:700;padding:12px 14px;border-radius:10px;text-align:center">Agotado</div>':'<button class="pcard-add" onclick="event.stopPropagation();event.preventDefault();addToCart(\''+accData.id+'\',this)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg> Agregar al carrito</button>')+
        stockLine+
      '</div>'+
    '</article></a>';
  }).join('');
  if(!grid.dataset.svRevealed){grid.classList.add('pgrid-reveal');grid.dataset.svRevealed='1';}else{grid.classList.remove('pgrid-reveal');}
  if(window.GPAnim&&window.GPAnim.refresh)window.GPAnim.refresh();
}
function setDetLoading(on){
  var sk=document.getElementById('detSkeleton');
  if(sk)sk.classList.toggle('hidden',!on);
}
function openAccDetail(id){
  setDetLoading(true);
  if(window.__INITIAL_ACCS_DETAIL__&&window.__INITIAL_ACCS_DETAIL_ID__===id){
    var detailData=window.__INITIAL_ACCS_DETAIL__;
    if(detailData.accessory){
      var cached=getById(window.ACCS,id);
      if(!cached&&window.ACCS)window.ACCS.push(detailData.accessory);
    }
    delete window.__INITIAL_ACCS_DETAIL__;
  }
  detailBackTarget='accesorios';
  currentProd=null;
  currentAcc=window.ACCS?getById(window.ACCS,id):null;if(!currentAcc){
    if(!window._accLoaded){
      showLoadingBar();
      var retryInterval=setInterval(function(){
        currentAcc=window.ACCS?getById(window.ACCS,id):null;
        if(currentAcc){
          clearInterval(retryInterval);
          hideLoadingBar();
          openAccDetail(id);
        }
      },100);
      setTimeout(function(){clearInterval(retryInterval);hideLoadingBar();if(typeof showErrorToast==='function')showErrorToast('No encontrado','No se pudo cargar el accesorio');},8000);
    }
    return;
  }
  var now=new Date();
  var isPromoActive=isOfferValid(currentAcc);
  var finalPrice=isPromoActive?Math.round(currentAcc.price*(1-currentAcc.discount/100)):currentAcc.price;
  var cuota12=Math.round(finalPrice/12);

  var brandEl=document.getElementById('detBrand');if(brandEl)brandEl.textContent=currentAcc.brand||'Accesorio';
  var typeEl=document.getElementById('detType');if(typeEl)typeEl.textContent=currentAcc.category||'';
  var name2El=document.getElementById('detName2');if(name2El)name2El.textContent=currentAcc.name;
  var nameEl=document.getElementById('detName');if(nameEl)nameEl.textContent=currentAcc.name;
  var priceEl=document.getElementById('detPrice');if(priceEl)priceEl.textContent=fmt(finalPrice);
  var totalEl=document.getElementById('detTotal');if(totalEl)totalEl.textContent=fmt(finalPrice);
  var oldEl=document.getElementById('detOld');
  if(isPromoActive&&currentAcc.discount){if(oldEl){oldEl.textContent=fmt(currentAcc.price);oldEl.style.display='inline';}}
  else{if(oldEl)oldEl.style.display='none';}
  var cuotaInfo=document.getElementById('detCuotaInfo');var cuotaText=document.getElementById('detCuotaText');
  if(cuotaText)cuotaText.textContent='12x '+fmt(cuota12)+' sin interes';if(cuotaInfo)cuotaInfo.style.display='inline-block';
  var descEl=document.getElementById('detDesc');
  if(descEl){var descParts=[];if(currentAcc.brand)descParts.push(currentAcc.brand);if(currentAcc.description)descParts.push(currentAcc.description);if(descParts.length){descEl.textContent=descParts.join(' \u2014 ');descEl.style.display='block';}else{descEl.style.display='none';}}

  var accSpecs=[];
  if(currentAcc.compatibleModels)accSpecs.push({key:'phone',label:'Compatible con',val:currentAcc.compatibleModels});
  var sc=currentAcc.stock>5?'var(--green)':currentAcc.stock>0?'var(--orange)':'var(--red)';
  accSpecs.push({key:'stock',label:'Stock',val:currentAcc.stock>0?currentAcc.stock+' disponibles':'Agotado',color:sc});
  renderSpecsGrid(accSpecs);

  renderAccVariants();
  var badgesEl=document.getElementById('detBadges');
  if(badgesEl)badgesEl.innerHTML='<div style="display:flex;align-items:center;gap:6px;background:rgba(45,90,39,.1);padding:8px 12px;border-radius:8px;font-size:11px;font-weight:600;color:var(--green)">\u2713 Garantia incluida</div>';

  var addCartBtn=document.getElementById('detAddCart');var buyNowBtn=document.getElementById('detBuyNow');
  if(addCartBtn){addCartBtn.style.display='';addCartBtn.onclick=function(){addToCartAcc(currentAcc.id,addCartBtn);};}
  if(buyNowBtn){buyNowBtn.style.display='';buyNowBtn.onclick=function(){if(typeof svBtnSuccess==='function')svBtnSuccess(buyNowBtn);addToCartAcc(currentAcc.id);setTimeout(function(){nav('checkout');},400);};}
  syncDetSticky(addCartBtn);

  _accImages=[];
  if(currentAcc.imageUrl)_accImages.push(currentAcc.imageUrl);
  if(currentAcc.images&&currentAcc.images.length)_accImages=_accImages.concat(currentAcc.images);

  var mainImg=document.getElementById('detImgMain');var thumbsContainer=document.getElementById('detThumbnails');
  if(mainImg){
    if(_accImages.length){
      mainImg.innerHTML=detMainImgHTML(_accImages[0],isFavorite(currentAcc.id),_accImages.length,0,true);
    }
    else{mainImg.innerHTML=detFavBtnHtml(isFavorite(currentAcc.id))+'<span style="font-size:80px">'+detIco('stock')+'</span>';}
  }
  if(thumbsContainer){
    if(_accImages.length>1){thumbsContainer.style.display='grid';thumbsContainer.innerHTML=_accImages.map(function(src,i){return '<div class="det-thumb'+(i===0?' act':'')+'" onclick="switchAccMainImg('+i+')"><img loading="lazy" src="'+src+'" alt=""></div>';}).join('');}
    else{thumbsContainer.style.display='none';}
  }
  detWMult=0;detDExtra=0;selCuotas=1;resetDetailSelections();updDetTotal();nav('detail');
  renderRelatedAccs();
  setDetLoading(false);
  var fb=document.getElementById('detFavBtn');
  if(fb){if(isFavorite(currentAcc.id)){fb.innerHTML='\u2665';fb.classList.add('saved');}else{fb.innerHTML='\u2661';fb.classList.remove('saved');}}
}
function switchAccMainImg(idx){
  if(!_accImages||!_accImages[idx])return;
  var mainImg=document.getElementById('detImgMain');var thumbsContainer=document.getElementById('detThumbnails');
  if(mainImg)mainImg.innerHTML=detMainImgHTML(_accImages[idx],isFavorite(currentAcc&&currentAcc.id),_accImages.length,idx,true);
  if(thumbsContainer){var thumbs=thumbsContainer.children;for(var i=0;i<thumbs.length;i++){thumbs[i].classList.toggle('act',i===idx);}}
}

function selectAccVariant(id){
  var v=getById(window.ACCS||[],id);if(!v)return;
  currentAcc=v;
  var isPromoActive=isOfferValid(currentAcc);
  var finalPrice=isPromoActive?Math.round(currentAcc.price*(1-currentAcc.discount/100)):currentAcc.price;
  var nameEl=document.getElementById('detName');if(nameEl)nameEl.textContent=currentAcc.name;
  var priceEl=document.getElementById('detPrice');if(priceEl)priceEl.textContent=fmt(finalPrice);
  var totalEl=document.getElementById('detTotal');if(totalEl)totalEl.textContent=fmt(finalPrice);
  var oldEl=document.getElementById('detOld');
  if(isPromoActive&&currentAcc.discount){if(oldEl){oldEl.textContent=fmt(currentAcc.price);oldEl.style.display='inline';}}
  else{if(oldEl)oldEl.style.display='none';}
  // Update specs (stock is per-variant now)
  var accSpecs=[];
  if(currentAcc.compatibleModels)accSpecs.push({key:'phone',label:'Compatible con',val:currentAcc.compatibleModels});
  var sc=currentAcc.stock>5?'var(--green)':currentAcc.stock>0?'var(--orange)':'var(--red)';
  accSpecs.push({key:'stock',label:'Stock',val:currentAcc.stock>0?currentAcc.stock+' disponibles':'Agotado',color:sc});
  renderSpecsGrid(accSpecs);
  // Update variant chips
  document.querySelectorAll('.acc-color-chip').forEach(function(c){c.classList.remove('act');});
  var activeChip=document.querySelector('.acc-color-chip[onclick*="selectAccVariant(\''+id+'\')"]');
  if(activeChip)activeChip.classList.add('act');
  // Update image
  _accImages=[];
  if(currentAcc.imageUrl)_accImages.push(currentAcc.imageUrl);
  if(currentAcc.images&&currentAcc.images.length)_accImages=_accImages.concat(currentAcc.images);
  var mainImg=document.getElementById('detImgMain');
  if(mainImg&&_accImages.length){
    mainImg.innerHTML=detMainImgHTML(_accImages[0],isFavorite(currentAcc.id),_accImages.length,0,true);
  }
  // Update cart button
  var addCartBtn=document.getElementById('detAddCart');
  if(addCartBtn){addCartBtn.style.display='';addCartBtn.onclick=function(){addToCartAcc(currentAcc.id,addCartBtn);};}
  syncDetSticky(addCartBtn);
  updDetTotal();
  var fb=document.getElementById('detFavBtn');
  if(fb){if(isFavorite(currentAcc.id)){fb.innerHTML='\u2665';fb.classList.add('saved');}else{fb.innerHTML='\u2661';fb.classList.remove('saved');}}
}

function renderAccVariants(){
  var variantsEl=document.getElementById('detVariants');
  var variantsListEl=document.getElementById('detVariantsList');
  if(!variantsEl||!variantsListEl||!currentAcc)return;
  if(currentAcc.modelGroup){
    var modelVariants=(window.ACCS||[]).filter(function(a){return a.modelGroup===currentAcc.modelGroup;});
    if(modelVariants.length>1){
      variantsEl.style.display='block';
      var COLOR_MAP={Negro:'#1a1a1a',Blanco:'#f0f0f0',Rojo:'#e53e3e',Azul:'#3182ce',Verde:'#38a169',Amarillo:'#ecc94b',Naranja:'#ed8936',Rosa:'#ed64a6',Gris:'#a0aec0',Plata:'#cbd5e0',Dorado:'#d69e2e','Púrpura':'#805ad5',Celeste:'#63b3ed',Beige:'#f5e6cc','Marrón':'#8b4513',Turquesa:'#4fd1c5',Coral:'#fc8181',Lavanda:'#b794f4',Oliva:'#68d391','Carbón':'#2d3748','Azul Marino':'#1a365d','Verde Menta':'#81e6d9','Gris Oscuro':'#4a5568',Crema:'#fefcbf'};
      function _cc(c){return COLOR_MAP[c]||c||'#ccc'}
      variantsListEl.innerHTML='<div style="display:flex;flex-wrap:wrap;gap:8px">'+
        modelVariants.map(function(v){
          var isActive=v.id===currentAcc.id;
          var oos=v.stock<=0;
          var c=v.color||'Sin color';
          return '<div class="acc-color-chip'+(isActive?' act':'')+(oos?' oos':'')+'"'+(oos?'':' onclick="selectAccVariant(\''+v.id+'\')"')+' title="'+c+(oos?' (agotado)':' ('+v.stock+' disp.)')+'">'+
            '<span class="acc-color-dot" style="background:'+_cc(v.color||'')+'"></span>'+
            '<span class="acc-color-name">'+c+'</span>'+
            '<span class="acc-color-stock">'+(oos?'0':v.stock)+'</span>'+
          '</div>';
        }).join('')+
      '</div>';
    }else{
      variantsEl.style.display='none';
    }
  }else{
    variantsEl.style.display='none';
  }
}

function openDetail(id, variantId){
  setDetLoading(true);
  window._detailVariants=[];
  window._selectedVariantIdx=-1;
  window._selectedVariant=null;
  window._variantsLoaded=false;
  window._colorCircleState={selectedColor:null,selectedStorage:null};
  // Use server pre-fetched detail data if available
  if(window.__INITIAL_DETAIL__&&window.__INITIAL_DETAIL_ID__===id){
    var detailData=window.__INITIAL_DETAIL__;
    if(detailData.product){
      // Merge product into cache so subsequent lookups work
      var cached=getById(PRODUCTS,id);
      if(!cached&&typeof PRODUCTS!=='undefined')PRODUCTS.push(detailData.product);
    }
    if(detailData.variants&&detailData.variants.length>0){
      window._detailVariants=detailData.variants;
      window._variantsLoaded=true;
    }
    delete window.__INITIAL_DETAIL__;
  }
  var activePage=document.querySelector('.page.act');
  if(activePage){var pid=activePage.id.replace('p-','');if(pid&&pid!=='detail')detailBackTarget=pid;}
  currentProd=typeof PRODUCTS!=='undefined'?getById(PRODUCTS,id):null;
  if(!currentProd&&typeof PREORDER_PRODUCTS!=='undefined')currentProd=getById(PREORDER_PRODUCTS,id);
  if(!currentProd){
    // Product not in cache yet: wait for loadProducts to finish, then retry
    if(typeof PRODUCTS==='undefined'||!window._productsLoaded){
      showLoadingBar();
      var retryInterval=setInterval(function(){
        currentProd=typeof PRODUCTS!=='undefined'?getById(PRODUCTS,id):null;
        if(!currentProd&&typeof PREORDER_PRODUCTS!=='undefined')currentProd=getById(PREORDER_PRODUCTS,id);
        if(currentProd){
          clearInterval(retryInterval);
          hideLoadingBar();
          openDetail(id, variantId);
        }
      },100);
      setTimeout(function(){clearInterval(retryInterval);hideLoadingBar();if(typeof showErrorToast==='function')showErrorToast('No encontrado','No se pudo cargar el producto');},8000);
    }
    return;
  }
  currentAcc=null;
  // PREVENTA: las variantes son los productos del mismo modelGroup con
  // isPreorder=true (color × almacenamiento × precio × disponibilidad).
  if(currentProd.isPreorder){
    window._isPreorderDetail=true;
    var preVariants=[];
    for(var pv=0;pv<PRODUCTS.length;pv++){
      var ppv=PRODUCTS[pv];
      if(ppv.isPreorder&&ppv.id===id){preVariants.push(Object.assign({},ppv,{targetPrice:ppv.price}));continue;}
      if(ppv.isPreorder&&ppv.modelGroup&&currentProd.modelGroup&&ppv.modelGroup===currentProd.modelGroup){
        preVariants.push(Object.assign({},ppv,{targetPrice:ppv.price}));
      }
    }
    window._detailVariants=preVariants;
    window._variantsLoaded=true;
    renderDetailVariants();
    var prePromo=isOfferValid(currentProd);
    var preMin=Infinity;
    for(var pi=0;pi<preVariants.length;pi++){
      if(preVariants[pi].price&&preVariants[pi].price<preMin)preMin=preVariants[pi].price;
    }
    var preBase=preMin<Infinity?preMin:currentProd.price;
    var preFinal=prePromo?Math.round(preBase*(1-currentProd.discount/100)):preBase;
    // No pisar el precio: si ya hay una variante seleccionada, selectDetailVariant
    // mostró el precio real. "Desde" solo si aún no se seleccionó ninguna.
    if(window._selectedVariantIdx<0){
      var preLabel=preVariants.length>1?'Desde ':'';
      var prePriceEl=document.getElementById('detPrice');if(prePriceEl)prePriceEl.textContent=preLabel+fmt(preFinal);
      var preTotalEl=document.getElementById('detTotal');if(preTotalEl)preTotalEl.textContent=fmt(preFinal);
    }
    var preBrandEl=document.getElementById('detBrand');if(preBrandEl)preBrandEl.textContent=(currentProd.brand==='iPhone'||currentProd.brand==='Apple')?'APPLE':(currentProd.brand||'Apple');
    var preTypeEl=document.getElementById('detType');if(preTypeEl)preTypeEl.textContent=cleanPreorderName(currentProd);
    var preName2El=document.getElementById('detName2');if(preName2El)preName2El.textContent=cleanPreorderName(currentProd);
    // Contador regresivo (días, horas, minutos)
    window.updatePreorderCountdown=function(){
      var avDateStr=currentProd.availableFrom;var selV=window._selectedVariant;
      if(selV&&selV.availableFrom)avDateStr=selV.availableFrom;
      if(!avDateStr)return;
      var av=new Date(avDateStr);var now=new Date();var diff=Math.max(0,av-now);
      var days=Math.floor(diff/(1000*60*60*24));var hrs=Math.floor((diff%(1000*60*60*24))/(1000*60*60));var mins=Math.floor((diff%(1000*60*60))/60000);
      var timerEl=document.getElementById('detTimerText');if(timerEl){
        var parts=[];if(days>0)parts.push(days+' día'+(days!==1?'s':''));if(hrs>0||days>0)parts.push(hrs+' h');if(mins>0||hrs>0||days>0)parts.push(mins+' min');
        timerEl.textContent='Disponible en: '+parts.join(' ');
      }
    };
    window.updatePreorderCountdown();
    var offerTimerEl=document.getElementById('detOfferTimer');if(offerTimerEl){offerTimerEl.style.display='block';}
    if(currentProd.availableFrom){var timerInt=setInterval(window.updatePreorderCountdown,60000);if(!window._preorderTimers)window._preorderTimers=[];window._preorderTimers.push(timerInt);}
    // Botones de Reservar
    var preAddEl=document.getElementById('detAddCart');
    if(preAddEl){preAddEl.style.display='';preAddEl.textContent='Reservar preventa';preAddEl.onclick=function(){
      var selV=window._selectedVariant;
      var avail=currentProd.availableFrom;
      if(selV&&selV.availableFrom)avail=selV.availableFrom;
      // Cada color de preventa es un producto propio (selV.id): reservar
      // siempre currentProd.id ignoraba el color elegido y agregaba el
      // producto con el que se abrió el detalle.
      var pid=(selV&&selV.id)||currentProd.id;
      addToCart(pid,this,null,true,avail);
    };}
    var preBuyEl=document.getElementById('detBuyNow');
    if(preBuyEl){preBuyEl.style.display='';preBuyEl.textContent='Reservar ahora';preBuyEl.onclick=function(){
      var selV=window._selectedVariant;
      var avail=currentProd.availableFrom;
      if(selV&&selV.availableFrom)avail=selV.availableFrom;
      var pid=(selV&&selV.id)||currentProd.id;
      addToCart(pid,null,null,true,avail);
      setTimeout(function(){nav('checkout');},400);
    };}
    if(window._selectedVariant&&window._selectedVariant.availableFrom){}
    if(typeof syncDetSticky==='function')syncDetSticky(document.getElementById('detAddCart'));
    // Cerrar otras secciones del detalle que no aplican a preventa
    var preOldEl=document.getElementById('detOld');if(preOldEl)preOldEl.style.display='none';
    var preCuotaEl=document.getElementById('detCuotaInfo');if(preCuotaEl)preCuotaEl.style.display='none';
    // Garantizar que haya una variante seleccionada con su imagen/precio: así no
    // se mezclan imagen del producto base con precio de la variante a la entrada.
    if(window._selectedVariantIdx<0&&preVariants.length>0){
      selectDetailVariant(0);
    }
    if(typeof renderRelatedAccs==='function'){try{renderRelatedAccs();}catch(e){}}
    setDetLoading(false);
    nav('detail');
    return;
  }
  window._isPreorderDetail=false;

  // Mismo modelo, distinto color/storage: variantes = productos hermanos
  // por modelGroup directo (igual que en preventa), SIN pedir inventario
  // individual por IMEI para elegir color. Ese fetch (más abajo, todavía
  // usado para productos sin hermanos por color) traía una lista que muchas
  // veces ni siquiera incluía el color del producto abierto, y terminaba
  // pisando el render con datos de otro color/precio: precio "Desde $X" y
  // una mezcla de nombre/precio de un color con imagen/specs de otro.
  var groupSiblings=[];
  if(currentProd.modelGroup){
    for(var gsi=0;gsi<PRODUCTS.length;gsi++){
      var gsp=PRODUCTS[gsi];
      if(!gsp.isPreorder&&gsp.modelGroup===currentProd.modelGroup)groupSiblings.push(gsp);
    }
  }
  if(groupSiblings.length>1){
    window._detailVariants=groupSiblings.map(function(gp){return Object.assign({},gp,{targetPrice:gp.price});});
    window._variantsLoaded=true;
    renderDetailVariants();
    // Preseleccionar la variante correcta: variantId es un override explícito
    // (ej. venir de un selector de color en otra pantalla); si no vino, hay que
    // preseleccionar el producto que realmente se pidió abrir (id) — antes,
    // sin variantId, siempre caía a la variante 0 del grupo sin importar cuál
    // id/color se abrió, mostrando stock/imagen de otro color.
    var wantedId=variantId||id;
    for(var gvi=0;gvi<window._detailVariants.length;gvi++){
      if(window._detailVariants[gvi].id===wantedId){selectDetailVariant(gvi);break;}
    }
    if(window._selectedVariantIdx<0&&window._detailVariants.length>0)selectDetailVariant(0);
    var gAddCartBtn=document.getElementById('detAddCart');var gBuyNowBtn=document.getElementById('detBuyNow');
    if(gAddCartBtn){gAddCartBtn.style.display='';gAddCartBtn.textContent='Agregar al carrito';gAddCartBtn.onclick=function(){addToCartFromDetail();};}
    if(gBuyNowBtn){gBuyNowBtn.style.display='';gBuyNowBtn.textContent='Comprar ahora';gBuyNowBtn.onclick=function(){buyNow();};}
    if(typeof syncDetSticky==='function')syncDetSticky(gAddCartBtn);
    var gConsultBtn=document.getElementById('detConsultBtn');if(gConsultBtn)gConsultBtn.style.display='flex';
    updDetTotal();
    renderRelatedAccs();
    setDetLoading(false);
    nav('detail');
    return;
  }

  // Sin hermanos por color: se mantiene el flujo existente, que puede
  // buscar unidades individuales por IMEI si el producto las tiene
  // (inventario usado con selección granular por condición/batería).
  // Collect all product IDs sharing the same modelGroup
  var variantProdIds=[id];
  if(currentProd.modelGroup){
    variantProdIds=[];
    for(var gi=0;gi<PRODUCTS.length;gi++){
      if(PRODUCTS[gi].modelGroup===currentProd.modelGroup)
        variantProdIds.push(PRODUCTS[gi].id);
    }
  }
  var cacheKey=currentProd.modelGroup||id;
  if(!window._variantCache)window._variantCache={};
  if(window._variantCache[cacheKey]&&window._variantCache[cacheKey].length>0){
    window._detailVariants=window._variantCache[cacheKey].filter(function(v){return v.status!=='SOLD';});
    window._variantsLoaded=true;
    // renderDetailVariants() ya auto-selecciona una variante coherente (ver
    // fix de selecci\u00f3n por defecto m\u00e1s abajo en esa funci\u00f3n) llamando a
    // selectDetailVariant(), que deja nombre/precio/imagen/specs/badges
    // consistentes entre s\u00ed. Antes, este bloque volv\u00eda a pisar todo eso con
    // datos de currentProd + un precio "Desde", y como selectDetailVariant()
    // no vuelve a reprocesar el mismo \u00edndice (guard anti-loop), la p\u00e1gina
    // quedaba con una mezcla: nombre/precio de un color e imagen/specs de
    // otro. Por eso ahora solo se arma el render gen\u00e9rico si nada qued\u00f3
    // seleccionado (caso sin c\u00edrculos de color reconocidos).
    renderDetailVariants();
    // Deep link a una variante puntual: manda sobre la auto-selecci\u00f3n.
    if(variantId){
      for(var vi=0;vi<window._detailVariants.length;vi++){
        if(window._detailVariants[vi].id===variantId||window._detailVariants[vi].imei===variantId){
          selectDetailVariant(vi);break;
        }
      }
    }
    if(window._selectedVariantIdx<0){
      var isPromoActive=isOfferValid(currentProd);
      var basePrice=currentProd.price;
      if(window._detailVariants.length>0){
        var minTarget=Infinity;
        for(var mi=0;mi<window._detailVariants.length;mi++){
          if(window._detailVariants[mi].targetPrice&&window._detailVariants[mi].targetPrice<minTarget){
            minTarget=window._detailVariants[mi].targetPrice;
          }
        }
        if(minTarget<Infinity)basePrice=minTarget;
      }
      var finalPrice=isPromoActive?Math.round(basePrice*(1-currentProd.discount/100)):basePrice;
      var brandEl=document.getElementById('detBrand');if(brandEl)brandEl.textContent=currentProd.brand||'Apple';
      var typeEl=document.getElementById('detType');if(typeEl)typeEl.textContent=currentProd.type||'iPhone';
      var name2El=document.getElementById('detName2');if(name2El)name2El.textContent=currentProd.name;
      var nameEl=document.getElementById('detName');if(nameEl)nameEl.textContent=currentProd.name;
      var priceEl=document.getElementById('detPrice');if(priceEl)priceEl.textContent=fmt(finalPrice);
      var totalEl=document.getElementById('detTotal');if(totalEl)totalEl.textContent=fmt(finalPrice);
      var oldEl=document.getElementById('detOld');
      if(isPromoActive&&currentProd.discount){
        if(oldEl){oldEl.textContent=fmt(basePrice);oldEl.style.display='inline';}
      }else{if(oldEl)oldEl.style.display='none';}
      renderDetailImages();
      renderDetBadges(currentProd);
      startOfferTimer(currentProd);
      var fb=document.getElementById('detFavBtn');
      if(fb){if(isFavorite(currentProd.id)){fb.innerHTML='\u2665';fb.classList.add('saved');}else{fb.innerHTML='\u2661';fb.classList.remove('saved');}}
      if(window._detailVariants.length>0)selectDetailVariant(0);
    }
    updDetTotal();
    renderRelatedAccs();
    setDetLoading(false);
    nav('detail');
    return;
  }
  // Show loading skeleton immediately
  renderDetailVariants();
  var fetchUrls=variantProdIds.map(function(pid){
    return API_URL+'/api/inventory/public?productId='+pid+'&limit=50';
  });
  Promise.all(fetchUrls.map(function(url){return fetch(url).then(function(r){return r.json();});})).then(function(results){
    if(currentProd.id!==id)return;
    var items=[];
    results.forEach(function(res){
      var data=res.data||res||[];
      items=items.concat(data);
    });
    var seen={};
    items=items.filter(function(v){
      if(seen[v.id])return false;
      seen[v.id]=true;
      return true;
    });
    if(items.length>0)window._variantCache[cacheKey]=items;
    window._detailVariants=items.filter(function(v){return v.status!=='SOLD';});
    window._variantsLoaded=true;
    // Mismo criterio que en el bloque con caché: renderDetailVariants() ya
    // auto-selecciona una variante coherente (nombre+precio+imagen+specs
    // juntos). Solo se arma el precio "Desde" genérico si nada quedó
    // seleccionado, para no pisar esa selección con datos de currentProd.
    renderDetailVariants();
    if(variantId){
      for(var vi=0;vi<window._detailVariants.length;vi++){
        if(window._detailVariants[vi].id===variantId||window._detailVariants[vi].imei===variantId){
          selectDetailVariant(vi);
          break;
        }
      }
    }
    if(window._selectedVariantIdx<0){
      var isPromo=isOfferValid(currentProd);
      var minTarget=Infinity;
      for(var mi=0;mi<window._detailVariants.length;mi++){
        if(window._detailVariants[mi].targetPrice&&window._detailVariants[mi].targetPrice<minTarget){
          minTarget=window._detailVariants[mi].targetPrice;
        }
      }
      if(minTarget<Infinity){
        var finalP=isPromo?Math.round(minTarget*(1-currentProd.discount/100)):minTarget;
        var priceEl=document.getElementById('detPrice');if(priceEl)priceEl.textContent=fmt(finalP);
        var totalEl=document.getElementById('detTotal');if(totalEl)totalEl.textContent=fmt(finalP);
        var oldEl=document.getElementById('detOld');
        if(isPromo&&oldEl){oldEl.textContent=fmt(minTarget);oldEl.style.display='inline';}
        var cuota12=Math.round(finalP/12);
        var cuotaText=document.getElementById('detCuotaText');
        if(cuotaText)cuotaText.textContent='12x '+fmt(cuota12)+' sin interes';
      }
      if(window._detailVariants.length>0)selectDetailVariant(0);
    }
    setDetLoading(false);
  }).catch(function(){
    if(currentProd.id!==id)return;
    window._detailVariants=[];
    window._variantsLoaded=true;
    renderDetailVariants();
    setDetLoading(false);
  });

  var now=new Date();
  var isPromoActive=isOfferValid(currentProd);
  var finalPrice=isPromoActive?Math.round(currentProd.price*(1-currentProd.discount/100)):currentProd.price;
  var cuota12=Math.round(finalPrice/12);

  var brandEl=document.getElementById('detBrand');if(brandEl)brandEl.textContent=currentProd.brand||'Apple';
  var typeEl=document.getElementById('detType');if(typeEl)typeEl.textContent=currentProd.type||'iPhone';
  var name2El=document.getElementById('detName2');if(name2El)name2El.textContent=currentProd.name;
  var nameEl=document.getElementById('detName');if(nameEl)nameEl.textContent=currentProd.name;
  var priceEl=document.getElementById('detPrice');if(priceEl)priceEl.textContent=fmt(finalPrice);
  var totalEl=document.getElementById('detTotal');if(totalEl)totalEl.textContent=fmt(finalPrice);
  var oldEl=document.getElementById('detOld');
  if(isPromoActive&&currentProd.discount){var originalPrice=currentProd.price;if(oldEl){oldEl.textContent=fmt(originalPrice);oldEl.style.display='inline';}}
  else{if(oldEl)oldEl.style.display='none';}
  var cuotaInfo=document.getElementById('detCuotaInfo');var cuotaText=document.getElementById('detCuotaText');
  if(cuotaText)cuotaText.textContent='12x '+fmt(cuota12)+' sin interes';if(cuotaInfo)cuotaInfo.style.display='inline-block';
  var descEl=document.getElementById('detDesc');
  if(descEl){var descText=currentProd.description||currentProd.sub||'';if(descText){descEl.textContent=descText;descEl.style.display='block';}else{descEl.style.display='none';}}

  renderSpecsGrid(buildSpecsForProduct(currentProd));
  renderDetBadges(currentProd);
  startOfferTimer(currentProd);

  var addCartBtn=document.getElementById('detAddCart');var buyNowBtn=document.getElementById('detBuyNow');
  if(currentProd.isPreorder){
    var availStr=currentProd.availableFrom?'Disponible '+new Date(currentProd.availableFrom).toLocaleDateString('es-AR',{month:'long',year:'numeric'}):'Próximamente';
    var timerEl=document.getElementById('detOfferTimer');var textEl=document.getElementById('detTimerText');
    if(timerEl&&textEl&&!isOfferValid(currentProd)){
      textEl.textContent='⏳ '+availStr;
      timerEl.style.display='';
    }
    if(addCartBtn){addCartBtn.style.display='';addCartBtn.textContent='Reservar';addCartBtn.onclick=function(){addToCart(currentProd.id,addCartBtn,null,true,currentProd.availableFrom);};}
    if(buyNowBtn){buyNowBtn.style.display='';buyNowBtn.textContent='Reservar Ahora';buyNowBtn.onclick=function(){addToCart(currentProd.id,null,null,true,currentProd.availableFrom);setTimeout(function(){nav('checkout');},400);};}
    syncDetSticky(addCartBtn);
    var preEl=document.getElementById('detPreorderInfo');
    if(preEl){
      preEl.innerHTML='<div class="det-preorder-title">'+detIco('date')+' Preventa</div>'+
        '<p><strong>Disponible '+availStr+'</strong>. Al reservar no necesitás IMEI: se te asigna uno cuando el equipo ingrese. Te avisamos por email cuando esté por llegar.</p>';
      preEl.style.display='block';
    }
    var variantsEl=document.getElementById('detVariants');
    if(variantsEl)variantsEl.style.display='none';
    var imeiSection=document.querySelector('.det-imei-section');
    if(imeiSection)imeiSection.style.display='none';
  }else{
    if(addCartBtn){addCartBtn.style.display='';addCartBtn.textContent='Agregar al carrito';addCartBtn.onclick=function(){addToCartFromDetail();};}
    if(buyNowBtn){buyNowBtn.style.display='';buyNowBtn.textContent='Comprar ahora';buyNowBtn.onclick=function(){buyNow();};}
    syncDetSticky(addCartBtn);
  }
  var consultBtn=document.getElementById('detConsultBtn');
  if(consultBtn)consultBtn.style.display='flex';

  renderDetailImages();updDetTotal();
  renderDetailVariants();
  var fb=document.getElementById('detFavBtn');
  if(fb){if(isFavorite(currentProd.id)){fb.innerHTML='\u2665';fb.classList.add('saved');}else{fb.innerHTML='\u2661';fb.classList.remove('saved');}}
  nav('detail');
  renderRelatedAccs();
}

function resetDetailSelections(){
  document.querySelectorAll('.cuota-btn').forEach(function(c,i){
    if(i===0){c.style.background='var(--green)';c.style.color='#fff';c.style.border='2px solid var(--green)';}
    else{c.style.background='var(--cream2)';c.style.color='var(--dk)';c.style.border='2px solid var(--border)';}
  });
  document.querySelectorAll('.warranty-btn').forEach(function(c,i){
    c.style.border=i===0?'2px solid var(--green)':'2px solid var(--border)';
  });
  document.querySelectorAll('.delivery-btn').forEach(function(c,i){
    c.style.border=i===0?'2px solid var(--green)':'2px solid var(--border)';
  });
}
function renderDetailImages(){
  var allImages=[];
  if(currentProd&&currentProd.imageUrl)allImages.push(currentProd.imageUrl);
  if(currentProd&&currentProd.images)allImages=allImages.concat(currentProd.images);
  var mainImg=document.getElementById('detImgMain');var thumbsContainer=document.getElementById('detThumbnails');
  if(!mainImg)return;
  var isFav=isFavorite(currentProd.id);
  var total=allImages.length;
  if(total===0){mainImg.innerHTML=detFavBtnHtml(isFav)+'<span style="font-size:80px">'+detIco('phone')+'</span>';if(thumbsContainer)thumbsContainer.style.display='none';return;}
  detailCurrentImageIndex=0;
  mainImg.innerHTML=detMainImgHTML(allImages[0],isFav,total,0,false);
  if(thumbsContainer){
    if(total>1){thumbsContainer.style.display='grid';thumbsContainer.innerHTML=allImages.map(function(url,i){return '<div class="det-thumb'+(i===0?' act':'')+'" onclick="setDetailImage('+i+')"><img loading="lazy" src="'+url+'" alt=""></div>';}).join('');}
    else{thumbsContainer.style.display='none';}
  }
}
function setDetailImage(index){
  var allImages=[];
  if(currentProd&&currentProd.imageUrl)allImages.push(currentProd.imageUrl);
  if(currentProd&&currentProd.images)allImages=allImages.concat(currentProd.images);
  detailCurrentImageIndex=index;
  var mainImg=document.getElementById('detImgMain');var thumbsContainer=document.getElementById('detThumbnails');
  var imgUrl=allImages[index];
  if(mainImg)mainImg.innerHTML=detMainImgHTML(imgUrl,isFavorite(currentProd.id),allImages.length,index,false);
  if(thumbsContainer){var thumbs=thumbsContainer.children;for(var i=0;i<thumbs.length;i++){thumbs[i].classList.toggle('act',i===index);}}
}
function prevDetailImage(){
  var allImages=[];
  if(currentProd&&currentProd.imageUrl)allImages.push(currentProd.imageUrl);
  if(currentProd&&currentProd.images)allImages=allImages.concat(currentProd.images);
  if(allImages.length<=1)return;
  detailCurrentImageIndex=(detailCurrentImageIndex-1+allImages.length)%allImages.length;
  setDetailImage(detailCurrentImageIndex);
}
function nextDetailImage(){
  var allImages=[];
  if(currentProd&&currentProd.imageUrl)allImages.push(currentProd.imageUrl);
  if(currentProd&&currentProd.images)allImages=allImages.concat(currentProd.images);
  if(allImages.length<=1)return;
  detailCurrentImageIndex=(detailCurrentImageIndex+1)%allImages.length;
  setDetailImage(detailCurrentImageIndex);
}
function selectDetailVariant(idx){
  var vars=window._detailVariants||[];
  if(idx<0||idx>=vars.length)return;
  // Guard anti-loop: si ya tenemos esta variante seleccionada, no re-render
  if(idx===window._selectedVariantIdx&&window._selectedVariant&&vars[idx]&&window._selectedVariant.id===vars[idx].id)return;
  window._selectedVariantIdx=idx;
  window._selectedVariant=vars[idx];
  var v=vars[idx];
  
  // Find the specific product for this variant to check its discount
  var variantProd=null;
  if(v.productId){
    for(var pi=0;pi<PRODUCTS.length;pi++){
      if(PRODUCTS[pi].id===v.productId){variantProd=PRODUCTS[pi];break;}
    }
  }
  // Fallback: search by modelGroup + color/storage match
  if(!variantProd&&currentProd.modelGroup){
    for(var gi=0;gi<PRODUCTS.length;gi++){
      var p=PRODUCTS[gi];
      if(p.modelGroup===currentProd.modelGroup){
        var colorMatch=!v.color||p.color===v.color;
        var storageMatch=!v.storage||p.storage===v.storage;
        if(colorMatch&&storageMatch){variantProd=p;break;}
      }
    }
  }
  // Fallback final: el producto actual es el que aparece en el detalle.
  // Sus campos isOffer/discount determinan si hay promo (el inventario IMEI no
  // los tiene), así el descuento se aplica igual aunque el producto no esté
  // cargado en PRODUCTS (ej: apertura directa del detalle via SSR/prefetch).
  if(!variantProd)variantProd=currentProd;
  
  var isPromo=isOfferValid(variantProd);
  var bestDiscount=isPromo?variantProd.discount:0;
  var basePrice=v.targetPrice||currentProd.price;
  var finalPrice=isPromo?Math.round(basePrice*(1-bestDiscount/100)):basePrice;
  
  console.log('[selectDetailVariant] variantProd:',variantProd?variantProd.id:'N/A','v.productId:',v.productId,'isPromo:',isPromo,'discount:',bestDiscount,'basePrice:',basePrice,'finalPrice:',finalPrice);

  // Update price (remove "Desde" when specific variant selected)
  var priceEl=document.getElementById('detPrice');
  if(priceEl)priceEl.textContent=fmt(finalPrice);
  var totalEl=document.getElementById('detTotal');
  if(totalEl)totalEl.textContent=fmt(finalPrice);
  var sbv=document.getElementById('detStickyVal');
  if(sbv)sbv.textContent=fmt(finalPrice);
  var oldEl=document.getElementById('detOld');
  if(isPromo&&oldEl){oldEl.textContent=fmt(basePrice);oldEl.style.display='inline';}
  else if(oldEl)oldEl.style.display='none';
  var cuota12=Math.round(finalPrice/12);
  var cuotaText=document.getElementById('detCuotaText');
  if(cuotaText)cuotaText.textContent=window._isPreorderDetail
    ?('12x '+fmt(cuota12)+' cuotas fijas')
    :('12x '+fmt(cuota12)+' sin interes');

  // Preventa: actualizar contador regresivo cuando cambias variante
  if(window._isPreorderDetail&&window.updatePreorderCountdown){
    window.updatePreorderCountdown();
  }

  // Update name to reflect variant details (solo breadcrumb)
  var suffixParts=[];
  if(v.color)suffixParts.push(v.color);
  if(v.storage)suffixParts.push(v.storage);
  var variantSuffix=suffixParts.length?' ('+suffixParts.join(' / ')+')':'';
  var name2El=document.getElementById('detName2');
  if(name2El)name2El.textContent=(window._isPreorderDetail?cleanPreorderName(currentProd):currentProd.name)+variantSuffix;
  var nameEl=document.getElementById('detName');
  if(nameEl)nameEl.textContent=window._isPreorderDetail?cleanPreorderName(currentProd):currentProd.name;

  // Rebuild specs grid with variant-specific data
  var mergedProd={
    type:v.deviceType||currentProd.type,
    condition:v.cosmeticCondition||currentProd.condition,
    battery:v.batteryHealth,
    batteryFrom:(window._isPreorderDetail||currentProd.isPreorder)&&!v.batteryHealth?(currentProd.batteryFrom||85):undefined,
    batteryTo:(window._isPreorderDetail||currentProd.isPreorder)&&!v.batteryHealth?(currentProd.batteryTo||95):undefined,
    availableFrom:(window._isPreorderDetail||currentProd.isPreorder)?(v.availableFrom||v._availableFrom||currentProd.availableFrom):undefined,
    color:v.color,
    ram:v.ram||currentProd.ram,
    storage:v.storage||currentProd.storage,
    stock:v.stock!==undefined?v.stock:currentProd.stock,
    sub:currentProd.sub,
    processor:currentProd.processor,
    screen:currentProd.screen,
    isOffer:isPromo,
    discount:bestDiscount,
    price:finalPrice,
    availableFrom:v.availableFrom||currentProd.availableFrom,
    isPreorder:!!(window._isPreorderDetail||currentProd.isPreorder)
  };
  renderSpecsGrid(buildSpecsForProduct(mergedProd));

  // Always render badges with promo info
  if(v.cosmeticCondition||v.functionalCondition){
    var condStr=[v.cosmeticCondition,v.functionalCondition].filter(Boolean).join(' - ');
    renderDetBadges(mergedProd,condStr);
  }else{
    renderDetBadges(mergedProd);
  }
  // startOfferTimer usa el mismo elemento (#detOfferTimer/#detTimerText) que
  // el contador de "Disponible en:" de preventa, y lo oculta si el producto
  // no tiene offerEnd (nunca lo tiene una preventa). Sin este guard, cambiar
  // de color/variante pisaba y escondía el contador de preventa.
  if(!window._isPreorderDetail)startOfferTimer(variantProd||currentProd);

  // Show variant-specific image
  if(v.imageUrl){
    var mainImg=document.getElementById('detImgMain');
    var thumbsEl=document.getElementById('detThumbnails');
    if(mainImg){
      mainImg.innerHTML=detMainImgHTML(v.imageUrl,isFavorite(currentProd.id),1,0,false);
    }
    if(window._isPreorderDetail&&thumbsEl){
      thumbsEl.style.display='none';
      thumbsEl.style.display='grid';
      thumbsEl.innerHTML='<div class="det-thumb act" onclick="setDetailImage(0)"><img loading="lazy" src="'+v.imageUrl+'" alt=""></div>';
    }
  }

  // Show condition note
  var descEl=document.getElementById('detDesc');
  if(descEl){
    var note=v.notes||'';
    var condNote='';
    if(v.cosmeticCondition||v.batteryHealth!=null){
      var parts=[];
      if(v.cosmeticCondition)parts.push('Estado: '+v.cosmeticCondition);
      if(v.batteryHealth!=null)parts.push('Batería: '+v.batteryHealth+'%');
      condNote=parts.join(' | ');
    }
    var fullDesc=[escapeHtml(currentProd.description||currentProd.sub||''),escapeHtml(condNote),escapeHtml(note)].filter(Boolean).join('<br>');
    if(fullDesc){descEl.innerHTML=fullDesc;descEl.style.display='block';}else{descEl.style.display='none';}
  }

  // Highlight the selected pill
  renderDetailVariants();
}

function renderDetailVariants(){
  var container=document.getElementById('detVariants');
  var list=document.getElementById('detVariantsList');
  if(!container||!list)return;
  var variants=window._detailVariants||[];
  if(variants.length===0){
    if(!window._variantsLoaded){
      container.style.display='block';
      list.innerHTML='<div style="display:flex;gap:8px;flex-wrap:wrap">'+
        '<div class="skeleton" style="padding:8px 16px;border-radius:10px;min-width:80px;height:36px"></div>'+
        '<div class="skeleton" style="padding:8px 16px;border-radius:10px;min-width:80px;height:36px"></div>'+
        '<div class="skeleton" style="padding:8px 16px;border-radius:10px;min-width:80px;height:36px"></div>'+
        '</div>';
      return;
    }
    container.style.display='none';
    return;
  }
  container.style.display='block';

  // Determine model name for color circle matching
  var modelName='';
  if(currentProd&&currentProd.modelGroup)modelName=currentProd.modelGroup;
  if(!modelName&&currentProd)modelName=currentProd.name;
  var modelColors=window.getModelColors&&window.getModelColors(modelName);
  var hexMap=window.COLOR_HEX||{};

  // Buscar color en COLOR_HEX: mapear inglés→español, case-insensitive,
  // fallback. Compartido por preventas y por el picker genérico (marcas sin
  // colores curados en MODEL_COLORS).
  function findColorHex(colorName){
    if(!window.COLOR_HEX)return'#9ca3af';
    // Mapeo de nombres en inglés a español (preventas). Apple nombra sus
    // acabados de titanio como "<Color> Titanium" (ej: "Natural Titanium",
    // "Black Titanium"): ese es el orden real que llega desde la carga de
    // preventas, no "Titanium <Color>". Se dejan ambos órdenes para no
    // romper datos viejos que puedan estar cargados al revés.
    var colorMapEnEs={'Blue':'Azul','Midnight':'Medianoche','Purple':'Púrpura','Red':'Rojo','Starlight':'Luz Estelar','Yellow':'Amarillo','Black':'Negro','White':'Blanco','Green':'Verde','Pink':'Rosa','Orange':'Naranja Coral','Silver':'Plateado','Gold':'Dorado','Gray':'Gris Espacial','Space Gray':'Gris Espacial','Rose Gold':'Rosa','Deep Purple':'Púrpura Intenso','Graphite':'Grafito','Midnight Black':'Negro','Sierra Blue':'Azul Sierra','Alpine Green':'Verde Alpino','Space Black':'Negro Espacial','Natural Titanium':'Titanio Natural','Blue Titanium':'Titanio Azul','White Titanium':'Titanio Blanco','Black Titanium':'Titanio Negro','Titanium Natural':'Titanio Natural','Titanium Blue':'Titanio Azul','Titanium White':'Titanio Blanco','Titanium Black':'Titanio Negro','Desert Titanium':'Titanio Desierto','Aqua':'Verde Agua','Ultra Violet':'Azul Ultramar'};
    var esp=colorMapEnEs[colorName]||colorName;
    if(window.COLOR_HEX[esp])return window.COLOR_HEX[esp];
    if(window.COLOR_HEX[colorName])return window.COLOR_HEX[colorName];
    var lower=colorName.toLowerCase();var espLower=esp.toLowerCase();
    var keys=Object.keys(window.COLOR_HEX);
    for(var i=0;i<keys.length;i++){
      if(keys[i].toLowerCase()===lower||keys[i].toLowerCase()===espLower)return window.COLOR_HEX[keys[i]];
    }
    return'#9ca3af';
  }

  // Cajas de "Almacenamiento" para el color elegido, deshabilitando las que
  // no existen para ese color. Compartido por los tres modos de picker
  // (preventa, iPhone curado, genérico) — antes estaba triplicado.
  function buildStorageHtml(colorMap,state){
    var storagesForColor=state.selectedColor?colorMap[state.selectedColor]:[];
    if(!storagesForColor||!storagesForColor.length){
      return state.selectedColor?'<div style="margin-top:8px;font-size:12px;color:var(--gray)">Sin variantes disponibles para este color</div>':'';
    }
    if(!state.selectedStorage){
      // Preferir el almacenamiento del producto abierto si es una opción
      // válida para el color seleccionado.
      var preferredStorage=currentProd&&currentProd.storage;
      var hasPreferred=preferredStorage&&storagesForColor.some(function(v){return (v.storage||'—')===preferredStorage;});
      state.selectedStorage=hasPreferred?preferredStorage:(storagesForColor[0].storage||'');
    }
    var allStorages=Array.from(new Set(storagesForColor.map(function(v){return v.storage||'—';})));
    var allColorStorages={};
    Object.keys(colorMap).forEach(function(col){
      allColorStorages[col]=Array.from(new Set(colorMap[col].map(function(v){return v.storage||'—';})));
    });
    var validStorages=allColorStorages[state.selectedColor]||[];
    return '<div style="margin-top:10px"><div style="font-size:11px;font-weight:600;color:var(--gray);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Almacenamiento</div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
      allStorages.map(function(s){
        var isAvailable=validStorages.indexOf(s)>=0;
        var isSelected=s===state.selectedStorage;
        if(isAvailable){
          return '<div onclick="onStorageBoxClick(\''+s.replace(/'/g,"\\'")+'\')" class="variant-chip'+(isSelected?' act':'')+'">'+s+'</div>';
        }
        return '<div class="variant-chip disabled">'+s+'</div>';
      }).join('')+'</div></div>';
  }

  // Selecciona automáticamente la variante que matchea color+storage elegidos.
  function autoSelectByColorStorage(variants,state){
    if(state.selectedColor&&state.selectedStorage){
      var foundIdx=-1;
      for(var vi=0;vi<variants.length;vi++){
        var v=variants[vi];
        if(v.color===state.selectedColor&&(v.storage||'—')===state.selectedStorage){
          foundIdx=vi;break;
        }
      }
      if(foundIdx>=0&&foundIdx!==window._selectedVariantIdx)selectDetailVariant(foundIdx);
      else if(foundIdx<0&&variants.length>0)selectDetailVariant(0);
    }else if(variants.length>0)selectDetailVariant(0);
  }

  // Use color circles for known iPhone models (y para preventas: círculos
  // armados desde los colores de las variantes del grupo).
  if(window._isPreorderDetail){
    if(!window._colorCircleState)window._colorCircleState={selectedColor:null,selectedStorage:null};
    var state=window._colorCircleState;

    // Group variants by color
    var colorMap={};
    variants.forEach(function(v){
      if(!v.color)return;
      if(!colorMap[v.color])colorMap[v.color]=[];
      colorMap[v.color].push(v);
    });

    var circlesHtml=Object.keys(colorMap).map(function(c){
      var hex=findColorHex(c);
      var isSelected=c===state.selectedColor;
      if(!state.selectedColor)state.selectedColor=c;
      return '<div onclick="onColorCircleClick(\''+c.replace(/'/g,"\\'")+'\')" style="width:36px;height:36px;border-radius:50%;background:'+hex+';cursor:pointer;border:3px solid '+(isSelected?'var(--orange)':'transparent')+';flex-shrink:0;transition:all .15s;box-shadow:0 2px 6px rgba(0,0,0,.15);transform:'+(isSelected?'scale(1.1)':'scale(1)')+'" title="'+c+'"></div>';
    }).join('');

    var storageHtml=buildStorageHtml(colorMap,state);
    list.innerHTML='<div><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'+
      circlesHtml+'</div>'+storageHtml+'</div>';
    autoSelectByColorStorage(variants,state);
    return;
  }

  // Use color circles for known iPhone models
  if(modelColors&&modelColors.length&&variants.some(function(v){return v.color;})){
    if(!window._colorCircleState)window._colorCircleState={selectedColor:null,selectedStorage:null};
    var state=window._colorCircleState;

    // Group variants by color
    var colorMap={};
    variants.forEach(function(v){
      if(!v.color)return;
      if(!colorMap[v.color])colorMap[v.color]=[];
      colorMap[v.color].push(v);
    });

    // Preferir el color del producto con el que se abrió el detalle (el que
    // el usuario clickeó) como selección inicial. Sin esto, se elegía "el
    // primer color de modelColors que tenga stock", sin relación con la URL
    // abierta, y el render quedaba mezclado: nombre/precio del producto
    // abierto pero imagen/specs de un color arbitrario distinto.
    if(!state.selectedColor&&currentProd&&currentProd.color&&colorMap[currentProd.color]){
      state.selectedColor=currentProd.color;
    }

    var circlesHtml=modelColors.map(function(c){
      var hex=hexMap[c]||'#ccc';
      var available=!!colorMap[c];
      var isSelected=c===state.selectedColor;
      if(available&&!state.selectedColor)state.selectedColor=c;
      if(!available) {
        return '<div style="width:36px;height:36px;border-radius:50%;background:#e0ddd8;cursor:not-allowed;border:2px dashed var(--border);flex-shrink:0;position:relative;opacity:.45" title="'+c+' (no disponible)">'+
          '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">'+
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray2)" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg></div></div>';
      }
      return '<div onclick="onColorCircleClick(\''+c.replace(/'/g,"\\'")+'\')" style="width:36px;height:36px;border-radius:50%;background:'+hex+';cursor:pointer;border:3px solid '+(isSelected?'var(--orange)':'transparent')+';flex-shrink:0;transition:all .15s;box-shadow:0 2px 6px rgba(0,0,0,.15);transform:'+(isSelected?'scale(1.1)':'scale(1)')+'" title="'+c+'"></div>';
    }).join('');

    var storageHtml=buildStorageHtml(colorMap,state);
    list.innerHTML='<div><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'+
      circlesHtml+'</div>'+storageHtml+'</div>';
    autoSelectByColorStorage(variants,state);
    return;
  }

  // Círculos genéricos (a partir de los colores reales de las variantes, no
  // de una lista curada) para cualquier marca sin entradas en MODEL_COLORS
  // (Samsung, Motorola, Xiaomi, etc.) — misma experiencia que iPhone
  // (círculo de color + cajas de almacenamiento) en vez de los chips de
  // texto de más abajo.
  if(variants.some(function(v){return v.color;})){
    if(!window._colorCircleState)window._colorCircleState={selectedColor:null,selectedStorage:null};
    var state=window._colorCircleState;

    var colorMap={};
    variants.forEach(function(v){
      if(!v.color)return;
      if(!colorMap[v.color])colorMap[v.color]=[];
      colorMap[v.color].push(v);
    });

    if(!state.selectedColor&&currentProd&&currentProd.color&&colorMap[currentProd.color]){
      state.selectedColor=currentProd.color;
    }

    var circlesHtml=Object.keys(colorMap).map(function(c){
      var hex=findColorHex(c);
      var isSelected=c===state.selectedColor;
      if(!state.selectedColor)state.selectedColor=c;
      return '<div onclick="onColorCircleClick(\''+c.replace(/'/g,"\\'")+'\')" style="width:36px;height:36px;border-radius:50%;background:'+hex+';cursor:pointer;border:3px solid '+(isSelected?'var(--orange)':'transparent')+';flex-shrink:0;transition:all .15s;box-shadow:0 2px 6px rgba(0,0,0,.15);transform:'+(isSelected?'scale(1.1)':'scale(1)')+'" title="'+c+'"></div>';
    }).join('');

    var storageHtml=buildStorageHtml(colorMap,state);
    list.innerHTML='<div><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'+
      circlesHtml+'</div>'+storageHtml+'</div>';
    autoSelectByColorStorage(variants,state);
    return;
  }

  // Fallback: chips de texto cuando ninguna variante tiene color cargado
  // (solo difieren en almacenamiento/condición, ej. accesorios).
  list.innerHTML=variants.map(function(v,i){
    var isActive=i===window._selectedVariantIdx;
    var isOos=v.status==='SOLD';
    var parts=[];
    if(v.color)parts.push(v.color);
    if(v.storage)parts.push(v.storage);
    if(v.cosmeticCondition&&!v.color&&!v.storage)parts.push(v.cosmeticCondition);
    var label=parts.join(' \u00B7 ')||'Variante '+(i+1);
    var priceHtml='';
    if(v.targetPrice){
      var variantProd=null;
      if(v.productId){
        for(var pi=0;pi<PRODUCTS.length;pi++){
          if(PRODUCTS[pi].id===v.productId){variantProd=PRODUCTS[pi];break;}
        }
      }
      var isPromo=isOfferValid(variantProd);
      var pillPrice=isPromo?Math.round(v.targetPrice*(1-variantProd.discount/100)):v.targetPrice;
      if(isPromo)priceHtml=' <span class="vc-old">'+fmt(v.targetPrice)+'</span> <span class="vc-price">'+fmt(pillPrice)+'</span>';
      else priceHtml=' <span class="vc-price">'+fmt(v.targetPrice)+'</span>';
    }
    var clickAttr=variants.length>1&&!isOos?'onclick="selectDetailVariant('+i+')"':'';
    return '<button '+clickAttr+' class="variant-chip'+(isActive?' act':'')+(isOos?' disabled':'')+'"'+(isOos?' disabled':'')+'>'+label+priceHtml+'</button>';
  }).join('');
}

function onColorCircleClick(color){
  if(!window._colorCircleState)return;
  window._colorCircleState.selectedColor=color;
  window._colorCircleState.selectedStorage=null;
  renderDetailVariants();
}

function onStorageBoxClick(storage){
  if(!window._colorCircleState)return;
  window._colorCircleState.selectedStorage=storage;
  renderDetailVariants();
}
function selCuota(el,n){
  document.querySelectorAll('.cuota-btn').forEach(function(c){
    c.style.background='var(--cream2)';
    c.style.color='var(--dk)';
    c.style.border='2px solid var(--border)';
  });
  el.style.background='var(--green)';
  el.style.color='#fff';
  el.style.border='2px solid var(--green)';
  selCuotas=n;
  updDetTotal();
}
function selOpt(el,type,val){
  var list=el.parentElement;
  if(type==='w'){
    list.querySelectorAll('.warranty-btn').forEach(function(r){
      r.style.border='2px solid var(--border)';
    });
    el.style.border='2px solid var(--green)';
    detWMult=val;
  }
  if(type==='d'){
    list.querySelectorAll('.delivery-btn').forEach(function(r){
      r.style.border='2px solid var(--border)';
    });
    el.style.border='2px solid var(--green)';
    detDExtra=val;
  }
  updDetTotal();
}
function syncDetSticky(addBtn){
  var sb=document.getElementById('detStickyAdd');
  if(!sb)return;
  sb.textContent=(addBtn&&addBtn.textContent)||'Agregar al carrito';
  sb.onclick=addBtn?addBtn.onclick:null;
}
function updDetTotal(){
  var total=0;
  if(currentProd){
    var base=(window._selectedVariant&&window._selectedVariant.targetPrice)
      ? window._selectedVariant.targetPrice
      : ((typeof displayBasePrice==='function')?displayBasePrice(currentProd):currentProd.price);
    var isPromo=isOfferValid(currentProd);
    total=isPromo?Math.round(base*(1-currentProd.discount/100)):base;
  }else if(currentAcc){
    var isPromo2=isOfferValid(currentAcc);
    total=isPromo2?Math.round(currentAcc.price*(1-currentAcc.discount/100)):currentAcc.price;
  }
  total+=detWMult+detDExtra;
  var totalEl=document.getElementById('detTotal');
  if(totalEl)totalEl.textContent=fmt(total);
  var sbv=document.getElementById('detStickyVal');
  if(sbv)sbv.textContent=fmt(total);
}
function filterShop(f,btn){
  window.shopFilter=f;
  if(btn){
    document.querySelectorAll('#p-shop .fchip').forEach(function(c){c.classList.remove('act');});
    btn.classList.add('act');
  }
  renderShopGrid();
  if(f==='todos'){
    var titleEl=document.getElementById('shopTitle');
    if(titleEl)titleEl.textContent='Catálogo';
    var subEl=document.getElementById('shopSub');
    if(subEl)subEl.textContent='Todos los equipos verificados con garantía incluida';
  }
}
var currentSort='rel';
var filterState={conditions:[],storage:[],ram:[],priceMin:null,priceMax:null,hideNoStock:false,batteryMin:0};
function toggleSortMenu(){
  var menu=document.getElementById('sortMenu');
  menu.style.display=menu.style.display==='none'?'block':'none';
}
function setSort(val,btn){
  currentSort=val;
  var label=document.getElementById('sortLabel');
  if(label)label.textContent=btn.textContent;
  document.querySelectorAll('.sort-opt').forEach(function(o){o.classList.remove('act');});
  btn.classList.add('act');
  document.getElementById('sortMenu').style.display='none';
  renderShopGrid();
}
function toggleFilterPanel(){
  var panel=document.getElementById('filterPanel');
  var overlay=document.getElementById('filterOverlay');
  var isOpen=panel.style.display==='block';
  
  var mainnav=document.getElementsByClassName('mainnav')[0];
  var catnav=document.getElementsByClassName('catnav')[0];
  
  if(isOpen){
    panel.style.animation='slideOut .25s ease forwards';
    overlay.style.display='none';
    if(mainnav)mainnav.style.backdropFilter='';
    if(catnav)catnav.style.backdropFilter='';
    setTimeout(function(){panel.style.display='none';panel.style.animation='';},250);
  }else{
    panel.style.display='block';
    panel.style.animation='slideIn .25s ease forwards';
    overlay.style.display='block';
    if(mainnav)mainnav.style.backdropFilter='blur(8px)';
    if(catnav)catnav.style.backdropFilter='blur(8px)';
  }
}
function applyFilters(){
  var state={conditions:[],storage:[],ram:[],priceMin:null,priceMax:null,hideNoStock:false,batteryMin:0};
  if(document.getElementById('chk-nuevo').checked)state.conditions.push('Nuevo');
  if(document.getElementById('chk-impecable').checked)state.conditions.push('Impecable');
  if(document.getElementById('chk-muybueno').checked)state.conditions.push('Muy bueno');
  if(document.getElementById('chk-bueno').checked)state.conditions.push('Bueno');
  document.querySelectorAll('#filterPanel input[type="checkbox"][value]').forEach(function(cb){
    if(cb.checked&&cb.value.match(/GB|TB/))state.storage.push(cb.value);
  });
  if(document.getElementById('ram-4').checked)state.ram.push('4 GB');
  if(document.getElementById('ram-6').checked)state.ram.push('6 GB');
  if(document.getElementById('ram-8').checked)state.ram.push('8 GB');
  if(document.getElementById('ram-12').checked)state.ram.push('12 GB');
  if(document.getElementById('ram-16').checked)state.ram.push('16 GB');
  var pMin=document.getElementById('priceMin');
  var pMax=document.getElementById('priceMax');
  if(pMin&&pMin.value)state.priceMin=parseInt(pMin.value);
  if(pMax&&pMax.value)state.priceMax=parseInt(pMax.value);
  var hideNoStock=document.getElementById('hideNoStock');
  state.hideNoStock=hideNoStock?hideNoStock.checked:false;
  var batMin=document.getElementById('batteryMin');
  state.batteryMin=batMin?parseInt(batMin.value):0;
  filterState=state;
  var count=state.conditions.length+state.storage.length+state.ram.length+(state.priceMin?1:0)+(state.priceMax?1:0)+(state.hideNoStock?1:0)+(state.batteryMin>0?1:0);
  var badge=document.getElementById('filterCount');
  if(badge){
    badge.textContent=count;
    badge.style.display=count>0?'inline':'none';
  }
  renderShopGrid();
  toggleFilterPanel();
}
function clearFilters(){
  document.getElementById('chk-nuevo').checked=false;
  document.getElementById('chk-impecable').checked=false;
  document.getElementById('chk-muybueno').checked=false;
  document.getElementById('chk-bueno').checked=false;
  document.querySelectorAll('#filterPanel input[type="checkbox"][value]').forEach(function(cb){cb.checked=false;});
  document.getElementById('ram-4').checked=false;
  document.getElementById('ram-6').checked=false;
  document.getElementById('ram-8').checked=false;
  document.getElementById('ram-12').checked=false;
  document.getElementById('ram-16').checked=false;
  document.getElementById('priceMin').value='';
  document.getElementById('priceMax').value='';
  document.getElementById('hideNoStock').checked=false;
  document.getElementById('batteryMin').value=0;
  document.getElementById('batteryMinVal').textContent='0%';
  filterState={conditions:[],storage:[],ram:[],priceMin:null,priceMax:null,hideNoStock:false,batteryMin:0};
  document.getElementById('filterCount').style.display='none';
  renderShopGrid();
}
function filtAcc(f,btn){
  accFilter=f;
  document.querySelectorAll('#p-accesorios .sh-chips .fchip').forEach(function(c){c.classList.remove('act');});
  btn.classList.add('act');
  renderAccGrid();
}
var currentAccSort='rel';
function toggleAccSortMenu(){
  var menu=document.getElementById('sortAccMenu');
  menu.style.display=menu.style.display==='none'?'block':'none';
}
function setAccSort(val,btn){
  currentAccSort=val;
  var label=document.getElementById('sortAccLabel');
  if(label)label.textContent=btn.textContent;
  document.querySelectorAll('#sortAccMenu .sort-opt').forEach(function(o){o.classList.remove('act');});
  btn.classList.add('act');
  document.getElementById('sortAccMenu').style.display='none';
  renderAccGrid();
}

function filtAccDevice(f,btn){
  accDeviceFilter=f;
  document.querySelectorAll('#accDeviceFilter .fchip').forEach(function(c){c.classList.remove('act');});
  if(btn)btn.classList.add('act');
  renderAccGrid();
}

function buildAccDeviceFilter(){
  var row=document.getElementById('accDeviceFilterRow');
  var container=document.getElementById('accDeviceFilter');
  if(!row||!container)return;
  var accs=window.ACCS||[];
  var modelSet={};
  accs.forEach(function(a){
    if(!a.compatibleModels)return;
    a.compatibleModels.split(',').forEach(function(m){
      m=m.trim();if(m)modelSet[m]=true;
    });
  });
  var models=Object.keys(modelSet).sort();
  if(models.length===0){container.style.display='none';return;}
  container.style.display='block';
  var html='<button class="fchip'+(accDeviceFilter==='todos'?' act':'')+'" onclick="filtAccDevice(\'todos\',this)">Todos los modelos</button>';
  models.forEach(function(m){
    html+='<button class="fchip'+(accDeviceFilter===m?' act':'')+'" onclick="filtAccDevice(\''+m.replace(/'/g,"\\'")+'\',this)">'+m+'</button>';
  });
  row.innerHTML=html;
  // Limit chip count and make the row scrollable
  if(models.length>8)row.style.overflowX='auto';
}

function renderRelatedAccs(){
  var container=document.getElementById('detRelated');
  if(!container)return;
  container.style.display='none';
  var related=[];
  var title='';
  var clickFn='';

  window.GPAnim&&window.GPAnim.revealAll&&window.GPAnim.revealAll('.det-gallery,.det-info');

  if(currentProd){
    // Product detail → show compatible accessories
    var modelName=currentProd.name.replace(/iPhone\s*/,'').trim();
    var prodNameLower=currentProd.name.toLowerCase();
    related=(window.ACCS||[]).filter(function(a){
      if(!a.compatibleModels||a.stock<=0)return false;
      var models=a.compatibleModels.split(',').map(function(s){return s.trim().toLowerCase();});
      return models.some(function(m){
        return prodNameLower.indexOf(m)>=0||m.indexOf('iphone '+modelName.toLowerCase())>=0;
      });
    }).slice(0,8);
    title='Accesorios compatibles';
    clickFn='openAccDetail';
  }else if(currentAcc&&currentAcc.compatibleModels){
    // Accessory detail → show compatible products
    var accModels=currentAcc.compatibleModels.split(',').map(function(s){return s.trim();});
    related=(PRODUCTS||[]).filter(function(p){
      if(p.stock<=0)return false;
      var prodName=p.name||'';
      return accModels.some(function(m){return prodName.indexOf(m)>=0;});
    }).slice(0,8);
    title='Compatible con estos dispositivos';
    clickFn='openDetail';
  }

  if(!related.length)return;
  container.style.display='block';
  var linkHref='';
  var linkLabel='';
  if(clickFn==='openAccDetail'){linkHref='/accesorios';linkLabel='Ver todos';}
  else if(clickFn==='openDetail'){linkHref='/productos';linkLabel='Ver todos';}
  container.innerHTML=
    '<div class="det-related-section">'+
      '<div class="det-related-header">'+
        '<div class="det-related-title">'+title+'</div>'+
        (linkHref?'<a class="det-related-link" href="'+linkHref+'" onclick="event.preventDefault();event.stopPropagation();nav(\''+(clickFn==='openAccDetail'?'accesorios':'shop')+'\')">'+linkLabel+'</a>':'')+
      '</div>'+
      '<div class="det-related-scroll">'+
        related.map(function(item){
          var isPromo=isOfferValid(item);
          var base=typeof displayBasePrice==='function'?displayBasePrice(item):item.price;
          var fp=isPromo?Math.round(base*(1-item.discount/100)):base;
          var img=item.imageUrl?'<img src="'+item.imageUrl+'" alt="'+(item.name||'')+'">':detIco('stock');
          var hrefPrefix='/detail/';
          return '<a href="'+hrefPrefix+item.id+'" style="text-decoration:none;color:inherit"><div class="det-related-card">'+
            '<div class="det-related-img">'+img+'</div>'+
            '<div class="det-related-body">'+
              '<div class="det-related-name">'+(item.name||item.brand||'')+'</div>'+
              '<div class="det-related-price">'+fmt(fp)+'</div>'+
            '</div>'+
          '</div></a>';
        }).join('')+
      '</div>'+
    '</div>';
  if(window.GPAnim&&window.GPAnim.revealAll)window.GPAnim.revealAll('.det-related-card');
}

function clearAdvF(){
  document.getElementById('af-st').value='';
  document.getElementById('af-cd').value='';
  document.getElementById('af-p1').value='';
  document.getElementById('af-p2').value='';
  renderShopGrid();
}

// =========== ORDER & QUOTE HISTORY ===========
var statusBadges={PENDING:'cu-item-badge--pending',APPROVED:'cu-item-badge--success',COMPLETED:'cu-item-badge--success',REJECTED:'cu-item-badge--neutral',CANCELLED:'cu-item-badge--neutral',SHIPPED:'cu-item-badge--success',DELIVERED:'cu-item-badge--success',REVIEWING:'cu-item-badge--pending'};
var statusLabels={PENDING:'Pendiente',APPROVED:'Aceptada',COMPLETED:'Completada',REJECTED:'Rechazada',CANCELLED:'Cancelada',SHIPPED:'En camino',DELIVERED:'Entregado',REVIEWING:'En revisión'};
function _cuSkeletonRow(){return'<div class="cu-skeleton-row"><div class="cu-skeleton" style="width:38px;height:38px;border-radius:10px;flex-shrink:0"></div><div style="flex:1;display:flex;flex-direction:column;gap:7px"><div class="cu-skeleton" style="width:55%;height:13px;border-radius:6px"></div><div class="cu-skeleton" style="width:35%;height:10px;border-radius:6px"></div></div></div>';}

function renderOrderHistory(){
  var list=document.getElementById('orderHistory');
  if(!list)return;
  if(!currentUser){list.innerHTML='<div class="cu-empty"><p>Iniciá sesión para ver tu historial</p></div>';return;}
  window.gpFetch('/api/orders?userId='+currentUser.id).then(function(res){
    var ords=res.data||res;
    var countEl=document.getElementById('orderCount');
    if(!ords||ords.length===0){
      list.innerHTML='<div class="cu-empty"><p>Todavía no hiciste ningún pedido</p><a href="/productos" onclick="event.preventDefault();nav(\'shop\')" class="cu-empty-link">Ir a la tienda</a></div>';
      if(countEl)countEl.style.display='none';
    }else{
      if(countEl){countEl.textContent=ords.length;countEl.style.display='inline';}
      list.innerHTML=ords.map(function(o){
        var status=o.status||'PENDING';
        var badgeClass=statusBadges[status]||'cu-item-badge--neutral';
        var label=statusLabels[status]||status;
        return'<div class="cu-item"><div class="cu-item-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg></div><div class="cu-item-body"><div class="cu-item-title">'+esc(o.items[0]?.product?.name||'Producto')+'</div><div class="cu-item-sub">'+esc(o.code)+' · '+new Date(o.createdAt).toLocaleDateString('es-AR')+'</div></div><div style="text-align:right;flex-shrink:0"><div style="font-weight:700;font-size:13px;color:var(--orange)">$'+o.total.toLocaleString('es-AR')+'</div><span class="cu-item-badge '+badgeClass+'">'+label+'</span></div></div>';
      }).join('');
    }
  }).catch(function(){
    list.innerHTML='<div class="cu-error"><p>No pudimos cargar tus pedidos</p><button class="cu-error-btn" onclick="renderOrderHistory()">Reintentar</button></div>';
  });
}

function renderQuotHistory(){
  var list=document.getElementById('clientQuoteList');
  if(!list)return;
  if(!currentUser){list.innerHTML='<div class="cu-empty"><p>Iniciá sesión para ver tus cotizaciones</p></div>';return;}
  cachedFetch(API_URL+'/api/quotes?userId='+currentUser.id,null,15000).then(function(qts){
    var quotes=Array.isArray(qts)?qts:(qts.data||[]);
    var countEl=document.getElementById('quoteCount');
    if(quotes.length===0){
      list.innerHTML='<div class="cu-empty"><p>No tenés cotizaciones activas</p><a href="/sell" onclick="event.preventDefault();nav(\'sell\')" class="cu-empty-link">Solicitar una ahora</a></div>';
      if(countEl)countEl.style.display='none';
    }else{
      if(countEl){countEl.textContent=quotes.length;countEl.style.display='inline';}
      list.innerHTML=quotes.map(function(q){
        var status=q.status||'PENDING';
        var badgeClass=statusBadges[status]||'cu-item-badge--neutral';
        var label=statusLabels[status]||status;
        var date=new Date(q.createdAt).toLocaleDateString('es-AR',{day:'numeric',month:'short'});
        return'<div class="cu-item" onclick="openClientQuoteDetail(\''+q.id+'\')" style="cursor:pointer"><div class="cu-item-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div><div class="cu-item-body"><div class="cu-item-title">'+q.device+' '+q.storage+'</div><div class="cu-item-sub">'+q.code+' · '+date+'</div></div><div style="text-align:right;flex-shrink:0"><div style="font-weight:700;font-size:13px;color:var(--orange)">$'+q.finalPrice.toLocaleString('es-AR')+'</div><span class="cu-item-badge '+badgeClass+'">'+label+'</span></div></div>';
      }).join('');
    }
  }).catch(function(){
    list.innerHTML='<div class="cu-error"><p>No pudimos cargar tus cotizaciones</p><button class="cu-error-btn" onclick="renderQuotHistory()">Reintentar</button></div>';
  });
}

function loadClientQuotes(){
  var list=document.getElementById('clientQuoteList');
  if(!list)return;
  if(!currentUser){
    list.innerHTML='<div style="text-align:center;padding:1.5rem 0;color:var(--gray)"><p style="font-size:13px">Inicia sesión para ver tus cotizaciones</p></div>';
    return;
  }
  list.innerHTML='<div style="text-align:center;padding:1.5rem;color:var(--gray)"><div style="display:inline-block;width:24px;height:24px;border:3px solid var(--border);border-top-color:var(--orange);border-radius:50%;animation:spin .6s linear infinite"></div></div>';

  cachedFetch(API_URL+'/api/quotes?userId='+currentUser.id+'&page=1&limit=5',null,15000).then(function(res){
    var quotes=res.data||[];
    if(quotes.length===0){
      list.innerHTML='<div style="text-align:center;padding:1.5rem 0;color:var(--gray)">'+
        '<div style="width:50px;height:50px;background:var(--cream3);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 10px">'+
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gray)" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="M12 13h.01"/></svg></div>'+
        '<p style="font-size:13px;font-weight:500;margin-bottom:8px">No tenes cotizaciones</p>'+
        '<button onclick="nav(\'sell\')" style="color:var(--green);background:none;border:none;font-size:13px;font-weight:700;cursor:pointer">Solicitar una ahora</button></div>';
      return;
    }
    var statusColors={PENDING:'var(--orange)',APPROVED:'var(--green)',REJECTED:'var(--red)',REVIEWING:'#8b5cf6',COMPLETED:'var(--blue)'};
    var statusLabels={PENDING:'Pendiente',APPROVED:'Aceptada',REJECTED:'Rechazada',REVIEWING:'En revisión',COMPLETED:'Completada'};
    var statusIcons={PENDING:'&#9203;',APPROVED:'&#9989;',REJECTED:'&#10060;',REVIEWING:'&#128269;',COMPLETED:'&#128184;'};
    var html=quotes.map(function(q){
      var sc=statusColors[q.status]||'var(--gray)';
      var sl=statusLabels[q.status]||q.status;
      var si=statusIcons[q.status]||'&#128203;';
      var date=new Date(q.createdAt).toLocaleDateString('es-AR',{day:'numeric',month:'short'});
      return '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--cream2);border-radius:10px;border:1px solid var(--border);margin-bottom:6px;cursor:pointer;transition:all .2s" onmouseover="this.style.borderColor=\'var(--orange)\';this.style.background=\'var(--cream3)\'" onmouseout="this.style.borderColor=\'var(--border)\';this.style.background=\'var(--cream2)\'" onclick="openClientQuoteDetail(\''+q.id+'\')">'+
        '<div style="width:36px;height:36px;border-radius:8px;background:'+sc+'18;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">'+si+'</div>'+
        '<div style="flex:1;min-width:0">'+
          '<div style="font-weight:600;font-size:13px;color:var(--dk);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+q.device+' '+q.storage+'</div>'+
          '<div style="font-size:11px;color:var(--gray)">'+date+' · '+q.code+'</div>'+
        '</div>'+
        '<div style="text-align:right;flex-shrink:0">'+
          '<div style="font-weight:700;font-size:13px;color:var(--orange)">$'+q.finalPrice.toLocaleString('es-AR')+'</div>'+
          '<div style="font-size:10px;font-weight:600;color:'+sc+';background:'+sc+'18;padding:2px 8px;border-radius:10px;display:inline-block">'+sl+'</div>'+
        '</div>'+
      '</div>';
    }).join('');
    if(res.total>5){
      html+='<div style="text-align:center;margin-top:8px"><button onclick="nav(\'sell\')" style="color:var(--green);background:none;border:none;font-size:12px;font-weight:600;cursor:pointer">Ver todas →</button></div>';
    }
    list.innerHTML=html;
  }).catch(function(){
    list.innerHTML='<div style="text-align:center;padding:1.5rem;color:var(--gray);font-size:13px">Error cargando cotizaciones</div>';
  });
}

function openClientQuoteDetail(id){
  fetch(API_URL+'/api/quotes?userId='+currentUser.id+'&page=1&limit=100').then(function(r){return r.json();}).then(function(res){
    var q=(res.data||[]).find(function(x){return x.id===id;});
    if(!q)return;
    
    var existing=document.getElementById('clientQuoteDetailModal');
    if(existing)existing.remove();
    
    var statusColors={PENDING:'var(--orange)',APPROVED:'var(--green)',REJECTED:'var(--red)',REVIEWING:'#8b5cf6',COMPLETED:'var(--blue)'};
    var statusLabels={PENDING:'Pendiente',APPROVED:'Aceptada',REJECTED:'Rechazada',REVIEWING:'En revisión',COMPLETED:'Completada'};
    var sc=statusColors[q.status]||'var(--gray)';
    var sl=statusLabels[q.status]||q.status;
    var date=new Date(q.createdAt).toLocaleDateString('es-AR',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});
    
    var extrasLabels={pant:'Pantalla perfecta (+6%)',bat:'Batería 80%+ (+5%)',icloud:'Cuenta libre (+8%)',caja:'Caja original (+3%)',acc:'Accesorios originales (+3%)'};
    var extrasHtml=(q.extras||[]).length>0?(q.extras||[]).map(function(e){return'<span style="font-size:11px;background:var(--cream3);padding:4px 8px;border-radius:6px">'+esc(extrasLabels[e]||e)+'</span>';}).join(''):'<span style="font-size:12px;color:var(--gray)">Ninguno</span>';
    
    var conditionLabels={excellent:'Excelente',good:'Bueno',fair:'Regular',poor:'Defectuoso'};
    
    var modal=document.createElement('div');
    modal.id='clientQuoteDetailModal';
    modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(4px)';
    modal.onclick=function(e){if(e.target===modal)modal.remove();};
    
    var content='<div style="background:var(--cream2);border-radius:16px;max-width:520px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.3)">'+
      '<div style="padding:1.25rem 1.5rem;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;background:var(--cream2);z-index:1;border-radius:16px 16px 0 0">'+
        '<h3 style="font-family:\'Playfair Display\',Georgia,serif;font-size:18px;font-weight:700;color:var(--dk)">Cotización '+esc(q.code)+'</h3>'+
        '<button onclick="document.getElementById(\'clientQuoteDetailModal\').remove()" style="background:none;border:none;cursor:pointer;font-size:20px;color:var(--gray);padding:4px 8px;border-radius:6px" onmouseover="this.style.background=\'var(--cream3)\'" onmouseout="this.style.background=\'none\'">&times;</button>'+
      '</div>'+
      '<div style="padding:1.5rem">'+
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:1.25rem;padding:12px;background:var(--cream3);border-radius:10px">'+
          '<div style="width:40px;height:40px;border-radius:8px;background:'+sc+'18;display:flex;align-items:center;justify-content:center;font-size:20px">'+
            (q.status==='PENDING'?'&#9203;':q.status==='APPROVED'?'&#9989;':q.status==='REJECTED'?'&#10060;':q.status==='REVIEWING'?'&#128269;':'&#128184;')+
          '</div>'+
          '<div><div style="font-weight:700;font-size:14px;color:'+sc+'">'+sl+'</div><div style="font-size:11px;color:var(--gray)">'+date+'</div></div>'+
        '</div>'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:1.25rem">'+
          '<div><div style="font-size:11px;color:var(--gray);margin-bottom:4px">Dispositivo</div><div style="font-weight:600;font-size:13px;color:var(--dk)">'+esc(q.device)+'</div></div>'+
          '<div><div style="font-size:11px;color:var(--gray);margin-bottom:4px">Almacenamiento</div><div style="font-weight:600;font-size:13px;color:var(--dk)">'+esc(q.storage)+'</div></div>'+
          '<div><div style="font-size:11px;color:var(--gray);margin-bottom:4px">Condición</div><div style="font-weight:600;font-size:13px;color:var(--dk)">'+esc(conditionLabels[q.condition]||q.condition)+'</div></div>'+
          '<div><div style="font-size:11px;color:var(--gray);margin-bottom:4px">Precio estimado</div><div style="font-weight:700;font-size:16px;color:var(--orange)">$'+q.finalPrice.toLocaleString('es-AR')+'</div></div>'+
        '</div>'+
        '<div style="margin-bottom:1.25rem"><div style="font-size:11px;color:var(--gray);margin-bottom:6px">Extras seleccionados</div><div style="display:flex;flex-wrap:wrap;gap:6px">'+extrasHtml+'</div></div>'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:1.25rem;padding-top:1rem;border-top:1px solid var(--border)">'+
          '<div><div style="font-size:11px;color:var(--gray);margin-bottom:4px">Envío</div><div style="font-weight:500;font-size:13px;color:var(--dk)">'+(q.envio==='pickup'?'Retiro en tienda':'Correo argentino')+'</div></div>'+
          '<div><div style="font-size:11px;color:var(--gray);margin-bottom:4px">Pago</div><div style="font-weight:500;font-size:13px;color:var(--dk)">'+(q.payment==='transfer'?'Transferencia bancaria':q.payment==='cash'?'Efectivo':'MercadoPago')+'</div></div>'+
        '</div>'+
        '<div style="padding-top:1rem;border-top:1px solid var(--border)">'+
          '<div style="font-size:11px;color:var(--gray);margin-bottom:6px">Datos del cliente</div>'+
          '<div style="font-size:13px;color:var(--dk);line-height:1.8">'+
            '<div><strong>Nombre:</strong> '+esc(q.clientName||'No especificado')+'</div>'+
            '<div><strong>DNI:</strong> '+esc(q.clientDni||'No especificado')+'</div>'+
            '<div><strong>Teléfono:</strong> '+esc(q.clientPhone||'No especificado')+'</div>'+
            (q.clientProvince?'<div><strong>Provincia:</strong> '+esc(q.clientProvince)+(q.clientCp?' (CP: '+esc(q.clientCp)+')':'')+'</div>':'')+
          '</div>'+
        '</div>'+
        (q.rejectReason?'<div style="margin-top:1.25rem;padding:12px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:10px">'+
          '<div style="font-size:11px;color:var(--red);font-weight:600;margin-bottom:4px">Motivo de rechazo</div>'+
          '<div style="font-size:13px;color:var(--dk)">'+esc(q.rejectReason)+'</div>'+
        '</div>':'')+
      '</div>'+
    '</div>';
    
    modal.innerHTML=content;
    document.body.appendChild(modal);
  }).catch(function(){
    alert('Error cargando el detalle de la cotización');
  });
}

// =========== INIT ===========
// La inicializacion de datos (loadProducts llena PRODUCTS/ACCS para Prods,
// Accesorios, Stock, etc.) corre al DOMContentLoaded. En el panel admin legacy
// este script puede cargarse por React de forma dinámica en navegación
// client-side (AdminPageClient), momento en el que DOMContentLoaded ya pasó y
// el listener nunca se dispararía. Con la guarda, si el documento ya está
// listo se ejecuta al instante (equivalente a un refresh, donde sí corre).
var _gpDclListeners=[];
function _gpDcl(fn){
  if(document.readyState==='loading'){_gpDclListeners.push(fn);return;}
  fn();
}
document.addEventListener('DOMContentLoaded',function(){
  var fns=_gpDclListeners;
  _gpDclListeners=[];
  for(var i=0;i<fns.length;i++){try{fns[i]();}catch(e){}}
});
_gpDcl(function(){
  loadProducts();
  loadAccessories();
  renderRepairGrid();
  renderAccGrid();
  initSlider();
  startTimer();
  renderNotebookConfig();
  restoreSession();
});

// Restaurar la sesion del usuario al cargar la pagina. Si gp-session es valida,
// hacemos /api/auth/me para obtener el perfil y guardarlo en localStorage.
// Asi currentUser queda seteado incluso despues de un reload.
function restoreSession(){
  var stored=null;
  try{stored=Storage.get('user');}catch(e){}
  if(stored&&stored.id){
    currentUser=stored;
    updateUserUI();
    if(typeof updateCartBadge==='function')updateCartBadge();
    if(typeof updateChatWidget==='function')updateChatWidget();
  }
  if(typeof window.gpFetch!=='function')return;
  window.gpFetch('/api/auth/me').then(function(data){
    if(data&&data.user){
      currentUser=data.user;
      try{Storage.set('user',currentUser);}catch(e){}
      updateUserUI();
      if(typeof updateCartBadge==='function')updateCartBadge();
      if(typeof updateChatWidget==='function')updateChatWidget();
      // Si estamos en /cuenta, refrescar las secciones ahora que hay sesion
      if(typeof renderOrderHistory==='function')renderOrderHistory();
      if(typeof loadClientQuotes==='function')loadClientQuotes();
      if(typeof cpnRenderCuentaSection==='function')cpnRenderCuentaSection('ACTIVE');
      var amt=document.getElementById('cuBalanceAmount');
      if(amt&&typeof getWallet==='function'){
        getWallet().then(function(w){
          amt.innerHTML='$<span id="cuentaSaldo" style="font-family:\'Playfair Display\',Georgia,serif;font-size:52px;font-weight:700;letter-spacing:-2px">'+(w.balance||0).toLocaleString('es-AR')+'</span>';
        }).catch(function(){});
      }
      if(typeof renderRedeemSection==='function')renderRedeemSection('walletRedeemSection');
    }
  }).catch(function(e) {
    // Sesión inexistente o expirada → estado invitado sin redirigir a login.
    if (e && e.status === 401) {
      try { Storage.remove('user'); } catch (e2) {}
      if (window.currentUser) {
        currentUser = null;
        if (typeof updateUserUI === 'function') updateUserUI();
      }
    }
  });
}

// =========== SLIDER ===========
function initSlider(){
  var nav=document.getElementById('sliderNav');
  if(!nav)return;
  nav.innerHTML='';
  for(var i=0;i<4;i++){
    var d=document.createElement('button');
    d.className='sdot'+(i===0?' act':'');
    d.setAttribute('data-i',i);
    d.setAttribute('aria-label','Ir al slide '+(i+1));
    d.onclick=(function(idx){return function(){goSlide(idx,true);};})(i);
    nav.appendChild(d);
  }
  // Plausear autoplay sobre el slider (accesibilidad)
  var slider=document.getElementById('heroSlider');
  if(slider){
    slider.addEventListener('mouseenter',pauseSliderTimer,{passive:true});
    slider.addEventListener('mouseleave',resumeSliderTimer,{passive:true});
    slider.addEventListener('focusin',pauseSliderTimer,{passive:true});
    slider.addEventListener('focusout',resumeSliderTimer,{passive:true});
  }
  bindSliderSwipe();
  startSliderTimer();
  animateHeroEnter();
}
function goSlide(idx,manual){
  var target=(idx+4)%4;
  var jumping=Math.abs(target-sliderIdx);
  // Al envolver (3→0 o 0→3) el salto sería largo y pasaría por un hueco
  // vacío fuera del track. La resolvemos con un salto instantáneo (sin
  // transición) hacia la posición destino para que nunca se vea un slide
  // fantasma en blanco entre el 4º y el 1º.
  var jumpOverHole=jumping>2;
  var track=document.getElementById('sliderTrack');
  if(track&&jumpOverHole){track.style.transition='none';}
  if(track)track.style.transform='translateX(-'+(target*25)+'%)';
  if(track&&jumpOverHole){
    // Forzar reflow para que el cambio de transform se aplique sin animar
    void track.offsetWidth;
    track.style.transition='';
  }
  document.querySelectorAll('.sdot').forEach(function(d,i){d.className='sdot'+(i===target?' act':'');});
  // Parallax interno: mover la imagen del slide anterior/siguiente levemente
  if(window.GPAnim&&GPAnim.enabled){animateSlideParallax(target);}
  sliderIdx=target;
  // Si el usuario cambió manualmente, reiniciamos el temporizador desde cero
  // (sin acumulación: cancelamos el timeout pendiente y lo re-armamos).
  if(manual)restartSliderTimer();else scheduleSliderNext();
}
function sliderNext(manual){goSlide(sliderIdx+1,manual!==false);}
function sliderPrev(manual){goSlide(sliderIdx-1,manual!==false);}

// ---- Autoplay por slide (setTimeout, no acumulable) ----
var _sliderT=null;
var _sliderPaused=false;
function clearSliderTimer(){if(_sliderT){clearTimeout(_sliderT);_sliderT=null;}}
function scheduleSliderNext(){
  clearSliderTimer();
  if(_sliderPaused)return;
  _sliderT=setTimeout(function(){_sliderT=null;goSlide(sliderIdx+1,false);},4500);
}
function startSliderTimer(){scheduleSliderNext();}
function restartSliderTimer(){scheduleSliderNext();}
function pauseSliderTimer(){_sliderPaused=true;clearSliderTimer();}
function resumeSliderTimer(){_sliderPaused=false;scheduleSliderNext();}

// ---- Swipe táctil ----
function bindSliderSwipe(){
  var slider=document.getElementById('heroSlider');
  if(!slider)return;
  var sx=0,sy=0,active=false;
  slider.addEventListener('pointerdown',function(e){
    sx=e.clientX;sy=e.clientY;active=true;
  },{passive:true});
  slider.addEventListener('pointerup',function(e){
    if(!active)return;
    active=false;
    var dx=e.clientX-sx,dy=e.clientY-sy;
    // Ignorar si fue un click (poco desplazamiento) o un gesto vertical (scroll)
    if(Math.abs(dx)<40||Math.abs(dx)<Math.abs(dy)*1.5)return;
    if(dx<0)sliderNext();else sliderPrev();
  },{passive:true});
}

// ---- Parallax interno entre slides (solo transform, reducido-motion aware) ----
function animateSlideParallax(idx){
  var slides=document.querySelectorAll('#heroSlider .slide');
  if(!slides.length)return;
  try{
    var toSlide=slides[idx];
    var prevSlide=slides[(idx-1+slides.length)%slides.length];
    var nextSlide=slides[(idx+1)%slides.length];
    // El slide entrante "se desliza" levemente su imagen (fondo)
    [prevSlide,toSlide,nextSlide].forEach(function(s){
      var bg=s&&s.children[0]; // el div de imagen de fondo
      if(bg)gsap.to(bg,{x:0,scale:1,transformOrigin:'center',duration:0.8,ease:'power2.out',overwrite:true});
    });
    var bgTo=toSlide&&toSlide.children[0];
    if(bgTo)gsap.fromTo(bgTo,{scale:1.08},{scale:1,duration:1.2,ease:'power2.out',overwrite:true});
  }catch(err){}
}
function animateHeroEnter(){
  if(!window.GPAnim||!GPAnim.enabled)return;
  var slide=document.querySelector('#heroSlider .slide');
  if(!slide)return;
  var kids=slide.querySelectorAll('.slide-tag,.slide-h,.slide-s,.slide-ctas');
  try{
    gsap.fromTo(kids,{opacity:0,y:24},{opacity:1,y:0,duration:0.6,ease:'power2.out',stagger:0.09,delay:0.1,overwrite:true,
      onComplete:function(){gsap.set(kids,{clearProps:'transform,opacity'});}});
  }catch(err){}
}

// =========== FEATURED GRID ===========
function renderFeaturedGrid(){
  var grid=document.getElementById('featuredGrid');
  if(!grid)return;
  var sorted=PRODUCTS.slice().filter(function(p){return !p.isPreorder;}).sort(function(a,b){
    var stockA=a.stock>0?0:1;
    var stockB=b.stock>0?0:1;
    if(stockA!==stockB)return stockA-stockB;
    return new Date(b.createdAt||0)-new Date(a.createdAt||0);
  });
  renderGrid('featuredGrid',sorted.slice(0,4));
}

// =========== TIMER ===========
var _timerInterval=null;
var _detailTimerInterval=null;
function startOfferTimer(p){
  var timerEl=document.getElementById('detOfferTimer');
  var textEl=document.getElementById('detTimerText');
  if(!timerEl||!textEl)return;
  if(_detailTimerInterval){clearInterval(_detailTimerInterval);_detailTimerInterval=null;}
  if(!p||!p.offerEnd){timerEl.style.display='none';return;}
  var end=new Date(p.offerEnd);
  if(end<=new Date()){timerEl.style.display='none';return;}
  function tick(){
    var now=new Date();
    var diff=Math.max(0,Math.floor((end-now)/1000));
    if(diff<=0){timerEl.style.display='none';clearInterval(_detailTimerInterval);_detailTimerInterval=null;return;}
    var d=Math.floor(diff/86400);
    var h=Math.floor((diff%86400)/3600);
    var m=Math.floor((diff%3600)/60);
    var s=diff%60;
    var parts=[];
    if(d>0)parts.push(d+'d');
    parts.push(String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'));
    textEl.textContent='🔥 Oferta termina en '+parts.join(' ');
    timerEl.style.display='';
  }
  tick();
  _detailTimerInterval=setInterval(tick,1000);
}
function combineDateTime(dateId, timeId){
  var d=document.getElementById(dateId);
  var t=document.getElementById(timeId);
  var dateVal=d?d.value:'';
  var timeVal=t?t.value:'';
  if(!dateVal)return null;
  return dateVal+'T'+(timeVal||'23:59');
}
// Lee un input datetime-local y devuelve un ISO string válido (o null si vacío).
// El input type=datetime-local entrega "YYYY-MM-DDTHH:MM" (hora local); lo
// convertimos a ISO (UTC con Z) que el validador Zod z.string().datetime()
// acepta de forma consistente.
function promoDatetimeLocal(id){
  var el=document.getElementById(id);
  if(!el)return null;
  var val=el.value;
  if(!val)return null;
  var d=new Date(val);
  return isNaN(d.getTime())?null:d.toISOString();
}
function toDatetimeLocal(d){
  var tz=new Date(d.getTime()-d.getTimezoneOffset()*60000);
  return tz.toISOString().slice(0,16);
}
function isOfferValid(p){
  if(!p||!p.isOffer||!p.discount||p.discount<=0)return false;
  var now=new Date();
  if(p.offerStart&&new Date(p.offerStart)>now)return false;
  if(p.offerEnd&&new Date(p.offerEnd)<now)return false;
  return true;
}
// Precio base consistente entre card / detalle / carrito: si el producto tiene
// IMEIs disponibles se usa el mínimo targetPrice (minTargetPrice del API).
function displayBasePrice(p){
  return (p&&p.minTargetPrice&&p.minTargetPrice>0)?p.minTargetPrice:p.price;
}
function startTimer(){
  if(_timerInterval)clearInterval(_timerInterval);
  var end=new Date();
  end.setHours(23,59,59,0);
  function tick(){
    var now=new Date();
    var diff=Math.max(0,Math.floor((end-now)/1000));
    var h=Math.floor(diff/3600);
    var m=Math.floor((diff%3600)/60);
    var s=diff%60;
    var el=document.getElementById('timerEl');
    if(el)el.textContent=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
    else{clearInterval(_timerInterval);_timerInterval=null;}
  }
  tick();
  _timerInterval=setInterval(tick,1000);
}

// =========== NOTEBOOK CONFIG ===========
function renderNotebookConfig(){
  var nbBase=document.getElementById('nbBaseOpts');
  if(nbBase){
    nbBase.innerHTML=NB_DATA.bases.map(function(nb,i){
      return '<div class="nb-opt" onclick="selectNbBase(this,'+i+')"><div><div class="nb-opt-name">'+nb.ico+' '+nb.name+'</div><div class="nb-opt-desc">'+nb.desc+'</div></div><div class="nb-opt-price">'+fmt(nb.price)+'</div><div class="nb-opt-chk"></div></div>';
    }).join('');
  }
}
function selectNbBase(el,idx){
  document.querySelectorAll('#nbBaseOpts .nb-opt').forEach(function(o){o.classList.remove('act');});
  el.classList.add('act');
}

// =========== MAYORISTA ===========
function renderMayorista(){
  var el=document.getElementById('mayoristaContent');
  if(el)el.innerHTML='<div style="text-align:center;padding:2rem;color:var(--gray)"><p>Programa mayorista no disponible</p><p style="font-size:11px">Contactanos por WhatsApp para ser mayorista</p></div>';
}

// =========== ADMIN ===========
function adminTab(tab,btn){
  // Update URL hash with proper history state
  if(tab&&tab!==window.currentAdminTab){
    try{window.history.pushState({page:'admin',tab:tab},'','#'+tab);}catch(e){}
  }
  
  // Reset all sidebar nav items
  document.querySelectorAll('.admin-nav-item').forEach(function(b){b.classList.remove('act');});
  // Reset old tab buttons (for backwards compatibility)
  document.querySelectorAll('.atab').forEach(function(c){c.classList.remove('act');});
  document.querySelectorAll('.admin-sec').forEach(function(s){s.classList.remove('act');});
  
  // Activate clicked item
  if(btn)btn.classList.add('act');
  
  // Update topbar title
  var titleEl=document.getElementById('adminPageTitle');
  if(titleEl&&ADMIN_TITLES[tab])titleEl.textContent=ADMIN_TITLES[tab];
  
  // Activate section (for old admin panel)
  var sec=document.getElementById('as-'+tab);
  if(sec)sec.classList.add('act');
  
  // Load chat if needed
  if(tab==='chat'){loadAdminConversations();initChatSocket();initChatSound();}
  
  // Render content
  renderAdminContent(tab);
  
  // Close mobile sidebar on navigation
  closeMobileSidebar();
}

window.addEventListener('hashchange',function(){
  if(!currentUser||currentUser.role!=='ADMIN')return;  var hashTab=location.hash.replace('#','');
  if(hashTab&&['dashboard','prods','acc','stock','promos','orders','arrep','chat','quotes','instore','preventa','sales','users'].indexOf(hashTab)!==-1){
    var btn=document.getElementById('adm-'+hashTab);
    if(btn&&hashTab!==window.currentAdminTab)adminTab(hashTab,btn);
  }
});

function toggleMobileSidebar(){
  var sidebar=document.querySelector('.admin-sidebar');
  var backdrop=document.querySelector('.admin-sidebar-backdrop');
  if(!sidebar)return;
  var isOpen=sidebar.classList.contains('open');
  sidebar.classList.toggle('open');
  if(backdrop)backdrop.classList.toggle('active');
  document.body.style.overflow=isOpen?'':'hidden';
}
function closeMobileSidebar(){
  var sidebar=document.querySelector('.admin-sidebar');
  var backdrop=document.querySelector('.admin-sidebar-backdrop');
  if(!sidebar)return;
  sidebar.classList.remove('open');
  if(backdrop)backdrop.classList.remove('active');
  document.body.style.overflow='';
}
function formatPriceInput(el){
  var val=el.value.replace(/[^0-9]/g,'');
  el.value=val;
}
function updateProductFields(){
  var type=document.getElementById('prodType').value;
  var batteryField=document.getElementById('prodBatteryField');
  var processorField=document.getElementById('prodProcessorField');
  if(type==='laptop'||type==='desktop'){
    if(batteryField)batteryField.style.display='none';
    if(processorField)processorField.style.display='block';
  }else{
    if(batteryField)batteryField.style.display='block';
    if(processorField)processorField.style.display='none';
  }
}
// Marca real elegida en el form de "Editar producto" (resuelve "Otra...").
function getSelectedAdminBrand(){
  var sel=document.getElementById('prodBrand');
  var other=document.getElementById('prodBrandOther');
  return sel&&sel.value==='__other__'?(other?other.value.trim():''):(sel?sel.value:'');
}

// Modelos conocidos para una marca+tipo (mismo criterio que modelsForImeiBrand
// del modal de alta por IMEI): Apple se resuelve a iPhone/iPad/MacBook según
// el tipo; el resto usa SELL_MODELS[marca] si existe.
function modelsForBrandType(brand,type){
  if(!brand)return[];
  if(/^Apple$/i.test(brand)){
    var key=type==='tablet'?'iPad':type==='laptop'?'MacBook':'iPhone';
    return(window.SELL_MODELS&&window.SELL_MODELS[key])||[];
  }
  return(window.SELL_MODELS&&window.SELL_MODELS[brand])||[];
}

var ADMIN_GENERIC_COLORS=['Negro','Blanco','Plateado','Grafito','Dorado','Azul','Rojo','Verde','Amarillo','Rosa','Púrpura'];
// Círculos de color: curados por modelo (getModelColors) si hay, si no la
// paleta genérica — igual que en el modal de alta por IMEI. Reemplaza el
// input de texto libre que antes quedaba para cualquier marca no-Apple.
function refreshAdminColorCircles(modelName,preselectColor){
  var colorField=document.getElementById('prodColor');
  if(!colorField)return;
  var colorContainer=document.getElementById('adminColorContainer');
  if(!colorContainer){
    colorContainer=document.createElement('div');
    colorContainer.id='adminColorContainer';
    colorContainer.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin-top:6px';
    colorField.parentNode.appendChild(colorContainer);
  }
  var curated=(window.getModelColors&&window.getModelColors(modelName))||[];
  var colors=curated.length?curated:ADMIN_GENERIC_COLORS;
  var hexMap=window.COLOR_HEX||{};
  window._adminColorCircleSelected=preselectColor||'';
  colorField.style.display='none';
  colorContainer.style.display='flex';
  colorContainer.innerHTML=colors.map(function(c){
    var hex=hexMap[c]||'#ccc';
    var isSelected=c===preselectColor;
    return '<div onclick="selectAdminColor(\''+c.replace(/'/g,"\\'")+'\',this)" style="width:32px;height:32px;border-radius:50%;background:'+hex+';cursor:pointer;border:3px solid '+(isSelected?'var(--orange)':'transparent')+';transition:all .15s;box-shadow:0 2px 6px rgba(0,0,0,.12);flex-shrink:0" title="'+c+'"></div>'
  }).join('');
}

window.updateAdminBrandFields=function(){
  var brand=getSelectedAdminBrand();
  var type=document.getElementById('prodType')?document.getElementById('prodType').value:'celular';
  var iphoneField=document.getElementById('prodIphoneModelField');
  var sel=document.getElementById('prodIphoneModel');
  var models=modelsForBrandType(brand,type);
  if(sel){
    sel.innerHTML='<option value="">Seleccionar...</option>'+
      models.map(function(m){return'<option value="'+m+'">'+m+'</option>';}).join('');
  }
  if(iphoneField)iphoneField.style.display=models.length?'':'none';
};
// Tamaños de pantalla conocidos por modelo de iPhone, para autocompletar
// "Pantalla" al elegirlo en el dropdown de "Editar producto" (dato que no
// tiene sentido pedirle a otras marcas, que no tienen esta tabla).
var IPHONE_SCREEN_SIZES={
  'iPhone 15':6.1,'iPhone 15 Plus':6.7,'iPhone 15 Pro':6.1,'iPhone 15 Pro Max':6.7,
  'iPhone 14':6.1,'iPhone 14 Plus':6.7,'iPhone 14 Pro':6.1,'iPhone 14 Pro Max':6.7,
  'iPhone 13':6.1,'iPhone 13 mini':5.4,'iPhone 13 Pro':6.1,'iPhone 13 Pro Max':6.7,
  'iPhone SE (3ra gen)':4.7,
  'iPhone 12':6.1,'iPhone 12 mini':5.4,'iPhone 12 Pro':6.1,'iPhone 12 Pro Max':6.7,
};
window.onAdminIphoneModelChange=function(){
  var sel=document.getElementById('prodIphoneModel');
  var model=sel.value;
  if(model){
    document.getElementById('prodName').value=model;
    var base=window.COTIZ_BASE&&window.COTIZ_BASE[model]||0;
    if(base)document.getElementById('prodPrice').value=base;
    var screenEl=document.getElementById('prodScreen');
    if(screenEl)screenEl.value=IPHONE_SCREEN_SIZES[model]||'';
    refreshAdminColorCircles(model,'');
  }
};
window.selectAdminColor=function(color,el){
  window._adminColorCircleSelected=color;
  document.querySelectorAll('#adminColorContainer > div').forEach(function(d){d.style.borderColor='transparent';d.style.transform='scale(1)';});
  el.style.borderColor='var(--orange)';
  el.style.transform='scale(1.1)';
};
function saveProduct(){
  var prodId=document.getElementById('prodId').value;
  var isEdit=!!prodId;
  var originalProduct=isEdit?getById(PRODUCTS,prodId):null;
  function getAdditionalImages(){
    try{
      return JSON.parse(document.getElementById('prodImages').value)||[];
    }catch(e){
      return [];
    }
  }
  var brandSel=document.getElementById('prodBrand');
  var brandOther=document.getElementById('prodBrandOther');
  var storageVal=document.getElementById('prodStorage').value||'';
  var colorVal=window._adminColorCircleSelected||document.getElementById('prodColor').value.trim();
  var descVal=document.getElementById('prodDescription').value.trim();
  // "sub" es el subtítulo que se ve debajo del nombre en las tarjetas del
  // admin/catálogo: preferir "Almacenamiento / Color" (igual que al crear el
  // producto por IMEI) y solo caer a la descripción si el producto no tiene
  // esos datos — antes esto se pisaba siempre con la descripción al editar,
  // borrando el subtítulo de storage/color.
  var subVal=[storageVal,colorVal].filter(Boolean).join(' / ')||descVal.substring(0,60)||null;
  var data={
    name:document.getElementById('prodName').value.trim(),
    brand: brandSel.value==='__other__'?(brandOther?brandOther.value.trim():''):brandSel.value,
    sub:subVal,
    description:descVal||null,
    price:parseInt(document.getElementById('prodPrice').value.replace(/[^0-9]/g,''))||0,
    cost:parseInt(document.getElementById('prodBuyPrice').value.replace(/[^0-9]/g,''))||0,
    stock:parseInt(document.getElementById('prodStock').value)||0,
    condition:document.getElementById('prodCondition').value||'Nuevo',
    type:document.getElementById('prodType').value||'celular',
    color:colorVal,
    screen:parseFloat(document.getElementById('prodScreen').value)||null,
    storage:storageVal||null,
    ram:document.getElementById('prodRam').value||null,
    battery:document.getElementById('prodType').value==='laptop'||document.getElementById('prodType').value==='desktop'?null:(parseInt(document.getElementById('prodBattery').value)||null),
    processor:document.getElementById('prodType').value==='laptop'||document.getElementById('prodType').value==='desktop'?(document.getElementById('prodProcessor').value.trim()||null):null,
    imei:document.getElementById('prodImei').value.trim()||null,
    imageUrl:document.getElementById('prodImageUrl').value.trim()||null,
    images:getAdditionalImages(),
    ico:originalProduct?originalProduct.ico:'\uD83D\uDCF1',
    discount:parseInt(document.getElementById('prodDiscount').value)||0,
    isOffer:document.getElementById('prodIsOffer').checked||false,
    offerStart:combineDateTime('prodOfferStartDate','prodOfferStartTime'),
    offerEnd:combineDateTime('prodOfferEndDate','prodOfferEndTime'),
  };
  if(!data.name||!data.price){
    showAlert('Campos requeridos', 'Nombre y precio son requeridos', 'warning');
    return;
  }
  var method=isEdit?'PUT':'POST';
  var url=isEdit?API_URL+'/api/products/'+prodId:API_URL+'/api/products';
  fetch(url,{
    method:method,
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(data)
  }).then(function(r){
    if(!r.ok)throw new Error('Error '+r.status);
    return r.json();
  }).then(function(result){
    if(result.error||result.success===false){
      var errMsg=result.message||'Error de validación';
      if(result.errors){
        errMsg+='\n'+Object.entries(result.errors).map(function(e){return e[0]+': '+e[1];}).join('\n');
      }
      throw new Error(errMsg);
    }
    // Update PRODUCTS[] directly with the saved result
    if(isEdit){
      for(var i=0;i<PRODUCTS.length;i++){
        if(PRODUCTS[i].id===prodId){PRODUCTS[i]=result;break;}
      }
    }else{
      PRODUCTS.unshift(result);
    }
    nav('admin');
    refreshAdmin();
    showSuccessToast(isEdit?'Producto actualizado':'Producto agregado', 'Los cambios han sido guardados');
  }).catch(function(e){showErrorToast('Error', e.message || 'No se pudo guardar el producto');});
}
function editProduct(id){
  var p=getById(PRODUCTS,id);
  if(!p)return;
  // Update header for editing
  var h1=document.querySelector('#p-admin-product .sh-hdr h1');
  var hp=document.querySelector('#p-admin-product .sh-hdr p');
  if(h1)h1.textContent='Editar Producto';
  if(hp)hp.textContent='Modificá los datos del producto';
  
  document.getElementById('prodId').value=p.id;
  document.getElementById('prodName').value=p.name||'';
  // Dynamically populate brand select with all existing brands
  var brandSel=document.getElementById('prodBrand');
  var brands=getUniqueBrands();
  var currentBrand=p.brand||'';
  var brandOpts='<option value="">Seleccioná marca...</option>'+brands.map(function(b){return'<option value="'+b+'">'+b+'</option>';}).join('')+'<option value="__other__">Otra...</option>';
  brandSel.innerHTML=brandOpts;
  var otherInput=document.getElementById('prodBrandOther');
  if(!otherInput){
    otherInput=document.createElement('input');
    otherInput.className='inp-f';
    otherInput.id='prodBrandOther';
    otherInput.placeholder='Escribí la marca';
    otherInput.style.display='none';
    otherInput.style.marginTop='6px';
    brandSel.parentNode.appendChild(otherInput);
  }
  if(brands.indexOf(currentBrand)!==-1){
    brandSel.value=currentBrand;
    otherInput.style.display='none';
  }else if(currentBrand){
    brandSel.value='__other__';
    otherInput.value=currentBrand;
    otherInput.style.display='block';
  }else{
    brandSel.value='';
    otherInput.style.display='none';
  }
  brandSel.onchange=function(){
    if(brandSel.value==='__other__'){otherInput.style.display='block';otherInput.focus();}
    else{otherInput.style.display='none';}
    // Show/hide iPhone model select
    updateAdminBrandFields();
  };
  // Modelo conocido: dropdown para cualquier marca con lista en SELL_MODELS
  // (Apple resuelve iPhone/iPad/MacBook por tipo, igual que en el modal de
  // alta por IMEI), texto libre en prodName si la marca no tiene lista.
  var iphoneField=document.getElementById('prodIphoneModelField');
  var iphoneSel=document.getElementById('prodIphoneModel');
  var prodModelName=p.modelGroup||p.name||'';
  var models=modelsForBrandType(currentBrand,p.type||'celular');
  if(iphoneSel){
    iphoneSel.innerHTML='<option value="">Seleccionar...</option>'+
      models.map(function(m){return'<option value="'+m+'">'+m+'</option>';}).join('');
    if(models.indexOf(prodModelName)>=0)iphoneSel.value=prodModelName;
  }
  if(iphoneField)iphoneField.style.display=models.length?'':'none';
  document.getElementById('prodBuyPrice').value=p.cost||'';
  document.getElementById('prodDescription').value=p.description||'';
  document.getElementById('prodPrice').value=p.price||'';
  document.getElementById('prodStock').value=p.stock||'';
  document.getElementById('prodCondition').value=p.condition||'Nuevo';
  document.getElementById('prodType').value=p.type||'celular';
  document.getElementById('prodColor').value=p.color||'';
  refreshAdminColorCircles(prodModelName,p.color||'');
  document.getElementById('prodScreen').value=p.screen||'';
  document.getElementById('prodStorage').value=p.storage||'';
  document.getElementById('prodRam').value=p.ram||'';
  document.getElementById('prodBattery').value=p.battery||'';
  document.getElementById('prodProcessor').value=p.processor||'';
  document.getElementById('prodImei').value=p.imei||'';
  updateProductFields();
  
  document.getElementById('prodImageUrl').value=p.imageUrl||'';
  if(p.imageUrl){
    document.getElementById('prodImagePreview').innerHTML='<img loading="lazy" src="'+p.imageUrl+'" style="width:100%;height:100%;object-fit:cover;border-radius:12px">';
  }else{
    document.getElementById('prodImagePreview').innerHTML='📷';
  }
  window.additionalImages=p.images||[];
  document.getElementById('prodImages').value=JSON.stringify(window.additionalImages);
  var container=document.getElementById('prodAdditionalImages');
  if(window.additionalImages.length>0){
    container.innerHTML='';
    window.additionalImages.forEach(function(url,i){
      renderAdditionalImage(url,i);
    });
  }else{
    container.innerHTML='<div id="addImgPlaceholder" style="color:var(--gray);font-size:11px;padding:10px">Arrastra imagenes adicionales aqui</div>';
  }
  var discountEl=document.getElementById('prodDiscount'); if(discountEl){discountEl.value=p.discount||0; discountEl.disabled=!p.isOffer;}
  var isOfferEl=document.getElementById('prodIsOffer'); if(isOfferEl)isOfferEl.checked=!!p.isOffer;
  var startEl=document.getElementById('prodOfferStartDate'); if(startEl)startEl.value=p.offerStart?toDatetimeLocal(new Date(p.offerStart)).split('T')[0]:'';
  var startTime=document.getElementById('prodOfferStartTime'); if(startTime)startTime.value=p.offerStart?toDatetimeLocal(new Date(p.offerStart)).split('T')[1]||'':'';
  var endEl=document.getElementById('prodOfferEndDate'); if(endEl)endEl.value=p.offerEnd?toDatetimeLocal(new Date(p.offerEnd)).split('T')[0]:'';
  var endTime=document.getElementById('prodOfferEndTime'); if(endTime)endTime.value=p.offerEnd?toDatetimeLocal(new Date(p.offerEnd)).split('T')[1]||'':'';
  isEditingProduct=true;
  nav('admin-product');
  // Fetch variants for this product on demand
  var vs=document.getElementById('variantsSection');
  var vl=document.getElementById('variantsList');
  if(vs&&vl){
    vs.style.display='block';
    vl.innerHTML='<div class="loader-spinner" style="padding:10px"><span>Cargando variantes...</span></div>';
    fetch(API_URL+'/api/inventory?productId='+p.id+'&limit=50').then(function(r){return r.json();}).then(function(res){
      var vc=res.data||res||[];
      if(vc.length>0){
        vl.innerHTML=vc.map(function(v){
          var statusColor=v.status==='SOLD'?'var(--red)':v.status==='IN_REPAIR'?'var(--orange)':v.status==='RESERVED'?'var(--blue,#3B82F6)':v.status==='ON_HOLD'?'#A855F7':'var(--green)';
          var statusLabel=v.status==='IN_STOCK'?'En stock':v.status==='SOLD'?'Vendido':v.status==='IN_REPAIR'?'Reparación':v.status==='RESERVED'?'Reservado':v.status==='ON_HOLD'?'Espera':v.status;
          var qrBtn='';
          if(v.qrCode){
            qrBtn='<button onclick="downloadQrCode(\''+v.qrCode+'\',\''+v.code+'\')" title="Descargar QR" style="padding:6px 10px;border:none;border-radius:8px;background:#1A1A2E;color:#fff;cursor:pointer;font-size:10px;font-weight:700;letter-spacing:.5px;display:inline-flex;align-items:center;gap:4px;flex-shrink:0;text-transform:uppercase">⬇ QR</button>';
          }
        }).join('');
      }else{
        vl.innerHTML='<div style="font-size:12px;color:var(--gray);padding:10px;text-align:center">Sin variantes. Agregá IMEIs para este producto.</div>';
      }
    }).catch(function(){
      vl.innerHTML='<div style="font-size:12px;color:var(--red);padding:10px;text-align:center">Error al cargar variantes</div>';
    });
  }
}
function cancelEditProduct(){
  // El toggle SPA nav('admin') depende de window.currentAdminTab, que puede
  // no coincidir con 'prods' según cómo se haya llegado a esta pantalla
  // (mostrando "Sección en desarrollo" en ese caso). Una navegación real
  // a /admin/productos es lo único que garantiza volver siempre ahí.
  window.isEditingProduct=false;
  window.location.href='/admin/productos';
}
window.downloadProductQr=function(productId){
  fetch(API_URL+'/api/inventory?productId='+productId+'&limit=5').then(function(r){return r.json();}).then(function(res){
    var items=res.data||res;
    if(!items||items.length===0){showInfoToast('Sin QR','Este producto no tiene variantes con QR');return;}
    var item=items[0];
    if(item.qrCode){
      showQrDownloadModal(item.qrCode,item.code,item.brand+' '+item.modelName);
    }else{
      showInfoToast('Sin QR','La variante de este producto no tiene código QR generado');
    }
  }).catch(function(){showErrorToast('Error','No se pudo obtener el QR del producto');});
};
window.downloadQrCode=function(qrDataUrl,code){
  var link=document.createElement('a');
  link.href=qrDataUrl;
  link.download='qr-'+code+'.png';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
window.showQrDownloadModal=function(qrDataUrl,code,label){
  var overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);z-index:99999;display:flex;align-items:center;justify-content:center';
  overlay.onclick=function(e){if(e.target===overlay)overlay.remove();};
  overlay.innerHTML='<div style="background:#fff;border-radius:20px;padding:32px;max-width:360px;width:90%;text-align:center;box-shadow:0 24px 80px rgba(0,0,0,.3);position:relative">'+
    '<button onclick="this.parentElement.parentElement.remove()" style="position:absolute;top:12px;right:12px;width:32px;height:32px;border-radius:50%;border:none;background:var(--cream2);cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;color:var(--gray)">✕</button>'+
    '<div style="font-size:14px;font-weight:700;color:#1A1A2E;margin-bottom:4px">QR del dispositivo</div>'+
    '<div style="font-size:12px;color:#888;margin-bottom:20px">'+(label||code)+'</div>'+
    '<div style="background:#F5F0EB;border-radius:16px;padding:20px;display:inline-block;margin-bottom:20px">'+
      '<img src="'+qrDataUrl+'" alt="QR" style="width:200px;height:200px;display:block">'+
    '</div>'+
    '<div style="font-size:11px;color:var(--gray);margin-bottom:16px">Código: <strong style="color:#FF6B2C">'+code+'</strong></div>'+
    '<button onclick="downloadQrCode(\''+qrDataUrl+'\',\''+code+'\')" style="width:100%;padding:14px;background:#1A1A2E;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer">⬇ Descargar QR</button>'+
    '<div style="font-size:10px;color:#ccc;margin-top:12px">Imprimí y pegá en la caja del dispositivo</div>'+
  '</div>';
  document.body.appendChild(overlay);
};
function getUniqueBrands(){
  var brands={};
  // iPhone no es una marca: la marca real es Apple.
  var fallback=['Apple','Samsung','MacBook','iPad','Motorola','Xiaomi','Google','OnePlus','Nokia'];
  fallback.forEach(function(b){brands[b]=true;});
  (PRODUCTS||[]).forEach(function(p){
    if(p.brand&&p.brand!=='iPhone')brands[p.brand]=true;
  });
  if(brands['Apple'])delete brands['iPhone'];
  return Object.keys(brands).sort();
}
function uploadProductImage(input){
  var file=input.files[0];
  if(!file)return;
  validateImageFile(file, function(ok){
    if(!ok)return;
    var preview=document.getElementById('prodImagePreview');
    preview.innerHTML='<span style="font-size:12px">Subiendo...</span>';
    var formData=new FormData();
    formData.append('file',file);
    fetch(API_URL+'/api/upload',{
    method:'POST',
    body:formData
  }).then(function(r){return r.json();}).then(function(data){
    if(data.url){
      document.getElementById('prodImageUrl').value=data.url;
      preview.innerHTML='<img loading="lazy" src="'+data.url+'" style="width:100%;height:100%;object-fit:cover;border-radius:12px">';
    }else{
      preview.innerHTML='📷';
      showErrorToast('Error', 'No se pudo subir la imagen');
    }
  }).catch(function(){
    preview.innerHTML='📷';
    showErrorToast('Error', 'No se pudo subir la imagen');
  });
  });
}
function handleImageDrop(event){
  var file=event.dataTransfer.files[0];
  if(!file||!file.type.startsWith('image/')){
    showWarningToast('Formato inválido', 'Por favor arrastra una imagen');
    return;
  }
  var preview=document.getElementById('prodImagePreview');
  preview.innerHTML='<span style="font-size:12px">Subiendo...</span>';
  var formData=new FormData();
  formData.append('file',file);
  fetch(API_URL+'/api/upload',{
    method:'POST',
    body:formData
  }).then(function(r){return r.json();}).then(function(data){
    if(data.url){
      document.getElementById('prodImageUrl').value=data.url;
      preview.innerHTML='<img loading="lazy" src="'+data.url+'" style="width:100%;height:100%;object-fit:cover;border-radius:12px">';
    }else{
      preview.innerHTML='📷';
      showErrorToast('Error', 'No se pudo subir la imagen');
    }
  }).catch(function(){
    preview.innerHTML='📷';
    showErrorToast('Error', 'No se pudo subir la imagen');
  });
}
var additionalImages=[];
function uploadAdditionalImages(input){
  var files=input.files;
  if(!files||files.length===0)return;
  Array.from(files).forEach(function(file){
    validateImageFile(file, function(ok){
      if(!ok)return;
      var container=document.getElementById('prodAdditionalImages');
      var placeholder=document.getElementById('addImgPlaceholder');
      if(placeholder)placeholder.remove();
      var formData=new FormData();
      formData.append('file',file);
      fetch(API_URL+'/api/upload',{
      method:'POST',
      body:formData
    }).then(function(r){return r.json();}).then(function(data){
      if(data.url){
        additionalImages.push(data.url);
        document.getElementById('prodImages').value=JSON.stringify(additionalImages);
        renderAdditionalImage(data.url,additionalImages.length-1);
      }
    }).catch(function(e){console.error('Error uploading image:',e);if(typeof showErrorToast==='function')showErrorToast('Error','No se pudo subir la imagen');});
    });
  });
  input.value='';
}
function renderAdditionalImage(url,index){
  var container=document.getElementById('prodAdditionalImages');
  var div=document.createElement('div');
  div.style.cssText='position:relative;width:60px;height:60px;flex-shrink:0';
  div.innerHTML='<img loading="lazy" src="'+url+'" style="width:100%;height:100%;object-fit:cover;border-radius:8px"><button onclick="removeAdditionalImage('+index+')" style="position:absolute;top:-5px;right:-5px;width:18px;height:18px;background:var(--red);color:#fff;border:none;border-radius:50%;font-size:12px;cursor:pointer;line-height:1">×</button>';
  container.appendChild(div);
}
function removeAdditionalImage(index){
  additionalImages.splice(index,1);
  document.getElementById('prodImages').value=JSON.stringify(additionalImages);
  var container=document.getElementById('prodAdditionalImages');
  container.innerHTML=additionalImages.length===0?'<div id="addImgPlaceholder" style="color:var(--gray);font-size:11px;padding:10px">Arrastra imagenes adicionales aqui</div>':'';
  additionalImages.forEach(function(url,i){
    renderAdditionalImage(url,i);
  });
}
var pendingDeleteId=null;
function closeConfirm(){
  document.getElementById('confirmOverlay').style.display='none';
  pendingDeleteId=null;
}
function confirmAction(confirmed){
  if(window.confirmCallback){window.confirmCallback(confirmed);}
  if(confirmed&&pendingDeleteId){var p=getById(PRODUCTS,pendingDeleteId);var pname=p?p.name:'este producto';
    fetch(API_URL+'/api/products/'+pendingDeleteId,{method:'DELETE'}).then(function(r){if(!r.ok)throw new Error('Error del servidor');loadProducts();showSuccessToast('Producto eliminado', pname);}).catch(function(e){showErrorToast('Error',e.message||'No se pudo eliminar el producto');});}
  closeConfirm();
}
// =========== AUTOSUGERIDO LISTA DE PRECIOS ===========
// Autocompleta precios (Venta/Preventa) desde la tabla priceList al cargar
// productos por IMEI o al armar variantes de preventa. Expone helpers en
// window para que preventa.js y render.js los compartan.
var _gpPreciosCache = null;
window.cargarPreciosLista = function () {
  if (_gpPreciosCache) return Promise.resolve(_gpPreciosCache);
  return Promise.all([
    fetch(API_URL + '/api/admin/precios', { credentials: 'include' }).then(function (r) { return r.json(); }).catch(function () { return []; }),
    fetch(API_URL + '/api/admin/precios/macipad', { credentials: 'include' }).then(function (r) { return r.json(); }).catch(function () { return []; })
  ]).then(function (arrs) {
    _gpPreciosCache = (arrs[0] || []).concat(arrs[1] || []);
    return _gpPreciosCache;
  });
};
window.buscarPrecioLista = function (modelo, almacenamiento) {
  var norm = function (s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); };
  var m = norm(modelo), a = norm(almacenamiento);
  if (!m) return null;
  var list = _gpPreciosCache || [];
  if (a) {
    var exact = list.find(function (p) { return norm(p.modelo) === m && norm(p.almacenamiento) === a; });
    if (exact) return exact;
  }
  return list.find(function (p) { return norm(p.modelo) === m; }) || null;
};

function showAddProductByImeiModal(){
  showImeiProductModal(null);
}
function showImeiProductModal(existingProductId){
  var overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;overflow-y:auto;padding:20px';
  overlay.onclick=function(e){if(e.target===overlay)closeModal();};

  var modal=document.createElement('div');
  modal.style.cssText='background:#fff;border-radius:16px;max-width:640px;width:100%;max-height:90vh;overflow-y:auto;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.3);position:relative';
  modal.onclick=function(e){e.stopPropagation();};
  if(!existingProductId)modal.scrollTop=0;

  var loadingProduct=false, imeiData=null;

  var rawBrands=getUniqueBrands();
  var brandMap={};
  rawBrands.forEach(function(b){
    var label=/^iPhone$/i.test(b)?'Apple':b;
    brandMap[label]=brandMap[label]||b;
  });
  var brandOptions=Object.keys(brandMap).sort().map(function(label){
    return'<option value="'+brandMap[label]+'">'+label+'</option>';
  }).join('');
  var html='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><h3 style="font-size:20px;font-weight:700;color:var(--dk)">'+(existingProductId?'Agregar variante':'Nuevo producto por IMEI')+'</h3><button onclick="document.getElementById(\'imeiModalOverlay\').remove()" style="width:32px;height:32px;border-radius:8px;border:none;background:var(--cream2);cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;color:var(--gray)">✕</button></div>'+
    '<div style="margin-bottom:16px"><label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px;color:var(--gray)">IMEI del dispositivo</label>'+
    '<div style="display:flex;gap:8px"><input type="text" id="imeiInput" maxlength="15" placeholder="Ingresá o escaneá el IMEI de 15 dígitos" oninput="this.value=this.value.replace(/[^0-9]/g,\'\')" style="flex:1;padding:10px 14px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;outline:none">'+
    '<button id="imeiLookupBtn" onclick="lookupImei()" style="padding:10px 20px;background:var(--orange);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap">Buscar</button>'+
    '<button onclick="startImeiScanner()" title="Escaneá el código QR" style="width:44px;height:44px;border-radius:10px;background:var(--cream2);border:1.5px solid var(--border);cursor:pointer;font-size:20px;display:flex;align-items:center;justify-content:center">📷</button>'+
    '<button onclick="omitirImei()" title="No es un iPhone / no tiene IMEI" style="width:44px;height:44px;border-radius:10px;background:var(--cream2);border:1.5px solid var(--border);cursor:pointer;font-size:16px;font-weight:700;color:var(--gray);display:flex;align-items:center;justify-content:center">✕</button></div>'+
    '<div style="font-size:11px;color:var(--gray);margin-top:6px">Tocá la ✕ si el producto no tiene IMEI (no es un celular)</div>'+
    '<div id="imeiError" style="display:none;font-size:12px;color:var(--red);margin-top:6px"></div></div>'+
    '<div id="imeiResult" style="display:none"></div>'+
    '<div id="imeiForm" style="display:none">'+
      '<div id="imeiFormFields" style="display:grid;gap:14px;margin-top:16px">'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
          '<div><label style="font-size:11px;font-weight:600;display:block;margin-bottom:4px;color:var(--gray)">Marca</label><select class="imei-fld" id="if-brand" onchange="toggleImeiBrandOther();onImeiBrandOrTypeChange()"><option value="">Seleccioná marca...</option>'+brandOptions+'<option value="__other__">Otra...</option></select><input class="imei-fld" id="if-brand-other" placeholder="Escribí la marca" style="display:none;margin-top:6px"></div>'+
          '<div><label style="font-size:11px;font-weight:600;display:block;margin-bottom:4px;color:var(--gray)">Modelo</label><input class="imei-fld" id="if-modelName" placeholder="Escribí el modelo" onchange="autocompletarPrecioImeiManual()" style="display:none"><select class="imei-fld" id="if-iphoneModel" onchange="onImeiPhoneModelChange()" style="display:none"><option value="">Seleccioná modelo...</option></select></div>'+
        '</div>'+
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">'+
          '<div><label style="font-size:11px;font-weight:600;display:block;margin-bottom:4px;color:var(--gray)">Almacenamiento</label><select class="imei-fld" id="if-storage" onchange="autocompletarPrecioImeiManual()"><option value="">—</option><option value="64 GB">64 GB</option><option value="128 GB">128 GB</option><option value="256 GB">256 GB</option><option value="512 GB">512 GB</option><option value="1 TB">1 TB</option></select></div>'+
          '<div><label style="font-size:11px;font-weight:600;display:block;margin-bottom:4px;color:var(--gray)">Color</label><input class="imei-fld" id="if-color" placeholder="Ej: Graphite" style="display:none"><div id="imeiColorContainer" style="display:none;min-height:36px"></div></div>'+
          '<div><label style="font-size:11px;font-weight:600;display:block;margin-bottom:4px;color:var(--gray)">RAM</label><select class="imei-fld" id="if-ram"><option value="">—</option><option value="4 GB">4 GB</option><option value="6 GB">6 GB</option><option value="8 GB">8 GB</option><option value="12 GB">12 GB</option><option value="16 GB">16 GB</option></select></div>'+
        '</div>'+
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">'+
          '<div><label style="font-size:11px;font-weight:600;display:block;margin-bottom:4px;color:var(--gray)">Tipo</label><select class="imei-fld" id="if-type" onchange="onImeiBrandOrTypeChange()"><option value="celular">Celular</option><option value="laptop">Laptop</option><option value="tablet">Tablet</option><option value="desktop">Desktop</option></select></div>'+
          '<div><label style="font-size:11px;font-weight:600;display:block;margin-bottom:4px;color:var(--gray)">Condición</label><select class="imei-fld" id="if-condition"><option value="Nuevo">Nuevo</option><option value="Impecable">Impecable</option><option value="Muy bueno">Muy bueno</option><option value="Bueno">Bueno</option></select></div>'+
          '<div><label style="font-size:11px;font-weight:600;display:block;margin-bottom:4px;color:var(--gray)">Pantalla</label><select class="imei-fld" id="if-screen"><option value="">—</option><option value="4.7">4.7"</option><option value="5.4">5.4"</option><option value="5.8">5.8"</option><option value="6.1">6.1"</option><option value="6.3">6.3"</option><option value="6.5">6.5"</option><option value="6.7">6.7"</option><option value="6.9">6.9"</option><option value="7.6">7.6"</option><option value="13.3">13.3"</option><option value="14">14"</option><option value="15.6">15.6"</option><option value="16">16"</option></select></div>'+
        '</div>'+
        '<div style="border-top:1px solid var(--border);padding-top:14px;margin-top:4px">'+
          '<div style="font-size:12px;font-weight:600;color:var(--gray);margin-bottom:10px">📸 Imagen del producto</div>'+
          '<div style="display:flex;gap:12px;align-items:start">'+
            '<div id="imeiImgPreview" style="width:100px;height:100px;border-radius:10px;background:var(--cream2);display:flex;align-items:center;justify-content:center;font-size:36px;border:2px dashed var(--border);flex-shrink:0;overflow:hidden">📷</div>'+
            '<div style="flex:1;min-width:0">'+
              '<div id="imeiImgCatalog" style="display:none">'+
                '<div style="font-size:11px;font-weight:600;color:var(--gray);margin-bottom:6px">Del catálogo (Lista de Precios)</div>'+
                '<div id="imeiImgOptions" style="display:flex;gap:8px;flex-wrap:wrap"></div>'+
                '<div style="font-size:10.5px;color:var(--gray);margin:4px 0 10px">Clic en una imagen del catálogo para seleccionarla. La tuya siempre podés subirla abajo.</div>'+
              '</div>'+
              '<label style="display:inline-block;padding:8px 16px;background:var(--orange);color:#fff;border-radius:8px;font-size:12px;cursor:pointer">Subir imagen personalizada<input type="file" accept="image/*" style="display:none" onchange="uploadImeiProductImage(this)"></label>'+
              '<input type="hidden" id="imeiImgUrl">'+
            '</div>'+
          '</div>'+
        '</div>'+
      '</div>'+
      '<div style="border-top:1px solid var(--border);padding-top:14px;margin-top:14px">'+
        '<div style="font-size:12px;font-weight:600;color:var(--gray);margin-bottom:10px">💰 Datos del negocio</div>'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
          '<div><label style="font-size:11px;font-weight:600;display:block;margin-bottom:4px;color:var(--gray)">Precio de venta *</label><input class="imei-fld" id="if-price" type="text" placeholder="Ej: 950000" oninput="formatPriceInput(this)"></div>'+
          '<div><label style="font-size:11px;font-weight:600;display:block;margin-bottom:4px;color:var(--gray)">Precio de compra</label><input class="imei-fld" id="if-cost" type="text" placeholder="Ej: 720000" oninput="formatPriceInput(this)"></div>'+
          '<div><label style="font-size:11px;font-weight:600;display:block;margin-bottom:4px;color:var(--gray)">Batería (%)</label><input class="imei-fld" id="if-battery" type="number" min="0" max="100" placeholder="89"></div>'+
          '<div><label style="font-size:11px;font-weight:600;display:block;margin-bottom:4px;color:var(--gray)">Proveedor / Comprado a</label><input class="imei-fld" id="if-purchasedFrom" placeholder="Ej: iShop BA"></div>'+
        '</div>'+
        '<div style="margin-top:12px"><label style="font-size:11px;font-weight:600;display:block;margin-bottom:4px;color:var(--gray)">Notas / Estado funcional</label><textarea class="imei-fld" id="if-notes" placeholder="Ej: Pantalla rayada, funciona perfecto" style="height:60px;resize:none"></textarea></div>'+
      '</div>'+
      '<div style="display:flex;gap:12px;margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">'+
        '<button id="imeiSaveBtn" onclick="saveImeiProduct(\''+(existingProductId||'')+'\')" style="flex:1;padding:12px;background:var(--orange);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">Guardar producto</button>'+
        '<button onclick="document.getElementById(\'imeiModalOverlay\').remove()" style="padding:12px 24px;background:var(--cream2);color:var(--dk);border:1px solid var(--border);border-radius:10px;font-size:14px;cursor:pointer">Cancelar</button>'+
      '</div>'+
    '</div>';

  modal.innerHTML=html;
  overlay.id='imeiModalOverlay';
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Add input styles
  var style=document.createElement('style');
  style.textContent='.imei-fld{width:100%;padding:8px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;outline:none;box-sizing:border-box;background:#fff}.imei-fld:focus{border-color:var(--orange)}';
  document.head.appendChild(style);

  // Colores: círculos siempre. Curados por modelo (getModelColors, hoy solo
  // con entradas de iPhone) si el modelo elegido tiene, si no la paleta
  // genérica. Definidos acá (antes del prefill de "Agregar variante" más
  // abajo, que los llama de forma síncrona) para que ya existan a tiempo.
  var GENERIC_COLOR_SWATCHES=['Negro','Blanco','Plateado','Grafito','Dorado','Azul','Rojo','Verde','Amarillo','Rosa','Púrpura'];
  function renderColorSwatchesList(colors,preselectColor){
    var container=document.getElementById('imeiColorContainer');
    if(!container)return;
    var hexMap=window.COLOR_HEX||{};
    if(!colors.length){container.style.display='none';return;}
    container.style.display='flex';
    container.style.gap='8px';
    container.style.flexWrap='wrap';
    container.innerHTML=colors.map(function(c){
      var hex=hexMap[c]||'#ccc';
      var isSelected=c===preselectColor;
      return '<div onclick="selectImeiColor(\''+c.replace(/'/g,"\\'")+'\',this)" style="width:32px;height:32px;border-radius:50%;background:'+hex+';cursor:pointer;border:3px solid '+(isSelected?'var(--orange)':'transparent')+';transition:all .15s;box-shadow:0 2px 6px rgba(0,0,0,.12);flex-shrink:0" title="'+c+'"></div>'
    }).join('');
    if(preselectColor)window._imeiSelectedColor=preselectColor;
  }
  window.renderImeiColorSwatches=function(modelName,preselectColor){
    var colors=(window.getModelColors&&window.getModelColors(modelName))||[];
    renderColorSwatchesList(colors,preselectColor);
  };
  window.renderGenericColorSwatches=function(preselectColor){
    renderColorSwatchesList(GENERIC_COLOR_SWATCHES,preselectColor);
  };

  window.toggleImeiBrandOther=function(){
    var sel=document.getElementById('if-brand');
    var other=document.getElementById('if-brand-other');
    if(sel.value==='__other__'){
      other.style.display='block';
      other.focus();
    }else{
      other.style.display='none';
    }
  };

  // Marca real elegida (resuelve "Otra..." contra el input de texto libre).
  function getSelectedImeiBrand(){
    var sel=document.getElementById('if-brand');
    return sel.value==='__other__'?document.getElementById('if-brand-other').value.trim():sel.value;
  }

  // Modelos conocidos para una marca+tipo (mismo criterio que _modelsForBrand
  // en preventa.js): Apple se resuelve a iPhone/iPad/MacBook según el tipo;
  // el resto usa SELL_MODELS[marca] si existe (hoy: Samsung, Motorola, Xiaomi).
  function modelsForImeiBrand(brand,type){
    if(!brand)return[];
    if(/^Apple$/i.test(brand)){
      var key=type==='tablet'?'iPad':type==='laptop'?'MacBook':'iPhone';
      return(window.SELL_MODELS&&window.SELL_MODELS[key])||[];
    }
    return(window.SELL_MODELS&&window.SELL_MODELS[brand])||[];
  }

  // Modelo efectivamente elegido: del <select> de modelos conocidos, o del
  // input libre (incluye el caso "Otro modelo...").
  function getSelectedImeiModelName(){
    var dd=document.getElementById('if-iphoneModel');
    var custom=document.getElementById('if-modelName');
    if(dd&&dd.style.display!=='none'){
      if(dd.value==='__other__')return custom?custom.value.trim():'';
      return dd.value;
    }
    return custom?custom.value.trim():'';
  }

  window.onImeiBrandOrTypeChange=function(){
    var brand=getSelectedImeiBrand();
    var type=document.getElementById('if-type').value;
    var models=modelsForImeiBrand(brand,type);
    var dd=document.getElementById('if-iphoneModel');
    var custom=document.getElementById('if-modelName');
    if(models.length){
      dd.innerHTML='<option value="">Seleccioná modelo...</option>'+
        models.map(function(m){return'<option value="'+m+'">'+m+'</option>';}).join('')+
        '<option value="__other__">Otro modelo...</option>';
      dd.style.display='';
      custom.style.display=dd.value==='__other__'?'':'none';
    }else{
      dd.innerHTML='';
      dd.style.display='none';
      custom.style.display='';
    }
    onImeiPhoneModelChange();
  };

  window.onImeiPhoneModelChange=function(){
    var dd=document.getElementById('if-iphoneModel');
    var custom=document.getElementById('if-modelName');
    if(dd&&dd.style.display!=='none'){
      custom.style.display=dd.value==='__other__'?'':'none';
      if(dd.value==='__other__')custom.focus();
    }
    var model=getSelectedImeiModelName();
    var curatedColors=model&&window.getModelColors&&window.getModelColors(model);
    document.getElementById('if-color').style.display='none';
    document.getElementById('imeiColorContainer').style.display='flex';
    if(curatedColors&&curatedColors.length){
      renderImeiColorSwatches(model,window._imeiSelectedColor||'');
    }else{
      renderGenericColorSwatches(window._imeiSelectedColor);
    }
    autocompletarPrecioImeiManual();
  };

  // Autocompleta el precio de venta desde la Lista de Precios cuando se carga
  // el producto a mano (sin IMEI) al elegir modelo/almacenamiento.
  window.autocompletarPrecioImeiManual=function(){
    if(window.renderImeiCatalogImages)window.renderImeiCatalogImages();
    if(typeof window.cargarPreciosLista!=='function')return;
    var model=getSelectedImeiModelName();
    var storageEl=document.getElementById('if-storage');
    var storage=storageEl?storageEl.value:'';
    if(!model)return;
    window.cargarPreciosLista().then(function(){
      var match=window.buscarPrecioLista(model,storage);
      var priceEl=document.getElementById('if-price');
      if(match&&priceEl&&!priceEl.value&&match.precioARS){
        priceEl.value=match.precioARS;
      }
    });
  };

  // Muestra las imágenes de la Lista de Precios para el modelo elegido y
  // preselecciona automáticamente la recomendada (mismo modelo+almacenamiento
  // o la única disponible). El operador puede cambiar de opción con un clic
  // o subir una imagen propia (que reemplaza la del catálogo).
  window.renderImeiCatalogImages=function(){
    var catEl=document.getElementById('imeiImgCatalog');
    var optsEl=document.getElementById('imeiImgOptions');
    if(!catEl||!optsEl)return;
    var model=getSelectedImeiModelName();
    if(!model){catEl.style.display='none';optsEl.innerHTML='';return;}
    var storage=document.getElementById('if-storage');
    var storageVal=storage?storage.value:'';
    if(typeof window.cargarPreciosLista!=='function')return;
    window.cargarPreciosLista().then(function(list){
      var norm=function(s){return String(s||'').toLowerCase().replace(/\s+/g,' ').trim();};
      var m=norm(model),a=norm(storageVal);
      var rows=(list||[]).filter(function(p){return norm(p.modelo)===m;});
      var urls=[],seen={};
      rows.forEach(function(p){if(p.imageUrl&&!seen[p.imageUrl]){seen[p.imageUrl]=1;urls.push(p.imageUrl);}});
      if(!urls.length){catEl.style.display='none';optsEl.innerHTML='';return;}
      var rec=urls[0];
      rows.forEach(function(p){if(norm(p.almacenamiento)===a&&p.imageUrl){rec=p.imageUrl;}});
      urls=urls.filter(function(u){return u!==rec;});
      urls.unshift(rec);
      catEl.style.display='block';
      var current=document.getElementById('imeiImgUrl').value||'';
      optsEl.innerHTML=urls.map(function(u){
        var sel=(u===current);
        return '<div onclick="selectImeiCatalogImage(this)" data-url="'+esc(u)+'" role="button" tabindex="0" title="Imagen del catálogo" aria-label="Seleccionar imagen del catálogo" style="width:48px;height:48px;border-radius:10px;overflow:hidden;border:2px solid '+(sel?'var(--orange)':'var(--border)')+';cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.08);flex-shrink:0">'+
          '<img loading="lazy" src="'+esc(u)+'" style="width:100%;height:100%;object-fit:cover;display:block" alt="Imagen del catálogo">'+
        '</div>';
      }).join('');
      // Sin imagen previa elegida (ni subida ni del IMEI): auto-seleccionar la recomendada.
      if(!current&&urls.length&&optsEl.firstElementChild)selectImeiCatalogImage(optsEl.firstElementChild);
    });
  };

  window.selectImeiCatalogImage=function(el){
    if(!el)return;
    var url=el.getAttribute('data-url');
    if(!url)return;
    var hidden=document.getElementById('imeiImgUrl');
    if(hidden)hidden.value=url;
    var preview=document.getElementById('imeiImgPreview');
    if(preview)preview.innerHTML='<img loading="lazy" src="'+esc(url)+'" style="width:100%;height:100%;object-fit:cover">';
    var all=document.querySelectorAll('#imeiImgOptions > div');
    for(var i=0;i<all.length;i++)all[i].style.borderColor='var(--border)';
    el.style.borderColor='var(--orange)';
  };

  // If editing existing product, pre-fill and skip IMEI step
  if(existingProductId){
    var p=getById(PRODUCTS,existingProductId);
    if(p){
      document.getElementById('imeiInput').value='';
      document.getElementById('imeiInput').disabled=true;
      document.getElementById('imeiLookupBtn').style.display='none';
      var brandSel=document.getElementById('if-brand');
      if(brandSel.querySelector('option[value="'+p.brand+'"]')){
        brandSel.value=p.brand||'';
      }else{
        brandSel.value='__other__';
        document.getElementById('if-brand-other').value=p.brand||'';
        document.getElementById('if-brand-other').style.display='block';
      }
      document.getElementById('if-storage').value=p.storage||'';
      document.getElementById('if-color').value=p.color||'';
      document.getElementById('if-ram').value=p.ram||'';
      document.getElementById('if-screen').value=p.screen||'';
      document.getElementById('if-type').value=p.type||'celular';
      document.getElementById('if-condition').value=p.condition||'Impecable';
      document.getElementById('if-price').value=p.price||'';
      document.getElementById('if-cost').value=p.cost||'';
      document.getElementById('if-battery').value=p.battery||'';
      document.getElementById('imeiResult').style.display='block';
      document.getElementById('imeiResult').innerHTML='<div style="padding:10px 14px;background:var(--cream2);border-radius:8px;font-size:13px;color:var(--gray)">📱 Agregando variante a <strong>'+esc(p.name)+'</strong></div>';
      document.getElementById('imeiForm').style.display='block';
      // Set model field and color circles
      onImeiBrandOrTypeChange();
      window._imeiSelectedColor=null;
      var prodName=p.name||'';
      var iphoneSelect=document.getElementById('if-iphoneModel');
      if(iphoneSelect&&iphoneSelect.style.display!=='none'&&iphoneSelect.querySelector('option[value="'+prodName+'"]')){
        iphoneSelect.value=prodName;
        onImeiPhoneModelChange();
        if(p.color)window._imeiSelectedColor=p.color;
      }else if(iphoneSelect&&iphoneSelect.style.display!=='none'){
        // Modelo conocido para la marca, pero este producto no coincide con
        // ninguna opción (nombre libre viejo): usar "Otro modelo".
        iphoneSelect.value='__other__';
        document.getElementById('if-modelName').value=prodName;
        onImeiPhoneModelChange();
        if(p.color)window._imeiSelectedColor=p.color;
      }else{
        document.getElementById('if-modelName').value=prodName;
      }
    }
  }

  // Global helper functions for this modal
  window.selectImeiColor=function(color,el){
    window._imeiSelectedColor=color;
    document.querySelectorAll('#imeiColorContainer > div').forEach(function(d){d.style.borderColor='transparent';});
    el.style.borderColor='var(--orange)';
  };
  window.omitirImei=function(){
    document.getElementById('imeiInput').value='';
    document.getElementById('imeiInput').disabled=true;
    document.getElementById('imeiError').style.display='none';
    document.getElementById('imeiResult').style.display='block';
    document.getElementById('imeiResult').innerHTML='<div style="padding:10px 14px;background:var(--cream2);border-radius:8px;font-size:13px;color:var(--gray)">Sin IMEI — completá los datos manualmente</div>';
    document.getElementById('imeiForm').style.display='block';
    onImeiBrandOrTypeChange();
  };
  window.lookupImei=function(){
    var input=document.getElementById('imeiInput');
    var imei=input.value.trim();
    if(imei.length!==15){
      document.getElementById('imeiError').style.display='block';
      document.getElementById('imeiError').textContent='El IMEI debe tener exactamente 15 dígitos';
      return;
    }
    document.getElementById('imeiError').style.display='none';
    var btn=document.getElementById('imeiLookupBtn');
    btn.textContent='Buscando...';
    btn.disabled=true;

    fetch(API_URL+'/api/inventory/lookup-imei',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({imei:imei})
    }).then(function(r){return r.json();}).then(function(data){
      btn.textContent='Buscar';
      btn.disabled=false;
      if(data.error){
        document.getElementById('imeiError').style.display='block';
        document.getElementById('imeiError').textContent=data.error;
        document.getElementById('if-color').style.display='';
        document.getElementById('imeiColorContainer').style.display='none';
        document.getElementById('imeiForm').style.display='block';
        return;
      }
      imeiData=data;
      var brandSel=document.getElementById('if-brand');
      if(brandSel.querySelector('option[value="'+data.brand+'"]')){
        brandSel.value=data.brand||'';
      }else{
        brandSel.value='__other__';
        document.getElementById('if-brand-other').value=data.brand||'';
        document.getElementById('if-brand-other').style.display='block';
      }
      document.getElementById('if-storage').value=data.storage||'';
      document.getElementById('if-color').value=data.color||'';
      document.getElementById('if-ram').value=data.ram||'';
      document.getElementById('if-screen').value=data.screen||'';
      document.getElementById('if-type').value=data.deviceType||'celular';
      if(data.imageUrl){
        document.getElementById('imeiImgPreview').innerHTML='<img loading="lazy" src="'+data.imageUrl+'" style="width:100%;height:100%;object-fit:cover">';
        document.getElementById('imeiImgUrl').value=data.imageUrl;
      }
      document.getElementById('imeiResult').style.display='block';
      document.getElementById('imeiResult').innerHTML='<div style="padding:10px 14px;background:rgba(34,197,94,.1);border-radius:8px;font-size:13px;color:var(--green)">✅ Datos obtenidos del IMEI. Revisá y editá si es necesario.</div>';

      // Set model field and color circles
      window._imeiSelectedColor=data.color||null;
      var imeiModel=data.modelName||'';
      onImeiBrandOrTypeChange();
      var iphoneSelect=document.getElementById('if-iphoneModel');
      if(iphoneSelect&&iphoneSelect.style.display!=='none'&&imeiModel&&iphoneSelect.querySelector('option[value="'+imeiModel+'"]')){
        iphoneSelect.value=imeiModel;
        onImeiPhoneModelChange();
      }else{
        if(iphoneSelect&&iphoneSelect.style.display!=='none')iphoneSelect.value='__other__';
        document.getElementById('if-modelName').value=imeiModel;
        onImeiPhoneModelChange();
      }

      document.getElementById('imeiForm').style.display='block';
      document.getElementById('imeiInput').disabled=true;
      btn.style.display='none';
      // Autocompletar el precio de venta desde la Lista de Precios
      // (solo si el campo sigue vacío, para no pisar un valor ya cargado).
      if (typeof window.cargarPreciosLista === 'function') {
        window.cargarPreciosLista().then(function () {
          var match = window.buscarPrecioLista(data.modelName, data.storage);
          var priceEl = document.getElementById('if-price');
          if (match && priceEl && !priceEl.value && match.precioARS) {
            priceEl.value = match.precioARS;
            var res = document.getElementById('imeiResult');
            if (res) {
              res.innerHTML = res.innerHTML +
                '<div style="padding:6px 14px;font-size:12px;color:var(--green);background:rgba(34,197,94,.08);border-radius:8px;margin-top:6px">' +
                '💰 Precio de venta autocompletado desde la Lista de Precios: <strong>$' + match.precioARS.toLocaleString('es-AR') + '</strong></div>';
            }
          }
        });
      }
      var m=document.getElementById('imeiModalOverlay');if(m)m.querySelector('[style*="overflow-y:auto"]').scrollTop=0;
    }).catch(function(){
      btn.textContent='Buscar';
      btn.disabled=false;
      document.getElementById('imeiError').style.display='block';
      document.getElementById('imeiError').textContent='Error al consultar el IMEI. Completá los datos manualmente.';
      document.getElementById('if-color').style.display='';
      document.getElementById('imeiColorContainer').style.display='none';
      document.getElementById('imeiForm').style.display='block';
    });
  };

  window.startImeiScanner=function(){
    var prev=document.getElementById('imeiConfirmOverlay');
    if(prev)prev.remove();
    var handled=false;
    window.abrirScannerQR({
      mode:'barcode',
      onDetected:function(res){
        if(handled) return;
        handled=true;
        var raw=res && (res.raw || res.value) ? String(res.raw || res.value) : '';
        var digits=raw.replace(/\D/g,'');
        var imei=null;
        if(res.type==='imei' && res.value) imei=res.value;
        else if(digits.length===15) imei=digits;
        else if(digits.length===14){
          for(var cd=0;cd<=9;cd++){
            var cand=digits+String(cd);
            var s=0,alt=false;
            for(var i=cand.length-1;i>=0;i--){
              var v=parseInt(cand[i],10);
              if(alt){v*=2; if(v>9) v-=9;}
              s+=v; alt=!alt;
            }
            if(s%10===0){imei=cand;break;}
          }
          if(!imei) imei=digits;
        } else if(raw) imei=digits || raw.trim();
        if(!imei) return;
        if(navigator.vibrate) try{navigator.vibrate(80);}catch(e){}
        var confirmDiv=document.createElement('div');
        confirmDiv.id='imeiConfirmOverlay';
        confirmDiv.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:1rem';
        confirmDiv.innerHTML='<div style="background:#fff;border-radius:16px;max-width:360px;width:100%;padding:2rem;text-align:center">'+
          '<div style="font-size:40px;margin-bottom:12px">📱</div>'+
          '<h3 style="font-size:16px;font-weight:700;margin-bottom:8px">IMEI detectado</h3>'+
          '<p style="font-size:13px;color:var(--gray);margin-bottom:16px">El código escaneado es:</p>'+
          '<div id="imeiConfirmNumber" style="font-size:24px;font-weight:800;letter-spacing:2px;color:var(--dk);background:var(--cream2);padding:12px;border-radius:10px;margin-bottom:20px;font-family:monospace;word-break:break-all">'+esc(imei)+'</div>'+
          '<div style="display:flex;gap:8px">'+
            '<button id="imeiRetryBtn" style="flex:1;padding:12px;background:var(--cream2);border:1px solid var(--border);border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;color:var(--gray)">Reintentar</button>'+
            '<button id="imeiConfirmBtn" style="flex:1;padding:12px;background:var(--orange);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer">✓ Correcto</button>'+
          '</div>'+
        '</div>';
        document.body.appendChild(confirmDiv);
        document.getElementById('imeiRetryBtn').onclick=function(){
          document.getElementById('imeiConfirmOverlay').remove();
          handled=false;
          window.startImeiScanner();
        };
        document.getElementById('imeiConfirmBtn').onclick=function(){
          document.getElementById('imeiConfirmOverlay').remove();
          window._confirmarImei(imei);
        };
      }
    });
  };
  window._confirmarImei=function(imei){
    document.getElementById('imeiInput').value=imei;
    document.getElementById('imeiInput').disabled=true;
    window.lookupImei();
  };

  window.uploadImeiProductImage=function(input){
    var file=input.files[0];
    if(!file)return;
    var preview=document.getElementById('imeiImgPreview');
    preview.innerHTML='<span style="font-size:12px;color:var(--gray)">Subiendo...</span>';
    var fd=new FormData();
    fd.append('file',file);
    fetch(API_URL+'/api/upload',{method:'POST',body:fd}).then(function(r){return r.json();}).then(function(data){
      if(data.url){
        document.getElementById('imeiImgUrl').value=data.url;
        preview.innerHTML='<img loading="lazy" src="'+data.url+'" style="width:100%;height:100%;object-fit:cover">';
        var catOpts=document.querySelectorAll('#imeiImgOptions > div');
        for(var ci=0;ci<catOpts.length;ci++)catOpts[ci].style.borderColor='var(--border)';
      }else{
        preview.innerHTML='📷';
        showErrorToast('Error','No se pudo subir la imagen');
      }
    }).catch(function(){
      preview.innerHTML='📷';
      showErrorToast('Error','No se pudo subir la imagen');
    });
  };

  window.saveImeiProduct=function(existingId){
    var imei=document.getElementById('imeiInput').value.trim();
    if(!imei){
      // Producto sin IMEI (se tocó "omitir"): generar un identificador único
      // sintético, ya que cada unidad de inventario necesita uno igual.
      imei='SN-'+Date.now().toString(36).toUpperCase()+Math.random().toString(36).slice(2,6).toUpperCase();
    }
    var brand=getSelectedImeiBrand();
    var modelName=getSelectedImeiModelName();
    if(!modelName&&!existingId){
      showErrorToast('Error','El nombre del modelo es requerido');
      return;
    }
    var price=parseInt((document.getElementById('if-price').value||'0').replace(/[^0-9]/g,''))||0;
    if(!price&&!existingId){
      showErrorToast('Error','El precio de venta es requerido');
      return;
    }

    var btn=document.getElementById('imeiSaveBtn');
    btn.textContent='Guardando...';
    btn.disabled=true;

    var screenVal=document.getElementById('if-screen').value;
    var productData={
      name: modelName || document.getElementById('if-modelName').value,
      brand: brand || 'Otro',
      sub: [document.getElementById('if-storage').value,window._imeiSelectedColor||document.getElementById('if-color').value].filter(Boolean).join(' / '),
      price: price,
      cost: parseInt((document.getElementById('if-cost').value||'0').replace(/[^0-9]/g,''))||0,
      condition: document.getElementById('if-condition').value,
      type: document.getElementById('if-type').value,
      storage: document.getElementById('if-storage').value || null,
      color: window._imeiSelectedColor||document.getElementById('if-color').value || null,
      ram: document.getElementById('if-ram').value || null,
      screen: screenVal?parseFloat(screenVal):null,
      battery: parseInt(document.getElementById('if-battery').value)||null,
      imageUrl: document.getElementById('imeiImgUrl').value || null,
      ico: '📱',
      stock: 1,
    };

    if(existingId){
      // Create inventory item (backend handles stock increment)
      fetch(API_URL+'/api/inventory',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          imei: imei,
          brand: brand,
          modelName: productData.name,
          storage: productData.storage,
          color: productData.color,
          ram: productData.ram,
          screen: productData.screen,
          deviceType: productData.type,
          imageUrl: document.getElementById('imeiImgUrl').value||null,
          productId: existingId,
          purchasePrice: productData.cost,
          cosmeticCondition: productData.condition,
          batteryHealth: productData.battery,
          targetPrice: productData.price,
          createdById: (Storage.get('user')||{}).id||'unknown'
        })
      }).then(function(res){
        if(!res.ok)return res.json().then(function(e){throw new Error(e.error||'Error del servidor');});
        showSuccessToast('Variante agregada','Se agregó el IMEI al producto');
        invalidateCache('/api/products');window._productsLoaded=false;loadProducts().then(function(){
          document.getElementById('imeiModalOverlay').remove();
        });
      }).catch(function(err){
        btn.textContent='Guardar producto';
        btn.disabled=false;
        showErrorToast('Error',err.message||'No se pudo guardar');
      });
    }else{
      // Create via inventory endpoint (creates product + inventory item)
      fetch(API_URL+'/api/inventory',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          imei: imei,
          brand: brand,
          modelName: productData.name,
          storage: productData.storage,
          color: productData.color,
          ram: productData.ram,
          screen: productData.screen,
          deviceType: productData.type,
          imageUrl: document.getElementById('imeiImgUrl').value||null,
          purchasePrice: productData.cost,
          cosmeticCondition: productData.condition,
          batteryHealth: productData.battery,
          targetPrice: productData.price,
          createdById: (Storage.get('user')||{}).id||'unknown'
        })
      }).then(function(res){
        if(!res.ok)return res.json().then(function(e){throw new Error(e.error||'Error del servidor');});
        return res.json().then(function(created){
          showSuccessToast('Producto creado','Se creó el producto con IMEI');
          if(created&&created.qrCode){
            showQrDownloadModal(created.qrCode, created.code, created.brand+' '+created.modelName);
          }
          invalidateCache('/api/products');window._productsLoaded=false;loadProducts().then(function(){
            document.getElementById('imeiModalOverlay').remove();
          });
        });
      }).catch(function(err){
        btn.textContent='Guardar producto';
        btn.disabled=false;
        showErrorToast('Error',err.message||'No se pudo crear');
      });
    }
  };
}

// Titulos legibles para el topbar del admin. Usado por adminTab y renderAdminContent
// para que el header se actualice al cambiar de tab (incluso cuando se navega
// directamente a /admin/<tab> y no se pasa por adminTab).
var ADMIN_TITLES={
  dashboard:'Dashboard',
  prods:'Productos',
  inventory:'Inventario',
  acc:'Accesorios',
  stock:'Stock',
  promos:'Promociones',
  orders:'Pedidos',
  arrep:'Arrepentimientos',
  chat:'Chat',
  quotes:'Cotizaciones',
  instore:'Venta en Tienda',
  preventa:'Preventas',
  sales:'Historial de Ventas',
  users:'Usuarios',
  cupones:'Cupones'
};

// Wrapper unificado que delega al renderAdminContent de admin.js (que maneja
// prods/acc/orders/chat/etc.) o al renderDashboardContent propio (dashboard).
// Se llama desde AdminPageClient (React) al cargar /admin/<tab>.
function renderAdminContent(tab){
  window.currentAdminTab=tab;
  var el=document.getElementById('adminContent');
  if(!el){
    // No dejar el panel en blanco sin pista. Normalmente #adminContent existe;
    // si no, mostramos un mensaje en el contenedor admin visible.
    console.warn('[admin] adminContent no encontrado para tab:',tab);
    var fallback=document.querySelector('.admin-main')||document.querySelector('#p-admin');
    if(fallback){
      fallback.innerHTML='<div style="padding:2rem;text-align:center;color:var(--gray)">Cargando sección...</div>';
    }
    return;
  }
  if(tab!=='chats'){window.adminActiveConvId=null;}
  if(tab!=='dashboard'&&window._dashRefreshInterval){
    clearInterval(window._dashRefreshInterval);
    window._dashRefreshInterval=null;
  }

  // Actualizar titulo del topbar para reflejar el tab activo.
  var titleEl=document.getElementById('adminPageTitle');
  if(titleEl&&ADMIN_TITLES[tab])titleEl.textContent=ADMIN_TITLES[tab];

  // Reset tab buttons y activar el actual
  document.querySelectorAll('#adm-prods,#adm-acc,#adm-stock,#adm-promos,#adm-cupones,#adm-orders,#adm-arrep,#adm-dashboard,#adm-chat,#adm-quotes,#adm-instore,#adm-preventa,#adm-sales,#adm-users').forEach(function(b){b.classList.remove('act');});
  var activeBtn=document.getElementById('adm-'+tab);
  if(activeBtn)activeBtn.classList.add('act');

  if(tab==='dashboard'){
    renderDashboardContent();
    if(typeof loadDashboard==='function')loadDashboard();
    return;
  }

  // Para los demas tabs, delegamos al renderAdminContent legacy de admin.js
  // que sabe dibujar cada vista con su lista/paginacion. La funcion vive en
  // admin.js y se llama _renderAdminLegacy para evitar colision de nombres.
  if(typeof window._renderAdminLegacy==='function'){
    window._renderAdminLegacy(tab);
  }else{
    // Fallback: si admin.js no esta cargado (no deberia pasar en admin),
    // mostramos un mensaje para no dejar el panel en blanco.
    el.innerHTML='<div style="padding:2rem;text-align:center;color:var(--gray)">Cargando panel...</div>';
  }
}


function renderDashboardContent(){
  var el=document.getElementById('adminContent');
  if(!el)return;
  var months=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var monthOptions=months.map(function(m,i){return'<option value="'+i+'"'+(i===new Date().getMonth()?' selected':'')+'>'+m+'</option>';}).join('');

  el.innerHTML='<div id="dashboard-view">'+
    '<header style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap;gap:12px" class="dash-header">'+
      '<h1 style="font-size:24px;font-weight:700;color:var(--dk)">Dashboard</h1>'+
      '<div style="display:flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--border);border-radius:10px;padding:4px" class="dash-header-actions">'+
        '<button id="dashTabMensual" onclick="setDashView(\'mensual\')" style="padding:8px 16px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;background:var(--orange);color:#fff">Mensual</button>'+
        '<button id="dashTabAnual" onclick="setDashView(\'anual\')" style="padding:8px 16px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;background:transparent;color:var(--gray)">Anual</button>'+
        '<select id="dashMonthSelect" onchange="updateDashMonth(this.value)" style="padding:8px 12px;border:none;border-left:1px solid var(--border);border-radius:0 8px 8px 0;font-size:13px;font-weight:600;color:var(--dk);background:transparent;outline:none;cursor:pointer">'+monthOptions+'</select>'+
      '</div>'+
    '</header>'+
    '<!-- KPI Cards -->'+
    '<section style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:2rem" class="dash-kpis">'+
      '<div style="background:#fff;border-radius:12px;padding:20px;border:1px solid var(--border)">'+
        '<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px">'+
          '<h3 style="font-size:11px;font-weight:600;color:var(--gray);text-transform:uppercase;letter-spacing:.5px" id="kpi-revenue-label">Ingresos</h3>'+
          '<div style="width:36px;height:36px;border-radius:8px;background:rgba(34,197,94,.1);display:flex;align-items:center;justify-content:center;font-size:18px">💵</div>'+
        '</div>'+
        '<div style="font-size:28px;font-weight:800;color:var(--dk);margin-bottom:6px" id="kpi-revenue">$0</div>'+
        '<div style="font-size:12px;font-weight:600;color:var(--green);display:inline-flex;align-items:center;gap:4px;background:rgba(34,197,94,.1);padding:4px 8px;border-radius:6px" id="kpi-revenue-change-container"><span id="kpi-revenue-change">--</span></div>'+
      '</div>'+
      '<div style="background:#fff;border-radius:12px;padding:20px;border:1px solid var(--border)">'+
        '<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px">'+
          '<h3 style="font-size:11px;font-weight:600;color:var(--gray);text-transform:uppercase;letter-spacing:.5px" id="kpi-orders-label">Pedidos</h3>'+
          '<div style="width:36px;height:36px;border-radius:8px;background:rgba(255,107,44,.1);display:flex;align-items:center;justify-content:center;font-size:18px">📦</div>'+
        '</div>'+
        '<div style="font-size:28px;font-weight:800;color:var(--dk);margin-bottom:6px" id="kpi-orders">0</div>'+
        '<div style="font-size:12px;font-weight:600;color:var(--green);display:inline-flex;align-items:center;gap:4px;background:rgba(34,197,94,.1);padding:4px 8px;border-radius:6px" id="kpi-orders-change-container"><span id="kpi-orders-change">--</span></div>'+
      '</div>'+
      '<div style="background:#fff;border-radius:12px;padding:20px;border:1px solid var(--border)">'+
        '<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px">'+
          '<h3 style="font-size:11px;font-weight:600;color:var(--gray);text-transform:uppercase;letter-spacing:.5px" id="kpi-ticket-label">Ticket Promedio</h3>'+
          '<div style="width:36px;height:36px;border-radius:8px;background:rgba(59,130,246,.1);display:flex;align-items:center;justify-content:center;font-size:18px">📋</div>'+
        '</div>'+
        '<div style="font-size:28px;font-weight:800;color:var(--dk);margin-bottom:6px" id="kpi-ticket">$0</div>'+
        '<div style="font-size:12px;font-weight:600;color:var(--green);display:inline-flex;align-items:center;gap:4px;background:rgba(34,197,94,.1);padding:4px 8px;border-radius:6px" id="kpi-ticket-change-container"><span id="kpi-ticket-change">--</span></div>'+
      '</div>'+
      '<div style="background:#fff;border-radius:12px;padding:20px;border:1px solid var(--border)">'+
        '<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px">'+
          '<h3 style="font-size:11px;font-weight:600;color:var(--gray);text-transform:uppercase;letter-spacing:.5px" id="kpi-users-label">Nuevos Usuarios</h3>'+
          '<div style="width:36px;height:36px;border-radius:8px;background:rgba(168,85,247,.1);display:flex;align-items:center;justify-content:center;font-size:18px">👤</div>'+
        '</div>'+
        '<div style="font-size:28px;font-weight:800;color:var(--dk);margin-bottom:6px" id="kpi-users">0</div>'+
        '<div style="font-size:12px;font-weight:600;color:var(--green);display:inline-flex;align-items:center;gap:4px;background:rgba(34,197,94,.1);padding:4px 8px;border-radius:6px" id="kpi-users-change-container"><span id="kpi-users-change">--</span></div>'+
      '</div>'+
      '<div style="background:#fff;border-radius:12px;padding:20px;border:1px solid var(--border)">'+
        '<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px">'+
          '<h3 style="font-size:11px;font-weight:600;color:var(--gray);text-transform:uppercase;letter-spacing:.5px" id="kpi-profit-label">Ganancia</h3>'+
          '<div style="width:36px;height:36px;border-radius:8px;background:rgba(45,90,39,.1);display:flex;align-items:center;justify-content:center;font-size:18px">📈</div>'+
        '</div>'+
        '<div style="font-size:28px;font-weight:800;color:var(--green);margin-bottom:6px" id="kpi-profit">$0</div>'+
        '<div style="font-size:12px;font-weight:600;color:var(--gray);display:inline-flex;align-items:center;gap:4px" id="kpi-profit-usd">US$ 0</div>'+
      '</div>'+
    '</section>'+
    '<!-- Recent Orders & Top Products -->'+
    '<section style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:2rem" class="dash-row">'+
      '<div style="background:#fff;border-radius:12px;border:1px solid var(--border);overflow:hidden">'+
        '<div style="padding:16px;border-bottom:1px solid var(--border);background:var(--cream2);display:flex;justify-content:space-between;align-items:center">'+
          '<h2 style="font-size:16px;font-weight:700">Últimos Pedidos</h2>'+
        '</div>'+
        '<table style="width:100%;border-collapse:collapse">'+
          '<thead><tr style="border-bottom:1px solid var(--border)">'+
            '<th style="padding:10px 14px;text-align:left;font-size:10px;font-weight:600;color:var(--gray);text-transform:uppercase">ID</th>'+
            '<th style="padding:10px 14px;text-align:left;font-size:10px;font-weight:600;color:var(--gray);text-transform:uppercase">Cliente</th>'+
            '<th style="padding:10px 14px;text-align:left;font-size:10px;font-weight:600;color:var(--gray);text-transform:uppercase">Monto</th>'+
            '<th style="padding:10px 14px;text-align:left;font-size:10px;font-weight:600;color:var(--gray);text-transform:uppercase">Ganancia</th>'+
            '<th style="padding:10px 14px;text-align:left;font-size:10px;font-weight:600;color:var(--gray);text-transform:uppercase">Método</th>'+
            '<th style="padding:10px 14px;text-align:left;font-size:10px;font-weight:600;color:var(--gray);text-transform:uppercase">Estado</th>'+
          '</tr></thead>'+
          '<tbody id="dashboard-recent-orders"></tbody>'+
        '</table>'+
      '</div>'+
      '<div style="background:#fff;border-radius:12px;border:1px solid var(--border);padding:16px">'+
        '<h2 style="font-size:16px;font-weight:700;margin-bottom:12px">Ingresos Mensuales</h2>'+
        '<div style="position:relative;height:280px"><canvas id="revenueChart"></canvas></div>'+
      '</div>'+
    '</section>'+
    '<!-- Payment breakdown -->'+
    '<section style="margin-bottom:2rem">'+
      '<div style="background:#fff;border-radius:12px;border:1px solid var(--border);padding:16px">'+
        '<h2 style="font-size:16px;font-weight:700;margin-bottom:16px">Ventas por Método de Pago</h2>'+
        '<div id="dashboard-payment-breakdown" style="display:flex;flex-direction:column;gap:12px"></div>'+
      '</div>'+
    '</section>'+
    '<!-- Charts Row -->'+
    '<section style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px" class="dash-charts-row">'+
      '<div style="background:#fff;border-radius:12px;border:1px solid var(--border);padding:16px">'+
        '<h2 style="font-size:16px;font-weight:700;margin-bottom:12px">Pedidos por Estado</h2>'+
        '<div style="position:relative;height:260px"><canvas id="statusChart"></canvas></div>'+
      '</div>'+
      '<div style="background:#fff;border-radius:12px;border:1px solid var(--border);padding:16px">'+
        '<h2 style="font-size:16px;font-weight:700;margin-bottom:12px">Ventas por Marca</h2>'+
        '<div style="position:relative;height:260px"><canvas id="brandChart"></canvas></div>'+
      '</div>'+
      '<div style="display:flex;flex-direction:column;gap:16px">'+
        '<div style="background:#fff;border-radius:12px;padding:16px;border:1px solid var(--border)">'+
          '<h2 style="font-size:16px;font-weight:700;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border)">Productos más vendidos</h2>'+
          '<ul id="dashboard-top-products" style="list-style:none;padding:0;margin:0"></ul>'+
        '</div>'+
        '<div style="background:#fff;border-radius:12px;padding:16px;border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.03)">'+
          '<h2 style="font-size:16px;font-weight:700;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid rgba(239,68,68,.2);display:flex;align-items:center;gap:8px">⚠️ Alertas de Stock</h2>'+
          '<ul id="dashboard-stock-alerts" style="list-style:none;padding:0;margin:0"></ul>'+
        '</div>'+
      '</div>'+
    '</section>'+
  '</div>';

  window.dashView='mensual';
  window.dashMonth=new Date().getMonth();
  loadDashboard();
}


// Polling helper: waits for admin.js to load before calling function
function waitForAdmin(fnName){
  var btn=this&&this.nodeType?this:null;
  if(window.__adminLoaded&&typeof window[fnName]==='function'){window[fnName]();return;}
  if(!btn){setTimeout(function(){waitForAdmin(fnName);},200);return;}
  var orig=btn.getAttribute('data-orig-text')||btn.textContent;
  btn.setAttribute('data-orig-text',orig);
  btn.textContent='Cargando...';btn.disabled=true;
  var iv=setInterval(function(){
    if(window.__adminLoaded&&typeof window[fnName]==='function'){
      clearInterval(iv);btn.textContent=orig;btn.disabled=false;window[fnName]();
    }
  },200);
  setTimeout(function(){clearInterval(iv);btn.textContent=orig;btn.disabled=false;},15000);
}

// =========== ADMIN PRODUCT CARDS (search + filters + full info) ===========
window.admProdFilter='all';
function setAdmProdFilter(type,btn){
  window.admProdFilter=type;
  document.querySelectorAll('#adm-prods-quickfilters .ord-btn').forEach(function(b){b.classList.remove('ord-btn-act');});
  if(btn)btn.classList.add('ord-btn-act');
  renderAdminProductsFiltered(document.getElementById('adminProdSearch').value);
}
function renderAdminProductsFiltered(q){
  var grid=document.getElementById('admin-prods-grid');
  if(!grid)return;
  q=(q||'').toLowerCase().trim();
  var sort=document.getElementById('admProdsSort')?document.getElementById('admProdsSort').value:'name';
  var list=PRODUCTS.filter(function(p){
    if(p.isPreorder)return false;
    var matchesQ=!q||(p.name||'').toLowerCase().indexOf(q)>=0||(p.sub||'').toLowerCase().indexOf(q)>=0||(p.brand||'').toLowerCase().indexOf(q)>=0;
    if(!matchesQ)return false;
    if(window.admProdFilter==='offer')return !!p.isOffer;
    if(window.admProdFilter==='nostock')return p.stock<=0;
    if(window.admProdFilter==='low')return p.stock>0&&p.stock<=3;
    return true;
  });
  list.sort(function(a,b){
    if(sort==='price')return a.price-b.price;
    if(sort==='cost')return a.cost-b.cost;
    if(sort==='profit')return (a.price-a.cost)-(b.price-b.cost);
    if(sort==='stock')return a.stock-b.stock;
    return (a.name||'').localeCompare(b.name||'');
  });
  var title=document.getElementById('adm-prods-title');
  if(title)title.textContent='Productos ('+list.length+(q?' / '+PRODUCTS.length:'')+')';
  if(!list.length){
    grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--gray)"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".5" style="display:block;margin:0 auto .5rem" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><p>No se encontraron productos</p></div>';
    return;
  }
  grid.innerHTML=list.map(function(p){return renderAdminProductCard(p);}).join('');
}

function renderAdminProductCard(p){
  var lowStock=p.stock<=0;
  var stockColor=lowStock?'var(--red)':(p.stock<=3?'var(--orange)':'var(--green)');
  var profit=p.price-(p.cost||0);
  var usd=window.dolarRate>0?Math.round(p.price/window.dolarRate):0;
  var imgHtml=p.imageUrl?'<img loading="lazy" src="'+p.imageUrl+'" style="width:100%;height:100%;object-fit:cover">':'<span style="font-size:32px">📱</span>';
  var badgeHtml='';
  if(p.isOffer){badgeHtml+='<span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:10px;background:rgba(192,57,43,.12);color:var(--red)">OFERTA'+(p.discount?(' -'+p.discount+'%'):'')+'</span>';}
  if(p.repairItemIds && p.repairItemIds.length > 0){badgeHtml+='<span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:10px;background:rgba(255,107,44,.12);color:var(--orange)">EN REPARACIÓN</span>';}
  if(lowStock){badgeHtml+='<span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:10px;background:rgba(192,57,43,.12);color:var(--red)">SIN STOCK</span>';}
  else if(p.stock<=3){badgeHtml+='<span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:10px;background:rgba(255,107,44,.12);color:var(--orange)">STOCK BAJO</span>';}
  return '<div style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid '+(lowStock?'var(--red)':'var(--border)')+';transition:all .2s" onmouseover="this.style.boxShadow=\'0 6px 20px rgba(0,0,0,.12)\'" onmouseout="this.style.boxShadow=\'none\'">'+
    '<div style="height:120px;background:var(--cream2);display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative">'+imgHtml+
      (badgeHtml?'<div style="position:absolute;top:8px;left:8px;display:flex;gap:4px;flex-wrap:wrap;max-width:90%">'+badgeHtml+'</div>':'')+
    '</div>'+
    '<div style="padding:11px;display:flex;flex-direction:column">'+
      '<div style="font-weight:600;font-size:13px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escapeHtml(p.name||'')+'</div>'+
      '<div style="font-size:10px;color:var(--gray);margin-bottom:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(p.sub||'')+'</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">'+
        '<div style="background:var(--cream2);border-radius:8px;padding:7px;min-width:0">'+
          '<div style="font-size:8px;text-transform:uppercase;letter-spacing:.5px;color:var(--gray);margin-bottom:2px">Venta</div>'+
          '<div style="font-size:14px;font-weight:800;color:var(--orange);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+fmt(p.price)+'</div>'+
        '</div>'+
        '<div style="background:var(--cream2);border-radius:8px;padding:7px;min-width:0">'+
          '<div style="font-size:8px;text-transform:uppercase;letter-spacing:.5px;color:var(--gray);margin-bottom:2px">Costo</div>'+
          '<div style="font-size:14px;font-weight:800;color:var(--dk);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+fmt(p.cost||0)+'</div>'+
        '</div>'+
        '<div style="background:rgba(45,90,39,.08);border-radius:8px;padding:7px;min-width:0">'+
          '<div style="font-size:8px;text-transform:uppercase;letter-spacing:.5px;color:var(--gray);margin-bottom:2px">Ganancia</div>'+
          '<div style="font-size:14px;font-weight:800;color:var(--green);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+fmt(profit)+'</div>'+
        '</div>'+
        '<div style="background:rgba(255,107,44,.08);border-radius:8px;padding:7px;min-width:0">'+
          '<div style="font-size:8px;text-transform:uppercase;letter-spacing:.5px;color:var(--gray);margin-bottom:2px">USD</div>'+
          '<div style="font-size:14px;font-weight:800;color:var(--orange);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(usd>0?('US$ '+usd.toLocaleString('es-AR')):'—')+'</div>'+
        '</div>'+
      '</div>'+
      '<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:rgba(0,0,0,.03);border-radius:8px;margin-bottom:10px">'+
        '<span style="font-size:10px;color:var(--gray)">Stock:</span>'+
        '<span style="font-size:13px;font-weight:800;color:'+stockColor+'">'+p.stock+'</span>'+
      '</div>'+
      '<div style="display:flex;gap:4px;margin-top:auto;flex-wrap:wrap">'+
        (p.repairItemIds&&p.repairItemIds.length>0?'<button class="btn btn-g btn-sm" style="flex:1;min-width:0;font-size:10px;padding:6px 4px" onclick="markItemAsReady(\''+p.repairItemIds[0]+'\')">Listo ✓</button>':'')+
        '<button class="btn btn-g btn-sm" style="flex:1;min-width:0;font-size:10px;padding:6px 4px" onclick="editProduct(\''+p.id+'\')">Editar</button>'+
        '<button class="btn btn-o btn-sm" style="flex:1;min-width:0;font-size:10px;padding:6px 4px" onclick="duplicateProduct(\''+p.id+'\')">Duplicar</button>'+
        '<button class="btn btn-o btn-sm" style="flex:1;min-width:0;font-size:10px;padding:6px 4px" onclick="deleteProduct(\''+p.id+'\')">Eliminar</button>'+
        '<button class="btn btn-sm" style="flex:1;min-width:0;font-size:10px;padding:6px 4px;background:#1A1A2E;color:#fff" onclick="downloadProductQr(\''+p.id+'\')">⬇ QR</button>'+
      '</div>'+
    '</div>'+
  '</div>';
}

// =========== ADMIN ACCESSORY CARDS (search + filters + full info) ===========
window.admAccFilter='all';
function setAdmAccFilter(type,btn){
  window.admAccFilter=type;
  document.querySelectorAll('#adm-acc-quickfilters .ord-btn').forEach(function(b){b.classList.remove('ord-btn-act');});
  if(btn)btn.classList.add('ord-btn-act');
  renderAdminAccFiltered(document.getElementById('adminAccSearch').value);
}
function renderAdminAccFiltered(q){
  var grid=document.getElementById('admin-acc-grid');
  if(!grid)return;
  q=(q||'').toLowerCase().trim();
  var sort=document.getElementById('admAccSort')?document.getElementById('admAccSort').value:'name';
  var list=(window.ACCS||[]).filter(function(a){
    var matchesQ=!q||(a.name||'').toLowerCase().indexOf(q)>=0||(a.category||'').toLowerCase().indexOf(q)>=0||(a.brand||'').toLowerCase().indexOf(q)>=0;
    if(!matchesQ)return false;
    if(window.admAccFilter==='offer')return !!a.isOffer;
    if(window.admAccFilter==='nostock')return a.stock<=0;
    if(window.admAccFilter==='low')return a.stock>0&&a.stock<=3;
    return true;
  });
  list.sort(function(a,b){
    if(sort==='price')return a.price-b.price;
    if(sort==='stock')return a.stock-b.stock;
    return (a.name||'').localeCompare(b.name||'');
  });
  var title=document.getElementById('adm-acc-title');
  if(title)title.textContent='Accesorios ('+list.length+(q?' / '+(window.ACCS||[]).length:'')+')';
  if(!list.length){
    grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--gray)"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".5" style="display:block;margin:0 auto .5rem" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><p>No se encontraron accesorios</p></div>';
    return;
  }
  grid.innerHTML=list.map(function(a){return renderAdminAccCard(a);}).join('');
}

function renderAdminAccCard(a){
  var lowStock=a.stock<=0;
  var stockColor=lowStock?'var(--red)':(a.stock<=3?'var(--orange)':'var(--green)');
  var usd=window.dolarRate>0?Math.round(a.price/window.dolarRate):0;
  var imgHtml=a.imageUrl?'<img loading="lazy" src="'+a.imageUrl+'" style="width:100%;height:100%;object-fit:cover">':'<span style="font-size:32px">'+(a.ico||'📦')+'</span>';
  var badgeHtml='';
  if(a.isOffer){badgeHtml+='<span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:10px;background:rgba(192,57,43,.12);color:var(--red)">OFERTA'+(a.discount?(' -'+a.discount+'%'):'')+'</span>';}
  if(a.modelGroup){
    var varCount=(window.ACCS||[]).filter(function(acc){return acc.modelGroup===a.modelGroup;}).length;
    if(varCount>1)badgeHtml+='<span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:10px;background:rgba(139,92,246,.12);color:#8b5cf6">'+varCount+' var.</span>';
  }
  if(lowStock){badgeHtml+='<span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:10px;background:rgba(192,57,43,.12);color:var(--red)">SIN STOCK</span>';}
  else if(a.stock<=3){badgeHtml+='<span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:10px;background:rgba(255,107,44,.12);color:var(--orange)">STOCK BAJO</span>';}
  return '<div style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid '+(lowStock?'var(--red)':'var(--border)')+';transition:all .2s" onmouseover="this.style.boxShadow=\'0 6px 20px rgba(0,0,0,.12)\'" onmouseout="this.style.boxShadow=\'none\'">'+
    '<div style="height:120px;background:var(--cream2);display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative">'+imgHtml+
      (badgeHtml?'<div style="position:absolute;top:8px;left:8px;display:flex;gap:4px;flex-wrap:wrap;max-width:90%">'+badgeHtml+'</div>':'')+
    '</div>'+
    '<div style="padding:11px;display:flex;flex-direction:column">'+
      '<div style="font-weight:600;font-size:13px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escapeHtml(a.name||'')+'</div>'+
      '<div style="font-size:10px;color:var(--gray);margin-bottom:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(a.category||'')+'</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">'+
        '<div style="background:var(--cream2);border-radius:8px;padding:7px;min-width:0">'+
          '<div style="font-size:8px;text-transform:uppercase;letter-spacing:.5px;color:var(--gray);margin-bottom:2px">Venta</div>'+
          '<div style="font-size:14px;font-weight:800;color:var(--orange);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+fmt(a.price)+'</div>'+
        '</div>'+
        '<div style="background:rgba(255,107,44,.08);border-radius:8px;padding:7px;min-width:0">'+
          '<div style="font-size:8px;text-transform:uppercase;letter-spacing:.5px;color:var(--gray);margin-bottom:2px">USD</div>'+
          '<div style="font-size:14px;font-weight:800;color:var(--orange);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(usd>0?('US$ '+usd.toLocaleString('es-AR')):'—')+'</div>'+
        '</div>'+
      '</div>'+
      '<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:rgba(0,0,0,.03);border-radius:8px;margin-bottom:10px">'+
        '<span style="font-size:10px;color:var(--gray)">Stock:</span>'+
        '<span style="font-size:13px;font-weight:800;color:'+stockColor+'">'+a.stock+'</span>'+
      '</div>'+
      '<div style="display:flex;gap:6px;margin-top:auto">'+
        '<button class="btn btn-g btn-sm" style="flex:1" onclick="editAccessory(\''+a.id+'\')">Editar</button>'+
        '<button class="btn btn-o btn-sm" style="flex:1" onclick="deleteAccessory(\''+a.id+'\')">Eliminar</button>'+
      '</div>'+
    '</div>'+
  '</div>';
}

function updateStock(id){
  var newStock=parseInt(document.getElementById('stock-'+id).value)||0;
  var p=getById(PRODUCTS,id);
  if(!p)return;
  fetch(API_URL+'/api/products/'+id,{
    method:'PUT',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({stock:newStock})
  }).then(function(){
    loadProducts();
  }).catch(function(){showErrorToast('Error', 'No se pudo actualizar el stock');});
}
function adjustStock(id,delta){
  var input=document.getElementById('stock-'+id);
  var newVal=Math.max(0,parseInt(input.value)+delta);
  input.value=newVal;
}
function saveAllStock(){
  var inputs=document.querySelectorAll('[id^="stock-"]');
  var promises=[];
  inputs.forEach(function(input){
    var id=input.id.replace('stock-','');
    var newStock=parseInt(input.value)||0;
    var original=parseInt(input.getAttribute('data-original'));
    if(newStock!==original){
      var isAcc=id.startsWith('acc-');
      var realId=isAcc?id.replace('acc-',''):id;
      var endpoint=isAcc?'/api/accessories?id='+realId:'/api/products/'+realId;
      promises.push(fetch(API_URL+endpoint,{
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({stock:newStock})
      }));
    }
  });
  Promise.all(promises).then(function(){
    inputs.forEach(function(input){
      var id=input.id.replace('stock-','');
      var newStock=parseInt(input.value)||0;
      var isAcc=id.startsWith('acc-');
      var realId=isAcc?id.replace('acc-',''):id;
      var p=getById(PRODUCTS,realId);
      if(p)p.stock=newStock;
      var a=getById(window.ACCS,realId);
      if(a)a.stock=newStock;
      input.setAttribute('data-original',input.value);
    });
    renderStockList();
    showSuccessToast('Stock guardado', 'Los cambios han sido guardados correctamente');
  }).catch(function(){showErrorToast('Error', 'No se pudo guardar el stock');});
}
function undoAllStock(){
  var inputs=document.querySelectorAll('[id^="stock-"]');
  inputs.forEach(function(input){
    input.value=input.getAttribute('data-original');
  });
  showInfoToast('Cambios revertidos', 'Se han deshecho los cambios');
}
function markItemAsReady(inventoryItemId){
  fetch(API_URL+'/api/inventory/'+inventoryItemId+'/status',{
    method:'PATCH',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({status:'IN_STOCK'})
  }).then(function(r){
    if(!r.ok)throw new Error('Error '+r.status);
    return r.json();
  }).then(function(item){
    invalidateCache('/api/products');
    showSuccessToast('Listo', 'Equipo marcado como disponible');
    loadProducts().then(function(){
      renderAdminProductsFiltered(document.getElementById('adminProdSearch')?document.getElementById('adminProdSearch').value:'');
    });
  }).catch(function(e){
    console.error('Error marking item as ready:', e);
    showErrorToast('Error', 'No se pudo marcar el equipo como listo');
  });
}
function renderStockList(){
  var list=document.getElementById('stockList');
  if(!list)return;
  var filterType=window._stockType||'todos';
  var filterBrand=document.getElementById('stockFilterBrand')?document.getElementById('stockFilterBrand').value:'';
  var items=[];
  if(filterType==='todos'||filterType==='productos'){
    PRODUCTS.forEach(function(p){
      if(p.isPreorder)return;
      if(filterBrand&&p.brand!==filterBrand)return;
      items.push({id:p.id,name:p.name,sub:p.sub||'',stock:p.stock,type:'producto',ico:p.ico||'📱',brand:p.brand,imageUrl:p.imageUrl});
    });
  }
  if(filterType==='todos'||filterType==='accesorios'){
    (window.ACCS||[]).forEach(function(a){
      if(filterBrand&&a.brand!==filterBrand)return;
      items.push({id:a.id,name:a.name,sub:a.category||'',stock:a.stock,type:'accesorio',ico:a.ico||'📦',brand:a.brand,imageUrl:a.imageUrl});
    });
  }
  // Update stats
  var totalLabel=document.getElementById('stockTotalLabel');
  if(totalLabel)totalLabel.textContent=items.length+' items';
  var statsRow=document.getElementById('stockStatsRow');
  if(statsRow){
    var crit=items.filter(function(i){return i.stock<=0;}).length;
    var low=items.filter(function(i){return i.stock>0&&i.stock<=3;}).length;
    var ok=items.length-crit-low;
    statsRow.innerHTML=
      '<div style="flex:1;background:#fff;border:1px solid var(--border);border-radius:10px;padding:12px 16px;display:flex;align-items:center;gap:10px">'+
        '<div style="width:36px;height:36px;border-radius:10px;background:rgba(45,90,39,.1);display:flex;align-items:center;justify-content:center;font-size:16px">✔</div>'+
        '<div><div style="font-size:18px;font-weight:800;color:var(--green)">'+ok+'</div><div style="font-size:10px;color:var(--gray);margin-top:1px">En stock</div></div>'+
      '</div>'+
      '<div style="flex:1;background:#fff;border:1px solid var(--border);border-radius:10px;padding:12px 16px;display:flex;align-items:center;gap:10px">'+
        '<div style="width:36px;height:36px;border-radius:10px;background:rgba(255,107,44,.1);display:flex;align-items:center;justify-content:center;font-size:16px">⚠</div>'+
        '<div><div style="font-size:18px;font-weight:800;color:var(--orange)">'+low+'</div><div style="font-size:10px;color:var(--gray);margin-top:1px">Stock bajo</div></div>'+
      '</div>'+
      '<div style="flex:1;background:#fff;border:1px solid var(--border);border-radius:10px;padding:12px 16px;display:flex;align-items:center;gap:10px">'+
        '<div style="width:36px;height:36px;border-radius:10px;background:rgba(192,57,43,.1);display:flex;align-items:center;justify-content:center;font-size:16px">✕</div>'+
        '<div><div style="font-size:18px;font-weight:800;color:var(--red)">'+crit+'</div><div style="font-size:10px;color:var(--gray);margin-top:1px">Sin stock</div></div>'+
      '</div>';
  }
  var page=window._stockPage||1;
  var limit=window._stockLimit||20;
  var totalPages=Math.ceil(items.length/limit);
  var start=(page-1)*limit;
  var end=start+limit;
  var pageItems=items.slice(start,end);
  list.innerHTML=pageItems.map(function(item){
    var lowStock=item.stock<=0;
    var medStock=item.stock>0&&item.stock<=3;
    var warning=item.stock>3&&item.stock<=5;
    var borderColor=lowStock?'var(--red)':medStock?'var(--red)':warning?'var(--orange)':'var(--border)';
    var barColor=lowStock?'var(--red)':medStock?'var(--red)':warning?'var(--orange)':'var(--green)';
    var barPct=Math.min(100,Math.round((item.stock/15)*100));
    var statusLabel=lowStock?'Sin stock':medStock?'Crítico':warning?'Bajo':'Normal';
    var stockId=item.type==='accesorio'?'acc-'+item.id:item.id;
    return '<div style="display:flex;align-items:center;gap:14px;padding:14px 16px;background:#fff;border-radius:12px;border:1px solid '+borderColor+';transition:all .2s" onmouseover="this.style.boxShadow=\'0 4px 16px rgba(0,0,0,.06)\'" onmouseout="this.style.boxShadow=\'none\'">'+
      '<div style="width:44px;height:44px;border-radius:10px;background:var(--cream2);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;overflow:hidden">'+(item.imageUrl?'<img loading="lazy" src="'+item.imageUrl+'" style="width:100%;height:100%;object-fit:cover">':'<span style="font-size:22px">'+item.ico+'</span>')+'</div>'+
      '<div style="flex:1;min-width:0">'+
        '<div style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+item.name+'</div>'+
        '<div style="display:flex;align-items:center;gap:6px;margin-top:3px">'+
          '<span style="font-size:10px;color:var(--gray)">'+item.sub+'</span>'+
          '<span style="font-size:8px;font-weight:600;padding:1px 6px;border-radius:3px;background:var(--cream2);color:var(--gray)">'+item.type+'</span>'+
        '</div>'+
        '<div style="margin-top:6px;display:flex;align-items:center;gap:8px">'+
          '<div style="flex:1;height:5px;background:var(--cream2);border-radius:3px;overflow:hidden;max-width:100px">'+
            '<div style="height:100%;width:'+barPct+'%;background:'+barColor+';border-radius:3px;transition:width .3s"></div>'+
          '</div>'+
          '<span style="font-size:10px;font-weight:600;color:'+barColor+'">'+statusLabel+'</span>'+
        '</div>'+
      '</div>'+
      '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">'+
        '<button onclick="adjustStock(\''+stockId+'\',-1)" style="width:30px;height:30px;border:1.5px solid var(--border);border-radius:8px;background:#fff;font-size:16px;font-weight:700;cursor:pointer;transition:all .12s;display:flex;align-items:center;justify-content:center;color:var(--dk);line-height:1" onmouseover="this.style.borderColor=\'var(--orange)\';this.style.color=\'var(--orange)\'" onmouseout="this.style.borderColor=\'var(--border)\';this.style.color=\'var(--dk)\'">−</button>'+
        '<input type="number" id="stock-'+stockId+'" data-original="'+item.stock+'" value="'+item.stock+'" min="0" style="width:52px;padding:7px 4px;border:1.5px solid '+borderColor+';border-radius:8px;font-size:15px;text-align:center;font-weight:700;outline:none;background:#fff;color:'+barColor+';transition:border-color .15s" onfocus="this.style.borderColor=\'var(--orange)\'" onblur="this.style.borderColor=\''+borderColor+'\'">'+
        '<button onclick="adjustStock(\''+stockId+'\',1)" style="width:30px;height:30px;border:1.5px solid var(--border);border-radius:8px;background:#fff;font-size:16px;font-weight:700;cursor:pointer;transition:all .12s;display:flex;align-items:center;justify-content:center;color:var(--dk);line-height:1" onmouseover="this.style.borderColor=\'var(--orange)\';this.style.color=\'var(--orange)\'" onmouseout="this.style.borderColor=\'var(--border)\';this.style.color=\'var(--dk)\'">+</button>'+
      '</div>'+
    '</div>';
  }).join('');
  var pagContainer=document.getElementById('stockPagination');
  if(pagContainer){
    if(totalPages<=1){pagContainer.innerHTML='';return;}
    var html='<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:1.25rem;padding:.75rem;border-top:1px solid var(--border)">'+
      '<button onclick="window._stockPage=Math.max(1,window._stockPage-1);renderStockList();"'+(page===1?' disabled':'')+
        ' style="padding:8px 14px;border:1px solid '+(page===1?'var(--border)':'var(--border)')+';border-radius:8px;background:'+(page===1?'var(--cream2)':'#fff')+';font-size:13px;cursor:'+(page===1?'not-allowed':'pointer')+';opacity:'+(page===1?'.4':'1')+'">← Anterior</button>';
    var s=Math.max(1,page-2);
    var e=Math.min(totalPages,page+2);
    for(var i=s;i<=e;i++){
      if(i===page)html+='<span style="padding:8px 14px;border-radius:8px;background:var(--orange);color:#fff;font-size:13px;font-weight:700">'+i+'</span>';
      else html+='<button onclick="window._stockPage='+i+';renderStockList();" style="padding:8px 14px;border:1px solid var(--border);border-radius:8px;background:#fff;font-size:13px;cursor:pointer;transition:all .12s" onmouseover="this.style.borderColor=\'var(--orange)\'" onmouseout="this.style.borderColor=\'var(--border)\'">'+i+'</button>';
    }
    html+='<button onclick="window._stockPage=Math.min('+totalPages+',window._stockPage+1);renderStockList();"'+(page===totalPages?' disabled':'')+
      ' style="padding:8px 14px;border:1px solid '+(page===totalPages?'var(--border)':'var(--border)')+';border-radius:8px;background:'+(page===totalPages?'var(--cream2)':'#fff')+';font-size:13px;cursor:'+(page===totalPages?'not-allowed':'pointer')+';opacity:'+(page===totalPages?'.4':'1')+'">Siguiente →</button>'+
    '</div>';
    pagContainer.innerHTML=html;
  }
}
function renderPromoProducts(){
  var brand=document.getElementById('promoBrand').value;
  var typeFilter=document.getElementById('promoType').value;
  var itemType=document.getElementById('promoItemType')?document.getElementById('promoItemType').value:'todos';
  var searchQ=(document.getElementById('promoSearch')?document.getElementById('promoSearch').value:'').toLowerCase().trim();
  var list=document.getElementById('promoProductList');
  if(!list)return;
  var items=[];
  if(itemType==='todos'||itemType==='productos'){
    PRODUCTS.forEach(function(p){
      if(brand&&p.brand!==brand)return;
      if(typeFilter&&p.type!==typeFilter)return;
      if(searchQ&&(p.name||'').toLowerCase().indexOf(searchQ)<0)return;
      items.push({id:p.id,name:p.name,brand:p.brand,price:p.price,isOffer:p.isOffer,discount:p.discount,imageUrl:p.imageUrl,type:'producto',ico:p.ico||'📱',color:p.color||null});
    });
  }
  if(itemType==='todos'||itemType==='accesorios'){
    (window.ACCS||[]).forEach(function(a){
      if(brand&&a.brand!==brand)return;
      if(typeFilter&&a.category!==typeFilter)return;
      if(searchQ&&(a.name||'').toLowerCase().indexOf(searchQ)<0)return;
      items.push({id:a.id,name:a.name,brand:a.brand,price:a.price,isOffer:a.isOffer,discount:a.discount,imageUrl:a.imageUrl,type:'accesorio',ico:a.ico||'📦',color:a.color||null});
    });
  }
  list.innerHTML=items.map(function(item){
    var chkId=item.type==='accesorio'?'promo-chk-acc-'+item.id:'promo-chk-'+item.id;
    var isSelected=document.getElementById(chkId)?.checked;
    return'<div style="background:#fff;border-radius:12px;padding:10px;border:1px solid '+(isSelected?'var(--orange)':'var(--border)')+';cursor:pointer;transition:all .2s;position:relative'+(isSelected?';box-shadow:0 2px 8px rgba(255,107,44,0.2)':'')+'" onclick="togglePromoProduct(\''+item.id+'\')">'+
      '<div style="position:absolute;top:6px;right:6px;z-index:10">'+
        '<input type="checkbox" id="'+chkId+'" '+(isSelected?'checked':'')+' style="width:16px;height:16px;border-radius:4px;border:2px solid var(--border);cursor:pointer" onclick="event.stopPropagation()">'+
      '</div>'+
      '<div style="aspect-ratio:1;border-radius:8px;overflow:hidden;margin-bottom:8px;background:var(--cream2);display:flex;align-items:center;justify-content:center">'+
        (item.imageUrl?'<img loading="lazy" src="'+item.imageUrl+'" style="width:100%;height:100%;object-fit:cover">':'<span style="font-size:28px">'+item.ico+'</span>')+
      '</div>'+
      '<div style="margin-bottom:2px">'+
        '<div style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--orange)">'+item.brand+' <span style="color:var(--gray);font-weight:400">['+item.type+']</span></div>'+
        '<div style="font-size:11px;font-weight:600;color:var(--dk);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+item.name+'</div>'+
        (item.color?'<div style="display:flex;align-items:center;gap:4px;margin-top:2px"><span style="width:9px;height:9px;border-radius:50%;background:'+_cssColor(item.color)+';border:1px solid rgba(0,0,0,.15);flex-shrink:0"></span><span style="font-size:10px;color:var(--gray)">'+item.color+'</span></div>':'')+
      '</div>'+
      '<div style="display:flex;align-items:center;gap:4px">'+
        '<span style="font-size:12px;font-weight:700;color:var(--dk)">'+fmt(item.price)+'</span>'+
        (item.isOffer?'<span style="font-size:9px;color:var(--red);font-weight:700;background:rgba(255,0,0,0.05);padding:2px 6px;border-radius:8px">-'+item.discount+'%</span>':'')+
      '</div>'+
      '</div>';
  }).join('');
  var rail=document.getElementById('homeRail');if(rail&&!rail.dataset.svRevealed){rail.classList.add('pgrid-reveal');rail.dataset.svRevealed='1';}else if(rail){rail.classList.remove('pgrid-reveal');}
}
function togglePromoProduct(id){
  var isAcc=getById(window.ACCS||[],id)?true:false;
  var chkId=isAcc?'promo-chk-acc-'+id:'promo-chk-'+id;
  var chk=document.getElementById(chkId);
  if(chk)chk.checked=!chk.checked;
  renderPromoProducts();
}
function selectAllPromo(selectAll){
  var brand=document.getElementById('promoBrand').value;
  var type=document.getElementById('promoType').value;
  var itemType=document.getElementById('promoItemType')?document.getElementById('promoItemType').value:'todos';
  if(itemType==='todos'||itemType==='productos'){
    var filtered=PRODUCTS.filter(function(p){
      return(!brand||p.brand===brand)&&(!type||p.type===type);
    });
    filtered.forEach(function(p){
      var chk=document.getElementById('promo-chk-'+p.id);
      if(chk)chk.checked=selectAll;
    });
  }
  if(itemType==='todos'||itemType==='accesorios'){
    var filteredAcc=(window.ACCS||[]).filter(function(a){
      return(!brand||a.brand===brand)&&(!type||a.category===type);
    });
    filteredAcc.forEach(function(a){
      var chk=document.getElementById('promo-chk-acc-'+a.id);
      if(chk)chk.checked=selectAll;
    });
  }
  renderPromoProducts();
}
function applyPromo(){
  var discount=parseInt(document.getElementById('promoDiscount').value)||0;
  if(discount<=0){showAlert('Descuento inválido', 'Ingresa un descuento mayor a 0', 'warning');return;}
  var checkboxes=document.querySelectorAll('[id^="promo-chk-"]:checked');
  if(checkboxes.length===0){showAlert('Selección requerida', 'Selecciona al menos un producto', 'warning');return;}
  var offerStart=promoDatetimeLocal('promoOfferStartDate');
  var offerEnd=promoDatetimeLocal('promoOfferEndDate');
  var promises=[];
  var prodCount=0,accCount=0;
  checkboxes.forEach(function(chk){
    var rawId=chk.id.replace('promo-chk-','');
    var isAcc=rawId.startsWith('acc-');
    var realId=isAcc?rawId.replace('acc-',''):rawId;
    var endpoint=isAcc?'/api/accessories?id='+realId:'/api/products/'+realId;
    if(isAcc)accCount++;else prodCount++;
    var body={discount:discount,isOffer:discount>0};
    if(offerStart)body.offerStart=offerStart;
    if(offerEnd)body.offerEnd=offerEnd;
    promises.push(fetch(API_URL+endpoint,{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body)
    }));
  });
  Promise.all(promises).then(function(){
    // Devolver la promesa de refreshAdmin para esperar a que se actualicen los datos
    // antes de mostrar el toast, asi el usuario ve los cambios inmediatamente.
    var p=refreshAdmin();
    var done=function(){
      var msg='Promo aplicada';
      if(prodCount>0&&accCount>0)msg+=' a '+prodCount+' producto(s) y '+accCount+' accesorio(s)';
      else if(prodCount>0)msg+=' a '+prodCount+' producto(s)';
      else if(accCount>0)msg+=' a '+accCount+' accesorio(s)';
      showSuccessToast('Promoción aplicada', msg);
    };
    if(p&&typeof p.then==='function')p.then(done);else done();
  }).catch(function(){showErrorToast('Error', 'No se pudo aplicar la promoción');});
}
function renderActivePromos(){
  var tbody=document.getElementById('activePromosTable');
  var filterType=document.getElementById('activePromoFilterType')?.value||'todos';
  var filterBrand=document.getElementById('activePromoFilterBrand')?.value||'';
  var filterStatus=document.getElementById('promoFilterStatus')?.value||'';
  if(!tbody)return;
  var now=new Date();
  var allOffers=[];
  if(filterType==='todos'||filterType==='productos'){
    PRODUCTS.filter(function(p){return isOfferValid(p);}).forEach(function(p){
      allOffers.push({id:p.id,name:p.name,sub:p.sub,brand:p.brand,discount:p.discount,imageUrl:p.imageUrl,type:'producto',ico:p.ico||'\uD83D\uDCF1',offerStart:p.offerStart,offerEnd:p.offerEnd});
    });
  }
  if(filterType==='todos'||filterType==='accesorios'){
    (window.ACCS||[]).filter(function(a){return isOfferValid(a);}).forEach(function(a){
      allOffers.push({id:a.id,name:a.name,sub:a.category||'',brand:a.brand,discount:a.discount,imageUrl:a.imageUrl,type:'accesorio',ico:a.ico||'\uD83D\uDCE6',offerStart:a.offerStart,offerEnd:a.offerEnd});
    });
  }
  var offers=allOffers.filter(function(p){
    if(filterBrand&&p.brand!==filterBrand)return false;
    if(filterStatus==='activa'){var oe2=p.offerEnd?new Date(p.offerEnd):null;var os2=p.offerStart?new Date(p.offerStart):null;if(os2&&os2>new Date())return false;if(oe2&&oe2<=new Date())return false;}
    if(filterStatus==='programada'){var ps=p.offerStart?new Date(p.offerStart):null;if(!ps||ps<=new Date())return false;}
    return true;
  });
  
  var brands=[...new Set(allOffers.map(function(p){return p.brand;}).filter(function(b){return b;}))];
  
  tbody.innerHTML='<tr>'+
    '<td colspan="6" style="padding:16px;background:var(--cream2);border-bottom:1px solid var(--border)">'+
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'+
        '<select id="activePromoFilterType" onchange="renderActivePromos()" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px">'+
          '<option value="todos" '+(filterType==='todos'?'selected':'')+'>Todos</option>'+
          '<option value="productos" '+(filterType==='productos'?'selected':'')+'>Productos</option>'+
          '<option value="accesorios" '+(filterType==='accesorios'?'selected':'')+'>Accesorios</option>'+
        '</select>'+
        '<select id="activePromoFilterBrand" onchange="renderActivePromos()" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px">'+
          '<option value="" '+(filterBrand===''?'selected':'')+'>Todas las marcas</option>'+brands.map(function(b){return'<option value="'+b+'" '+(filterBrand===b?'selected':'')+'>'+b+'</option>';}).join('')+
        '</select>'+
        '<select id="promoFilterStatus" onchange="renderActivePromos()" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px">'+
          '<option value="" '+(filterStatus===''?'selected':'')+'>Todos los estados</option>'+
          '<option value="activa" '+(filterStatus==='activa'?'selected':'')+'>Activas</option>'+
          '<option value="programada" '+(filterStatus==='programada'?'selected':'')+'>Programadas</option>'+
        '</select>'+
        '<button onclick="toggleSelectAllPromos(true)" style="padding:8px 16px;background:var(--green);color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer">Seleccionar todas</button>'+
        '<button onclick="toggleSelectAllPromos(false)" style="padding:8px 16px;background:var(--cream2);color:var(--dk);border:1px solid var(--border);border-radius:8px;font-size:12px;font-weight:600;cursor:pointer">Deseleccionar todas</button>'+
      '</div>'+
    '</td>'+
  '</tr>';
  
  if(offers.length===0){
    tbody.innerHTML+='<tr><td colspan="6" style="padding:32px;text-align:center;color:var(--gray)">No hay promociones activas</td></tr>';
    return;
  }
  tbody.innerHTML+=offers.map(function(p){
    var chkVal=p.type==='accesorio'?'acc-'+p.id:p.id;
    var now=new Date();
    var offerEnd=p.offerEnd?new Date(p.offerEnd):null;
    var offerStart=p.offerStart?new Date(p.offerStart):null;
    var isScheduled=!!offerStart&&offerStart>now;
    var isActive=true;
    if(offerEnd&&offerEnd<=now)isActive=false;
    if(offerStart&&offerStart>now)isActive=false;
    if(!offerEnd&&!offerStart)isActive=true;
    var statusHtml='';
    if(isScheduled){statusHtml='<span style="background:rgba(245,158,11,.1);color:#d97706;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700">PROGRAMADA</span>';}
    else if(isActive){statusHtml='<span style="background:rgba(45,90,39,.1);color:var(--green);padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700">ACTIVA</span>';}
    else{statusHtml='<span style="background:rgba(192,57,43,.1);color:var(--red);padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700">VENCIDA</span>';}
    var endDateStr=offerEnd?offerEnd.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'2-digit'}):'';
    var endTimeStr=offerEnd?offerEnd.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}):'';
    return'<tr onclick="togglePromoRow(\''+chkVal+'\')" style="border-top:1px solid var(--border);cursor:pointer;transition:background .15s" onmouseover="this.style.background=\'var(--cream)\'" onmouseout="this.style.background=\'transparent\'">'+
      '<td style="padding:12px;width:40px">'+
        '<input type="checkbox" class="promo-del-chk" value="'+chkVal+'" style="width:18px;height:18px;cursor:pointer" onclick="event.stopPropagation()">'+
      '</td>'+
      '<td style="padding:12px">'+
        '<div style="display:flex;align-items:center;gap:10px">'+
          '<div style="width:48px;height:48px;background:var(--cream2);border-radius:8px;overflow:hidden;display:flex;align-items:center;justify-content:center">'+
            (p.imageUrl?'<img loading="lazy" src="'+p.imageUrl+'" style="width:100%;height:100%;object-fit:cover">':'<span style="font-size:24px">'+p.ico+'</span>')+
          '</div>'+
          '<div><div style="font-weight:600;font-size:13px">'+esc(p.name)+'</div><div style="font-size:10px;color:var(--gray)">'+esc(p.sub)+' <span style="color:var(--orange);font-weight:600">['+esc(p.type)+']</span></div></div>'+
        '</div>'+
      '</td>'+
      '<td style="padding:12px"><span style="font-size:10px;font-weight:600;background:var(--cream2);padding:4px 10px;border-radius:20px">'+esc(p.brand)+'</span></td>'+
      '<td style="padding:12px"><span style="font-size:14px;font-weight:700;color:var(--orange)">-'+p.discount+'%</span></td>'+
      '<td style="padding:12px">'+statusHtml+'</td>'+
      '<td style="padding:12px;font-size:11px;color:var(--gray)">'+(endDateStr?endDateStr+' '+endTimeStr:'—')+'</td>'+
    '</tr>';
  }).join('');
}
function removePromo(id){
  var isAcc=id.startsWith('acc-');
  var realId=isAcc?id.replace('acc-',''):id;
  var endpoint=isAcc?'/api/accessories?id='+realId:'/api/products/'+realId;
  fetch(API_URL+endpoint,{
    method:'PUT',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({discount:0,isOffer:false})
  }).then(function(){
    refreshAdmin();
    showSuccessToast('Promoci&oacute;n eliminada', 'La promoci&oacute;n ha sido eliminada');
  }).catch(function(){showErrorToast('Error', 'No se pudo eliminar la promoción');});
}
var promoDeleteIds=[];
function deleteSelectedPromos(){
  var checkboxes=document.querySelectorAll('.promo-del-chk:checked');
  if(checkboxes.length===0){showAlert('Selección requerida', 'Selecciona al menos una promoción', 'warning');return;}
  showConfirm(
    'Eliminar promociones',
    '¿Eliminar '+checkboxes.length+' promoción(es)? Esta acción no se puede deshacer.',
    { confirmText: 'Eliminar', confirmClass: 'danger' }
  ).then(function(confirmed){
    if(!confirmed)return;
    promoDeleteIds=Array.from(checkboxes).map(function(chk){return chk.value;});
    var promises=[];
    promoDeleteIds.forEach(function(rawId){
      var isAcc=rawId.startsWith('acc-');
      var realId=isAcc?rawId.replace('acc-',''):rawId;
      var endpoint=isAcc?'/api/accessories?id='+realId:'/api/products/'+realId;
      promises.push(fetch(API_URL+endpoint,{
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({discount:0,isOffer:false})
      }));
    });
    Promise.all(promises).then(function(){
      refreshAdmin();
      showSuccessToast('Promociones eliminadas', promoDeleteIds.length+' promoci&oacute;n(es) eliminada(s)');
    }).catch(function(){showErrorToast('Error', 'No se pudieron eliminar las promociones');});
    promoDeleteIds=[];
  });
}
function toggleSelectAllPromos(selectAll){
  var checkboxes=document.querySelectorAll('.promo-del-chk');
  checkboxes.forEach(function(chk){chk.checked=selectAll;});
}
function togglePromoRow(id){
  var chk=document.querySelector('.promo-del-chk[value="'+id+'"]');
  if(chk)chk.checked=!chk.checked;
}
function showToast(msg,type){
  // Support admin-ui.js object signature ({title, message, type, duration})
  if(typeof msg==='object'&&msg!==null){
    var container=document.getElementById('adminToastContainer');
    if(container){
      var t=msg.type||'info';var d=msg.duration||4000;
      var toast=document.createElement('div');toast.className='admin-toast';
      var icons={success:'\u2705',error:'\u274C',warning:'\u26A0\uFE0F',info:'\u2139\uFE0F'};
      var iconHTML='<div class="admin-toast-icon '+t+'">'+(icons[t]||icons.info)+'</div>';
      var contentHTML='<div class="admin-toast-content">'+(msg.title?'<div class="admin-toast-title">'+msg.title+'</div>':'')+'<div class="admin-toast-message">'+msg.message+'</div></div>';
      var closeHTML='<button class="admin-toast-close" onclick="this.parentElement.remove()">&times;</button>';
      var progressHTML=msg.showProgress!==false?'<div class="admin-toast-progress" style="animation-duration:'+d+'ms"></div>':'';
      toast.innerHTML=iconHTML+contentHTML+closeHTML+progressHTML;
      container.appendChild(toast);
      setTimeout(function(){toast.style.opacity='0';toast.style.transform='translateX(120%)';setTimeout(function(){toast.remove();},400);},d);
      return;
    }
    type=msg.type||type;
    msg=msg.message||msg.title||'';
  }
  var existing=document.getElementById('toast');
  if(existing)existing.remove();
  var toast=document.createElement('div');
  toast.id='toast';
  var colors={success:'var(--green)',error:'var(--red)',warning:'var(--orange)',info:'var(--blue)'};
  var icons={success:'\u2705',error:'\u274C',warning:'\u26A0\uFE0F',info:'\u2139\uFE0F'};
  var c=colors[type]||'var(--dk)';
  var i=icons[type]||'';
  toast.innerHTML=(i?'<span style="margin-right:8px">'+i+'</span>':'')+'<span>'+msg+'</span>';
  toast.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:'+c+';color:#fff;padding:14px 28px;border-radius:12px;font-size:14px;font-weight:600;z-index:10000;box-shadow:0 8px 32px rgba(0,0,0,.25);display:flex;align-items:center;gap:8px;animation:fadeInUp .3s ease;max-width:90vw;text-align:center;backdrop-filter:blur(8px)';
  document.body.appendChild(toast);
  setTimeout(function(){toast.style.animation='fadeOutDown .3s ease';setTimeout(function(){toast.remove();},300);},3000);
}

// =========== QUOTES (COTIZACIONES) ===========
var _allQuotes=[];
var _quotePage=1;
var _quoteLimit=20;
var _quoteStatus='all';
var _quoteSearch='';

function loadQuotes(status){
  _quoteStatus=status||'all';
  _quotePage=1;
  
  document.querySelectorAll('#quoteBtnAll,#quoteBtnPending,#quoteBtnApproved,#quoteBtnRejected').forEach(function(b){b.classList.remove('ord-btn-act');});
  if(status==='all')document.getElementById('quoteBtnAll').classList.add('ord-btn-act');
  else if(status==='PENDING')document.getElementById('quoteBtnPending').classList.add('ord-btn-act');
  else if(status==='APPROVED')document.getElementById('quoteBtnApproved').classList.add('ord-btn-act');
  else if(status==='REJECTED')document.getElementById('quoteBtnRejected').classList.add('ord-btn-act');
  
  var url=API_URL+'/api/quotes?page='+_quotePage+'&limit='+_quoteLimit;
  if(status!=='all')url+='&status='+status;
  if(_quoteSearch)url+='&search='+encodeURIComponent(_quoteSearch);
  
  fetch(url).then(function(r){return r.json();}).then(function(res){
    _allQuotes=res.data||[];
    renderQuotesList(res);
  }).catch(function(){
    document.getElementById('quoteList').innerHTML='<div style="text-align:center;padding:2rem;color:var(--gray)">Error cargando cotizaciones</div>';
  });
}

function searchQuotes(val){
  _quoteSearch=val;
  _quotePage=1;
  loadQuotes(_quoteStatus);
}

function renderQuotesList(res){
  var list=document.getElementById('quoteList');
  if(!list)return;
  
  if(!_allQuotes||_allQuotes.length===0){
    list.innerHTML='<div style="text-align:center;padding:3rem;color:var(--gray)"><div style="font-size:48px;margin-bottom:1rem">&#128203;</div><div style="font-size:14px;font-weight:600;margin-bottom:.5rem">No hay cotizaciones</div><div style="font-size:12px">Las cotizaciones apareceran aqui cuando los usuarios las envien</div></div>';
    return;
  }
  
  var statusColors={PENDING:'var(--orange)',APPROVED:'var(--green)',REJECTED:'var(--red)',REVIEWING:'#8b5cf6',COMPLETED:'var(--blue)'};
  var statusLabels={PENDING:'Pendiente',APPROVED:'Aceptada',REJECTED:'Rechazada',REVIEWING:'En revisión',COMPLETED:'Completada'};
  
  var html=_allQuotes.map(function(q){
    var sc=statusColors[q.status]||'var(--gray)';
    var sl=statusLabels[q.status]||q.status;
    var date=new Date(q.createdAt).toLocaleDateString('es-AR',{day:'numeric',month:'short',year:'numeric'});
    var phone=q.clientPhone||'';
    return '<div class="gp-card" style="--gp-accent:'+sc+'">'+
      '<div class="gp-card-head">'+
        '<div style="min-width:0">'+
          '<div class="gp-card-title" style="font-family:inherit;font-size:15px">'+esc(q.device)+'</div>'+
          '<div class="gp-card-sub">'+esc(q.clientName||'Sin nombre')+' · '+date+'</div>'+
        '</div>'+
        '<span class="gp-pill" style="--gp-pill-bg:'+sc+';--gp-pill-fg:#fff"><span class="gp-dot"></span>'+sl+'</span>'+
      '</div>'+
      '<div class="gp-fields">'+
        (q.clientDni?'<div class="gp-field"><div class="gp-field-label">DNI</div><div class="gp-field-value">'+esc(q.clientDni)+'</div></div>':'')+
        (phone?'<div class="gp-field"><div class="gp-field-label">Teléfono</div><div class="gp-field-value">'+esc(phone)+'</div></div>':'')+
        (q.clientCity?'<div class="gp-field"><div class="gp-field-label">Ciudad</div><div class="gp-field-value">'+esc(q.clientCity)+'</div></div>':'')+
        (q.storage?'<div class="gp-field"><div class="gp-field-label">Almacenamiento</div><div class="gp-field-value">'+esc(q.storage)+'</div></div>':'')+
        (q.condition?'<div class="gp-field"><div class="gp-field-label">Estado</div><div class="gp-field-value">'+esc(q.condition)+'</div></div>':'')+
      '</div>'+
      '<div class="gp-card-foot">'+
        '<div><span class="gp-total-label">Precio cotizado</span><span class="gp-total-value">$'+(q.finalPrice||0).toLocaleString('es-AR')+'</span></div>'+
        '<div class="gp-actions">'+
          '<button class="gp-btn gp-btn-ghost" onclick="openQuoteDetail(\''+q.id+'\')">Ver cotización →</button>'+
          '<button class="gp-btn gp-btn-danger" onclick="deleteQuote(\''+q.id+'\')" title="Eliminar">🗑</button>'+
        '</div>'+
      '</div>'+
    '</div>';
  }).join('');
  
  list.innerHTML=html;
  
  var pagContainer=document.getElementById('quotePagination');
  if(pagContainer){
    var totalPages=res.totalPages||1;
    if(totalPages<=1){pagContainer.innerHTML='';return;}
    var phtml='<div style="display:flex;align-items:center;justify-content:center;gap:4px;margin-top:1rem;padding:1rem">';
    phtml+='<button onclick="_quotePage=Math.max(1,_quotePage-1);loadQuotes(_quoteStatus);"'+(_quotePage===1?' disabled style="opacity:.4;cursor:not-allowed"':'')+' style="padding:6px 12px;border:1px solid var(--border);border-radius:6px;background:var(--admin-surface);color:var(--admin-text);font-size:13px;cursor:pointer">&#8592;</button>';
    for(var i=1;i<=totalPages;i++){
      if(i===_quotePage)phtml+='<span style="padding:6px 12px;border-radius:6px;background:var(--orange);color:#fff;font-size:13px;font-weight:600">'+i+'</span>';
      else phtml+='<button onclick="_quotePage='+i+';loadQuotes(_quoteStatus);" style="padding:6px 12px;border:1px solid var(--border);border-radius:6px;background:var(--admin-surface);color:var(--admin-text);font-size:13px;cursor:pointer">'+i+'</button>';
    }
    phtml+='<button onclick="_quotePage=Math.min('+totalPages+',_quotePage+1);loadQuotes(_quoteStatus);"'+(_quotePage===totalPages?' disabled style="opacity:.4;cursor:not-allowed"':'')+' style="padding:6px 12px;border:1px solid var(--border);border-radius:6px;background:var(--admin-surface);color:var(--admin-text);font-size:13px;cursor:pointer">&#8594;</button>';
    phtml+='</div>';
    pagContainer.innerHTML=phtml;
  }
}

function openQuoteDetail(id){
  var q=_allQuotes.find(function(x){return x.id===id;});
  if(!q)return;
  
  var existing=document.getElementById('quoteDetailModal');
  if(existing)existing.remove();
  
  var statusColors={PENDING:'var(--orange)',APPROVED:'var(--green)',REJECTED:'var(--red)',REVIEWING:'#8b5cf6',COMPLETED:'var(--blue)'};
  var statusLabels={PENDING:'Pendiente',APPROVED:'Aceptada',REJECTED:'Rechazada',REVIEWING:'En revision',COMPLETED:'Completada'};
  var date=new Date(q.createdAt).toLocaleDateString('es-AR',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});
  
  var extrasLabels={pant:'Pantalla perfecta (+6%)',bat:'Bateria 80%+ (+5%)',icloud:'Cuenta libre (+8%)',caja:'Caja original (+3%)',acc:'Accesorios originales (+3%)'};
  var extrasHtml=(q.extras||[]).length>0?(q.extras||[]).map(function(e){return'<span style="font-size:11px;background:var(--admin-surface-hover);padding:4px 8px;border-radius:6px">'+esc(extrasLabels[e]||e)+'</span>';}).join(''):'<span style="font-size:11px;color:var(--admin-text-muted)">Ninguno</span>';
  
  var photosHtml=(q.photos||[]).length>0?q.photos.map(function(p){return'<img loading="lazy" src="'+esc(p)+'" onclick="openLightbox(\''+jsStr(p)+'\')" style="width:100px;height:100px;object-fit:cover;border-radius:8px;border:1px solid var(--admin-border);cursor:pointer">';}).join(''):'<span style="font-size:12px;color:var(--admin-text-muted)">No se adjuntaron fotos</span>';

  var dniPhotosHtml=(q.dniPhotos||[]).length>0?q.dniPhotos.map(function(p,i){var label=i===0?'Frente':'Dorso';return'<div><div style="font-size:10px;color:var(--admin-text-muted);margin-bottom:4px">'+label+'</div><img loading="lazy" src="'+esc(p)+'" onclick="openLightbox(\''+jsStr(p)+'\')" style="width:100px;height:64px;object-fit:cover;border-radius:8px;border:1px solid var(--admin-border);cursor:pointer"></div>';}).join(''):'<span style="font-size:12px;color:var(--admin-text-muted)">No se adjuntaron fotos del DNI</span>';
  
  var modal=document.createElement('div');
  modal.id='quoteDetailModal';
  modal.style.cssText='display:flex;position:fixed;inset:0;z-index:9999;align-items:center;justify-content:center;opacity:0;transition:opacity .3s';
  modal.innerHTML='<div style="position:absolute;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px)" onclick="closeQuoteDetail()"></div>'+
    '<div style="position:relative;background:var(--admin-surface);border:1px solid var(--admin-border);border-radius:16px;width:min(600px,95%);max-height:90vh;overflow-y:auto;box-shadow:0 25px 80px rgba(0,0,0,.35);transform:scale(.9);transition:transform .3s">'+
      '<div style="padding:20px 24px;border-bottom:1px solid var(--admin-border);display:flex;align-items:center;justify-content:space-between">'+
        '<div><h3 style="font-family:\'Playfair Display\',Georgia,serif;font-size:18px;font-weight:700;color:var(--admin-text)">Cotizacion '+esc(q.code)+'</h3><p style="font-size:12px;color:var(--admin-text-muted);margin-top:4px">'+date+'</p></div>'+
        '<button onclick="closeQuoteDetail()" style="background:none;border:none;color:var(--admin-text-muted);cursor:pointer;font-size:24px;padding:4px">&times;</button>'+
      '</div>'+
      '<div style="padding:24px">'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">'+
          '<div style="background:var(--admin-surface-hover);border-radius:10px;padding:14px">'+
            '<div style="font-size:10px;color:var(--admin-text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Dispositivo</div>'+
            '<div style="font-size:14px;font-weight:600;color:var(--admin-text)">'+esc(q.device)+'</div>'+
            '<div style="font-size:12px;color:var(--admin-text-muted);margin-top:4px">'+esc(q.storage)+' &middot; '+esc(q.condition)+'</div>'+
          '</div>'+
          '<div style="background:var(--admin-surface-hover);border-radius:10px;padding:14px">'+
            '<div style="font-size:10px;color:var(--admin-text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Precio estimado</div>'+
            '<div style="font-size:20px;font-weight:700;color:var(--orange)">$'+(q.finalPrice||0).toLocaleString('es-AR')+'</div>'+
            '<div style="font-size:10px;color:var(--admin-text-muted);margin-top:4px">Base: $'+(q.basePrice||0).toLocaleString('es-AR')+'</div>'+
          '</div>'+
        '</div>'+
        
        '<div style="margin-bottom:20px">'+
          '<div style="font-size:12px;font-weight:600;color:var(--admin-text);margin-bottom:8px">Extras</div>'+
          '<div style="display:flex;flex-wrap:wrap;gap:6px">'+extrasHtml+'</div>'+
        '</div>'+
        
        '<div style="margin-bottom:20px">'+
          '<div style="font-size:12px;font-weight:600;color:var(--admin-text);margin-bottom:8px">Datos del cliente</div>'+
          '<div style="background:var(--admin-surface-hover);border-radius:10px;padding:14px;display:grid;grid-template-columns:1fr 1fr;gap:10px">'+
            '<div><span style="font-size:10px;color:var(--admin-text-muted)">Nombre</span><div style="font-size:13px;font-weight:500;color:var(--admin-text)">'+esc(q.clientName||'-')+'</div></div>'+
            '<div><span style="font-size:10px;color:var(--admin-text-muted)">DNI</span><div style="font-size:13px;font-weight:500;color:var(--admin-text)">'+esc(q.clientDni||'-')+'</div></div>'+
            '<div><span style="font-size:10px;color:var(--admin-text-muted)">Telefono</span><div style="font-size:13px;font-weight:500;color:var(--admin-text)">'+esc(q.clientPhone||'-')+'</div></div>'+
            '<div><span style="font-size:10px;color:var(--admin-text-muted)">Ciudad</span><div style="font-size:13px;font-weight:500;color:var(--admin-text)">'+esc(q.clientCity||'-')+'</div></div>'+
          '</div>'+
        '</div>'+
        
        '<div style="margin-bottom:20px">'+
          '<div style="font-size:12px;font-weight:600;color:var(--admin-text);margin-bottom:8px">Fotos del dispositivo</div>'+
          '<div style="display:flex;gap:8px;flex-wrap:wrap">'+photosHtml+'</div>'+
        '</div>'+

        '<div style="margin-bottom:20px">'+
          '<div style="font-size:12px;font-weight:600;color:var(--admin-text);margin-bottom:8px">Fotos del DNI</div>'+
          '<div style="display:flex;gap:12px;flex-wrap:wrap">'+dniPhotosHtml+'</div>'+
        '</div>'+

        '<div style="margin-bottom:20px">'+
          '<div style="font-size:12px;font-weight:600;color:var(--admin-text);margin-bottom:8px">Envio y cobro</div>'+
          '<div style="background:var(--admin-surface-hover);border-radius:10px;padding:14px;display:grid;grid-template-columns:1fr 1fr;gap:10px">'+
            '<div><span style="font-size:10px;color:var(--admin-text-muted)">Envio</span><div style="font-size:13px;font-weight:500;color:var(--admin-text)">'+esc(q.envio||'-')+'</div></div>'+
            '<div><span style="font-size:10px;color:var(--admin-text-muted)">Cobro</span><div style="font-size:13px;font-weight:500;color:var(--admin-text)">'+esc(q.payment||'-')+'</div></div>'+
          '</div>'+
        '</div>'+
        
        '<div style="display:flex;gap:12px;padding-top:16px;border-top:1px solid var(--admin-border)">'+
          '<button onclick="rejectQuote(\''+q.id+'\')" style="flex:1;padding:12px;background:var(--red);color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">Rechazar</button>'+
          '<button onclick="approveQuote(\''+q.id+'\')" style="flex:1;padding:12px;background:var(--green);color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">Aceptar</button>'+
        '</div>'+
      '</div>'+
    '</div>';
  
  var target=document.querySelector('.admin-main')||document.querySelector('.admin-layout')||document.body;
  target.appendChild(modal);
  setTimeout(function(){modal.style.opacity='1';modal.querySelector('div:nth-child(2)').style.transform='scale(1)';},10);
}
function closeQuoteDetail(){
  var modal=document.getElementById('quoteDetailModal');
  if(!modal)return;
  modal.style.opacity='0';
  modal.querySelector('div:nth-child(2)').style.transform='scale(.9)';
  setTimeout(function(){modal.remove();},300);
}

function approveQuote(id){
  showConfirm('Aceptar cotizacion','¿Confirmas que aceptas esta cotizacion? Se emitira una factura ARCA automaticamente y se notificara al cliente.',{confirmText:'Aceptar y facturar',confirmClass:'primary'}).then(function(confirmed){
    if(!confirmed)return;
    fetch(API_URL+'/api/quotes',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:id,status:'APPROVED'})}).then(function(r){return r.json();}).then(function(res){
      var invoice=res.invoice;
      var msg=invoice
        ? 'Factura '+invoice.type+' N° '+invoice.pos.toString().padStart(4,'0')+'-'+invoice.number.toString().padStart(8,'0')
        : 'Aceptada (sin factura)';
      var sub=res.warning||'El cliente sera notificado';
      showSuccessToast('Cotizacion aceptada',msg+(res.warning?' · '+sub:''));
      closeQuoteDetail();
      loadQuotes(_quoteStatus);
    }).catch(function(err){
      showErrorToast('Error',err&&err.message?err.message:'No se pudo aceptar la cotizacion');
    });
  });
}

function rejectQuote(id){
  var existing=document.getElementById('rejectQuoteModal');
  if(existing)existing.remove();
  
  var modal=document.createElement('div');
  modal.id='rejectQuoteModal';
  modal.style.cssText='display:flex;position:fixed;inset:0;z-index:10000;align-items:center;justify-content:center;opacity:0;transition:opacity .3s';
  modal.innerHTML='<div style="position:absolute;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px)" onclick="closeRejectQuoteModal()"></div>'+
    '<div style="position:relative;background:var(--admin-surface);border:1px solid var(--admin-border);border-radius:16px;width:min(450px,95%);box-shadow:0 25px 80px rgba(0,0,0,.35);transform:scale(.9);transition:transform .3s">'+
      '<div style="padding:20px 24px;border-bottom:1px solid var(--admin-border)">'+
        '<h3 style="font-family:\'Playfair Display\',Georgia,serif;font-size:18px;font-weight:700;color:var(--red)">Rechazar cotizacion</h3>'+
        '<p style="font-size:12px;color:var(--admin-text-muted);margin-top:4px">Selecciona el motivo del rechazo</p>'+
      '</div>'+
      '<div style="padding:24px">'+
        '<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:1rem">'+
          '<label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:var(--admin-surface-hover);border-radius:8px;cursor:pointer">'+
            '<input type="checkbox" class="quote-reason-cb" value="El dispositivo no coincide con la descripcion" style="margin-top:2px;accent-color:var(--red);width:18px;height:18px">'+
            '<span style="font-size:13px;color:var(--admin-text)">El dispositivo no coincide con la descripcion</span>'+
          '</label>'+
          '<label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:var(--admin-surface-hover);border-radius:8px;cursor:pointer">'+
            '<input type="checkbox" class="quote-reason-cb" value="No se puede verificar la propiedad" style="margin-top:2px;accent-color:var(--red);width:18px;height:18px">'+
            '<span style="font-size:13px;color:var(--admin-text)">No se puede verificar la propiedad</span>'+
          '</label>'+
          '<label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:var(--admin-surface-hover);border-radius:8px;cursor:pointer">'+
            '<input type="checkbox" class="quote-reason-cb" value="Modelo no aceptado" style="margin-top:2px;accent-color:var(--red);width:18px;height:18px">'+
            '<span style="font-size:13px;color:var(--admin-text)">Modelo no aceptado</span>'+
          '</label>'+
        '</div>'+
        '<textarea id="quoteRejectComment" placeholder="Otro motivo (opcional)" style="width:100%;padding:10px 12px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-surface-hover);color:var(--admin-text);font-size:13px;resize:none;height:60px;outline:none"></textarea>'+
        '<div style="display:flex;gap:12px;margin-top:1rem">'+
          '<button onclick="closeRejectQuoteModal()" style="flex:1;padding:12px;background:var(--admin-surface-hover);color:var(--admin-text);border:1px solid var(--admin-border);border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">Cancelar</button>'+
          '<button onclick="confirmRejectQuote(\''+id+'\')" style="flex:1;padding:12px;background:var(--red);color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">Rechazar</button>'+
        '</div>'+
      '</div>'+
    '</div>';
  
  var target=document.querySelector('.admin-main')||document.querySelector('.admin-layout')||document.body;
  target.appendChild(modal);
  setTimeout(function(){modal.style.opacity='1';modal.querySelector('div:nth-child(2)').style.transform='scale(1)';},10);
}
function closeRejectQuoteModal(){
  var modal=document.getElementById('rejectQuoteModal');
  if(!modal)return;
  modal.style.opacity='0';
  modal.querySelector('div:nth-child(2)').style.transform='scale(.9)';
  setTimeout(function(){modal.remove();},300);
}

function confirmRejectQuote(id){
  var cbs=document.querySelectorAll('.quote-reason-cb:checked');
  var reasons=[];
  cbs.forEach(function(cb){reasons.push(cb.value);});
  var commentEl=document.getElementById('quoteRejectComment');
  var comment=commentEl?commentEl.value.trim():'';
  var reasonText=reasons.join('; ')+(comment?(reasons.length>0?' | ':'')+comment:'');
  
  fetch(API_URL+'/api/quotes',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:id,status:'REJECTED',rejectReason:reasonText})}).then(function(r){return r.json();}).then(function(){
    showSuccessToast('Cotizacion rechazada','El cliente sera notificado');
    closeRejectQuoteModal();
    closeQuoteDetail();
    loadQuotes(_quoteStatus);
  }).catch(function(){showErrorToast('Error','No se pudo rechazar la cotizacion');});
}

function deleteQuote(id){
  if(!confirm('¿Eliminar esta cotización? Esta acción no se puede deshacer.'))return;
  
  fetch(API_URL+'/api/quotes?id='+id,{method:'DELETE'}).then(function(r){return r.json();}).then(function(res){
    if(res.success){
      showSuccessToast('Cotización eliminada','Se eliminó correctamente');
      loadQuotes(_quoteStatus);
    }else{
      showErrorToast('Error','No se pudo eliminar la cotización');
    }
  }).catch(function(){showErrorToast('Error','No se pudo eliminar la cotización');});
}

// SSR support: auto-open detail when pre-fetched data is available
(function initSSRDetail(){
  // Accessory detail
  if(window.__INITIAL_ACCS_DETAIL_ID__&&window.__INITIAL_ACCS_DETAIL__){
    var accId=window.__INITIAL_ACCS_DETAIL_ID__;
    var accInterval=setInterval(function(){
      if(window._accLoaded||(window.__INITIAL_ACCESSORIES__&&window.__INITIAL_ACCESSORIES__.length>0)||(window.ACCS&&window.ACCS.length>0)){
        clearInterval(accInterval);
        if(typeof openAccDetail==='function')openAccDetail(accId);
      }
    },50);
    setTimeout(function(){clearInterval(accInterval);},5000);
  }
  // Product detail
  if(window.__INITIAL_DETAIL_ID__&&window.__INITIAL_DETAIL__){
    var id=window.__INITIAL_DETAIL_ID__;
    var checkInterval=setInterval(function(){
      if(window._productsLoaded||(window.__INITIAL_PRODUCTS__&&window.__INITIAL_PRODUCTS__.length>0)||(typeof PRODUCTS!=='undefined'&&PRODUCTS&&PRODUCTS.length>0)){
        clearInterval(checkInterval);
        if(typeof openDetail==='function')openDetail(id);
      }
    },50);
    setTimeout(function(){clearInterval(checkInterval);},5000);
  }
})();

// SSR support: auto-open catalog when pre-fetched data is available
(function initSSRCatalog(){
  if(window.__INITIAL_CATALOG__){
    delete window.__INITIAL_CATALOG__;
    var checkInterval=setInterval(function(){
      if(typeof nav === 'function' && typeof renderShopGrid === 'function'){
        clearInterval(checkInterval);
        nav('shop');
      }
    },50);
    setTimeout(function(){clearInterval(checkInterval);},5000);
  }
})();

// SSR support: auto-navigate to accesorios page
(function initSSRAcc(){
  if(window.__INITIAL_ACC_PAGE__){
    delete window.__INITIAL_ACC_PAGE__;
    var checkInterval=setInterval(function(){
      if(typeof nav === 'function'){
        clearInterval(checkInterval);
        nav('accesorios');
      }
    },50);
    setTimeout(function(){clearInterval(checkInterval);},5000);
  }
})();

// SSR support: auto-navigate to ofertas page
(function initSSROfertas(){
  if(window.__INITIAL_OFERTAS__){
    delete window.__INITIAL_OFERTAS__;
    var checkInterval=setInterval(function(){
      if(typeof nav === 'function'){
        clearInterval(checkInterval);
        nav('ofertas');
      }
    },50);
    setTimeout(function(){clearInterval(checkInterval);},5000);
  }
})();

// SSR support: auto-navigate to garantias page
(function initSSRGarantias(){
  if(window.__INITIAL_GARANTIAS__){
    delete window.__INITIAL_GARANTIAS__;
    var checkInterval=setInterval(function(){
      if(typeof nav === 'function'){
        clearInterval(checkInterval);
        nav('garantias');
      }
    },50);
    setTimeout(function(){clearInterval(checkInterval);},5000);
  }
})();

// SSR support: auto-navigate to preventas page
// Preventas ya no tienen página propia: se muestran en el catálogo (/productos).

// ===== ADMIN USERS =====
var _adminUsersPage = 1;
var _adminUsersLimit = 50;

function loadAdminUsers(){
  var url=API_URL+'/api/admin/users?page='+_adminUsersPage+'&limit='+_adminUsersLimit;
  fetch(url,{headers:{}})
    .then(function(r){return r.json();})
    .then(function(res){
      renderAdminUsers(res.users || [], res.total || 0, res.page || 1, res.limit || _adminUsersLimit);
    }).catch(function(){
      var el=document.getElementById('adminUsersList');
      if(el)el.innerHTML='<div style="text-align:center;padding:2rem;color:var(--red)">Error cargando usuarios</div>';
    });
}

function renderAdminUsers(users,total,page,limit){
  var el=document.getElementById('adminUsersList');
  if(!el)return;
  var loader=document.querySelector('#adminContent .loader-spinner');
  if(loader)loader.style.display='none';

  if(!users||users.length===0){
    el.innerHTML='<div style="text-align:center;padding:3rem;color:var(--gray)">No hay usuarios</div>';
    return;
  }

  var totalPages=Math.max(1,Math.ceil(total/limit));
  var html='<div style="display:flex;justify-content:space-between;align-items:center;padding:0 16px 12px;font-size:12px;color:var(--gray)">'+
    '<div style="display:flex;gap:12px;align-items:center"><span>'+total+' usuario'+(total===1?'':'s')+'</span><button onclick="deleteSelectedUsers()" style="background:var(--red);color:#fff;border:none;padding:6px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">Eliminar seleccionados</button></div>'+
    '<span>Página '+page+' de '+totalPages+'</span>'+
  '</div>'+
  '<table style="width:100%;border-collapse:collapse;font-size:13px">'+
    '<thead><tr style="border-bottom:2px solid var(--border)">'+
      '<th style="width:40px;padding:10px 8px 10px 16px"><input type="checkbox" onclick="toggleSelectAllUsers(this)" style="width:17px;height:17px;cursor:pointer;accent-color:var(--orange)"></th>'+
      '<th style="text-align:left;padding:10px 16px;color:var(--gray);font-weight:600;font-size:10px;text-transform:uppercase">Usuario</th>'+
      '<th style="text-align:left;padding:10px 16px;color:var(--gray);font-weight:600;font-size:10px;text-transform:uppercase">Email</th>'+
      '<th style="text-align:center;padding:10px 16px;color:var(--gray);font-weight:600;font-size:10px;text-transform:uppercase">Rol</th>'+
      '<th style="text-align:left;padding:10px 16px;color:var(--gray);font-weight:600;font-size:10px;text-transform:uppercase">Teléfono</th>'+
      '<th style="text-align:right;padding:10px 16px;color:var(--gray);font-weight:600;font-size:10px;text-transform:uppercase">Registro</th>'+
      '<th style="text-align:center;padding:10px 16px;color:var(--gray);font-weight:600;font-size:10px;text-transform:uppercase">Acciones</th>'+
    '</tr></thead><tbody>';

  users.forEach(function(u){
    var roleColor=u.role==='ADMIN'?'var(--orange)':'var(--green)';
    var roleBg=u.role==='ADMIN'?'rgba(255,107,44,.1)':'rgba(45,90,39,.1)';
    var date=new Date(u.createdAt).toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'2-digit'});
    html+='<tr data-uid="'+u.id+'" style="border-bottom:1px solid var(--border)" onmouseover="this.style.background=\'var(--cream)\'" onmouseout="this.style.background=\'transparent\'">'+
      '<td style="padding:10px 8px 10px 16px;text-align:center"><input type="checkbox" class="admin-user-chk" value="'+u.id+'" '+(u.role==='ADMIN'||u.id===currentUser.id?'disabled':'')+' style="width:17px;height:17px;cursor:pointer;accent-color:var(--orange)"></td>'+
      '<td style="padding:10px 16px"><div style="font-weight:600">'+escapeHtml(u.name||'Sin nombre')+'</div></td>'+
      '<td style="padding:10px 16px;font-size:12px;color:var(--gray)">'+escapeHtml(u.email||'—')+'</td>'+
      '<td style="padding:10px 16px;text-align:center">'+
        '<select onchange="changeUserRole(\''+u.id+'\',this.value)" style="padding:4px 8px;border-radius:8px;border:1px solid var(--border);background:'+roleBg+';color:'+roleColor+';font-weight:700;font-size:11px;cursor:pointer;font-family:inherit;outline:none">'+
          '<option value="CLIENT"'+ (u.role==='CLIENT'?' selected':'') +'>Cliente</option>'+
          '<option value="ADMIN"'+ (u.role==='ADMIN'?' selected':'') +'>Admin</option>'+
        '</select>'+
      '</td>'+
      '<td style="padding:10px 16px;font-size:12px;color:var(--gray)">'+escapeHtml(u.phone||'—')+'</td>'+
      '<td style="padding:10px 16px;text-align:right;font-size:12px;color:var(--gray)">'+date+'</td>'+
      '<td style="padding:10px 16px;text-align:center">'+
        '<button onclick="deleteAdminUser(\''+u.id+'\',\''+escapeHtml(u.name||'Usuario').replace(/'/g,"\\'")+'\')" '+(u.role==='ADMIN'||u.id===currentUser.id?'disabled':'')+' style="background:none;border:1px solid '+(u.role==='ADMIN'?'var(--gray)':'var(--red)')+';color:'+(u.role==='ADMIN'?'var(--gray)':'var(--red)')+';padding:4px 10px;border-radius:8px;font-size:11px;cursor:'+(u.role==='ADMIN'?'not-allowed':'pointer')+';font-weight:600;font-family:inherit">Eliminar</button>'+
      '</td>'+
    '</tr>';
  });

  html+='</tbody></table>'+
    '<div style="display:flex;justify-content:center;gap:8px;padding:16px">'+
      '<button onclick="adminUsersPrevPage()" '+(page<=1?'disabled':'')+' style="padding:6px 14px;border-radius:8px;border:1px solid var(--border);background:'+(page<=1?'var(--cream)':'white')+';cursor:'+(page<=1?'default':'pointer')+';font-size:12px;font-family:inherit;font-weight:600;color:'+(page<=1?'var(--gray)':'var(--orange)')+'">← Anterior</button>'+
      '<button onclick="adminUsersNextPage()" '+(page>=totalPages?'disabled':'')+' style="padding:6px 14px;border-radius:8px;border:1px solid var(--border);background:'+(page>=totalPages?'var(--cream)':'white')+';cursor:'+(page>=totalPages?'default':'pointer')+';font-size:12px;font-family:inherit;font-weight:600;color:'+(page>=totalPages?'var(--gray)':'var(--orange)')+'">Siguiente →</button>'+
    '</div>';
  el.innerHTML=html;
}

function adminUsersPrevPage(){
  if(_adminUsersPage<=1)return;
  _adminUsersPage--;
  loadAdminUsers();
}

function adminUsersNextPage(){
  _adminUsersPage++;
  loadAdminUsers();
}

function changeUserRole(userId,newRole){
  if(!currentUser||!currentUser.id)return showToast({title:'Error',message:'No autorizado',type:'error'});
  fetch(API_URL+'/api/admin/users',{
    method:'PUT',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({id:userId,role:newRole})
  }).then(function(r){return r.json();}).then(function(res){
    if(res.error)return showToast({title:'Error',message:res.error,type:'error'});
    showToast({title:'Exito',message:'Rol actualizado',type:'success'});
  }).catch(function(){showToast({title:'Error',message:'Error al actualizar',type:'error'});});
}

function toggleSelectAllUsers(checkboxEl){
  var checked=checkboxEl.checked;
  document.querySelectorAll('.admin-user-chk').forEach(function(chk){
    if(!chk.disabled)chk.checked=checked;
  });
}
function buildAdminDeleteModal(title, bodyHtml, onConfirm){
  var existing=document.getElementById('adminDeleteModal');
  if(existing)existing.remove();
  var overlay=document.createElement('div');
  overlay.id='adminDeleteModal';
  overlay.style.cssText='position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);backdrop-filter:blur(3px)';
  overlay.innerHTML=
    '<div style="background:#fff;border-radius:18px;width:min(420px,92vw);padding:1.5rem;box-shadow:0 24px 80px rgba(0,0,0,.35)">'+
      '<div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:1.25rem">'+
        '<div style="width:46px;height:46px;border-radius:13px;background:rgba(192,57,43,.1);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C0392B" stroke-width="2"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></svg></div>'+
        '<div><div style="font-family:\'Playfair Display\',Georgia,serif;font-size:18px;font-weight:700;color:var(--dk)">'+title+'</div></div>'+
      '</div>'+
      '<div style="font-size:13px;color:var(--gray);line-height:1.6;margin-bottom:1.5rem">'+bodyHtml+'</div>'+
      '<div style="display:flex;gap:10px;justify-content:flex-end">'+
        '<button id="adminDelCancel" style="padding:11px 18px;background:var(--cream2);color:var(--dk);border:1px solid var(--border);border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Cancelar</button>'+
        '<button id="adminDelOk" style="padding:11px 20px;background:var(--red);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Confirmar</button>'+
      '</div>'+
    '</div>';
  document.body.appendChild(overlay);
  overlay.querySelector('#adminDelCancel').onclick=function(){overlay.remove()};
  overlay.querySelector('#adminDelOk').onclick=function(){overlay.remove();onConfirm();};
  overlay.addEventListener('click',function(e){if(e.target===overlay)overlay.remove();});
  return overlay;
}
function deleteAdminUser(userId,userName){
  if(!currentUser||!currentUser.id)return showToast({title:'Error',message:'No autorizado',type:'error'});
  if(userId===currentUser.id)return showToast({title:'Error',message:'No podes eliminarte a vos mismo',type:'error'});
  buildAdminDeleteModal('Eliminar usuario','¿Eliminar a <strong style="color:var(--dk)">'+userName+'</strong>? Esta acción no se puede deshacer y eliminará todos sus datos asociados.',function(){
    fetch(API_URL+'/api/admin/users?id='+userId,{
      method:'DELETE',
      headers:{}
    }).then(function(r){return r.json();}).then(function(res){
      if(res.error)return showToast({title:'Error',message:res.error,type:'error'});
      showToast({title:'Exito',message:'Usuario eliminado',type:'success'});
      loadAdminUsers();
    }).catch(function(){showToast({title:'Error',message:'Error al eliminar',type:'error'});});
  });
}
function deleteSelectedUsers(){
  if(!currentUser||!currentUser.id)return showToast({title:'Error',message:'No autorizado',type:'error'});
  var ids=Array.from(document.querySelectorAll('.admin-user-chk:checked')).map(function(c){return c.value;});
  if(!ids.length)return showToast({title:'Aviso',message:'Seleccioná al menos un usuario',type:'warning'});
  buildAdminDeleteModal('Eliminar '+ids.length+' usuario(s)','¿Eliminar <strong style="color:var(--dk)">'+ids.length+'</strong> usuario(s) seleccionados? Esta acción no se puede deshacer y eliminará todos sus datos asociados.',function(){
    fetch(API_URL+'/api/admin/users?ids='+ids.join(','),{
      method:'DELETE',
      headers:{}
    }).then(function(r){return r.json();}).then(function(res){
      if(res.error)return showToast({title:'Error',message:res.error,type:'error'});
      showToast({title:'Exito',message:ids.length+' usuario(s) eliminados',type:'success'});
      loadAdminUsers();
    }).catch(function(){showToast({title:'Error',message:'Error al eliminar',type:'error'});});
  });
}