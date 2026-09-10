// =========== CHAT SIMPLIFICADO ===========
var API_URL=window.API_URL||(window.location.hostname==='localhost'?window.location.protocol+'//'+window.location.host:window.location.origin);
var chatSocket=null;
var userConvId=null;
var typingTimeout=null;
var adminTypingTimeout=null;
var chatPollInterval=null;
var socketConnected=false;
var chatSoundEnabled=true;
var healthCheckInterval=null;
var PAGE_SIZE=30;
var _msgCursor=null;
var _hasMoreMsgs=false;
var _panelCursor=null;
var _hasMorePanel=false;

function initChatSocket(){
  if(!currentUser||!window.io){
    console.log('[Chat] Socket client not available');
    return;
  }
  // Si ya hay un socket conectado o en proceso de conexión, reusarlo para
  // evitar conexiones duplicadas que el servidor rechaza.
  if(chatSocket&&(chatSocket.connected||chatSocket.connecting)){
    return;
  }
  if(chatSocket&&chatSocket.disconnected){
    try{chatSocket.disconnect();}catch(e){}
    chatSocket=null;
  }
  try{
    var socketUrl=window.location.origin;
    chatSocket=window.io(socketUrl,{
      auth:{userId:currentUser.id},
      reconnection:true,
      reconnectionAttempts:Infinity,
      reconnectionDelay:500,
      reconnectionDelayMax:5000,
      timeout:8000
    });
    chatSocket.on('connect',function(){
      socketConnected=true;
      if(userConvId)chatSocket.emit('joinConversation',userConvId);
      startHealthCheck();
      requestNotifPermission();
    });
    chatSocket.on('connect_error',function(err){
      socketConnected=false;
    });
    chatSocket.on('disconnect',function(reason){
      socketConnected=false;
      stopHealthCheck();
    });
    chatSocket.on('reconnect',function(){
      socketConnected=true;
      if(userConvId)chatSocket.emit('joinConversation',userConvId);
      startHealthCheck();
    });
    chatSocket.on('newMessage',function(msg){
      if(msg.conversationId===userConvId){
        appendMessageToChat(msg);
        appendPanelMessage(msg);
        scrollIfNeeded();
        if(!chatPanelOpen&&msg.from!==(currentUser?currentUser.id:null)){
          updateChatWidgetPreview(msg.text||(msg.imageUrl?'\u{1F4F7} Imagen':(msg.text||'')));
        }
      }else{
        if(typeof showToast==='function')showToast('Tienes un nuevo mensaje');
        updateMsgBadge();
        playNotifSound();
        showBrowserNotif(msg);
      }
    });
    chatSocket.on('userTyping',function(data){
      showTypingIndicator(data.userName);
      showPanelTyping(data.userName);
    });
    chatSocket.on('userStoppedTyping',function(){
      hideTypingIndicator();
      hidePanelTyping();
    });
    chatSocket.on('unreadUpdate',function(data){
      updateBadgeUI(data);
    });
    chatSocket.on('pong',function(){});
    chatSocket.on('userOnline',function(data){
      if(data.userId!==currentUser.id)updateAdminOnlineStatus(true);
    });
    chatSocket.on('userOffline',function(data){
      if(data.userId!==currentUser.id)updateAdminOnlineStatus(false);
    });
    chatSocket.on('messagesRead',function(data){
      if(data.conversationId===userConvId){
        updateMsgStatus(data.conversationId,true);
      }
    });
  }catch(e){
    console.error('[Chat] Socket init error:', e);
  }
}

function startHealthCheck(){
  stopHealthCheck();
  healthCheckInterval=setInterval(function(){
    if(chatSocket&&!chatSocket.connected){
      console.log('[Chat] Health check: reconnecting');
      chatSocket.connect();
    }
  },60000);
}
function stopHealthCheck(){
  if(healthCheckInterval){clearInterval(healthCheckInterval);healthCheckInterval=null;}
}

function updateBadgeUI(data){
  var badge=document.getElementById('msgBadge');
  if(badge){
    var total=data.unreadByUser||0;
    if(total>0){
      badge.textContent=total>99?'99+':total;
      badge.style.display='flex';
    }else{
      badge.style.display='none';
    }
  }
  var adminBadge=document.getElementById('adminChatBadge');
  if(adminBadge){
    var adminTotal=data.unreadByAdmin||0;
    if(adminTotal>0){
      adminBadge.textContent=adminTotal>99?'99+':adminTotal;
      adminBadge.style.display='inline';
    }else{
      adminBadge.style.display='none';
    }
  }
}

function updateAdminOnlineStatus(online){
  // Admin header dot
  var dot=document.getElementById('adminOnlineDot');
  if(dot){
    dot.style.background=online?'var(--green)':'var(--gray)';
    dot.title=online?'En l\u00EDnea':'Desconectado';
  }
  // User chat header (p-chats page)
  var userDot=document.getElementById('chatOnlineDot');
  if(userDot){
    userDot.style.background=online?'var(--green)':'var(--gray)';
  }
  var userStatus=document.getElementById('chatOnlineText');
  if(userStatus)userStatus.textContent=online?'En l\u00EDnea':'Desconectado';
}

function getStatusHtml(msg){
  if(!msg||!msg.from||!currentUser||msg.from!==currentUser.id)return'';
  var status=msg.status||'SENT';
  var readAt=msg.readAt;
  if(readAt||status==='READ')return'<span style="font-size:11px;color:#53bdeb;margin-left:4px">\u2713\u2713</span>';
  if(status==='DELIVERED')return'<span style="font-size:11px;color:var(--gray);margin-left:4px">\u2713\u2713</span>';
  return'<span style="font-size:11px;color:var(--gray);margin-left:4px">\u2713</span>';
}

function updateMsgStatus(convId,allRead){
  var list=document.getElementById('chatMsgList');
  if(!list)return;
  var wraps=list.querySelectorAll('.msg-wrap.mine');
  wraps.forEach(function(w){
    var statusEl=w.querySelector('.msg-status');
    if(statusEl){
      if(allRead)statusEl.innerHTML='<span style="font-size:11px;color:#53bdeb;margin-left:4px">\u2713\u2713</span>';
      else statusEl.innerHTML='<span style="font-size:11px;color:var(--gray);margin-left:4px">\u2713\u2713</span>';
    }
  });
  // Also update panel
  var panelList=document.getElementById('panelMsgList');
  if(!panelList)return;
  var pWraps=panelList.querySelectorAll('.msg-wrap.mine');
  pWraps.forEach(function(w){
    var statusEl=w.querySelector('.msg-status');
    if(statusEl){
      if(allRead)statusEl.innerHTML='<span style="font-size:11px;color:#53bdeb;margin-left:4px">\u2713\u2713</span>';
      else statusEl.innerHTML='<span style="font-size:11px;color:var(--gray);margin-left:4px">\u2713\u2713</span>';
    }
  });
}

function requestNotifPermission(){
  if(!('Notification'in window))return;
  if(Notification.permission==='default'){
    Notification.requestPermission();
  }
}

function showBrowserNotif(msg){
  if(!('Notification'in window)||Notification.permission!=='granted')return;
  if(!document.hidden)return;
  var body=msg.text||(msg.imageUrl?'\u{1F4F7} Imagen':'Nuevo mensaje');
  var userName=msg.fromUserName||'Great Phones';
  try{
    var n=new Notification(userName,{
      body:body,
      icon:'/icons/539432645_17922071475132461_1228687370142381845_n.jpg'
    });
    n.onclick=function(){
      window.focus();
      if(msg.conversationId){
        if(currentUser&&currentUser.role==='ADMIN'){
          nav('admin');
          setTimeout(function(){openAdminConv(msg.conversationId);},300);
        }else{
          nav('chats');
        }
      }
      n.close();
    };
  }catch(e){}
}

function playNotifSound(){
  if(!chatSoundEnabled)return;
  if(currentUser&&currentUser.role==='ADMIN'){
    try{
      var ctx=new(window.AudioContext||window.webkitAudioContext)();
      var osc=ctx.createOscillator();
      var gain=ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type='sine';
      osc.frequency.value=880;
      gain.gain.setValueAtTime(0.15,ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime+0.3);
    }catch(e){}
  }
}

function toggleChatSound(){
  chatSoundEnabled=!chatSoundEnabled;
  localStorage.setItem('chatSound',chatSoundEnabled?'on':'off');
  var btn=document.getElementById('chatSoundToggle');
  if(btn){
    btn.innerHTML=chatSoundEnabled?'\u{1F50A}':'\u{1F507}';
    btn.title=chatSoundEnabled?'Silenciar notificaciones':'Activar sonido';
  }
}

function initChatSound(){
  var stored=localStorage.getItem('chatSound');
  if(stored==='off')chatSoundEnabled=false;
  var btn=document.getElementById('chatSoundToggle');
  if(btn){
    btn.innerHTML=chatSoundEnabled?'\u{1F50A}':'\u{1F507}';
    btn.title=chatSoundEnabled?'Silenciar notificaciones':'Activar sonido';
  }
}

function openUserChat(){
  if(!currentUser){window.location.href='/login';return;}
  initChatSocket();
  initChatScrollListeners();
  getUserConversation();
}

function getUserConversation(){
  fetch(API_URL+'/api/conversations?userId='+currentUser.id)
    .then(function(r){return r.json();})
    .then(function(convs){
      if(convs&&convs.length>0){
        userConvId=convs[0].id;
        loadPanelMessages(userConvId,true);
        markAsRead(userConvId);
        if(chatSocket)chatSocket.emit('joinConversation',userConvId);
      }else{
        createDefaultConversation();
      }
    })
    .catch(function(e){console.error('Error loading conversation:',e);showErrorToast('Error','No se pudo cargar la conversación');});
}

function createDefaultConversation(){
  fetch(API_URL+'/api/conversations',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      userId:currentUser.id,
      type:'GENERIC',
      subject:'Chat con Great Phones',
      firstMessage:''
    })
  })
  .then(function(r){return r.json();})
  .then(function(conv){
    userConvId=conv.id;
    var list=document.getElementById('panelMsgList');
    if(list){
      list.innerHTML='<div class="empty-state-chat"><svg viewBox="0 0 72 72" fill="none"><circle cx="36" cy="36" r="35" stroke="#E4DDD4" stroke-width="1.5" opacity="0.4"/><path d="M20 26c0-4 3-7 7-7h18c4 0 7 3 7 7v14c0 4-3 7-7 7h-4l-7 6-7-6h-4c-4 0-7-3-7-7V26z" fill="#F0EBE3"/><path d="M27 32h18M27 39h12" stroke="#D4CCC2" stroke-width="2" stroke-linecap="round"/><circle cx="56" cy="20" r="5" fill="#FF6B2C" opacity="0.12" class="fb-dot"/><circle cx="58" cy="18" r="2" fill="#FF6B2C" opacity="0.25"/></svg><h3>Hola! C\u00F3mo podemos ayudarte?</h3><p>Escrib\u00ED tu consulta y te responderemos a la brevedad.</p></div>';
    }
    if(chatSocket)chatSocket.emit('joinConversation',userConvId);
  })
  .catch(function(e){console.error('Error creating conversation:',e);showErrorToast('Error','No se pudo crear el chat');});
}

