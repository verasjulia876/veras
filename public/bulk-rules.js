(() => {
 const selections={flows:new Set(),automations:new Set()},bars={};let profile;
 function syncProfile(){const current=state.account?.id||'';if(profile!==current){profile=current;Object.values(selections).forEach(s=>s.clear());}for(const s of Object.values(selections))for(const id of s)if(!rules.some(r=>r.id===id))s.delete(id);}
 function visible(page){return [...document.querySelectorAll('[data-page="'+page+'"] .bulk-rule-check')];}
 function update(page){const list=visible(page),set=selections[page],bar=bars[page];if(!bar)return;bar.count.textContent=set.size+' selecionado(s)';bar.remove.disabled=!set.size;bar.all.checked=!!list.length&&list.every(c=>set.has(c.value));bar.all.indeterminate=list.some(c=>set.has(c.value))&&!bar.all.checked;bar.all.disabled=!list.length;}
 function confirmDelete(page){
  syncProfile();const ids=[...selections[page]],selected=rules.filter(r=>ids.includes(r.id)),account=profile;if(!selected.length)return;
  const dialog=el('dialog',null,'flow-import-dialog');dialog.append(el('h2','Excluir '+selected.length+' item(ns)?'),el('p','Esta exclusão é permanente. Você pode fazer um backup em Configurações antes de continuar.'));
  for(const r of selected)dialog.append(el('p',r.name));
  const confirm=button('Confirmar exclusão',()=>run(async()=>{if((state.account?.id||'')!==account)throw Error('O perfil mudou. Feche e selecione os itens novamente.');const result=await post('rules-bulk-delete',{ids});selections[page].clear();dialog.close();await refresh();renderFlows();toast(result.deleted+' item(ns) excluído(s).');},confirm),'gold');dialog.append(button('Cancelar',()=>dialog.close(),'outline'),confirm);dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();
 }
 for(const page of ['flows','automations']){
  const bar=el('div',null,'rule-actions'),label=el('label',null,'check'),all=el('input'),count=el('span','0 selecionado(s)','small muted');all.type='checkbox';label.append(all,document.createTextNode('Selecionar todos os exibidos'));label.style.margin='0';
  const remove=button('Excluir selecionados',()=>confirmDelete(page),'outline');remove.disabled=true;all.onchange=()=>{syncProfile();for(const c of visible(page)){if(all.checked)selections[page].add(c.value);else selections[page].delete(c.value);c.checked=all.checked;}update(page);};
  const clear=button('Limpar seleção',()=>{selections[page].clear();visible(page).forEach(c=>c.checked=false);update(page);},'subtle');bar.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin:16px 0';bar.append(label,count,remove,clear);document.querySelector(page==='flows'?'#flow-list':'#rules').before(bar);bars[page]={all,count,remove};
 }
 const row=ruleRow;ruleRow=function(r,map){syncProfile();const result=row(r,map),page=map?'flows':'automations',label=el('label',null,'check'),check=el('input');check.type='checkbox';check.className='bulk-rule-check';check.value=r.id;check.checked=selections[page].has(r.id);check.setAttribute('aria-label','Selecionar '+r.name);check.style.cssText='width:18px;min-width:18px;height:18px;min-height:0;margin:0';label.style.cssText='margin:0;align-self:flex-start;flex:0 0 auto';label.append(check);const description=result.firstElementChild,identity=el('div');identity.style.cssText='display:flex;align-items:flex-start;gap:12px;flex:1;min-width:0;text-align:left';description.style.cssText='min-width:0;overflow-wrap:anywhere;text-align:left';result.insertBefore(identity,description);identity.append(label,description);check.onchange=()=>{if(check.checked)selections[page].add(r.id);else selections[page].delete(r.id);update(page);};return result;};
 const renderAutomations=renderRules;renderRules=function(){syncProfile();renderAutomations();update('automations');};
 const renderMaps=renderFlows;renderFlows=function(){syncProfile();renderMaps();update('flows');};
})();
