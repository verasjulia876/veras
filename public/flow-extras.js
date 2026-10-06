/* Scoped authoring improvements for the local flow preview. No production sender is called. */
(() => {
 const originalDefault=defaultNode;defaultNode=function(type){const n=originalDefault(type);n.text='';n.label='';if(type==='message')n.sendDelay={mode:'auto',seconds:0};if(n.cards)n.cards=[{title:'',subtitle:'',image:'',buttons:[]}];return n;};
 const beforeEdit=editMap;editMap=function(rule){beforeEdit(rule);if(rule){for(const n of mapState.map.nodes)if(n.type==='message'&&!n.sendDelay)n.sendDelay={mode:'manual',seconds:0};renderMap();renderInspector();}};
 const refreshPreview=()=>{window.drawFlowConversation?.($('#fp-map-conversation'));window.drawFlowConversation?.($('#sf-conversation'));};
 window.flowTitleHint=input=>{
  if(input.dataset.titleHint)return;input.dataset.titleHint='1';
  const hint=el('small',null,'fe-title-hint');input.after(hint);
  const update=()=>{const size=Array.from(input.value).length;hint.textContent=size>20?size+' caracteres · No Instagram, encurte para até 20. Seu rascunho foi mantido.':size+'/20 caracteres no Instagram';hint.classList.toggle('fe-warning',size>20);};input.addEventListener('input',update);update();
 };
 window.flowEmojiFields=host=>{
  host.querySelectorAll('textarea,input[type="text"],input:not([type])').forEach(input=>{
   if(input.dataset.emojiReady)return;input.dataset.emojiReady='1';
   const labelText=[...(input.closest('label')?.childNodes||[])].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim();if(labelText)input.setAttribute('aria-label',labelText);
   const bar=el('div',null,'fe-emoji-bar'),toggle=button('😊 Emojis',()=>window.openFlowEmojiPicker(input),'subtle');toggle.setAttribute('aria-haspopup','dialog');bar.append(toggle);input.closest('label')?.append(bar);
  });
 };
 window.flowDelayEditor=(host,n)=>{
  if(host.querySelector('.fe-delay'))return;
  const box=el('section',null,'fe-delay'),heading=el('h3','Tempo antes de enviar'),summary=el('strong',null,'fe-delay-value'),help=el('p',null,'small muted');
  const modeLabel=el('label','Como calcular'),mode=el('select');mode.add(new Option('Automático','auto'));mode.add(new Option('Definir meu tempo','manual'));mode.value=n.sendDelay?.mode||'auto';modeLabel.append(mode);
  const manualLabel=el('label','Segundos antes de enviar'),manual=el('input');manual.type='number';manual.min='0';manual.max='82800';manual.step='1';manual.value=n.sendDelay?.seconds??FlowTiming.automatic(n)??2;manualLabel.append(manual);
  const update=()=>{summary.textContent=FlowTiming.label(n);manualLabel.hidden=mode.value!=='manual';help.textContent=mode.value==='manual'?'Sua pausa personalizada para esta etapa.':n.mediaType==='audio'?'A pausa usa a duração do áudio anexado. Você pode escolher outro tempo.':n.mediaType?'Padrão de 2 segundos antes de enviar.':'Estimativa: 12 caracteres por segundo, entre 2 e 30 segundos. Texto vazio não acrescenta espera.';};
  mode.onchange=()=>{remember();n.sendDelay={mode:mode.value,seconds:FlowTiming.seconds(n)??2};manual.value=n.sendDelay.seconds;update();renderMap();};
  let recorded=false;manual.oninput=()=>{if(!recorded){remember();recorded=true;}n.sendDelay={mode:'manual',seconds:Math.max(0,Math.min(82800,Math.round(Number(manual.value)||0)))};update();refreshPreview();};manual.onchange=()=>{recorded=false;manual.value=n.sendDelay.seconds;renderMap();};
  box.append(heading,summary,modeLabel,manualLabel,help);const content=n.mediaType?host.querySelector('.fp-media,.fp-upload'):host.querySelector('textarea')?.closest('label');if(content)content.after(box);else host.prepend(box);host.addEventListener('input',update);update();
  // Metadata never overwrites an explicitly chosen pause; changing the file invalidates duration.
  if(n.mediaType==='audio'&&n.mediaUrl){const audio=host.querySelector('audio');if(audio){const url=n.mediaUrl;const read=()=>{if(!mapState?.map.nodes.includes(n)||n.mediaUrl!==url||!Number.isFinite(audio.duration)||audio.duration<=0)return;n.mediaDuration=audio.duration;update();refreshPreview();const badge=document.querySelector('[data-node-id="'+n.id+'"] .fe-node-delay');if(badge)badge.textContent='◷ '+FlowTiming.label(n);};audio.addEventListener('loadedmetadata',read,{once:true});if(audio.readyState>=1)read();}}
 };
 const previousInspector=renderInspector;renderInspector=function(){previousInspector();const n=mapState?.map.nodes.find(n=>n.id===selectedNode),host=$('#node-fields');if(n?.type==='message')window.flowDelayEditor(host,n);window.flowEmojiFields(host);};
 window.flowOpenNode=(n,choice)=>{
  selectedNode=n.id;renderInspector();$('.fp-inspector-tabs button')?.click();
  requestAnimationFrame(()=>{const host=$('#node-fields'),field=choice===undefined?host.querySelector('textarea'):(typeof choice==='number'?host.querySelectorAll('.fp-button-row')[choice]?.querySelector('input'):host.querySelectorAll('.fp-button-row input')[choice.link*2]);field?.focus();if(innerWidth<=1100)host.scrollIntoView({block:'center',behavior:'smooth'});});
 };
 const previousRender=renderMap;renderMap=function(){previousRender();if(!mapState)return;for(const n of mapState.map.nodes){const box=document.querySelector('[data-node-id="'+n.id+'"]');if(!box||n.type!=='message')continue;box.querySelectorAll('.vm-link').forEach((link,i)=>{link.tabIndex=0;link.setAttribute('role','button');link.setAttribute('aria-label','Editar botão de link '+(i+1));link.onclick=e=>{e.stopPropagation();window.flowOpenNode(n,link.dataset.choiceIndex!==undefined?Number(link.dataset.choiceIndex):{link:i});};link.onkeydown=e=>{if(e.key==='Enter')link.click();};});}
 };
 // New text inputs are empty; existing messages and saved drafts stay intact.
 const originalGuided=renderGuided;renderGuided=function(){originalGuided();guidedHost.querySelectorAll('.sf-card-summary').forEach(p=>{p.tabIndex=0;p.setAttribute('role','button');p.title='Clique para editar';const edit=()=>p.closest('.sf-card').querySelector('.sf-card-head button').click();p.onclick=edit;p.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();edit();}};});};
 const oldSave=$('#save-flow').onclick;$('#save-flow').onclick=function(e){
  for(const n of mapState?.map.nodes||[])if(n.type==='message')n.sendDelay={mode:n.sendDelay?.mode||'auto',seconds:FlowTiming.seconds(n)??0};
  return oldSave.call(this,e);
 };
 if(mapState){renderMap();renderInspector();}
})();