function loadMessages(convId,scrollBottom,scrollToMsgId){
  var headers={};
  
  fetch(API_URL+'/api/conversations/'+convId+'/messages?limit='+PAGE_SIZE,{headers:headers})
    .then(function(r){
      if(!r.ok)throw new Error('Error al cargar mensajes');
      return r.json();
    })
    .then(function(msgs){
      renderMsgs(msgs);
      _hasMoreMsgs=msgs.length>=PAGE_SIZE;
      _msgCursor=msgs.length>0?msgs[0].id:null;
      showOlderBtn(_hasMoreMsgs);
      if(scrollToMsgId){
        setTimeout(function(){
          var el=document.querySelector('[data-msg-id="'+scrollToMsgId+'"]');
          if(el)el.scrollIntoView({behavior:'smooth',block:'center'});
        },200);
      }else if(scrollBottom){
        setTimeout(scrollToBottom,100);
      }
    })
    .catch(function(e){console.error('Error loading messages:',e);});
}

function renderMsgs(msgs){
  var list=document.getElementById('chatMsgList');
  if(!list)return;
  _lastMsgDate=null;
  if(!Array.isArray(msgs)||msgs.length===0){
    list.innerHTML='<div class="empty-state-chat"><svg viewBox="0 0 72 72" fill="none"><circle cx="36" cy="36" r="35" stroke="#E4DDD4" stroke-width="1.5" opacity="0.4"/><path d="M20 26c0-4 3-7 7-7h18c4 0 7 3 7 7v14c0 4-3 7-7 7h-4l-7 6-7-6h-4c-4 0-7-3-7-7V26z" fill="#F0EBE3"/><path d="M27 32h18M27 39h12" stroke="#D4CCC2" stroke-width="2" stroke-linecap="round"/><circle cx="56" cy="20" r="5" fill="#FF6B2C" opacity="0.12" class="fb-dot"/><circle cx="58" cy="18" r="2" fill="#FF6B2C" opacity="0.25"/></svg><h3>Hola! C\u00F3mo podemos ayudarte?</h3><p>Escrib\u00ED tu consulta y te responderemos a la brevedad.</p></div>';
    return;
  }
  var html='';
  for(var i=0;i<msgs.length;i++){
    var m=msgs[i];
    var msgDate=new Date(m.createdAt);
    var dateStr=msgDate.toDateString();
    if(dateStr!==_lastMsgDate){
      html+='<div style="text-align:center;padding:8px 0 12px;position:relative"><span style="font-size:10px;font-weight:600;color:var(--gray);background:var(--cream);padding:3px 14px;border-radius:10px;letter-spacing:.3px;text-transform:uppercase">'+formatDate(msgDate)+'</span></div>';
      _lastMsgDate=dateStr;
    }
    html+=buildMsgHtml(m);
  }
  list.innerHTML=html;
}

function buildMsgHtml(m){
  var msgDate=new Date(m.createdAt);
  var time=formatTime(msgDate);
  var isMine=currentUser&&m.from===currentUser.id;
  var productData=m.text?parseProductData(m.text):null;
  var content='';
  if(productData){
    content=renderProductCard(productData);
  }else if(m.imageUrl){
    content='<img src="'+escapeHtml(m.imageUrl)+'" style="max-width:220px;border-radius:10px;display:block;cursor:pointer" onclick="openLightbox(\''+escapeHtml(m.imageUrl)+'\')">';
    if(m.imageCaption)content+='<p style="margin-top:6px;font-size:13px">'+escapeHtml(m.imageCaption)+'</p>';
  }else{
    content='<p style="margin:0;line-height:1.5">'+escapeHtml(m.text||'')+'</p>';
  }
  return '<div class="msg-wrap'+(isMine?' mine':'')+'" data-msg-id="'+(m.id||'')+'">'+
    (!isMine?'<div class="msg-avatar">GP</div>':'')+
    '<div class="msg-bubble">'+
      content+
      '<div class="msg-time">'+time+'<span class="msg-status">'+getStatusHtml(m)+'</span></div>'+
    '</div>'+
  '</div>';
}

function showOlderBtn(visible){
  var list=document.getElementById('chatMsgList');
  if(!list)return;
  var btn=list.querySelector('#olderMsgsBtn');
  if(!visible){
    if(btn)btn.style.display='none';
    return;
  }
  if(!btn){
    btn=document.createElement('div');
    btn.id='olderMsgsBtn';
    btn.style.cssText='text-align:center;padding:12px 0;position:relative;z-index:1';
    btn.innerHTML='<button onclick="loadOlderMessages()" style="background:var(--cream2);border:1.5px solid var(--border);border-radius:10px;padding:6px 18px;font-size:12px;font-weight:600;color:var(--gray);cursor:pointer;transition:all .15s" onmouseover="this.style.background=\'var(--orange)\';this.style.color=\'#fff\';this.style.borderColor=\'var(--orange)\'" onmouseout="this.style.background=\'var(--cream2)\';this.style.color=\'var(--gray)\';this.style.borderColor=\'var(--border)\'">Cargar mensajes anteriores</button>';
    list.insertBefore(btn,list.firstChild);
  }
  btn.style.display='block';
}

function loadOlderMessages(){
  if(!userConvId||!_msgCursor)return;
  var btn=document.querySelector('#olderMsgsBtn');
  if(btn)btn.innerHTML='<span style="font-size:12px;color:var(--gray)">Cargando...</span>';
  var headers={};
  
  fetch(API_URL+'/api/conversations/'+userConvId+'/messages?limit='+PAGE_SIZE+'&cursor='+_msgCursor,{headers:headers})
    .then(function(r){
      if(!r.ok)throw new Error('Error al cargar mensajes');
      return r.json();
    })
    .then(function(msgs){
      prependMessages(msgs);
      if(msgs.length<PAGE_SIZE){
        _hasMoreMsgs=false;
        showOlderBtn(false);
      }else{
        _msgCursor=msgs[0].id;
        showOlderBtn(true);
      }
    })
    .catch(function(e){
      console.error('Error loading older messages:',e);
      if(btn)btn.innerHTML='<button onclick="loadOlderMessages()" style="background:var(--cream2);border:1.5px solid var(--border);border-radius:10px;padding:6px 18px;font-size:12px;font-weight:600;color:var(--gray);cursor:pointer">Cargar mensajes anteriores</button>';
    });
}

function prependMessages(msgs){
  var list=document.getElementById('chatMsgList');
  if(!list||!msgs||msgs.length===0)return;
  var btn=list.querySelector('#olderMsgsBtn');
  var refNode=btn?btn.nextSibling:list.firstChild;
  var html='';
  for(var i=0;i<msgs.length;i++){
    html+=buildMsgHtml(msgs[i]);
  }
  var temp=document.createElement('div');
  temp.innerHTML=html;
  while(temp.firstChild){
    list.insertBefore(temp.firstChild,refNode);
  }
}

function appendMessageToChat(msg){
  var list=document.getElementById('chatMsgList');
  if(!list)return;
  if(msg.id){
    var existing=list.querySelector('[data-msg-id="'+msg.id+'"]');
    if(existing)return;
  }
  var msgDate=new Date(msg.createdAt);
  var dateStr=msgDate.toDateString();
  if(dateStr!==_lastMsgDate){
    list.insertAdjacentHTML('beforeend','<div style="text-align:center;padding:8px 0 12px;position:relative;animation:fadeIn .3s ease"><span style="font-size:10px;font-weight:600;color:var(--gray);background:var(--cream);padding:3px 14px;border-radius:10px;letter-spacing:.3px;text-transform:uppercase">'+formatDate(msgDate)+'</span></div>');
    _lastMsgDate=dateStr;
  }
  var isMine=currentUser&&msg.from===currentUser.id;
  var time=formatTime(msgDate);
  var productData=msg.text?parseProductData(msg.text):null;
  var content='';
  if(productData){
    content=renderProductCard(productData);
  }else if(msg.imageUrl){
    content='<img src="'+escapeHtml(msg.imageUrl)+'" style="max-width:220px;border-radius:10px;display:block;cursor:pointer" onclick="openLightbox(\''+escapeHtml(msg.imageUrl)+'\')">';
    if(msg.imageCaption)content+='<p style="margin-top:6px;font-size:13px">'+escapeHtml(msg.imageCaption)+'</p>';
  }else{
    content='<p style="margin:0;line-height:1.5">'+escapeHtml(msg.text||'')+'</p>';
  }
  var html='<div class="msg-wrap'+(isMine?' mine':'')+'" data-msg-id="'+(msg.id||'')+'" style="animation:msgIn .2s ease">'+
    (!isMine?'<div class="msg-avatar">GP</div>':'')+
    '<div class="msg-bubble">'+
      content+
      '<div class="msg-time">'+time+'<span class="msg-status">'+getStatusHtml(msg)+'</span></div>'+
    '</div>'+
  '</div>';
  list.insertAdjacentHTML('beforeend',html);
}

function sendMessage(){
  var input=document.getElementById('chatInput');
  if(!input||!input.value.trim()||!userConvId)return;
  var text=input.value.trim();
  input.value='';
  hideTypingIndicator();
  if(chatSocket)chatSocket.emit('stopTyping',{conversationId:userConvId});
  
  fetch(API_URL+'/api/conversations/'+userConvId+'/messages',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({userId:currentUser.id,text:text})
  })
  .then(function(r){return r.json();})
  .then(function(msg){
    appendMessageToChat(msg);
    scrollToBottom();
    checkAndShowAutoReply(text);
  })
  .catch(function(e){console.error('Error sending message:',e);showErrorToast('Error','No se pudo enviar el mensaje');});
}

var autoReplyKeywords=[
  {keywords:['precio','cuanto sale','cuanto cuesta','valor','costo','cuotas','precios'],faqId:'pagos'},
  {keywords:['envio','envían','envios','correo','entregar','demora','tarda','llega','recibir','domicilio','andreani'],faqId:'envios'},
  {keywords:['garantia','garantía','falla','roto','problema','arreglar','reparacion','cubre','funciona mal'],faqId:'garantia'},
  {keywords:['horario','atencion','abierto','local','direccion','zelarrayan','ubicacion','donde estan'],faqId:'horarios'},
  {keywords:['devolver','devolucion','arrepentimiento','reembolso','cancelar','cancelacion','boton'],faqId:'devoluciones'},
];

