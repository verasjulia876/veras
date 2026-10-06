/* Map authoring surface, isolated from production and from the flow engine. */
(() => {
 const viewport=$('#map-viewport'),canvas=$('#map-canvas'),svg=$('#map-lines'),nodes=$('#map-nodes');
 const NS='http://www.w3.org/2000/svg',WIDTH=260;
 let pending=null,inspected='',triggerPosition={x:60,y:110};
 const svgEl=(tag,attrs={})=>{const e=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));return e;};
 const title=n=>'Bloco '+n.number+' — '+(n.mediaType?({image:'Imagem',audio:'Áudio',video:'Vídeo',file:'Documento'}[n.mediaType]):n.choices.length?'Mensagem com respostas':nodeNames[n.type]);
 function point(port){const r=port.getBoundingClientRect(),c=canvas.getBoundingClientRect();return{x:(r.x+r.width/2-c.x)/mapZoom,y:(r.y+r.height/2-c.y)/mapZoom};}
 function curve(a,b){const bend=Math.max(60,Math.abs(b.x-a.x)*.45);return `M${a.x} ${a.y} C${a.x+bend} ${a.y},${b.x-bend} ${b.y},${b.x} ${b.y}`;}
 function targetOf(source,index){return source==='trigger'?mapState.map.start:index<0?source.next:source.choices[index]?.next;}
 function assign(source,index,id){if(source==='trigger')mapState.map.start=id;else if(index<0)source.next=id;else source.choices[index].next=id;}
 function reaches(id,target,seen=new Set()){if(id===target)return true;if(!id||seen.has(id))return false;seen.add(id);const n=mapState.map.nodes.find(n=>n.id===id);return !!n&&[n.next,...n.choices.map(c=>c.next)].some(dest=>reaches(dest,target,seen));}
 function connect(source,index,id){
  if(source!=='trigger'&&reaches(id,source.id)){toast('Essa ligação voltaria a uma etapa anterior. Escolha outra caixa.');return false;}
  if(targetOf(source,index)===id){pending=null;renderMap();return true;}
  remember();assign(source,index,id);pending=null;renderMap();toast('Etapas conectadas.');return true;
 }
 function drawEdges(){
  svg.replaceChildren();
  for(const port of nodes.querySelectorAll('.vm-output')){
   const source=port.dataset.source==='trigger'?'trigger':mapState.map.nodes.find(n=>n.id===port.dataset.source),index=Number(port.dataset.choice),dest=targetOf(source,index);
   const input=[...nodes.querySelectorAll('.vm-input')].find(e=>e.dataset.target===dest);if(!input)continue;
   const a=point(port),b=point(input),group=svgEl('g',{'class':'vm-edge'}),path=svgEl('path',{d:curve(a,b),'class':'vm-line'}),hit=svgEl('path',{d:curve(a,b),'class':'vm-hit'});
   const label=source==='trigger'?'início':index<0?'próxima etapa':source.choices[index].title;
   const del=svgEl('g',{transform:`translate(${(a.x+b.x)/2},${(a.y+b.y)/2})`,'class':'vm-edge-remove',role:'button',tabindex:0,'aria-label':'Excluir conexão: '+label});
   const circle=svgEl('circle',{r:12}),x=svgEl('text',{'text-anchor':'middle',dy:5});x.textContent='×';del.append(circle,x);
   const remove=e=>{e.stopPropagation();remember();assign(source,index,'');pending=null;renderMap();toast('Conexão excluída. As caixas continuam no mapa.');};
   del.onclick=remove;del.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();remove(e);}};
   hit.onclick=()=>{group.classList.toggle('is-selected');del.focus();};group.append(path,hit,del);svg.append(group);
  }
 }
 function output(source,index,label){
  const row=el('div',null,'vm-output-row'),text=el('span',label),plus=button('+',()=>{if(source==='trigger'){if(mapState.map.start){selectedNode=mapState.map.start;renderMap();renderInspector();return;}chooseNextStep(null);}else chooseNextStep(source,index<0?undefined:index);},'vm-plus');
  plus.setAttribute('aria-label','Adicionar etapa após '+label);
  const port=button('',()=>{},'vm-output');port.dataset.source=source==='trigger'?'trigger':source.id;port.dataset.choice=index;port.setAttribute('aria-label','Conectar saída '+label);port.title='Arraste até a entrada de outra caixa, ou clique nos dois pontos';
  port.onpointerdown=e=>{e.preventDefault();e.stopPropagation();pending={source,index};port.setPointerCapture(e.pointerId);const start=point(port),ghost=svgEl('path',{d:curve(start,start),'class':'vm-ghost'});svg.append(ghost);let moved=false;
   port.onpointermove=ev=>{moved=true;const r=canvas.getBoundingClientRect();ghost.setAttribute('d',curve(start,{x:(ev.clientX-r.x)/mapZoom,y:(ev.clientY-r.y)/mapZoom}));};
   port.onpointerup=ev=>{port.onpointermove=null;port.onpointerup=null;ghost.remove();if(port.hasPointerCapture(ev.pointerId))port.releasePointerCapture(ev.pointerId);const hit=document.elementFromPoint(ev.clientX,ev.clientY),t=hit?.closest('.vm-node[data-node-id]');if(t&&t.dataset.nodeId!==(source==='trigger'?'trigger':source.id))connect(source,index,t.dataset.nodeId);else if(moved&&hit?.closest('#map-viewport')&&!hit.closest('.vm-node')){pending=null;viewport.classList.remove('vm-connecting');chooseNextStep(source==='trigger'?null:source,index<0?undefined:index);}else viewport.classList.add('vm-connecting');};
   port.onpointercancel=()=>{ghost.remove();if(port.isConnected){pending=null;viewport.classList.remove('vm-connecting');}port.onpointermove=null;};
  };
  // Keyboard users connect by choosing an output and then an input.
  port.onclick=e=>{if(e.detail===0){pending={source,index};viewport.classList.add('vm-connecting');toast('Escolha o ponto de entrada de outra caixa.');}};
  if(source!=='trigger'&&index>=0){text.tabIndex=0;text.setAttribute('role','button');text.setAttribute('aria-label','Editar resposta '+(index+1));const edit=e=>{e.stopPropagation();window.flowOpenNode?.(source,index);};text.onclick=edit;text.onkeydown=e=>{if(e.key==='Enter')edit(e);};}row.append(text,plus,port);return row;
 }
 function drag(head,box,n){head.onpointerdown=e=>{if(e.button!==0||e.target.closest('button'))return;e.preventDefault();e.stopPropagation();head.setPointerCapture(e.pointerId);const sx=e.clientX,sy=e.clientY,ox=n.x,oy=n.y;let moved=false;head.onpointermove=ev=>{if(!moved&&Math.abs(ev.clientX-sx)+Math.abs(ev.clientY-sy)>4){remember();moved=true;}if(!moved)return;n.x=Math.max(20,Math.min(3800,ox+(ev.clientX-sx)/mapZoom));n.y=Math.max(20,Math.min(3800,oy+(ev.clientY-sy)/mapZoom));box.style.left=n.x+'px';box.style.top=n.y+'px';drawEdges();};head.onpointerup=()=>{head.onpointermove=null;if(moved)renderMap();};head.onpointercancel=()=>{head.onpointermove=null;renderMap();};};}
 function pickOutput(n,done){
  if(!n.choices.some(c=>!window.flowChoiceIsLink(c))){done(-1);return;}
  const d=el('dialog',null,'sf-picker');d.append(el('h2','Qual saída deseja conectar?'),button('Próximo passo da caixa',()=>{d.close();done(-1);},'outline'));
  n.choices.forEach((c,i)=>{if(!window.flowChoiceIsLink(c))d.append(button(c.title||'Resposta '+(i+1),()=>{d.close();done(i);},'outline'));});
  d.append(button('Cancelar',()=>d.close(),'subtle'));d.addEventListener('close',()=>{d.remove();renderMap();});document.body.append(d);d.showModal();
 }
 function connectBox(box,n){
  const tap=button('Ligar a outra caixa',()=>pickOutput(n,index=>{pending={source:n,index};viewport.classList.add('vm-connecting');toast('Toque na caixa de destino. Toque no fundo para cancelar.');}),'outline vm-connect');box.append(tap);
  box.onpointerdown=e=>{
   if(e.button!==0||e.target.closest('.vm-head,button,input,textarea,[role=button]')||pending)return;
   e.preventDefault();e.stopPropagation();box.setPointerCapture(e.pointerId);const sx=e.clientX,sy=e.clientY;let moved=false,ghost;
   const clear=()=>{box.onpointermove=null;box.onpointerup=null;box.onpointercancel=null;ghost?.remove();document.querySelectorAll('.vm-drop-target').forEach(x=>x.classList.remove('vm-drop-target'));};
   box.onpointermove=ev=>{if(!moved&&Math.hypot(ev.clientX-sx,ev.clientY-sy)<8)return;moved=true;if(!ghost){ghost=svgEl('path',{'class':'vm-ghost'});svg.append(ghost);}const r=canvas.getBoundingClientRect();ghost.setAttribute('d',curve({x:n.x+WIDTH,y:n.y+80},{x:(ev.clientX-r.x)/mapZoom,y:(ev.clientY-r.y)/mapZoom}));const hit=document.elementFromPoint(ev.clientX,ev.clientY)?.closest('.vm-node[data-node-id]');document.querySelectorAll('.vm-drop-target').forEach(x=>x.classList.remove('vm-drop-target'));if(hit&&hit!==box)hit.classList.add('vm-drop-target');};
   box.onpointerup=ev=>{const hit=document.elementFromPoint(ev.clientX,ev.clientY),target=hit?.closest('.vm-node[data-node-id]');clear();if(box.hasPointerCapture(ev.pointerId))box.releasePointerCapture(ev.pointerId);if(!moved)return;box.onclick=event=>{event.stopPropagation();event.preventDefault();};if(target&&target!==box)pickOutput(n,index=>connect(n,index,target.dataset.nodeId));else if(hit?.closest('#map-viewport')&&!hit.closest('.vm-node'))pickOutput(n,index=>chooseNextStep(n,index<0?undefined:index));else renderMap();};
   box.onpointercancel=()=>{clear();renderMap();};
  };
 }
 renderMap=function(){
  if(!mapState)return;window.flowNumberBlocks?.();nodes.replaceChildren();canvas.style.transform=`scale(${mapZoom})`;canvas.style.transformOrigin='0 0';$('#zoom-label').textContent=Math.round(mapZoom*100)+'%';
  viewport.classList.toggle('vm-connecting',!!pending);
  const trigger=el('article',null,'vm-node vm-trigger');trigger.style.left=triggerPosition.x+'px';trigger.style.top=triggerPosition.y+'px';
  const th=el('div',null,'vm-head');th.append(el('strong','ϟ Quando alguém…'));trigger.append(th,el('p',(mapState.channels||[mapState.trigger]).map(c=>channelNames[c]).join(' · ')),el('small',mapState.match==='any'?'Qualquer texto':mapState.keywords||'Escolha as palavras-chave'));
  trigger.append(button('Editar gatilhos',()=>{const s=$('.sf-setup');s.open=true;s.scrollIntoView({block:'start',behavior:'smooth'});},'vm-trigger-edit'),output('trigger',-1,'Começar conversa'));drag(th,trigger,triggerPosition);nodes.append(trigger);
  for(const n of mapState.map.nodes){
   const box=el('article',null,'vm-node'+(n.id===selectedNode?' is-selected':''));box.dataset.nodeId=n.id;box.style.left=n.x+'px';box.style.top=n.y+'px';
   const head=el('div',null,'vm-head');head.append(el('strong',title(n)));const remove=button('×',()=>{pending=null;removeMapNode(n.id);},'vm-remove');remove.setAttribute('aria-label','Remover caixa '+title(n));head.append(window.duplicateBlockButton(n),remove);drag(head,box,n);box.append(head);
   const input=button('',()=>{if(pending)connect(pending.source,pending.index,n.id);else{selectedNode=n.id;renderMap();renderInspector();}},'vm-input');input.dataset.target=n.id;input.setAttribute('aria-label','Entrada de '+title(n));input.title='Solte aqui a conexão';box.append(input);
   const description=n.type==='wait'?'◷ '+FlowTiming.waitLabel(n):n.mediaType?(n.mediaUrl?'Arquivo pronto: '+({audio:'áudio',image:'imagem',video:'vídeo',file:'documento'}[n.mediaType]):'Adicione '+({audio:'um áudio',image:'uma imagem',video:'um vídeo',file:'um documento'}[n.mediaType])):n.text||n.tag||'Clique para editar';box.append(el('p',description));if(n.type==='message'&&window.FlowTiming){const timing=button('◷ '+FlowTiming.label(n),()=>{window.flowOpenNode(n);requestAnimationFrame(()=>document.querySelector('.fe-delay select')?.focus());},'fe-node-delay');timing.setAttribute('aria-label','Editar tempo: '+FlowTiming.label(n));box.append(timing);}
   if(n.type==='follow'){const preview=el('div',null,'follow-buttons-preview');preview.style.cssText='padding:8px 16px;display:flex;gap:8px;flex-wrap:wrap';preview.append(el('span','Ver perfil ↗','badge'),el('span',n.followButton||'Já segui','badge'));box.append(preview);}
   for(const l of n.links||[])box.append(el('small',l.title+' ↗','vm-link'));if(n.url)box.append(el('small',n.label+' ↗','vm-link'));
   n.choices.forEach((c,i)=>{if(window.flowChoiceIsLink(c)){const link=button((c.title||'Botão de link')+' ↗',()=>window.flowOpenNode(n,i),'vm-link');link.dataset.choiceIndex=i;box.append(link);}else box.append(output(n,i,c.title||'Resposta '+(i+1)));});{const continuation=output(n,-1,'Próximo passo da caixa');const port=continuation.querySelector('.vm-output');port.classList.add('vm-box-port');box.append(port);}
   box.onclick=e=>{if(e.target.closest('button,[role=button]'))return;if(pending){connect(pending.source,pending.index,n.id);return;}selectedNode=n.id;renderMap();renderInspector();window.flowOpenNode?.(n);};connectBox(box,n);nodes.append(box);
  }
  drawEdges();$('#undo-flow').disabled=!undoStack.length;$('#redo-flow').disabled=!redoStack.length;
  if(guidedMode)renderGuided();else if(inspected!==selectedNode){inspected=selectedNode;renderInspector();}
 };
 const legacyInspector=renderInspector;
 renderInspector=function(){
  if(guidedMode)return legacyInspector();const n=mapState?.map.nodes.find(n=>n.id===selectedNode),host=$('#node-fields');if(!n){host.replaceChildren(el('p','Clique em uma caixa para editar.','muted'));return;}
  if(!['message','wait'].includes(n.type)||n.parts?.length||n.links?.length)return legacyInspector();
  host.replaceChildren();$('#node-title').textContent=title(n);host.append(el('p','Edite aqui. As ligações são feitas pelos pontos no mapa.','small muted'));
  function field(label,obj,key,opts={}){const l=el('label',label),i=el(opts.area?'textarea':'input');if(!opts.area)i.type=opts.type||'text';i.value=obj[key]??'';i.maxLength=opts.max||600;if(opts.type==='number'){i.min=1;i.max=key==='seconds'?82800:1380;}if(opts.area)i.rows=4;let changed=false;i.oninput=()=>{if(!changed){remember();changed=true;}obj[key]=opts.type==='number'?Number(i.value):i.value;renderMap();};i.onblur=()=>changed=false;l.append(i);host.append(l);return i;}
  if(n.type==='wait'&&window.renderWaitUnits){window.renderWaitUnits(host,n);return;}
  if(n.type==='wait'){field('Tempo de espera',n,n.seconds===undefined?'minutes':'seconds',{type:'number'});const l=el('label','Unidade'),s=el('select');s.add(new Option('Segundos','seconds'));s.add(new Option('Minutos','minutes'));s.value=n.seconds===undefined?'minutes':'seconds';s.onchange=()=>{remember();const value=n.seconds??n.minutes;if(s.value==='seconds')n.seconds=value;else{delete n.seconds;n.minutes=value;}renderMap();renderInspector();};l.append(s);host.append(l,el('p','A conversa retoma após a espera. O tempo pode variar um pouco conforme a rede.','small muted'));return;}
  if(n.mediaType){if(window.flowAttachmentEditor)window.flowAttachmentEditor(host,n,()=>{renderMap();renderInspector();});else field('URL HTTPS do arquivo',n,'mediaUrl',{type:'url',max:500});return;}
  field('Mensagem',n,'text',{area:true});
  if(n.choices.length){host.append(el('h3','Respostas e caminhos'));n.choices.forEach((c,i)=>{field('Resposta '+(i+1),c,'title',{max:20});host.append(button('Remover resposta '+(i+1),()=>{if(c.next){toast('Exclua a linha desta resposta antes de remover o botão.');return;}remember();n.choices.splice(i,1);renderMap();renderInspector();},'subtle'));});}
  if(n.choices.length<3&&!n.url)host.append(button('+ Botão de resposta',()=>{if(n.url){toast('Use outra caixa para a pergunta com respostas.');return;}remember();n.choices.push({title:'Nova resposta',next:n.choices.length?'':n.next});n.next='';renderMap();renderInspector();},'outline'));
  if(!n.choices.length){field('Link opcional',n,'url',{type:'url',max:500});field('Texto do botão de link',n,'label',{max:20});}
 };
 function zoom(value){const x=(viewport.scrollLeft+viewport.clientWidth/2)/mapZoom,y=(viewport.scrollTop+viewport.clientHeight/2)/mapZoom;mapZoom=Math.max(.3,Math.min(1.7,value));renderMap();viewport.scrollLeft=x*mapZoom-viewport.clientWidth/2;viewport.scrollTop=y*mapZoom-viewport.clientHeight/2;}
 fitMap=function(){if(!mapState)return;const all=[triggerPosition,...mapState.map.nodes],minX=Math.min(...all.map(n=>n.x))-30,minY=Math.min(...all.map(n=>n.y))-30,maxX=Math.max(...all.map(n=>n.x+WIDTH))+30,maxY=Math.max(...[...nodes.children].map(n=>parseFloat(n.style.top)+n.offsetHeight))+30;mapZoom=Math.max(.3,Math.min(1,viewport.clientWidth/(maxX-minX),viewport.clientHeight/(maxY-minY)));renderMap();viewport.scrollLeft=Math.max(0,minX*mapZoom);viewport.scrollTop=Math.max(0,minY*mapZoom);};
 $('#zoom-in').onclick=()=>zoom(mapZoom+.1);$('#zoom-out').onclick=()=>zoom(mapZoom-.1);
 for(const b of $('.map-footer').querySelectorAll('button'))if(b.textContent==='Ajustar à tela')b.onclick=fitMap;
 viewport.onpointerdown=e=>{if(e.button!==0||e.target.closest('.vm-node,.vm-edge-remove,.vm-hit'))return;e.preventDefault();window.getSelection()?.removeAllRanges();pending=null;viewport.classList.remove('vm-connecting');const x=e.clientX,y=e.clientY,left=viewport.scrollLeft,top=viewport.scrollTop;viewport.setPointerCapture(e.pointerId);viewport.classList.add('vm-panning');viewport.onpointermove=ev=>{viewport.scrollLeft=left+x-ev.clientX;viewport.scrollTop=top+y-ev.clientY;};viewport.onpointerup=viewport.onpointercancel=()=>{viewport.onpointermove=null;viewport.classList.remove('vm-panning');};};
 viewport.addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();zoom(mapZoom+(e.deltaY<0?.1:-.1));},{passive:false});
 viewport.addEventListener('keydown',e=>{if(e.key==='Escape'){pending=null;renderMap();}});
 const organize=$('#organize-flow');organize.onclick=()=>{if(!mapState)return;remember();const seen=new Set();let row=0;function visit(id,col){const n=mapState.map.nodes.find(n=>n.id===id);if(!n||seen.has(id))return;seen.add(id);n.x=420+col*380;n.y=100+row*310;[n.next,...n.choices.map(c=>c.next)].filter(Boolean).forEach((id,i)=>{if(i)row++;visit(id,col+1);});}triggerPosition={x:60,y:110};visit(mapState.map.start,0);for(const n of mapState.map.nodes)if(!seen.has(n.id)){row++;visit(n.id,0);}renderMap();fitMap();};
 const oldEdit=editMap;editMap=function(rule){pending=null;inspected='';oldEdit(rule);setEditorMode(false);if(!rule){const first=mapState.map.nodes[0];if(first){first.x=420;first.y=110;}}$('.sf-setup').open=false;renderMap();fitMap();};
 $('.map-layout').classList.add('vm-layout');viewport.classList.add('vm-viewport');
 $('.map-footer>span:first-child').textContent='Arraste o corpo de uma caixa até outra para ligar. Mova a caixa pelo título e o mapa pelo fundo. No celular, toque em Ligar a outra caixa. O × remove a conexão.';
 const toolbar=$('#map-toolbar');toolbar.replaceChildren(button('+ Nova caixa',()=>{selectedNode='';chooseNextStep(null);},'gold'),el('span','Escolha uma caixa para editar · Cada resposta tem seu próprio ponto','small muted'));
 // A new standalone node must not replace the start of an existing conversation.
 const picker=chooseNextStep;chooseNextStep=function(source,choice){const start=mapState.map.start,existing=new Set(mapState.map.nodes.map(n=>n.id));picker(source,choice);const dialog=[...document.querySelectorAll('dialog[open]')].at(-1);if(!dialog)return;dialog.addEventListener('close',()=>requestAnimationFrame(()=>{const added=mapState.map.nodes.find(n=>!existing.has(n.id));if(added){if(!source&&start){mapState.map.start=start;added.next='';if(added.choices.length)added.choices[0].next='';added.x=Math.min(3600,Math.max(...mapState.map.nodes.filter(n=>n!==added).map(n=>n.x))+340);added.y=110;}else if(source&&source!=='trigger'){added.x=source.x+380;added.y=source.y+(choice||0)*310;}while(added.y<3500&&mapState.map.nodes.some(n=>n!==added&&Math.abs(n.x-added.x)<280&&Math.abs(n.y-added.y)<300))added.y+=310;selectedNode=added.id;inspected='';renderMap();renderInspector();const left=added.x*mapZoom,top=added.y*mapZoom;viewport.scrollLeft=Math.max(0,left-70);viewport.scrollTop=Math.max(0,top-70);}}),{once:true});};
 const save=el('div',null,'vm-save');save.append(button('Salvar fluxo',()=>$('#save-flow').click(),'gold'));$('.map-footer').after(save);
 mapModeButton.textContent='Mapa visual';guideModeButton.textContent='Ver em sequência';
 if(mapState){setEditorMode(false);renderMap();fitMap();}
})();



