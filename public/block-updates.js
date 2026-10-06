/* Editor controls use the existing seconds/minutes storage format. */
(() => {
 const units=new Map();
 window.duplicateBlockButton=n=>{
  const control=button('',()=>window.duplicateFlowBlock(n),'outline block-duplicate');
  control.title='Duplicar bloco';control.setAttribute('aria-label','Duplicar bloco '+(n.number||''));
  const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');
  for(const [key,value]of Object.entries({viewBox:'0 0 24 24',width:'18',height:'18',fill:'none',stroke:'currentColor','stroke-width':'1.8','aria-hidden':'true'}))icon.setAttribute(key,value);
  const back=document.createElementNS(icon.namespaceURI,'path');back.setAttribute('d','M8 8V4a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-4');
  const front=document.createElementNS(icon.namespaceURI,'rect');for(const [key,value]of Object.entries({x:'3',y:'8',width:'13',height:'13',rx:'2'}))front.setAttribute(key,value);
  icon.append(back,front);control.append(icon);control.style.cssText='display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:34px;height:34px;padding:6px;min-height:34px';return control;
 };
 window.renderWaitUnits=(host,n,redraw=renderInspector)=>{
  const unit=units.get(n.id)||(n.seconds!==undefined?'seconds':n.minutes%60===0?'hours':'minutes');
  const seconds=n.seconds??n.minutes*60;
  const label=el('label','Tempo de espera'),input=el('input'),unitLabel=el('label','Unidade'),select=el('select');
  for(const [value,title] of [['seconds','Segundos'],['minutes','Minutos'],['hours','Horas']])select.add(new Option(title,value));
  select.value=unit;input.type='number';input.min=unit==='hours'?'0.01':'1';input.max=unit==='hours'?'23':unit==='minutes'?'1380':'82800';input.step=unit==='seconds'?'1':'any';input.value=String(seconds/(unit==='hours'?3600:unit==='minutes'?60:1));
  select.onchange=()=>{units.set(n.id,select.value);redraw();};
  input.onchange=()=>{const value=Math.round(Number(input.value)*(select.value==='hours'?3600:select.value==='minutes'?60:1));if(!Number.isFinite(value)||value<1||value>82800){toast('Use uma espera de 1 segundo a 23 horas.');return;}remember();if(value%60===0){delete n.seconds;n.minutes=value/60;}else n.seconds=value;renderMap();};
  label.append(input);unitLabel.append(select);host.append(label,unitLabel,el('small','A conversa retoma após a espera. Limite: 23 horas.','muted'));
 };
 window.duplicateFlowBlock=n=>{
  if(mapState.map.nodes.length>=30){toast('Limite de 30 blocos por fluxo.');return;}
  remember();const copy=structuredClone(n);copy.id='n'+crypto.randomUUID().slice(0,8);delete copy.number;copy.x=(n.x||0)+280;copy.y=(n.y||0)+80;
  mapState.map.nodes.push(copy);selectedNode=copy.id;window.flowNumberBlocks?.();renderMap();renderInspector();toast('Bloco duplicado. Conecte a cópia ao caminho desejado no mapa.');
 };
 const original = renderInspector;
 renderInspector = function(){
  original();
  const n=mapState?.map.nodes.find(item=>item.id===selectedNode),host=document.querySelector('#node-fields');
  if(!n||!host)return;
  host.prepend(button('Duplicar bloco',()=>window.duplicateFlowBlock(n),'outline'));
  window.flowEmojiFields?.(host);
 };
 const previousSync=syncMapSettings;
 syncMapSettings=function(){
  previousSync();if(!mapState)return;
  document.querySelector('#next-post-map')?.remove();
  if(!(mapState.channels||[mapState.trigger]).includes('comment'))return;
  const host=document.querySelector('#flow-media').closest('label');
  if(mapState.nextPostAt){
   // Hide only existing selection controls; the new checkbox remains accessible.
   for(const child of host.children)child.hidden=true;
  }
  const section=el('div'),label=el('label'),check=el('input');section.id='next-post-map';check.type='checkbox';check.checked=!!mapState.nextPostAt;check.style.width='auto';
  check.onchange=()=>{remember();mapState.nextPostAt=check.checked?Math.floor(Date.now()/1000):undefined;mapState.allPosts=false;mapState.media_id='';syncMapSettings();};
  label.append(check,document.createTextNode(' Automatizar próximo post'));section.append(label);
  if(check.checked)section.append(el('small','Ao salvar, aguarda o próximo post ou Reel deste perfil. Depois, fica vinculada somente a ele.','muted'));
  host.append(section);
 };
 const form=document.querySelector('#rule-form'),label=el('label'),check=el('input');
 for(const name of ['welcomeButton','linkLabel','followupLabel']){const field=form.elements[name];field.maxLength=80;window.flowTitleHint?.(field);}
 check.type='checkbox';check.style.width='auto';check.id='next-post-simple';label.append(check,document.createTextNode(' Automatizar próximo post'));document.querySelector('#post-field').append(label);
 let armedAt;
 const previousData=editorData;
 editorData=function(){const data=previousData();if(check.checked&&data.flow.channels.includes('comment')){data.flow.nextPostAt=armedAt||Math.floor(Date.now()/1000);data.flow.allPosts=false;data.media_id='';}return data;};
 const previousNew=newRule;
 newRule=function(rule){check.checked=false;armedAt=undefined;previousNew(rule);armedAt=rule?getFlow(rule).nextPostAt:undefined;check.checked=!!armedAt;updatePreview();window.flowEmojiFields?.(form);};
 const previousPreview=updatePreview;
 updatePreview=function(){previousPreview();const waiting=check.checked;document.querySelector('#load-media').disabled=waiting||form.elements.allPosts.checked;form.elements.allPosts.disabled=waiting;if(waiting)document.querySelector('#selected-post').replaceChildren(el('p','Ao salvar, aguarda o próximo post ou Reel deste perfil.','small muted'));};
 check.onchange=()=>{armedAt=check.checked?Math.floor(Date.now()/1000):undefined;if(check.checked)form.elements.allPosts.checked=false;updatePreview();};
 const previousRow=ruleRow;
 ruleRow=function(rule,map){const row=previousRow(rule,map);if(getFlow(rule).nextPostAt)row.querySelector('h3').after(el('p','Aguardando próximo post','badge'));return row;};
})();