function checkAndShowAutoReply(text){
  if(window._autoReplyShown)return;
  if(!text||text.trim().length<3)return;
  var lowerText=text.toLowerCase();
  var matched=null;
  for(var i=0;i<autoReplyKeywords.length;i++){
    var rule=autoReplyKeywords[i];
    for(var j=0;j<rule.keywords.length;j++){
      if(lowerText.indexOf(rule.keywords[j])!==-1){
        matched=rule;
        break;
      }
    }
    if(matched)break;
  }
  if(!matched)return;
  window._autoReplyShown=true;
  var faq=faqOptions.find(function(f){return f.id===matched.faqId;});
  if(!faq)return;
  // Show contextual auto-reply
  var list=document.getElementById('chatMsgList');
  if(list){
    var autoHtml='<div class="msg-wrap" style="animation:msgIn .2s ease">'+
      '<div class="msg-bubble" style="background:#fff;border:1.5px solid var(--border)">'+
        '<p style="margin:0 0 6px;font-size:13px;font-weight:600;color:var(--dk)">'+faq.label+'</p>'+
        '<p style="margin:0 0 8px;font-size:12px;color:var(--gray);line-height:1.6">'+faq.answer+'</p>'+
        '<div class="msg-time" style="margin-top:6px">'+formatTime(new Date())+'</div>'+
      '</div>'+
    '</div>';
    list.insertAdjacentHTML('beforeend',autoHtml);
    scrollToBottom();
  }
  var panelList=document.getElementById('panelMsgList');
  if(panelList){
    var panelAutoHtml='<div class="msg-wrap" style="animation:msgIn .2s ease">'+
      '<div class="msg-bubble" style="background:#fff;border:1.5px solid var(--border)">'+
        '<p style="margin:0 0 4px;font-size:12px;font-weight:600;color:var(--dk)">'+faq.label+'</p>'+
        '<p style="margin:0;font-size:11px;color:var(--gray);line-height:1.5">'+faq.answer+'</p>'+
      '</div>'+
    '</div>';
    panelList.insertAdjacentHTML('beforeend',panelAutoHtml);
    scrollPanelBottom();
  }
}

var faqOptions=[
  {id:'horarios',label:'Horarios de atencion',answer:'Nuestro horario de atencion es de Lunes a Viernes de 10:00 a 19:00hs y Sabados de 10:00 a 14:00hs. Estamos en Zelarrayan 179, Bahia Blanca.'},
  {id:'garantia',label:'Garantia de productos',answer:'Todos nuestros productos tienen garantia de 12 meses segun Ley 24.240. Si tenes algun problema, contactanos y lo resolvemos.'},
  {id:'envios',label:'Informacion sobre envios',answer:'Realizamos envios a todo el pais. El tiempo de entrega es de 3 a 7 dias habiles. Tambien podes retirar en nuestro local en Zelarrayan 179, Bahia Blanca.'},
  {id:'pagos',label:'Medios de pago',answer:'Aceptamos Mercado Pago, tarjetas de credito/debito y efectivo. Podes pagar en hasta 12 cuotas sin interes.'},
  {id:'devoluciones',label:'Devoluciones y arrepentimientos',answer:'Tenes 10 dias habiles desde la recepcion para ejercer tu derecho de arrepentimiento segun Ley 24.240. El reembolso se procesa en 10 dias habiles.'},
];

function showAutoReply(){
  _autoReplyShown=true;
  var list=document.getElementById('chatMsgList');
  if(!list)return;
  
  var faqButtonsHtml=faqOptions.map(function(faq){
    return '<button onclick="handleFaqClick(\''+faq.id+'\')" style="display:block;width:100%;padding:10px 14px;margin-bottom:6px;background:#fff;border:1.5px solid var(--border);border-radius:10px;font-size:12px;font-weight:600;color:var(--dk);cursor:pointer;text-align:left;transition:all .15s" onmouseover="this.style.borderColor=\'var(--orange)\';this.style.background=\'rgba(255,107,44,.05)\'" onmouseout="this.style.borderColor=\'var(--border)\';this.style.background=\'#fff\'">'+faq.label+'</button>';
  }).join('');
  
  var html='<div class="msg-wrap" style="animation:msgIn .2s ease">'+
    '<div class="msg-bubble" style="background:#fff;border:1.5px solid var(--border);max-width:100%">'+
      '<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:var(--dk)">Hola! Ac\u00E1 ten\u00E9s algunas respuestas r\u00E1pidas:</p>'+
      '<p style="margin:0 0 12px;font-size:12px;color:var(--gray)">Seleccion\u00E1 una opci\u00F3n o escribinos directamente:</p>'+
      '<div id="faqButtons">'+faqButtonsHtml+'</div>'+
      '<div class="msg-time">'+formatTime(new Date())+'</div>'+
    '</div>'+
  '</div>';
  
  list.insertAdjacentHTML('beforeend',html);
  scrollToBottom();
  showPanelAutoReply();
}

function showPanelAutoReply(){
  var list=document.getElementById('panelMsgList');
  if(!list)return;
  
  var faqButtonsHtml=faqOptions.map(function(faq){
    return '<button onclick="handleFaqClick(\''+faq.id+'\')" style="display:block;width:100%;padding:8px 12px;margin-bottom:4px;background:#fff;border:1.5px solid var(--border);border-radius:8px;font-size:11px;font-weight:600;color:var(--dk);cursor:pointer;text-align:left;transition:all .15s" onmouseover="this.style.borderColor=\'var(--orange)\';this.style.background=\'rgba(255,107,44,.05)\'" onmouseout="this.style.borderColor=\'var(--border)\';this.style.background=\'#fff\'">'+faq.label+'</button>';
  }).join('');
  
  var html='<div class="msg-wrap" style="animation:msgIn .2s ease">'+
    '<div class="msg-bubble" style="background:#fff;border:1.5px solid var(--border);max-width:100%">'+
      '<p style="margin:0 0 6px;font-size:12px;font-weight:600;color:var(--dk)">Hola! Ac\u00E1 ten\u00E9s respuestas r\u00E1pidas:</p>'+
      '<p style="margin:0 0 8px;font-size:11px;color:var(--gray)">Seleccion\u00E1 una opci\u00F3n:</p>'+
      '<div id="panelFaqButtons">'+faqButtonsHtml+'</div>'+
    '</div>'+
  '</div>';
  
  list.insertAdjacentHTML('beforeend',html);
  scrollPanelBottom();
}

function handleFaqClick(faqId){
  var faq=faqOptions.find(function(f){return f.id===faqId;});
  if(!faq)return;
  
  var list=document.getElementById('chatMsgList');
  if(list){
    var html='<div class="msg-wrap" style="animation:msgIn .2s ease">'+
      '<div class="msg-avatar">GP</div>'+
      '<div class="msg-bubble">'+
        '<p style="margin:0 0 4px;font-size:12px;font-weight:600;color:var(--orange)">'+faq.label+'</p>'+
        '<p style="margin:0">'+faq.answer+'</p>'+
        '<div class="msg-time">'+formatTime(new Date())+'</div>'+
      '</div>'+
    '</div>';
    list.insertAdjacentHTML('beforeend',html);
    scrollToBottom();
  }
  
  var panelList=document.getElementById('panelMsgList');
  if(panelList){
    var panelHtml='<div class="msg-wrap" style="animation:msgIn .2s ease">'+
      '<div class="msg-avatar" style="width:26px;height:26px;font-size:9px">GP</div>'+
      '<div class="msg-bubble">'+
        '<p style="margin:0 0 4px;font-size:11px;font-weight:600;color:var(--orange)">'+faq.label+'</p>'+
        '<p style="margin:0;font-size:12px">'+faq.answer+'</p>'+
      '</div>'+
    '</div>';
    panelList.insertAdjacentHTML('beforeend',panelHtml);
    scrollPanelBottom();
  }
  
  var faqContainer=document.getElementById('faqButtons');
  if(faqContainer){
    var btns=faqContainer.querySelectorAll('button');
    btns.forEach(function(btn){
      btn.disabled=true;
      btn.style.opacity='0.5';
      btn.style.cursor='not-allowed';
    });
  }
  var panelFaqContainer=document.getElementById('panelFaqButtons');
  if(panelFaqContainer){
    var pBtns=panelFaqContainer.parentElement.querySelectorAll('button');
    pBtns.forEach(function(btn){
      btn.disabled=true;
      btn.style.opacity='0.5';
      btn.style.cursor='not-allowed';
    });
  }
}

function sendChatImg(input){
  var file=input.files[0];
  if(!file||!userConvId)return;
  validateImageFile(file, function(ok){
    if(!ok)return;
    var formData=new FormData();
    formData.append('file',file);
    formData.append('upload_preset','greatphones');
    
    fetch('https://api.cloudinary.com/v1_1/dck24mtpw/image/upload',{
    method:'POST',
    body:formData
  })
  .then(function(r){return r.json();})
  .then(function(data){
    if(data.secure_url){
      fetch(API_URL+'/api/conversations/'+userConvId+'/messages',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({userId:currentUser.id,imageUrl:data.secure_url,imageCaption:file.name})
      })
      .then(function(r){return r.json();})
      .then(function(msg){
        appendMessageToChat(msg);
        scrollToBottom();
        checkAndShowAutoReply(file.name);
      });
    }
  })
  .catch(function(e){console.error('Error uploading image:',e);showErrorToast('Error','No se pudo subir la imagen');});
    input.value='';
  });
}

function markAsRead(convId){
  if(!currentUser)return;
  fetch(API_URL+'/api/conversations/'+convId+'/read',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({readerId:currentUser.id})
  }).catch(function(e){console.error('Error marking conversation as read:',e);});
  if(chatSocket)chatSocket.emit('markRead',{conversationId:convId});
}

function showTypingIndicator(userName){
  var el=document.getElementById('typingIndicator');
  if(el){
    el.innerHTML='<span class="typing-dots"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></span><span style="font-size:12px;color:var(--gray)">'+escapeHtml(userName||'Great Phones')+' est\u00E1 escribiendo...</span>';
    el.style.display='block';
  }
}

function hideTypingIndicator(){
  var el=document.getElementById('typingIndicator');
  if(el)el.style.display='none';
}

function handleAdminTyping(){
  if(!userConvId||!currentUser)return;
  if(chatSocket)chatSocket.emit('typing',{conversationId:userConvId,userName:'Great Phones'});
  if(adminTypingTimeout)clearTimeout(adminTypingTimeout);
  adminTypingTimeout=setTimeout(function(){
    if(chatSocket)chatSocket.emit('stopTyping',{conversationId:userConvId});
  },3000);
}

function handleTyping(){
  if(!userConvId||!currentUser)return;
  if(chatSocket)chatSocket.emit('typing',{conversationId:userConvId,userName:currentUser.name});
  if(typingTimeout)clearTimeout(typingTimeout);
  typingTimeout=setTimeout(function(){
    if(chatSocket)chatSocket.emit('stopTyping',{conversationId:userConvId});
  },3000);
}

function scrollToBottom(){
  var list=document.getElementById('chatMsgList');
  if(list)list.scrollTop=list.scrollHeight;
}

