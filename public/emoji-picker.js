/* Local catalog: Emojibase 17, Portuguese CLDR names. License: /EMOJI-LICENSE.txt. */
(() => {
 let catalogPromise;
 const groups=['😊 Rostos e emoções','👋 Pessoas e corpo','🧩 Componentes','🐻 Animais e natureza','🍕 Comidas e bebidas','🚗 Viagens e lugares','⚽ Atividades','💡 Objetos','❤️ Símbolos','🏳️ Bandeiras'];
 const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 async function catalog(){
  if(!catalogPromise)catalogPromise=fetch('/emojis-pt.json').then(r=>{if(!r.ok)throw Error('catalog');return r.json();}).then(r=>r.data.flatMap(e=>[{...e,tone:0},...e.skins.map(s=>({...s,group:e.group,tags:e.tags}))]).map(e=>({...e,search:normalize(e.label+' '+e.tags.join(' ')+' '+e.emoji)}))).catch(e=>{catalogPromise=null;throw e;});
  return catalogPromise;
 }
 window.openFlowEmojiPicker=async input=>{
  if(document.querySelector('.fe-emoji-dialog'))return;
  const start=input.selectionStart??input.value.length,end=input.selectionEnd??start;
  const dialog=el('dialog',null,'fe-emoji-dialog'),header=el('div',null,'fe-emoji-header'),title=el('h2','Escolha um emoji');title.id='fe-emoji-heading';dialog.setAttribute('aria-labelledby',title.id);
  const close=button('✕',()=>dialog.close(),'subtle');close.setAttribute('aria-label','Fechar emojis');header.append(title,close);
  const searchLabel=el('label','Buscar emoji'),search=el('input');search.type='search';search.placeholder='Ex.: coração, sorriso, festa, dinheiro…';search.setAttribute('aria-label','Buscar emoji');searchLabel.append(search);
  const filters=el('div',null,'fe-emoji-filters'),categoryLabel=el('label','Categoria'),category=el('select');category.setAttribute('aria-label','Categoria de emoji');category.add(new Option('Todos os emojis','all'));groups.forEach((name,i)=>category.add(new Option(name,String(i))));categoryLabel.append(category);
  const toneLabel=el('label','Tom de pele'),tone=el('select');tone.setAttribute('aria-label','Tom de pele');[['0','Padrão'],['all','Todas as variações'],['1','🏻 Pele clara'],['2','🏼 Pele morena clara'],['3','🏽 Pele morena'],['4','🏾 Pele morena escura'],['5','🏿 Pele escura']].forEach(([value,label])=>tone.add(new Option(label,value)));toneLabel.append(tone);filters.append(categoryLabel,toneLabel);
  const status=el('p','Carregando catálogo…','small muted'),grid=el('div',null,'fe-full-emoji-grid'),more=button('Mostrar mais emojis',()=>{limit+=120;draw();},'outline');status.setAttribute('role','status');grid.setAttribute('aria-label','Emojis disponíveis');more.hidden=true;
  dialog.append(header,searchLabel,filters,status,grid,more,el('small','Alguns emojis novos dependem da versão do seu aparelho.','muted'));document.body.append(dialog);
  dialog.addEventListener('close',()=>{dialog.remove();if(input.isConnected)input.focus();},{once:true});dialog.showModal();search.focus();
  let all=[],limit=120;
  function draw(){
   const terms=normalize(search.value).trim().split(/\s+/).filter(Boolean);
   const entries=all.filter(e=>(category.value==='all'||e.group===Number(category.value))&&(tone.value==='all'||(tone.value==='0'?e.tone===0:e.tone===0||[].concat(e.tone).includes(Number(tone.value))))&&terms.every(t=>e.search.includes(t)));
   grid.replaceChildren();
   entries.slice(0,limit).forEach(e=>{const b=button(e.emoji,()=>{
    const value=input.value.slice(0,start)+e.emoji+input.value.slice(end);
    if(input.maxLength>=0&&value.length>input.maxLength){status.textContent='O campo atingiu o limite de caracteres. Feche e encurte o texto para inserir o emoji.';return;}
    input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));dialog.close();if(input.isConnected)input.setSelectionRange(start+e.emoji.length,start+e.emoji.length);
   },'fe-full-emoji');b.title=e.label;b.setAttribute('aria-label',e.label);grid.append(b);});
   status.textContent=entries.length?Math.min(limit,entries.length)+' de '+entries.length+' emojis':'Nenhum emoji encontrado. Tente outra palavra.';more.hidden=limit>=entries.length;
  }
  search.oninput=category.onchange=tone.onchange=()=>{limit=120;draw();};
  try{all=await catalog();if(dialog.isConnected)draw();}catch{if(dialog.isConnected){status.textContent='Não foi possível carregar os emojis.';dialog.append(button('Tentar novamente',()=>{dialog.close();window.openFlowEmojiPicker(input);},'outline'));}}
 };
})();
