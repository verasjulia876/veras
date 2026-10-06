/* Visual conversation authoring. Keeps the existing flow payload and engine. */
(() => {
  let editing = '', previewChannel = 'comment';
  const titles = {message:'Mensagem',image:'Imagem',audio:'Áudio',video:'Vídeo',file:'Documento',buttons:'Botões de resposta',link:'Botão com link',wait:'Espera'};
  const icons = {message:'💬',image:'▧',audio:'♫',video:'▷',file:'📄',buttons:'☷',wait:'◷'};
  const kind = n => n.type === 'message' ? n.mediaType || (n.choices.length ? 'buttons' : 'message') : n.type;
  const name = n => 'Bloco '+n.number+' — '+(titles[kind(n)] || nodeNames[n.type]);
  const mutate = fn => { remember(); fn(); renderMap(); };
  const focusCard = id => requestAnimationFrame(() => guidedHost.querySelector('[data-node="'+id+'"]')?.scrollIntoView({block:'nearest',behavior:'smooth'}));
  function inputField(host,label,value,onchange,options={}) {
    const l=el('label',label),i=el(options.area?'textarea':'input');
    if(!options.area)i.type=options.type||'text';
    i.value=value??'';i.maxLength=options.max||600;
    if(options.area)i.rows=3;
    if(options.type==='number'){i.min=1;i.max=options.limit||82800;i.step=1;}
    if(options.placeholder)i.placeholder=options.placeholder;
    let recorded=false;
    i.addEventListener('input',()=>{if(!recorded){remember();recorded=true;}onchange(options.type==='number'?Number(i.value):i.value);renderConversation();});
    i.addEventListener('blur',()=>recorded=false);
    l.append(i);host.append(l);return i;
  }
  function add(source,choice,type) {
    if(mapState.map.nodes.length>=30){toast('Este fluxo já tem 30 etapas.');return;}
    remember();
    const n=defaultNode(['image','audio','video','file','buttons','link'].includes(type)?'message':type);
    n.text='';
    if(['image','audio','video','file'].includes(type))n.mediaType=type;
    if(type==='buttons')n.choices=[{title:'',next:''},{title:'',next:''}];
    if(type==='link')n.links=[{title:'',url:''}];
    if(type==='wait')n.seconds=5;
    const next=source?(choice===undefined?source.next:source.choices[choice].next):mapState.map.start;
    if(type==='buttons')n.choices[0].next=next||'';else n.next=next||'';
    if(source){if(choice===undefined)source.next=n.id;else source.choices[choice].next=n.id;}else mapState.map.start=n.id;
    n.x=(source?.x||0)+300;n.y=source?.y||100;mapState.map.nodes.push(n);selectedNode=n.id;editing=n.id;
    renderMap();focusCard(n.id);
  }
  chooseNextStep=function(source,choice){
    const d=el('dialog',null,'sf-picker');d.append(el('h2','Qual é o próximo passo?'),el('p','Escolha o que a pessoa vai receber.','muted'));
    const grid=el('div',null,'sf-picker-grid');
    for(const type of ['message','image','audio','video','file','wait','buttons','link']){const b=button('',()=>{d.close();add(source,choice,type);},'sf-pick');b.append(el('span',icons[type]||'↗'),el('strong',titles[type]));grid.append(b);}
    d.append(grid);const more=el('details');more.append(el('summary','Mais opções'));for(const type of ['email','follow','tag','carousel'])more.append(button(nodeNames[type],()=>{d.close();add(source,choice,type);},'outline'));d.append(more,button('Cancelar',()=>d.close(),'subtle'));d.addEventListener('close',()=>d.remove());document.body.append(d);d.showModal();
  };
  function removeStep(n){
    if(n.choices.some(c=>c.next)){toast('Remova primeiro as etapas dos caminhos deste botão.');return;}
    mutate(()=>{for(const p of mapState.map.nodes){if(p.next===n.id)p.next=n.next;for(const c of p.choices)if(c.next===n.id)c.next=n.next;}if(mapState.map.start===n.id)mapState.map.start=n.next;mapState.map.nodes=mapState.map.nodes.filter(p=>p.id!==n.id);editing='';});
    toast('Etapa removida. Você pode desfazer.');
  }
  function editor(card,n){
    const form=el('div',null,'sf-fields');card.append(form);
    if(n.type==='message'&&!n.mediaType){
      inputField(form,'Mensagem',n.text,v=>n.text=v,{area:true,placeholder:'Escreva como você fala com sua audiência…'});
      if(window.flowButtonEditor)window.flowButtonEditor(form,n,()=>renderMap());
      else {
      if(!n.url&&!n.links?.length&&!n.parts?.length&&n.choices.length<3)form.append(button('+ Botão de resposta',()=>{if(n.url){toast('Use uma etapa separada para botões de resposta e links.');return;}mutate(()=>{n.choices.push({title:'Nova resposta',next:n.choices.length?'':n.next});n.next='';});},'outline'));
      if(!n.choices.length&&!n.links?.length){
        const links=el('details');links.append(el('summary','Botão que abre um link'));form.append(links);
        inputField(links,'Endereço do link',n.url,v=>n.url=v,{type:'url',max:500,placeholder:'https://…'});
        inputField(links,'Texto do botão',n.label,v=>n.label=v,{max:20});
      }
      }
    }else if(n.type==='message'){
      if(window.flowAttachmentEditor)window.flowAttachmentEditor(form,n,()=>renderMap());
      else inputField(form,'Link público do arquivo',n.mediaUrl,v=>n.mediaUrl=v,{type:'url',max:500,placeholder:'https://…'});
    }else if(n.type==='wait'){
      if(window.renderWaitUnits)window.renderWaitUnits(form,n,renderGuided);
      else{
      const row=el('div',null,'sf-wait');form.append(row);
      inputField(row,'Tempo',n.seconds??n.minutes,v=>{if(n.seconds===undefined)n.minutes=v;else n.seconds=v;},{type:'number',limit:n.seconds===undefined?1380:82800});
      const l=el('label','Unidade'),s=el('select');s.add(new Option('Segundos','seconds'));s.add(new Option('Minutos','minutes'));s.value=n.seconds===undefined?'minutes':'seconds';s.onchange=()=>mutate(()=>{const value=n.seconds??n.minutes;if(s.value==='seconds')n.seconds=value;else{delete n.seconds;n.minutes=value;}});l.append(s);row.append(l);
      form.append(el('p','A conversa retoma após a espera. O tempo pode variar um pouco conforme a rede.','small muted'));
      }
    }else form.append(button('Configurar esta etapa',()=>{selectedNode=n.id;renderInspector();blockDialog.showModal();},'outline'));
    if(n.parts?.length||n.links?.length)form.append(button('Editar conteúdos existentes',()=>{selectedNode=n.id;renderInspector();blockDialog.showModal();},'outline'));
    if(n.type==='message'&&window.flowDelayEditor)window.flowDelayEditor(form,n);
    window.flowEmojiFields?.(form);
    form.append(button('✓ Concluir',()=>{editing='';renderGuided();},'sf-done outline'));
  }
  function renderPath(host,id,trail,label){
    if(!id)return;
    if(trail.has(id)){host.append(el('p','Este caminho retorna a uma etapa anterior. Revise no mapa.','notice'));return;}
    const n=mapState.map.nodes.find(x=>x.id===id);if(!n)return;
    const nextTrail=new Set(trail);nextTrail.add(id);
    const card=el('article',null,'sf-card');card.dataset.node=n.id;
    const head=el('div',null,'sf-card-head'),heading=el('div');heading.append(el('small',label,'eyebrow'),el('h3',(icons[kind(n)]||'◇')+' '+name(n)));
    head.append(heading,button(editing===n.id?'Fechar':'Editar',()=>{editing=editing===n.id?'':n.id;renderGuided();focusCard(n.id);},'outline'));
    head.append(window.duplicateBlockButton(n));
    const del=button('×',()=>removeStep(n),'subtle');del.setAttribute('aria-label','Remover '+name(n));head.append(del);card.append(head);
    if(editing===n.id)editor(card,n);else{const text=n.type==='wait'?FlowTiming.waitLabel(n):n.mediaType?(n.mediaUrl?'Arquivo adicionado':'Toque para anexar o arquivo'):n.text||n.tag||'Toque para escrever sua mensagem';card.append(el('p',text,'sf-card-summary'));if(n.type==='message'&&window.FlowTiming)card.append(el('small','◷ '+FlowTiming.label(n),'fe-delay-preview'));}
    host.append(card);
    if(n.choices.some(c=>!window.flowChoiceIsLink(c))){
      card.append(el('p','Cada resposta continua pelo caminho abaixo.','small muted'));
      const branches=el('div',null,'sf-branches');host.append(branches);
      n.choices.forEach((c,i)=>{if(window.flowChoiceIsLink(c))return;const branch=el('div',null,'sf-branch');branches.append(branch);const bar=el('div',null,'sf-branch-head');branch.append(bar);const response=inputField(bar,'Se escolher',c.title,v=>c.title=v,{max:80});window.flowTitleHint?.(response);window.flowEmojiFields?.(bar);
        const remove=button('×',()=>{if(c.next){toast('Remova as etapas deste caminho antes de apagar a resposta.');return;}mutate(()=>n.choices.splice(i,1));},'subtle');remove.setAttribute('aria-label','Remover resposta '+c.title);bar.append(remove);
        branch.append(button(c.next?'+ Inserir próximo passo':'+ Próximo passo',()=>chooseNextStep(n,i),'sf-add'));
        if(c.next||n.next)renderPath(branch,c.next||n.next,nextTrail,'CAMINHO '+(i+1));else branch.append(el('p','Seu próximo passo aparece aqui.','sf-end'));
      });
    }else{host.append(button(n.next?'+ Inserir etapa':'+ Próximo passo',()=>chooseNextStep(n),'sf-add'));if(n.next)renderPath(host,n.next,nextTrail,'PRÓXIMA ETAPA');else host.append(el('p','Fim deste caminho','sf-end'));}
  }
  function renderConversation(target){
    const host=target||$('#sf-conversation');if(!host||!mapState)return;host.replaceChildren();
    const tabs=el('div',null,'preview-tabs'),channels=mapState.channels||[mapState.trigger];if(!channels.includes(previewChannel))previewChannel=channels[0];
    channels.forEach(c=>tabs.append(button(channelNames[c],()=>{previewChannel=c;renderConversation(host);},c===previewChannel?'selected':'outline')));host.append(tabs);
    host.append(el('p',previewChannel==='comment'?'Comentou na publicação':previewChannel==='story'?'Respondeu ao story':'Enviou no Direct','small muted'),el('div',mapState.keywords.split(',')[0]||'Olá!','sf-incoming'));
    let id=mapState.map.start;const seen=new Set();
    while(id&&!seen.has(id)){seen.add(id);const n=mapState.map.nodes.find(x=>x.id===id);if(!n)break;
      if(n.type==='message'&&window.FlowTiming)host.append(el('small','◷ '+FlowTiming.label(n),'fe-delay-preview'));
      host.append(el('div',n.type==='wait'?'◷ '+FlowTiming.waitLabel(n):n.mediaType?(icons[n.mediaType]+' '+titles[n.mediaType]):(n.text||n.tag||'Sua mensagem aparece aqui').replace(/\{\{\s*first_name\s*\}\}/g,'Ana'),'sf-bubble'));
      if(n.type==='follow'){host.append(el('div','Ver perfil ↗','preview-button'),el('div',n.followButton||'Já segui','preview-button'),el('small','A próxima etapa só é enviada após o clique e a confirmação de que segue.','small muted'));}
      if(n.mediaType&&n.mediaUrl&&window.flowMediaPreview)window.flowMediaPreview(host,n.mediaType,n.mediaUrl);
      for(const p of n.parts||[])host.append(el('div',p.type==='text'?p.text:p.type==='delay'?'◷ '+p.seconds+' s':titles[p.type]||p.type,'sf-bubble'));
      for(const l of [...(n.url?[{title:n.label,url:n.url}]:[]),...(n.links||[]),...n.choices.filter(c=>window.flowChoiceIsLink(c))]){const a=el('a',l.title+' ↗','preview-button');if(/^https:\/\//i.test(l.url)){a.href=l.url;a.target='_blank';a.rel='noopener noreferrer';}else a.title='Preencha um endereço HTTPS';host.append(a);}
      if(n.choices.some(c=>!window.flowChoiceIsLink(c))){let selected=chosenPaths.get(n.id)||0;if(!n.choices[selected]||window.flowChoiceIsLink(n.choices[selected]))selected=n.choices.findIndex(c=>!window.flowChoiceIsLink(c));n.choices.forEach((c,i)=>{if(!window.flowChoiceIsLink(c))host.append(button(c.title||'Resposta',()=>{chosenPaths.set(n.id,i);renderConversation(host);},'sf-preview-choice'+(n.replyStyle==='buttons'?' sf-preview-postback preview-button':'')+(i===selected?' chosen':'')));});if(n.choices.some(c=>Array.from(c.title).length>20))host.append(el('small','Há resposta acima de 20 caracteres. Encurte o texto antes de publicar no Instagram.','fe-title-hint fe-warning'));host.append(el('small','Toque em uma resposta para ver esse caminho.','muted'));id=n.choices[selected].next||n.next;}else id=n.next;
    }
  }
  window.drawFlowConversation=renderConversation;
  renderGuided=function(){
    if(!mapState||!guidedMode)return;guidedHost.replaceChildren();guidedHost.classList.add('sf-workspace');
    const lane=el('div',null,'sf-lane');lane.append(el('h2','Monte a conversa'),el('p','Adicione uma etapa. Depois, escolha o próximo passo.','muted'));
    const start=el('div',null,'sf-start');start.append(el('small','INÍCIO','eyebrow'),el('strong',(mapState.channels||[mapState.trigger]).map(c=>channelNames[c]).join(' + ')),el('span',mapState.match==='any'?'Qualquer texto':mapState.keywords||'Defina as palavras-chave no início'));lane.append(start);
    const first=mapState.map.nodes.find(n=>n.id===mapState.map.start);
    if((mapState.channels||[mapState.trigger]).includes('comment')&&first?.next&&!first.choices.length)lane.append(el('p','Para continuar após a primeira mensagem de um comentário, a pessoa precisa responder. Ela pode escrever uma resposta ou tocar em uma opção de resposta. Botões de link apenas abrem o endereço.','notice'));
    if(mapState.map.start)renderPath(lane,mapState.map.start,new Set(),'PRIMEIRA ETAPA');else lane.append(button('+ Primeira etapa',()=>chooseNextStep(null),'gold'));
    const connected=new Set();const visit=id=>{if(!id||connected.has(id))return;connected.add(id);const n=mapState.map.nodes.find(n=>n.id===id);if(n){visit(n.next);n.choices.forEach(c=>visit(c.next));}};visit(mapState.map.start);
    const loose=mapState.map.nodes.filter(n=>!connected.has(n.id));
    if(loose.length){lane.append(el('h3','Blocos sem conexão'),el('p','Conecte estes blocos ao caminho desejado em “Ver mapa”.','muted'));for(const n of loose){if(connected.has(n.id))continue;renderPath(lane,n.id,new Set(),'CÓPIA / BLOCO LIVRE');visit(n.id);}}
    const footer=el('div',null,'sf-save');footer.append(el('span','Tudo pronto? Salve sua conversa.'),button('Salvar fluxo',()=>$('#save-flow').click(),'gold'));lane.append(footer);
    const preview=el('aside',null,'sf-preview');preview.append(el('h3','Prévia da conversa'),el('p','Exemplo de como a pessoa percorre o fluxo.','small muted'));const conv=el('div');conv.id='sf-conversation';preview.append(conv);guidedHost.append(lane,preview);renderConversation();
  };
  const section=$('[data-page="map-editor"]');section.classList.add('sf-editor');
  const setup=el('details',null,'sf-setup');setup.open=true;setup.append(el('summary','1. Quando a conversa começa'));
  $('.map-settings').before(setup);setup.append($('.map-settings'));if($('#map-channel-settings'))setup.append($('#map-channel-settings'));
  const oldSync=syncMapSettings;syncMapSettings=function(){oldSync();const channels=$('#map-channel-settings');if(channels)setup.append(channels);};
  const oldEdit=editMap;editMap=function(rule){editing='';oldEdit(rule);setup.open=!rule;};
  guideModeButton.textContent='Passo a passo';mapModeButton.textContent='Ver mapa';

  if(mapState)renderGuided();
})();