function formatTime(d){
  return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
}
function formatDate(d){
  var today=new Date();var yesterday=new Date(today);yesterday.setDate(yesterday.getDate()-1);
  var dd=String(d.getDate()).padStart(2,'0');var mm=String(d.getMonth()+1).padStart(2,'0');var yyyy=d.getFullYear();
  if(d.toDateString()===today.toDateString())return'Hoy';
  if(d.toDateString()===yesterday.toDateString())return'Ayer';
  return dd+'/'+mm+'/'+yyyy;
}
var _lastMsgDate=null;

function timeAgo(d){
  var now=new Date();
  var diff=Math.floor((now-d)/1000);
  if(diff<60)return'Ahora';
  if(diff<3600)return Math.floor(diff/60)+'min';
  if(diff<86400)return Math.floor(diff/3600)+'h';
  return Math.floor(diff/86400)+'d';
}

// =========== SCROLL FAB ===========
var _pendingMsgCount=0;
var _panelPendingMsgCount=0;
var _scrollListenersInit=false;
function initChatScrollListeners(){
  if(_scrollListenersInit)return;
  _scrollListenersInit=true;
  var list=document.getElementById('chatMsgList');
  var fab=document.getElementById('scrollFab');
  if(list&&fab){
    list.addEventListener('scroll',function(){
      var isUp=list.scrollTop+list.clientHeight<list.scrollHeight-50;
      fab.style.display=isUp?'flex':'none';
    });
  }
  var panelList=document.getElementById('panelMsgList');
  var panelFab=document.getElementById('panelScrollFab');
  if(panelList&&panelFab){
    panelList.addEventListener('scroll',function(){
      var isUp=panelList.scrollTop+panelList.clientHeight<panelList.scrollHeight-50;
      panelFab.style.display=isUp?'flex':'none';
    });
  }
}
function clickScrollFab(){
  scrollToBottom();
  var fab=document.getElementById('scrollFab');
  var badge=document.getElementById('scrollFabBadge');
  if(fab)fab.style.display='none';
  if(badge){badge.style.display='none';badge.textContent='0';}
  _pendingMsgCount=0;
}
function clickPanelScrollFab(){
  scrollPanelBottom();
  var fab=document.getElementById('panelScrollFab');
  var badge=document.getElementById('panelScrollFabBadge');
  if(fab)fab.style.display='none';
  if(badge){badge.style.display='none';badge.textContent='0';}
  _panelPendingMsgCount=0;
}
function scrollIfNeeded(){
  var list=document.getElementById('chatMsgList');
  var isAtBottom=!list||(list.scrollTop+list.clientHeight>=list.scrollHeight-50);
  if(isAtBottom){
    scrollToBottom();
  }else{
    _pendingMsgCount++;
    var badge=document.getElementById('scrollFabBadge');
    var fab=document.getElementById('scrollFab');
    if(badge){badge.textContent=_pendingMsgCount;badge.style.display='flex';}
    if(fab)fab.style.display='flex';
  }
  var panelList=document.getElementById('panelMsgList');
  if(!panelList)return;
  var isPanelAtBottom=(panelList.scrollTop+panelList.clientHeight>=panelList.scrollHeight-50);
  if(isPanelAtBottom){
    scrollPanelBottom();
  }else{
    _panelPendingMsgCount++;
    var pBadge=document.getElementById('panelScrollFabBadge');
    var pFab=document.getElementById('panelScrollFab');
    if(pBadge){pBadge.textContent=_panelPendingMsgCount;pBadge.style.display='flex';}
    if(pFab)pFab.style.display='flex';
  }
}

// =========== WIDGET PREVIEW ===========
function updateChatWidgetPreview(text){
  var preview=document.getElementById('chatWidgetPreview');
  if(!preview)return;
  if(!chatPanelOpen&&text){
    var previewText=text.length>35?text.substring(0,35)+'...':text;
    preview.innerHTML='<strong>Great Phones</strong> '+escapeHtml(previewText);
    preview.classList.add('show');
  }else{
    preview.classList.remove('show');
  }
}

// =========== PRODUCT SHARING ===========
var PRODUCT_PREFIX='@PRODUCT@';
function parseProductData(text){
  if(!text||text.indexOf(PRODUCT_PREFIX)!==0)return null;
  try{
    return JSON.parse(text.substring(PRODUCT_PREFIX.length));
  }catch(e){return null;}
}
function renderProductCard(product){
  var img=product.image||product.imageUrl||'';
  var name=product.name||'Producto';
  var price=product.price||0;
  var pid=product.id||'';
  var priceStr='$'+Number(price).toLocaleString('es-AR');
  var variantInfo=product.variant||'';
  var storageInfo=product.storage?'<div class="msg-product-card-detail">💾 '+escapeHtml(product.storage)+'</div>':'';
  var colorInfo=product.color?'<div class="msg-product-card-detail">🎨 '+escapeHtml(product.color)+'</div>':'';
  return '<div class="msg-product-card" onclick="event.stopPropagation();openDetail(\''+escapeHtml(pid)+'\')" style="cursor:pointer">'+
    (img?'<img src="'+escapeHtml(img)+'" class="msg-product-card-img" onerror="this.style.display=\'none\'">':'<div class="msg-product-card-img" style="display:flex;align-items:center;justify-content:center;font-size:18px">📦</div>')+
    '<div class="msg-product-card-info">'+
      '<div class="msg-product-card-name">'+escapeHtml(name)+'</div>'+
      storageInfo+colorInfo+
      '<div class="msg-product-card-price">'+priceStr+'</div>'+
      '<div class="msg-product-card-link">🔗 Ver producto</div>'+
    '</div>'+
  '</div>';
}

var _productSearchTimeout=null;
function openProductSearch(){
  var overlay=document.getElementById('productSearchOverlay');
  if(overlay)overlay.style.display='flex';
  setTimeout(function(){
    var input=document.getElementById('productSearchInput');
    if(input){input.value='';input.focus();}
    var results=document.getElementById('productSearchResults');
    if(results)results.innerHTML='<div style="text-align:center;padding:3rem 1rem;color:var(--gray)"><div style="font-size:32px;margin-bottom:12px">🔍</div><p style="font-size:13px;font-weight:500;color:var(--dk);margin-bottom:4px">Escribí para buscar productos</p><p style="font-size:12px">Compartí un producto en el chat como tarjeta</p></div>';
  },100);
}
function closeProductSearch(){
  var overlay=document.getElementById('productSearchOverlay');
  if(overlay)overlay.style.display='none';
}
function searchAdminProducts(query){
  if(_productSearchTimeout)clearTimeout(_productSearchTimeout);
  _productSearchTimeout=setTimeout(function(){
    var results=document.getElementById('productSearchResults');
    if(!results)return;
    if(!query||!query.trim()){
      results.innerHTML='<div style="text-align:center;padding:3rem 1rem;color:var(--gray)"><div style="font-size:32px;margin-bottom:12px">🔍</div><p style="font-size:13px;font-weight:500;color:var(--dk);margin-bottom:4px">Escribí para buscar productos</p><p style="font-size:12px">Compartí un producto en el chat como tarjeta</p></div>';
      return;
    }
    results.innerHTML='<div style="text-align:center;padding:3rem 1rem;color:var(--gray)"><div style="width:24px;height:24px;border:3px solid var(--border);border-top-color:var(--orange);border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 12px"></div><p style="font-size:12px">Buscando...</p></div>';
    fetch(API_URL+'/api/products?search='+encodeURIComponent(query.trim())+'&limit=15')
      .then(function(r){return r.json();})
      .then(function(data){
        var products=data&&data.data?data.data:[];
        if(!products||products.length===0){
          results.innerHTML='<div style="text-align:center;padding:3rem 1rem;color:var(--gray)"><div style="font-size:32px;margin-bottom:12px">😕</div><p style="font-size:13px;font-weight:500;color:var(--dk);margin-bottom:4px">Sin resultados</p><p style="font-size:12px">Probá con otro término de búsqueda</p></div>';
          return;
        }
        results.innerHTML=products.map(function(p){
          var img=p.imageUrl||p.images&&p.images[0]||'';
          var priceStr='$'+Number(p.price).toLocaleString('es-AR');
          return '<div class="product-search-item" onclick="selectAdminProduct(\''+escapeHtml(p.id)+'\')">'+
            (img?'<img src="'+escapeHtml(img)+'" class="product-search-item-img" onerror="this.style.display=\'none\'">':'<div class="product-search-item-img" style="display:flex;align-items:center;justify-content:center;font-size:16px;background:var(--cream)">📦</div>')+
            '<div class="product-search-item-info">'+
              '<div class="product-search-item-name">'+escapeHtml(p.name)+'</div>'+
              '<div class="product-search-item-price">'+priceStr+'</div>'+
              (p.brand?'<div class="product-search-item-brand">'+escapeHtml(p.brand)+'</div>':'')+
            '</div>'+
            '<button style="padding:6px 14px;background:linear-gradient(135deg,var(--orange) 0%,#e55a1a 100%);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:11px;font-weight:600;white-space:nowrap;flex-shrink:0;transition:transform .1s" onmouseover="this.style.transform=\'scale(1.05)\'" onmouseout="this.style.transform=\'scale(1)\'">Enviar</button>'+
          '</div>';
        }).join('');
      })
      .catch(function(e){
        console.error('Error searching products:',e);
        results.innerHTML='<div style="text-align:center;padding:3rem 1rem;color:var(--gray)"><div style="font-size:32px;margin-bottom:12px">❌</div><p style="font-size:13px;font-weight:500;color:var(--dk);margin-bottom:4px">Error al buscar</p><p style="font-size:12px">Intentalo de nuevo más tarde</p></div>';
      });
  },300);
}
function selectAdminProduct(productId){
  fetch(API_URL+'/api/products/'+productId)
    .then(function(r){
      if(!r.ok)throw new Error('Product not found');
      return r.json();
    })
    .then(function(product){
      sendProductMessage(product);
    })
    .catch(function(e){
      console.error('Error fetching product:',e);
      showErrorToast('Error','No se pudo obtener el producto');
    });
}
function sendProductMessage(product){
  if(!userConvId){showErrorToast('Error','No hay una conversación activa');return;}
  var productData={
    id:product.id,
    name:product.name,
    price:product.price,
    image:product.imageUrl||(product.images&&product.images[0])||'',
    slug:product.slug||''
  };
  var encodedText=PRODUCT_PREFIX+JSON.stringify(productData);
  closeProductSearch();
  fetch(API_URL+'/api/conversations/'+userConvId+'/messages',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({userId:currentUser.id,text:encodedText})
  })
  .then(function(r){return r.json();})
  .then(function(msg){
    appendMessageToChat(msg);
    scrollToBottom();
  })
  .catch(function(e){console.error('Error sending product message:',e);showErrorToast('Error','No se pudo enviar el producto');});
}

