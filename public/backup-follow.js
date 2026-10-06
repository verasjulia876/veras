(() => {
 const file=el('input');file.type='file';file.accept='.json,application/json';file.hidden=true;document.body.append(file);
 async function exportBackup(){
  const data=await api('rules-backup');if(!data.rules.length){toast('Não há fluxos ou automações neste perfil.');return;}
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=el('a');a.href=url;a.download='directcash-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 const backupCard=el('article',null,'card');backupCard.id='backup-settings';
 backupCard.append(el('h2','Backup de fluxos e automações'),el('p','Exporte as configurações do perfil atual ou restaure um backup como cópias pausadas.','muted'));
 const backupActions=el('div',null,'rule-actions');backupActions.style.flexWrap='wrap';backupActions.append(button('Exportar backup',()=>run(exportBackup),'outline'),button('Importar backup',()=>file.click(),'outline'));backupCard.append(backupActions);
 document.querySelector('[data-page="setup"] .page-title').after(backupCard);
 file.onchange=()=>run(async()=>{
  try{
   const selected=file.files[0];if(!selected)return;if(selected.size>4*1024*1024)throw Error('Use um backup de até 4 MB.');
   const data=JSON.parse(await selected.text());if(data?.format!=='directcash-backup'||data.version!==1||!Array.isArray(data.rules)||!data.rules.length)throw Error('Escolha um backup DirectCA$H válido.');
   const profile=state.account?.id||'',dialog=el('dialog',null,'flow-import-dialog');
   dialog.append(el('h2','Importar '+data.rules.length+' fluxos e automações'),el('p','Serão adicionadas cópias pausadas ao perfil atual. As automações existentes serão mantidas.'),el('p','O backup contém configurações e links dos anexos, não os arquivos de mídia. Ao mudar de instalação ou perfil, revise publicações e anexos antes de ativar.','small muted'));
   for(const r of data.rules)dialog.append(el('p',String(r?.name||'Sem nome')));
   const confirm=button('Importar cópias pausadas',()=>run(async()=>{
    if((state.account?.id||'')!==profile)throw Error('O perfil mudou. Feche e importe novamente no perfil desejado.');
    const result=await post('rules-backup',data);dialog.close();await refresh();renderFlows();toast(result.imported+' itens importados e pausados.');
   },confirm),'gold');dialog.append(confirm,button('Cancelar',()=>dialog.close(),'subtle'));dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();
  }finally{file.value='';}
 });
 const inspector=renderInspector;renderInspector=function(){
  inspector();const n=mapState?.map.nodes.find(n=>n.id===selectedNode);if(n?.type!=='follow')return;
  const host=$('#node-fields'),label=el('label','Texto do botão de verificação'),input=el('input');input.value=n.followButton||'Já segui';input.maxLength=40;
  input.onchange=()=>{remember();n.followButton=input.value;renderMap();};label.append(input);host.append(label,el('p','Pode ser a primeira etapa. Envia Ver perfil e o botão de verificação. O conteúdo só continua depois do clique e da confirmação de que a pessoa segue este perfil.','small muted'));
  window.flowTitleHint?.(input);window.flowEmojiFields?.(host);
 };
})();
