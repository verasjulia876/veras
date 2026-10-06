/* Focused usability and attachment fixes. No account/profile layout changes. */
(() => {
 window.flowNumberBlocks=()=>{if(!mapState)return;const used=new Set();let next=Math.max(0,...mapState.map.nodes.map(n=>Number.isSafeInteger(n.number)&&n.number>0?n.number:0));for(const n of mapState.map.nodes){if(!Number.isSafeInteger(n.number)||n.number<1||used.has(n.number))n.number=++next;used.add(n.number);}};
 const inspector=renderInspector;renderInspector=function(){window.flowNumberBlocks();inspector();const n=mapState?.map.nodes.find(n=>n.id===selectedNode);if(n){const title=$('#node-title');if(!title.textContent.startsWith('Bloco '))title.textContent='Bloco '+n.number+' — '+title.textContent;}};
 window.flowShowError=error=>{const n=mapState?.map.nodes.find(n=>n.id===error.nodeId);if(!n)return;setEditorMode(false);selectedNode=n.id;renderMap();window.flowOpenNode(n);const v=$('#map-viewport');v.scrollLeft=Math.max(0,n.x*mapZoom-v.clientWidth/2+130*mapZoom);v.scrollTop=Math.max(0,n.y*mapZoom-80);let box=$('#flow-error');if(!box){box=el('div',null,'flow-error');box.id='flow-error';box.setAttribute('role','alert');$('#map-toolbar').before(box);}box.replaceChildren(el('strong',error.message),button('Ir ao bloco '+n.number,()=>window.flowShowError(error),'outline'),button('Fechar aviso',()=>box.remove(),'subtle'));requestAnimationFrame(()=>$('#node-fields input,#node-fields textarea,#node-fields select')?.focus());};
 const edit=editMap;editMap=function(rule){$('#flow-error')?.remove();edit(rule);window.flowNumberBlocks();renderMap();renderInspector();};
 const sync=syncMapSettings;syncMapSettings=function(){sync();if(!mapState)return;let note=$('#comment-continuation');if(!note){note=el('p',null,'small muted');note.id='comment-continuation';$('.sf-setup').append(note);}note.hidden=!(mapState.channels||[mapState.trigger]).includes('comment');note.textContent='Primeira mensagem: com ou sem botões. Após um comentário, a próxima etapa espera a pessoa responder no Direct. Clicar em um link não conta como resposta.';};

 const types={IMAGE:'Imagem',VIDEO:'Vídeo / Reel',CAROUSEL_ALBUM:'Carrossel'};
 function mediaCard(m,selected,choose){
  const card=el('article',null,'publication-card'+(selected?' selected':'')),b=button('',choose,'publication-choice');b.setAttribute('aria-pressed',String(selected));
  const src=m.thumbnail_url||(m.media_type==='IMAGE'?m.media_url:'');if(src&&/^https:\/\//.test(src)){const img=el('img');img.src=src;img.alt='Prévia da publicação';img.loading='lazy';b.append(img);}else b.append(el('span','▧','publication-empty'));
  b.append(el('strong',selected?'✓ Selecionada':'Selecionar'),el('small',(types[m.media_type]||'Story')+(m.timestamp?' · '+new Date(m.timestamp).toLocaleDateString('pt-BR'):'')));
  const caption=el('p',m.caption||'Sem legenda','publication-caption');b.append(caption);card.append(b);
  if(m.caption?.length>90)card.append(button('Ver legenda',()=>{const open=caption.classList.toggle('expanded');expand.textContent=open?'Recolher legenda':'Ver legenda';},'publication-expand'));
  const expand=card.querySelector('.publication-expand');return card;
 }
 chooseVisualMedia=async function(kind,onchoose){
  const dialog=el('dialog',null,'visual-media-dialog organized-media'),head=el('div',null,'publication-heading'),grid=el('div',null,'media-grid'),note=el('p','Carregando…','muted'),search=el('input'),footer=el('div',null,'dialog-footer');
  const close=()=>{dialog.close();dialog.remove();};let selected=null,after='',items=[];
  head.append(el('h2',kind==='story'?'Escolha um story':'Escolha uma publicação'),button('✕',close,'subtle'));head.lastChild.setAttribute('aria-label','Fechar seleção');search.placeholder='Buscar pela legenda';search.setAttribute('aria-label','Buscar publicação');
  const confirm=button('Usar esta publicação',()=>{if(!selected)return;visualSelections.set(selected.id,selected);onchoose(selected);close();},'gold');confirm.disabled=true;
  const more=button('Carregar mais',()=>run(load,more),'outline');more.hidden=true;
  footer.append(button('Usar todos',()=>{onchoose(null);close();},'outline'),more,confirm);dialog.append(head,search,note,grid,footer);document.body.append(dialog);dialog.showModal();dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  function render(){grid.replaceChildren();for(const m of items.filter(m=>(m.caption||'').toLocaleLowerCase().includes(search.value.toLocaleLowerCase())))grid.append(mediaCard(m,selected?.id===m.id,()=>{selected=m;confirm.disabled=false;render();}));note.textContent=grid.children.length?'Selecione uma miniatura e confirme abaixo.':'Nenhum conteúdo encontrado.';}
  async function load(){const r=await api(kind==='story'?'stories':'media'+(after?'?after='+encodeURIComponent(after):''));after=r.after||'';for(const m of r.data||[])if(!items.some(x=>x.id===m.id))items.push(m);more.hidden=!after;render();}
  search.oninput=render;try{await load();}catch(e){note.textContent=e.message;}
 };
 renderMedia=function(){const grid=$('#media-grid'),q=$('#media-search').value.toLocaleLowerCase();grid.replaceChildren();for(const m of mediaItems.filter(m=>([m.caption,m.permalink,m.id].join(' ')).toLocaleLowerCase().includes(q)))grid.append(mediaCard(m,pendingMedia?.id===m.id,()=>{pendingMedia=m;$('#use-media').disabled=false;renderMedia();}));if(!grid.children.length)grid.append(el('p','Nenhuma publicação encontrada.','muted'));};
 $('#media-dialog').classList.add('organized-media');

 const formats={image:{label:'imagem',accept:'.jpg,.jpeg,.png,.webp',help:'JPG, JPEG, PNG ou WebP'},video:{label:'vídeo',accept:'.mp4',help:'MP4'},audio:{label:'áudio',accept:'.mp3,.m4a,.aac,.wav,.ogg',help:'MP3, M4A, AAC, WAV ou OGG'},file:{label:'documento',accept:'.pdf,.doc,.docx',help:'PDF, DOC ou DOCX'}};
 const mime={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',mp4:'video/mp4',mp3:'audio/mpeg',m4a:'audio/mp4',aac:'audio/aac',wav:'audio/wav',ogg:'audio/ogg',pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
 async function prepare(file,kind,convert){
  const ext=file.name.split('.').pop().toLowerCase(),type=mime[ext];if(!formats[kind].accept.split(',').includes('.'+ext)||!type)throw Error('Escolha '+formats[kind].help+'.');if(file.size>10485760)throw Error('Use um arquivo de até 10 MB.');
  convert=kind==='audio'&&(convert||['mp3','ogg'].includes(ext));
  let blob=file,duration;
  if(kind==='audio'){
   const Audio=window.AudioContext||window.webkitAudioContext,ctx=Audio?new Audio():null;
   try{if(!ctx)throw Error();const decoded=await ctx.decodeAudioData(await file.arrayBuffer());duration=decoded.duration;
    if(convert){const rate=22050,frames=Math.ceil(duration*rate);if(frames*2+44>10485760)throw Error('O áudio convertido excede 10 MB. Use um MP3 menor.');const offline=new OfflineAudioContext(1,frames,rate),source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start();const rendered=await offline.startRendering(),pcm=rendered.getChannelData(0),buffer=new ArrayBuffer(44+pcm.length*2),view=new DataView(buffer);const str=(at,s)=>[...s].forEach((c,i)=>view.setUint8(at+i,c.charCodeAt(0)));str(0,'RIFF');view.setUint32(4,buffer.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,pcm.length*2,true);for(let i=0;i<pcm.length;i++)view.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,pcm[i]))*(pcm[i]<0?32768:32767)),true);blob=new Blob([buffer],{type:'audio/wav'});}
   }catch(e){if(convert)throw Error(e.message||'Este navegador não consegue converter este áudio. Use M4A, AAC ou WAV.');}finally{await ctx?.close();}
  }
  return {blob,type:convert&&kind==='audio'?'audio/wav':type,duration};
 }
 const previousPreview=window.flowMediaPreview;window.flowMediaPreview=(host,type,url)=>{if(type!=='file')return previousPreview(host,type,url);if(!url||!/^https:\/\//.test(url)&&!url.startsWith(location.origin+'/uploads/'))return;const link=el('a','📄 Abrir documento para baixar','fp-media document-preview');link.href=url;link.target='_blank';link.rel='noopener';host.append(link,el('small','A pessoa receberá um link para baixar o documento.','muted'));};
 async function upload(file,kind,convert){const prepared=await prepare(file,kind,convert);const r=await fetch('/api/uploads?kind='+kind,{method:'POST',headers:{'Content-Type':prepared.type},body:prepared.blob}),data=await r.json();if(!r.ok)throw Error(data.error||'Falha ao anexar o arquivo.');return {...data,duration:prepared.duration,size:prepared.blob.size,name:prepared.type==='audio/wav'?file.name.replace(/\.[^.]+$/,'.wav'):file.name};}
 function attachmentFields(host,kind,url,onupload){
  const f=formats[kind];if(!f)return;const box=el('div',null,'fp-upload'),input=el('input'),status=el('p','','small muted'),convert=el('input');input.type='file';input.accept=f.accept;input.hidden=true;convert.type='checkbox';
  const attach=button('📎 '+(url?'Trocar ':'Anexar ')+f.label,()=>input.click(),'gold');box.append(attach,input,el('small',f.help+' · até 10 MB','muted'));
  if(kind==='audio'){const label=el('label','Converter para WAV compatível'),help=el('small','MP3 e OGG são convertidos automaticamente para WAV antes do envio. AAC, M4A e WAV podem ser enviados diretamente. O áudio continua sendo uma mensagem de áudio.','muted');label.prepend(convert);box.append(label,help);}
  if(kind==='audio'&&url){
   const fix=button('Preparar áudio já anexado',async()=>{fix.disabled=true;attach.disabled=true;status.textContent='Convertendo o áudio para WAV…';try{const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Não foi possível abrir o áudio. Anexe o arquivo novamente.');const reader=response.body.getReader(),pieces=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>10485760){await reader.cancel();throw Error('Use um áudio de até 10 MB.');}pieces.push(value);}}finally{reader.releaseLock();}const contentType=(response.headers.get('content-type')||'').split(';')[0],ext=Object.keys(mime).find(k=>mime[k]===contentType)||new URL(url,location.href).pathname.split('.').pop();const result=await upload(new File(pieces,'audio.'+ext,{type:contentType}),'audio',true);onupload(result);toast('Áudio preparado. Salve o fluxo para usar a versão convertida.');}catch(e){status.textContent=e.message||'Anexe o áudio novamente para converter.';}finally{fix.disabled=false;attach.disabled=false;}},'outline');box.append(fix);if(/\.(mp3|ogg)(?:[?#]|$)/i.test(url))box.append(el('small','Este anexo antigo precisa ser convertido. Toque em Preparar áudio já anexado e depois salve.','muted'));
  }
  if(kind==='file')box.append(el('small','Envio como link para baixar, com o nome do documento.','muted'));
  box.append(status);host.append(box);
  input.onchange=async()=>{const file=input.files?.[0];if(!file)return;attach.disabled=true;status.textContent='Preparando '+file.name+'…';try{const result=await upload(file,kind,convert.checked);onupload(result);status.textContent='Arquivo pronto.';}catch(e){status.textContent=e.message||'Não foi possível ler este áudio. Use M4A, AAC ou WAV.';}finally{attach.disabled=false;input.value='';}};
 }
 window.flowAttachmentEditor=(host,n,rerender)=>{
  const originalState=mapState;attachmentFields(host,n.mediaType,n.mediaUrl,result=>{if(mapState!==originalState||!mapState.map.nodes.includes(n))return;remember();n.mediaUrl=result.url;n.fileName=result.name;n.fileSize=result.size;delete n.mediaDuration;if(result.duration)n.mediaDuration=result.duration;else if(n.mediaType==='audio'&&n.sendDelay?.mode!=='manual'){n.sendDelay={mode:'manual',seconds:2};toast('Não foi possível ler a duração. Pausa definida em 2 segundos; você pode ajustar.');}rerender();});
  if(n.fileName)host.append(el('p',n.fileName+(n.fileSize?' · '+(n.fileSize/1048576).toFixed(2)+' MB':''),'small muted'));window.flowMediaPreview(host,n.mediaType,n.mediaUrl);
  const details=el('details',null,'fp-link-alternative'),label=el('label','Endereço HTTPS do arquivo'),input=el('input');input.type='url';input.maxLength=500;input.value=n.mediaUrl||'';input.placeholder='https://…';input.onchange=()=>{remember();n.mediaUrl=input.value.trim();delete n.fileName;delete n.fileSize;delete n.mediaDuration;rerender();};label.append(input);details.append(el('summary','Ou usar um link'),label);host.append(details);
 };
 const form=$('#rule-form'),kind=form.elements.attachmentType;kind.add(new Option('Documento (link para baixar)','file'));let simpleHost=el('div');kind.closest('label').after(simpleHost);
 const preview=updatePreview;updatePreview=function(){preview();const type=kind.value,url=form.elements.attachmentUrl.value;if(simpleHost.dataset.key===type+'|'+url)return;simpleHost.dataset.key=type+'|'+url;simpleHost.replaceChildren();if(type){attachmentFields(simpleHost,type,url,result=>{form.elements.attachmentUrl.value=result.url;updatePreview();});window.flowMediaPreview(simpleHost,type,url);}};
 const oldRender=renderMap;renderMap=function(){window.flowNumberBlocks();oldRender();};
 if(mapState){renderMap();renderInspector();syncMapSettings();}
})();