// =========== SEND PRODUCT FROM DETAIL (USER SIDE) ===========
function consultarProducto(){
  if(!currentUser){window.location.href='/login';return;}
  if(!window.currentProd)return;
  var p=window.currentProd;
  var v=window._selectedVariant;
  var variantLabel=v&&(v.storage||v.color)?' ('+[v.storage,v.color].filter(Boolean).join(' / ')+')':'';
  var productData={
    id:p.id,
    name:p.name+(variantLabel||''),
    price:v&&v.targetPrice?v.targetPrice:p.price,
    image:p.imageUrl||(p.images&&p.images[0])||'',
    slug:p.slug||'',
    variant:v?variantLabel.trim():'',
    storage:v?v.storage:null,
    color:v?v.color:null,
    imei:v?v.imei:null
  };
  var encodedText=PRODUCT_PREFIX+JSON.stringify(productData);

  // Open chat panel
  if(!chatPanelOpen){
    chatPanelOpen=true;
    var panel=document.getElementById('chatPanel');
    var wrapEl=document.getElementById('chatWidgetWrap');
    if(panel)panel.style.transform='translateX(0)';
    if(wrapEl)wrapEl.style.display='none';
  }

  // Ensure socket is connected
  if(typeof initChatSocket==='function'&&(!chatSocket||!chatSocket.connected)){
    initChatSocket();
  }

  // Get or create conversation, then send
  ensureUserConversation().then(function(convId){
    userConvId=convId;
    fetch(API_URL+'/api/conversations/'+convId+'/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({userId:currentUser.id,text:encodedText})
    })
    .then(function(r){return r.json();})
    .then(function(msg){
      appendPanelMessage(msg);
      scrollPanelBottom();
      if(chatSocket)chatSocket.emit('joinConversation',convId);
      // Load messages to show history
      if(typeof loadPanelMessages==='function')loadPanelMessages(convId,true);
    })
    .catch(function(e){console.error('Error sending product from detail:',e);showErrorToast('Error','No se pudo enviar el producto');});
  });
}

function ensureUserConversation(){
  return new Promise(function(resolve){
    if(userConvId&&window._adminConvs){
      resolve(userConvId);
      return;
    }
    fetch(API_URL+'/api/conversations?userId='+currentUser.id)
      .then(function(r){return r.json();})
      .then(function(convs){
        if(convs&&convs.length>0){
          userConvId=convs[0].id;
          resolve(userConvId);
        }else{
          fetch(API_URL+'/api/conversations',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({userId:currentUser.id,type:'GENERIC',subject:'Chat con Great Phones',firstMessage:''})
          })
          .then(function(r){return r.json();})
          .then(function(conv){
            userConvId=conv.id;
            resolve(userConvId);
          });
        }
      });
  });
}

// =========== MESSAGE SEARCH ===========
var _msgSearchActive=false;
var _msgSearchResults=[];
var _msgSearchIdx=0;
function openMsgSearch(){
  var bar=document.getElementById('msgSearchBar');
  var input=document.getElementById('msgSearchInput');
  if(!bar||!input)return;
  bar.style.display='block';
  input.value='';
  input.focus();
  _msgSearchActive=true;
}
function closeMsgSearch(){
  var bar=document.getElementById('msgSearchBar');
  if(bar)bar.style.display='none';
  _msgSearchActive=false;
  _msgSearchResults=[];
}
function searchInMessages(query){
  if(!userConvId||!query||!query.trim()){
    _msgSearchResults=[];
    _msgSearchIdx=0;
    loadMessages(userConvId);
    return;
  }
  fetch(API_URL+'/api/conversations/'+userConvId+'/messages?search='+encodeURIComponent(query.trim())+'&limit=100')
    .then(function(r){return r.json();})
    .then(function(msgs){
      if(!msgs||msgs.length===0){
        showInfoToast('Sin resultados','No se encontraron mensajes con "'+query+'"');
        return;
      }
      _msgSearchResults=msgs;
      _msgSearchIdx=0;
      renderMsgSearchResults(msgs);
    })
    .catch(function(e){console.error('Error searching messages:',e);showErrorToast('Error','Error al buscar mensajes');});
}
function renderMsgSearchResults(msgs){
  var list=document.getElementById('chatMsgList');
  if(!list)return;
  list.innerHTML='<div style="padding:8px 0;font-size:11px;color:var(--gray);display:flex;justify-content:space-between;align-items:center">'+
    '<span>🔍 Se encontraron <strong>'+msgs.length+'</strong> mensajes</span>'+
    '<button onclick="closeMsgSearch();loadMessages(userConvId)" style="background:none;border:none;color:var(--orange);cursor:pointer;font-size:11px;font-weight:600">Limpiar</button>'+
  '</div>';
  msgs.forEach(function(m){
    var isMine=currentUser&&m.from===currentUser.id;
    var time=formatTime(new Date(m.createdAt));
    var userName=m.fromUser&&m.fromUser.name?m.fromUser.name:(isMine?'Yo':'Cliente');
    var productData=m.text?parseProductData(m.text):null;
    var content='';
    if(productData){
      content='<span style="font-size:11px">📦 '+escapeHtml(productData.name||'Producto')+'</span>';
    }else if(m.imageUrl){
      content='<span style="font-size:11px">📷 Imagen</span>'+(m.imageCaption?'<p style="margin:4px 0 0;font-size:12px">'+escapeHtml(m.imageCaption)+'</p>':'');
    }else{
      content='<p style="margin:0;line-height:1.5;font-size:13px">'+escapeHtml(m.text||'')+'</p>';
    }
    list.insertAdjacentHTML('beforeend','<div class="msg-wrap'+(isMine?' mine':'')+'" data-msg-id="'+(m.id||'')+'" style="animation:fadeIn .2s ease;cursor:pointer" onclick="scrollToMsg(\''+m.id+'\')">'+
      '<div class="msg-bubble">'+
        '<div style="font-size:10px;color:var(--gray);margin-bottom:4px;font-weight:500">'+userName+'</div>'+
        content+
        '<div class="msg-time">'+time+'</div>'+
      '</div>'+
    '</div>');
  });
}
function scrollToMsg(msgId){
  closeMsgSearch();
  if(!userConvId)return;
  loadMessages(userConvId,false,msgId);
}

// =========== EXPORT CONVERSATION ===========
function exportConversation(){
  if(!userConvId){showInfoToast('Info','Abrí una conversación primero');return;}
  fetch(API_URL+'/api/conversations/'+userConvId+'/messages?limit=500')
    .then(function(r){return r.json();})
    .then(function(msgs){
      if(!msgs||msgs.length===0){showInfoToast('Info','No hay mensajes para exportar');return;}
      var convName=document.getElementById('adminChatName');
      var userName=convName?convName.textContent:'Conversación';
      var lines=['Conversación con '+userName,'Exportado el '+new Date().toLocaleDateString('es-AR')+'\n'];
      msgs.forEach(function(m){
        var date=new Date(m.createdAt).toLocaleString('es-AR');
        var sender=m.from===currentUser.id?'Admin':'Cliente';
        var text=m.text||(m.imageUrl?'[Imagen]':'');
        lines.push('['+date+'] '+sender+': '+text);
      });
      var content=lines.join('\n');
      var blob=new Blob([content],{type:'text/plain;charset=utf-8'});
      var url=URL.createObjectURL(blob);
      var a=document.createElement('a');
      a.href=url;
      a.download='chat-'+userName.replace(/\s+/g,'-')+'.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccessToast('Exportado','Conversación descargada como archivo .txt');
    })
    .catch(function(e){console.error('Error exporting conversation:',e);showErrorToast('Error','No se pudo exportar la conversación');});
}

// =========== CANNED REPLIES MANAGEMENT ===========
var cachedCannedReplies=null;
function loadCannedReplies(){
  if(cachedCannedReplies)return Promise.resolve(cachedCannedReplies);
  return fetch(API_URL+'/api/admin/canned-replies')
    .then(function(r){return r.json();})
    .then(function(data){
      var replies=data&&data.replies?data.replies:null;
      if(replies&&replies.length>0){
        cachedCannedReplies=replies;
      }else{
        cachedCannedReplies=null;
      }
      return cachedCannedReplies;
    })
    .catch(function(){
      cachedCannedReplies=null;
      return null;
    });
}
function getCannedReplies(){
  return cachedCannedReplies||cannedReplies;
}
function openManageReplies(){
  var overlay=document.getElementById('manageRepliesOverlay');
  if(!overlay)return;
  overlay.style.display='flex';
  document.getElementById('newReplyLabel').value='';
  document.getElementById('newReplyText').value='';
  renderCannedReplyList();
}
function closeManageReplies(){
  var overlay=document.getElementById('manageRepliesOverlay');
  if(overlay)overlay.style.display='none';
}
function renderCannedReplyList(){
  var list=document.getElementById('cannedReplyList');
  if(!list)return;
  var replies=getCannedReplies();
  if(!replies||replies.length===0){
    list.innerHTML='<div style="text-align:center;padding:2rem 1rem;color:var(--gray)"><p style="font-size:13px;font-weight:500;color:var(--dk);margin-bottom:4px">Sin respuestas rápidas</p><p style="font-size:12px">Agregá una usando los campos de arriba</p></div>';
    return;
  }
  list.innerHTML=replies.map(function(r,i){
    return '<div style="display:flex;gap:8px;align-items:center;padding:8px 10px;border-radius:8px;margin-bottom:4px;background:var(--cream2)">'+
      '<span style="font-size:10px;font-weight:600;color:var(--gray);min-width:60px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escapeHtml(r.label)+'</span>'+
      '<span style="flex:1;font-size:12px;color:var(--gray);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escapeHtml(r.text)+'</span>'+
      '<button onclick="removeCannedReply('+i+')" style="padding:4px 8px;background:transparent;color:var(--red);border:1px solid rgba(239,68,68,.2);border-radius:6px;cursor:pointer;font-size:10px;font-weight:600;flex-shrink:0" onmouseover="this.style.background=\'rgba(239,68,68,.1)\'" onmouseout="this.style.background=\'transparent\'">Eliminar</button>'+
    '</div>';
  }).join('');
}
function addCannedReply(){
  var labelInput=document.getElementById('newReplyLabel');
  var textInput=document.getElementById('newReplyText');
  if(!labelInput||!textInput)return;
  var label=labelInput.value.trim();
  var text=textInput.value.trim();
  if(!label||!text){showErrorToast('Error','Completá la etiqueta y el texto');return;}
  var replies=getCannedReplies();
  if(!Array.isArray(replies)){
    replies=[];
    cachedCannedReplies=replies;
  }
  replies.push({label:label,text:text});
  labelInput.value='';
  textInput.value='';
  textInput.focus();
  renderCannedReplyList();
}
function removeCannedReply(index){
  var replies=getCannedReplies();
  if(!replies||!Array.isArray(replies))return;
  replies.splice(index,1);
  renderCannedReplyList();
}
function saveCannedReplies(){
  var replies=getCannedReplies();
  // Also update the fallback array
  var data=replies||cannedReplies;
  fetch(API_URL+'/api/admin/canned-replies',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({replies:data})
  })
  .then(function(r){return r.json();})
  .then(function(){
    cachedCannedReplies=data;
    showSuccessToast('Guardado','Respuestas rápidas guardadas correctamente');
    closeManageReplies();
  })
  .catch(function(e){
    console.error('Error saving replies:',e);
    showErrorToast('Error','No se pudieron guardar las respuestas');
  });
}

// =========== CREATE QUOTE FROM CHAT ===========
function openCreateQuoteFromChat(){
  var overlay=document.getElementById('createQuoteOverlay');
  if(!overlay)return;
  overlay.style.display='flex';
  var conv=window._adminConvs?window._adminConvs.find(function(c){return c.id===adminActiveConvId;}):null;
  if(conv&&conv.user){
    var nameEl=document.getElementById('quoteClientName');
    if(nameEl)nameEl.value=conv.user.name||'';
    var phoneEl=document.getElementById('quoteClientPhone');
    if(phoneEl&&conv.user.phone)phoneEl.value=conv.user.phone;
    var dniEl=document.getElementById('quoteClientDni');
    if(dniEl&&conv.user.dni)dniEl.value=conv.user.dni;
  }
  document.getElementById('quoteDevice').value='';
  document.getElementById('quoteStorage').value='128GB';
  document.getElementById('quoteCondition').value='Bueno';
  document.getElementById('quoteBasePrice').value='';
  document.getElementById('quoteFinalPrice').value='';
  setTimeout(function(){document.getElementById('quoteDevice').focus();},200);
}
function closeCreateQuote(){
  var overlay=document.getElementById('createQuoteOverlay');
  if(overlay)overlay.style.display='none';
}
function submitQuoteFromChat(){
  var conv=window._adminConvs?window._adminConvs.find(function(c){return c.id===adminActiveConvId;}):null;
  var userId=conv&&conv.user?conv.user.id:null;
  if(!userId){showErrorToast('Error','No se pudo identificar el usuario');return;}
  var device=document.getElementById('quoteDevice').value.trim();
  var storage=document.getElementById('quoteStorage').value;
  var condition=document.getElementById('quoteCondition').value;
  var basePrice=parseInt(document.getElementById('quoteBasePrice').value)||0;
  var finalPrice=parseInt(document.getElementById('quoteFinalPrice').value)||0;
  var clientName=document.getElementById('quoteClientName').value.trim();
  var clientDni=document.getElementById('quoteClientDni').value.trim();
  var clientPhone=document.getElementById('quoteClientPhone').value.trim();

  if(!device||!finalPrice){showErrorToast('Error','Completá el dispositivo y el precio final');return;}
  
  fetch(API_URL+'/api/quotes',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      userId:userId,
      device:device,
      storage:storage,
      condition:condition,
      basePrice:basePrice,
      finalPrice:finalPrice,
      clientName:clientName||undefined,
      clientDni:clientDni||undefined,
      clientPhone:clientPhone||undefined,
    })
  })
  .then(function(r){return r.json();})
  .then(function(data){
    if(data.success){
      showSuccessToast('Cotización creada','Código: '+data.quote.code);
      closeCreateQuote();
      // Send quote link in chat
      var text='Te generamos una cotización por tu '+device+' ('+condition+', '+storage+') por $'+finalPrice.toLocaleString('es-AR')+'. Código: '+data.quote.code;
      fetch(API_URL+'/api/conversations/'+adminActiveConvId+'/messages',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({userId:currentUser.id,text:text})
      })
      .then(function(r2){return r2.json();})
      .then(function(msg){
        appendMessageToChat(msg);
        scrollToBottom();
      })
      .catch(function(e){console.error('Error sending quote message:',e);showErrorToast('Error','Error al enviar cotización');});
    }else{
      showErrorToast('Error','No se pudo crear la cotización');
    }
  })
  .catch(function(e){console.error('Error creating quote:',e);showErrorToast('Error','Error al crear cotización');});
}

// =========== ADMIN CHAT ===========
var adminActiveConvId=null;
var _adminConvSearchQuery='';
function loadAdminConversations(){
  // Retry robusto si el contexto admin aún no está listo (evita que el div
  // quede vacío por un race de sesión al entrar a la sección Chat).
  if(!currentUser||currentUser.role!=='ADMIN'){
    window._adminConvRetry=(window._adminConvRetry||0)+1;
    if(window._adminConvRetry<=20){
      setTimeout(loadAdminConversations,150);
    }
    return;
  }
  window._adminConvRetry=0;
  var list=document.getElementById('adminConvList');
  if(!list){
    setTimeout(loadAdminConversations,100);
    return;
  }
  list.innerHTML='<div class="loader-spinner"><span>Cargando conversaciones...</span></div>';
  fetch(API_URL+'/api/admin/conversations',{
    credentials:'include',
    headers:{}
  })
    .then(function(r){
      if(!r.ok)throw new Error('HTTP '+r.status);
      return r.json();
    })
    .then(function(data){
      // El endpoint puede devolver un array directo o un objeto { conversations }.
      var convs=Array.isArray(data)?data:((data&&data.conversations)||[]);
      if(!Array.isArray(convs)){
        console.error('Invalid admin conversations response:',data);
        var list=document.getElementById('adminConvList');
        if(list)list.innerHTML='<div style="text-align:center;padding:2rem;color:var(--red)"><p style="font-size:14px;font-weight:600;margin-bottom:8px">Error al cargar conversaciones</p><p style="font-size:12px">Respuesta invalida del servidor</p><button class="ord-btn" onclick="loadAdminConversations()" style="margin-top:12px">Reintentar</button></div>';
        return;
      }
      window._adminConvs=convs;
      filterAndRenderAdminConvs(convs);
    })
    .catch(function(e){
      console.error('Error loading admin conversations:',e);
      var list=document.getElementById('adminConvList');
      if(list)list.innerHTML='<div style="text-align:center;padding:2rem;color:var(--red)"><p style="font-size:14px;font-weight:600;margin-bottom:8px">Error de conexión</p><p style="font-size:12px">No se pudieron cargar las conversaciones</p><button class="ord-btn" onclick="loadAdminConversations()" style="margin-top:12px">Reintentar</button></div>';
    });
}

function filterAndRenderAdminConvs(convs){
  if(!convs)return;
  var filtered=convs;
  if(_adminConvSearchQuery&&_adminConvSearchQuery.trim()){
    var q=_adminConvSearchQuery.trim().toLowerCase();
    filtered=convs.filter(function(c){
      var userName=(c.user&&c.user.name)?c.user.name.toLowerCase():'';
      var userEmail=(c.user&&c.user.email)?c.user.email.toLowerCase():'';
      var userDni=(c.user&&c.user.dni)?c.user.dni.toLowerCase():'';
      var lastMsg=(c.messages&&c.messages[0])?(c.messages[0].text||'').toLowerCase():'';
      return userName.indexOf(q)!==-1||userEmail.indexOf(q)!==-1||userDni.indexOf(q)!==-1||lastMsg.indexOf(q)!==-1;
    });
  }
  renderAdminConvList(filtered);
}

function searchAdminConvs(query){
  _adminConvSearchQuery=query;
  filterAndRenderAdminConvs(window._adminConvs||[]);
}

function getInitials(name){
  if(!name)return'?';
  var parts=name.trim().split(/\s+/);
  if(parts.length>=2)return(parts[0][0]+parts[1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
}
var avatarGradients=['linear-gradient(135deg,#FF6B2C,#e55a1a)','linear-gradient(135deg,#2563eb,#1d4ed8)','linear-gradient(135deg,#059669,#047857)','linear-gradient(135deg,#7c3aed,#6d28d9)','linear-gradient(135deg,#d97706,#b45309)','linear-gradient(135deg,#dc2626,#b91c1c)','linear-gradient(135deg,#0891b2,#0e7490)','linear-gradient(135deg,#db2777,#be185d)'];
function getAvatarGrad(name){
  if(!name)return avatarGradients[0];
  var hash=0;
  for(var i=0;i<name.length;i++){hash=name.charCodeAt(i)+((hash<<5)-hash);}
  return avatarGradients[Math.abs(hash)%avatarGradients.length];
}

function renderAdminConvList(convs){
  var list=document.getElementById('adminConvList');
  var count=document.getElementById('adminConvCount');
  if(!list)return;
  if(!convs||convs.length===0){
    list.innerHTML='<div style="text-align:center;padding:3rem 1.5rem;color:var(--gray)"><div style="width:56px;height:56px;border-radius:50%;background:var(--cream2);display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;font-size:24px">\u{1F4AC}</div><p style="font-size:14px;font-weight:600;color:var(--dk);margin-bottom:4px">Sin conversaciones</p><p style="font-size:12px;line-height:1.5">No hay chats disponibles.<br>Cuando un cliente inicie uno, aparecerá aquí.</p></div>';
    if(count)count.textContent='0';
    return;
  }
  if(count)count.textContent=convs.length;
  list.innerHTML=convs.map(function(c){
    var lastMsgRaw=c.messages&&c.messages[0]?c.messages[0].text||'':''; 
    var lastMsg=lastMsgRaw?((lastMsgRaw.indexOf(PRODUCT_PREFIX)===0)?'\u{1F4E6} Producto':(c.messages&&c.messages[0]&&c.messages[0].imageUrl?'\u{1F4F7} Imagen':lastMsgRaw)):''; 
    var time=c.lastMsgAt?timeAgo(new Date(c.lastMsgAt)):'';
    var unreadCount=c.unreadByAdmin||0;
    var userName=c.user?c.user.name:'Cliente';
    var userEmail=c.user?c.user.email:'';
    var initials=getInitials(userName);
    var grad=getAvatarGrad(userName);
    var isActive=c.id===adminActiveConvId;
    var status=c.status||'OPEN';
    var statusColors={OPEN:'#059669',CLOSED:'var(--gray)',RESOLVED:'#2563eb'};
    var statusLabels={OPEN:'Abierta',CLOSED:'Cerrada',RESOLVED:'Resuelta'};
    var statusColor=statusColors[status]||'var(--gray)';
    var statusLabel=statusLabels[status]||status;
    return '<div onclick="openAdminConv(\''+c.id+'\')" style="cursor:pointer;padding:14px 18px;display:flex;gap:12px;align-items:flex-start;transition:all .15s;background:'+(isActive?'rgba(255,107,44,.07)':'transparent')+';border-left:3px solid '+(isActive?'var(--orange)':'transparent')+';position:relative" onmouseover="this.style.background=\''+(isActive?'rgba(255,107,44,.07)':'rgba(255,107,44,.04)')+'\'" onmouseout="this.style.background=\''+(isActive?'rgba(255,107,44,.07)':'transparent')+'\'">'+
      '<div style="width:40px;height:40px;min-width:40px;border-radius:50%;background:'+grad+';display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;flex-shrink:0;box-shadow:0 2px 6px rgba(0,0,0,.1)">'+initials+'</div>'+
      '<div style="flex:1;min-width:0">'+
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">'+
          '<span style="font-size:13px;font-weight:600;color:var(--dk)">'+esc(userName)+'</span>'+
          '<div style="display:flex;align-items:center;gap:6px">'+
            (time?'<span style="font-size:10px;color:var(--gray)">'+time+'</span>':'')+
            (unreadCount>0?'<span style="background:var(--orange);color:#fff;font-size:9px;font-weight:700;min-width:18px;height:18px;display:flex;align-items:center;justify-content:center;border-radius:9px;padding:0 5px;box-sizing:border-box">'+(unreadCount>99?'99+':unreadCount)+'</span>':'')+
          '</div>'+
        '</div>'+
        (userEmail?'<div style="font-size:10px;color:var(--gray);margin-bottom:4px">'+esc(userEmail)+'</div>':'')+
        '<div style="display:flex;align-items:center;gap:6px">'+
          '<span class="conv-last-msg" style="font-size:11px;color:var(--gray);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px">'+esc(lastMsg||'Sin mensajes')+'</span>'+
          '<span style="width:5px;height:5px;border-radius:50%;background:'+statusColor+';flex-shrink:0"></span>'+
          '<span style="font-size:9px;color:'+statusColor+';font-weight:500;text-transform:uppercase;letter-spacing:.3px">'+statusLabel+'</span>'+
        '</div>'+
      '</div>'+
    '</div>';
  }).join('');
}

function openAdminConv(id){
  adminActiveConvId=id;
  userConvId=id;
  loadMessages(id,true);
  markAsRead(id);
  if(chatSocket)chatSocket.emit('joinConversation',id);
  loadCannedReplies().then(function(){renderQuickReplies();});
  loadAdminConversations();
  
  var conv=window._adminConvs?window._adminConvs.find(function(c){return c.id===id;}):null;
  var userName=conv&&conv.user?conv.user.name:'Cliente';
  var userEmail=conv&&conv.user?conv.user.email:'';
  var userDni=conv&&conv.user?conv.user.dni:'';
  var initials=getInitials(userName);
  var grad=getAvatarGrad(userName);
  
  var avatarEl=document.getElementById('adminChatAvatar');
  if(avatarEl){
    avatarEl.style.display='flex';
    avatarEl.style.background=grad;
    avatarEl.textContent=initials;
  }
  var nameEl=document.getElementById('adminChatName');
  if(nameEl)nameEl.textContent=userName;
  var subEl=document.getElementById('adminChatSub');
  if(subEl){
    var subParts=[];
    if(userEmail)subParts.push(userEmail);
    if(userDni)subParts.push('DNI: '+userDni);
    subEl.textContent=subParts.join(' · ')||'Cliente';
  }
  var closeBtn=document.getElementById('adminCloseConvBtn');
  if(closeBtn)closeBtn.style.display='inline-flex';
  var deleteBtn=document.getElementById('adminDeleteConvBtn');
  if(deleteBtn)deleteBtn.style.display='inline-flex';
  var searchBtn=document.getElementById('adminMsgSearchBtn');
  if(searchBtn)searchBtn.style.display='inline-flex';
  var replyBtn=document.getElementById('adminManageRepliesBtn');
  if(replyBtn)replyBtn.style.display='inline-flex';
  var quoteBtn=document.getElementById('adminQuoteBtn');
  if(quoteBtn)quoteBtn.style.display='inline-flex';
  var exportBtn=document.getElementById('adminExportBtn');
  if(exportBtn)exportBtn.style.display='inline-flex';
  var dot=document.getElementById('adminOnlineDot');
  if(dot)dot.style.display='inline-block';
  
  // Mobile: show chat, hide conversation list
  if(window.innerWidth<=768){
    var convSide=document.querySelector('.chat-conv-side');
    var msgArea=document.querySelector('.chat-msg-area');
    if(convSide)convSide.classList.add('hide');
    if(msgArea)msgArea.classList.add('show');
  }
  setTimeout(function(){
    var inp=document.getElementById('adminChatInput');
    if(inp)inp.focus();
  },100);
}

function closeMobileChat(){
  var convSide=document.querySelector('.chat-conv-side');
  var msgArea=document.querySelector('.chat-msg-area');
  if(convSide)convSide.classList.remove('hide');
  if(msgArea)msgArea.classList.remove('show');
}
var quickReplyIcons=['\u2705','\u{1F68A}','\u{1F6E1}','\u{1F3ED}','\u23F3','\u2764'];
var cannedReplies=[
  {label:'Confirmado',text:'Tu pedido ha sido confirmado y estamos preparandolo. Te avisaremos cuando este listo para envio.'},
  {label:'Enviado',text:'Tu pedido fue enviado! Te compartiremos el numero de tracking para que puedas seguirlo.'},
  {label:'Garantía',text:'Tu compra tiene garantia de 12 meses segun Ley 24.240. Si tenes algun problema, contactanos.'},
  {label:'Retiro',text:'Tu pedido esta listo para retiro en nuestro local: Zelarrayan 179, Bahia Blanca. Horario: Lun a Vie 10-19hs.'},
  {label:'Demora',text:'Estamos teniendo una leve demora en tu pedido. Te agradecemos la paciencia y te avisaremos apenas este listo.'},
  {label:'Gracias',text:'Gracias por tu compra! Si tenes alguna consulta no dudes en escribirnos. Estamos para ayudarte.'},
];

function renderQuickReplies(){
  var container=document.getElementById('quickReplies');
  if(!container)return;
  var replies=getCannedReplies();
  if(!replies||replies.length===0){container.style.display='none';return;}
  container.style.display='flex';
  container.innerHTML=replies.map(function(r,i){
    return '<button onclick="useQuickReply('+i+')" title="'+esc(r.text)+'">⚡ '+esc(r.label)+'</button>';
  }).join('');
}

function useQuickReply(index){
  var replies=getCannedReplies();
  var reply=replies[index];
  if(!reply)return;
  var input=document.getElementById('adminChatInput');
  if(input){
    input.value=reply.text;
    autoResizeChatInput(input);
    toggleSendBtn();
    input.focus();
  }
}

function deleteAdminConv(id){
  if(!id)return;
  showConfirm(
    'Eliminar conversación',
    '¿Estás seguro de que querés eliminar esta conversación? Esta acción no se puede deshacer.',
    { confirmText: 'Eliminar', confirmClass: 'danger' }
  ).then(function(confirmed){
    if(!confirmed) return;
    fetch(API_URL+'/api/admin/conversations',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({conversationId:id,action:'delete'})
    })
    .then(function(r){return r.json();})
    .then(function(){
      showSuccessToast('Conversación eliminada', 'El chat y sus mensajes fueron eliminados.');
      adminActiveConvId=null;
      userConvId=null;
      resetAdminChatHeader();
      loadAdminConversations();
      var list=document.getElementById('chatMsgList');
      if(list)list.innerHTML='';
    })
    .catch(function(e){console.error('Error deleting conversation:',e);showErrorToast('Error', 'No se pudo eliminar la conversación');});
  });
}

function resetAdminChatHeader(){
  var avatarEl=document.getElementById('adminChatAvatar');
  if(avatarEl)avatarEl.style.display='none';
  var nameEl=document.getElementById('adminChatName');
  if(nameEl)nameEl.textContent='Seleccioná una conversación';
  var subEl=document.getElementById('adminChatSub');
  if(subEl)subEl.textContent='';
  var closeBtn=document.getElementById('adminCloseConvBtn');
  if(closeBtn)closeBtn.style.display='none';
  var deleteBtn=document.getElementById('adminDeleteConvBtn');
  if(deleteBtn)deleteBtn.style.display='none';
  var searchBtn=document.getElementById('adminMsgSearchBtn');
  if(searchBtn)searchBtn.style.display='none';
  var replyBtn=document.getElementById('adminManageRepliesBtn');
  if(replyBtn)replyBtn.style.display='none';
  var quoteBtn=document.getElementById('adminQuoteBtn');
  if(quoteBtn)quoteBtn.style.display='none';
  var exportBtn=document.getElementById('adminExportBtn');
  if(exportBtn)exportBtn.style.display='none';
  closeMsgSearch();
}

function closeAdminConv(id){
  if(!id)return;
  fetch(API_URL+'/api/admin/conversations',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({conversationId:id,action:'close'})
  })
  .then(function(r){return r.json();})
  .then(function(){
    showSuccessToast('Conversación cerrada','El chat se ha marcado como cerrado.');
    adminActiveConvId=null;
    userConvId=null;
    resetAdminChatHeader();
    loadAdminConversations();
    var list=document.getElementById('chatMsgList');
    if(list)list.innerHTML='';
  })
  .catch(function(e){console.error('Error closing conversation:',e);showErrorToast('Error','No se pudo cerrar la conversación');});
}

function autoResizeChatInput(el){
  el.style.height='auto';
  el.style.height=Math.min(el.scrollHeight,120)+'px';
}

function adminChatKeydown(e){
  if(e.key==='Enter'&&!e.shiftKey){
    e.preventDefault();
    sendAdminMessage();
  }
}

function toggleSendBtn(){
  var input=document.getElementById('adminChatInput');
  var btn=document.getElementById('adminSendBtn');
  if(!input||!btn)return;
  btn.style.opacity=input.value.trim()?1:.5;
  btn.style.pointerEvents=input.value.trim()?'auto':'none';
}

function sendAdminMessage(){
  var input=document.getElementById('adminChatInput');
  if(!input||!input.value.trim()||!userConvId)return;
  var text=input.value.trim();
  input.value='';
  autoResizeChatInput(input);
  toggleSendBtn();
  if(adminTypingTimeout)clearTimeout(adminTypingTimeout);
  if(chatSocket)chatSocket.emit('stopTyping',{conversationId:userConvId});
  fetch(API_URL+'/api/conversations/'+userConvId+'/messages',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({userId:currentUser.id,text:text})
  })
  .then(function(r){return r.json();})
  .then(function(msg){
    appendMessageToChat(msg);
    scrollToBottom();
  })
  .catch(function(e){console.error('Error sending admin message:',e);showErrorToast('Error','No se pudo enviar el mensaje');});
}

// =========== PANEL CHAT ===========
function sendPanelMessage(){
  var input=document.getElementById('panelChatInput');
  if(!input||!input.value.trim()||!userConvId)return;
  var text=input.value.trim();
  input.value='';
  hidePanelTyping();
  if(chatSocket)chatSocket.emit('stopTyping',{conversationId:userConvId});

  fetch(API_URL+'/api/conversations/'+userConvId+'/messages',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({userId:currentUser.id,text:text})
  })
  .then(function(r){return r.json();})
  .then(function(msg){
    appendPanelMessage(msg);
    scrollPanelBottom();
    checkAndShowAutoReply(text);
  })
  .catch(function(e){console.error('Error sending panel message:',e);showErrorToast('Error','No se pudo enviar el mensaje');});
}

function sendPanelImg(input){
  var file=input.files[0];
  if(!file||!userConvId)return;
  validateImageFile(file, function(ok){
    if(!ok)return;
    var formData=new FormData();
    formData.append('file',file);
    formData.append('upload_preset','greatphones');

    fetch('https://api.cloudinary.com/v1_1/dck24mtpw/image/upload',{
    method:'POST',
    body:formData
  })
  .then(function(r){return r.json();})
  .then(function(data){
    if(data.secure_url){
      fetch(API_URL+'/api/conversations/'+userConvId+'/messages',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({userId:currentUser.id,imageUrl:data.secure_url,imageCaption:file.name})
      })
      .then(function(r){return r.json();})
      .then(function(msg){
        appendPanelMessage(msg);
        scrollPanelBottom();
        checkAndShowAutoReply(file.name);
      });
    }
  })
  .catch(function(e){console.error('Error uploading panel image:',e);showErrorToast('Error','No se pudo subir la imagen');});
    input.value='';
  });
}

function appendPanelMessage(msg){
  var list=document.getElementById('panelMsgList');
  if(!list)return;
  if(msg.id){
    var existing=list.querySelector('[data-msg-id="'+msg.id+'"]');
    if(existing)return;
  }
  var isMine=currentUser&&msg.from===currentUser.id;
  var time=formatTime(new Date(msg.createdAt));
  var productData=msg.text?parseProductData(msg.text):null;
  var content='';
  if(productData){
    content=renderProductCard(productData);
  }else if(msg.imageUrl){
    content='<img src="'+escapeHtml(msg.imageUrl)+'" class="msg-img" onclick="openLightbox(\''+escapeHtml(msg.imageUrl)+'\')">';
    if(msg.imageCaption)content+='<p style="margin-top:6px;font-size:13px">'+escapeHtml(msg.imageCaption)+'</p>';
  }else{
    content='<p style="margin:0">'+escapeHtml(msg.text||'')+'</p>';
  }
  var html='<div class="msg-wrap'+(isMine?' mine':'')+'" data-msg-id="'+(msg.id||'')+'" style="animation:msgIn .2s ease">'+
    (!isMine?'<div class="msg-avatar" style="width:26px;height:26px;font-size:9px">GP</div>':'')+
    '<div class="msg-bubble">'+
      content+
      '<div class="msg-time">'+time+'<span class="msg-status">'+getStatusHtml(msg)+'</span></div>'+
    '</div>'+
  '</div>';
  list.insertAdjacentHTML('beforeend',html);
}

function scrollPanelBottom(){
  var list=document.getElementById('panelMsgList');
  if(list)list.scrollTop=list.scrollHeight;
}

function showPanelTyping(userName){
  var el=document.getElementById('panelTyping');
  if(el){
    el.innerHTML='<span class="typing-dots"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></span><span style="font-size:11px;color:var(--gray)">'+escapeHtml(userName||'Great Phones')+' est\u00E1 escribiendo...</span>';
    el.style.display='block';
  }
}

function hidePanelTyping(){
  var el=document.getElementById('panelTyping');
  if(el)el.style.display='none';
}

function handlePanelTyping(){
  if(!userConvId||!currentUser)return;
  if(chatSocket)chatSocket.emit('typing',{conversationId:userConvId,userName:currentUser.name});
  if(typingTimeout)clearTimeout(typingTimeout);
  typingTimeout=setTimeout(function(){
    if(chatSocket)chatSocket.emit('stopTyping',{conversationId:userConvId});
  },3000);
}

function loadPanelMessages(convId,scrollBottom){
  var headers={};
  
  fetch(API_URL+'/api/conversations/'+convId+'/messages?limit='+PAGE_SIZE,{headers:headers})
    .then(function(r){
      if(!r.ok)throw new Error('Error al cargar mensajes');
      return r.json();
    })
    .then(function(msgs){
      renderPanelMsgs(msgs);
      _hasMorePanel=msgs.length>=PAGE_SIZE;
      _panelCursor=msgs.length>0?msgs[0].id:null;
      showPanelOlderBtn(_hasMorePanel);
      if(scrollBottom)setTimeout(scrollPanelBottom,100);
    })
    .catch(function(e){console.error('Error loading panel messages:',e);});
}

function renderPanelMsgs(msgs){
  var list=document.getElementById('panelMsgList');
  if(!list)return;
  if(!msgs||msgs.length===0){
    list.innerHTML='<div class="empty-state-chat"><svg viewBox="0 0 72 72" fill="none"><circle cx="36" cy="36" r="35" stroke="#E4DDD4" stroke-width="1.5" opacity="0.4"/><path d="M20 26c0-4 3-7 7-7h18c4 0 7 3 7 7v14c0 4-3 7-7 7h-4l-7 6-7-6h-4c-4 0-7-3-7-7V26z" fill="#F0EBE3"/><path d="M27 32h18M27 39h12" stroke="#D4CCC2" stroke-width="2" stroke-linecap="round"/><circle cx="56" cy="20" r="5" fill="#FF6B2C" opacity="0.12" class="fb-dot"/><circle cx="58" cy="18" r="2" fill="#FF6B2C" opacity="0.25"/></svg><h3>Hola! C\u00F3mo podemos ayudarte?</h3><p>Escrib\u00ED tu consulta y te responderemos a la brevedad.</p></div>';
    return;
  }
  var html='';
  for(var i=0;i<msgs.length;i++){
    html+=buildPanelMsgHtml(msgs[i]);
  }
  list.innerHTML=html;
}

function buildPanelMsgHtml(m){
  var isMine=currentUser&&m.from===currentUser.id;
  var time=formatTime(new Date(m.createdAt));
  var productData=m.text?parseProductData(m.text):null;
  var content='';
  if(productData){
    content=renderProductCard(productData);
  }else if(m.imageUrl){
    content='<img src="'+escapeHtml(m.imageUrl)+'" class="msg-img" onclick="openLightbox(\''+escapeHtml(m.imageUrl)+'\')">';
    if(m.imageCaption)content+='<p style="margin-top:6px;font-size:13px">'+escapeHtml(m.imageCaption)+'</p>';
  }else{
    content='<p style="margin:0">'+escapeHtml(m.text||'')+'</p>';
  }
  return '<div class="msg-wrap'+(isMine?' mine':'')+'" data-msg-id="'+(m.id||'')+'">'+
    (!isMine?'<div class="msg-avatar" style="width:26px;height:26px;font-size:9px">GP</div>':'')+
    '<div class="msg-bubble">'+
      content+
      '<div class="msg-time">'+time+'<span class="msg-status">'+getStatusHtml(m)+'</span></div>'+
    '</div>'+
  '</div>';
}

function showPanelOlderBtn(visible){
  var list=document.getElementById('panelMsgList');
  if(!list)return;
  var btn=list.querySelector('#panelOlderBtn');
  if(!visible){
    if(btn)btn.style.display='none';
    return;
  }
  if(!btn){
    btn=document.createElement('div');
    btn.id='panelOlderBtn';
    btn.style.cssText='text-align:center;padding:10px 0;position:relative;z-index:1';
    btn.innerHTML='<button onclick="loadOlderPanelMessages()" style="background:var(--cream2);border:1.5px solid var(--border);border-radius:10px;padding:6px 18px;font-size:12px;font-weight:600;color:var(--gray);cursor:pointer;transition:all .15s" onmouseover="this.style.background=\'var(--orange)\';this.style.color=\'#fff\';this.style.borderColor=\'var(--orange)\'" onmouseout="this.style.background=\'var(--cream2)\';this.style.color=\'var(--gray)\';this.style.borderColor=\'var(--border)\'">Cargar mensajes anteriores</button>';
    list.insertBefore(btn,list.firstChild);
  }
  btn.style.display='block';
}

function loadOlderPanelMessages(){
  if(!userConvId||!_panelCursor)return;
  var btn=document.querySelector('#panelOlderBtn');
  if(btn)btn.innerHTML='<span style="font-size:12px;color:var(--gray)">Cargando...</span>';
  var headers={};
  
  fetch(API_URL+'/api/conversations/'+userConvId+'/messages?limit='+PAGE_SIZE+'&cursor='+_panelCursor,{headers:headers})
    .then(function(r){
      if(!r.ok)throw new Error('Error al cargar mensajes');
      return r.json();
    })
    .then(function(msgs){
      prependPanelMessages(msgs);
      if(msgs.length<PAGE_SIZE){
        _hasMorePanel=false;
        showPanelOlderBtn(false);
      }else{
        _panelCursor=msgs[0].id;
        showPanelOlderBtn(true);
      }
    })
    .catch(function(e){
      console.error('Error loading older panel messages:',e);
      if(btn)btn.innerHTML='<button onclick="loadOlderPanelMessages()" style="background:var(--cream2);border:1.5px solid var(--border);border-radius:10px;padding:6px 18px;font-size:12px;font-weight:600;color:var(--gray);cursor:pointer">Cargar mensajes anteriores</button>';
    });
}

function prependPanelMessages(msgs){
  var list=document.getElementById('panelMsgList');
  if(!list||!msgs||msgs.length===0)return;
  var btn=list.querySelector('#panelOlderBtn');
  var refNode=btn?btn.nextSibling:list.firstChild;
  var html='';
  for(var i=0;i<msgs.length;i++){
    html+=buildPanelMsgHtml(msgs[i]);
  }
  var temp=document.createElement('div');
  temp.innerHTML=html;
  while(temp.firstChild){
    list.insertBefore(temp.firstChild,refNode);
  }
}



function updateMsgBadge(){
  if(!currentUser)return;
  fetch(API_URL+'/api/conversations?userId='+currentUser.id+'&status=OPEN')
    .then(function(r){return r.json();})
    .then(function(convs){
      var totalUnread=0;
      if(Array.isArray(convs)){
        convs.forEach(function(c){
          totalUnread+=(c.unreadByUser||0);
        });
      }
      var badge=document.getElementById('msgBadge');
      if(badge){
        if(totalUnread>0){
          badge.textContent=totalUnread>99?'99+':totalUnread;
          badge.style.display='flex';
        }else{
          badge.style.display='none';
        }
      }
    })
    .catch(function(e){console.error('Error loading conversation badge:',e);});
}

// =========== KEYBOARD SHORTCUTS ===========
document.addEventListener('keydown',function(e){
  // Escape: close modals
  if(e.key==='Escape'){
    var prodOverlay=document.getElementById('productSearchOverlay');
    if(prodOverlay&&prodOverlay.style.display==='flex'){closeProductSearch();e.preventDefault();return;}
    var msgSearch=document.getElementById('msgSearchOverlay');
    if(msgSearch&&msgSearch.style.display==='flex'){closeMsgSearch();e.preventDefault();return;}
  }
  // Ctrl+Shift+R: show quick replies and focus first one
  if(e.ctrlKey&&e.shiftKey&&e.key==='R'){
    e.preventDefault();
    renderQuickReplies();
    return;
  }
  // Ctrl+Shift+E: export conversation
  if(e.ctrlKey&&e.shiftKey&&e.key==='E'){
    e.preventDefault();
    exportConversation();
    return;
  }
});
window.__chatLoaded = true;
