export type Part={type:'text'|'image'|'audio'|'video'|'delay';text:string;url:string;seconds:number};
export type Node={followButton?:string;replyStyle?:'quick'|'buttons';number?:number;fileName?:string;fileSize?:number;sendDelay?:{mode:'auto'|'manual';seconds:number};mediaDuration?:number;id:string;type:'message'|'carousel'|'wait'|'email'|'follow'|'tag';text:string;next:string;choices:{title:string;next:string;action?:'next'|'link';url?:string}[];minutes:number;url:string;label:string;mediaType:''|'image'|'audio'|'video'|'file';mediaUrl:string;tag:string;links?:{title:string;url:string}[];parts?:Part[];seconds?:number;cards?:{title:string;subtitle:string;image:string;buttons:{title:string;url:string}[]}[];x:number;y:number};
export type MapFlow={start:string;nodes:Node[]};
export class BlockError extends Error{constructor(public nodeId:string,public blockNumber:number,message:string){super(`Bloco ${blockNumber} — ${message}`);}}
export function validateMap(input:any):MapFlow{
 if(!input||!Array.isArray(input.nodes)||!input.nodes.length||input.nodes.length>30)throw Error('Use de 1 a 30 blocos no fluxo.');
 const used=new Set<number>();let nextNumber=Math.max(0,...input.nodes.map((b:any)=>Number.isSafeInteger(b?.number)&&b.number>0&&b.number<1000000?b.number:0));
 const nodes:Node[]=input.nodes.map((b:any)=>{
  const number=Number.isSafeInteger(b?.number)&&b.number>0&&b.number<1000000&&!used.has(b.number)?b.number:++nextNumber;used.add(number);
  try{
  const s=(k:string,max=600)=>{const v=b[k]??'';if(typeof v!=='string'||(k==='label'?Array.from(v).length:v.length)>max)throw Error('Campo inválido no bloco: '+k);return v.trim();};
  const id=s('id',40),type=s('type',20),text=s('text'),next=s('next',40),url=s('url',500),mediaUrl=s('mediaUrl',500),mediaType=s('mediaType',10);
  if(!/^[a-zA-Z0-9_-]+$/.test(id)||!['message','carousel','wait','email','follow','tag'].includes(type))throw Error('Bloco inválido.');
  if(['message','email','follow'].includes(type)&&!text&&!(type==='message'&&mediaType))throw Error('Preencha a mensagem de cada bloco.');
  const valid=(v:string)=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}};
  if(url&&!valid(url)||!['','image','audio','video','file'].includes(mediaType)||mediaType&&!valid(mediaUrl))throw Error('Use links HTTPS válidos nos blocos.');
  let replyStyle=b.replyStyle??'quick';if(!['quick','buttons'].includes(replyStyle))throw Error('Escolha o estilo dos botões.');
  const choices=(b.choices??[]);if(!Array.isArray(choices)||choices.length>13)throw Error('Use até 13 opções por mensagem.');
  if(replyStyle==='buttons'&&choices.length>3)throw Error('Botões na mensagem permitem até 3 respostas. Use respostas rápidas para mais opções.');
  const parsed=choices.map((c:any)=>{if(typeof c.title!=='string'||!c.title.trim()||Array.from(c.title).length>20||typeof c.next!=='string'||c.next.length>40)throw Error('Preencha o texto e o destino das opções.');const action=c.action??(c.url?'link':'next');if(!['next','link'].includes(action))throw Error('Escolha a ação do botão.');if(action==='link'){if(typeof c.url!=='string'||c.url.length>500||!valid(c.url)||c.next)throw Error('Botão de link: informe um endereço HTTPS e remova a conexão com outro bloco.');return {title:c.title.trim(),next:'',action:'link' as const,url:c.url};}if(c.url)throw Error('Escolha apenas uma ação por botão.');return {title:c.title.trim(),next:c.next};});
  if(parsed.some(c=>c.action==='link')){replyStyle='buttons';if(parsed.length>3)throw Error('Mensagens com links permitem até 3 botões.');}
  const links=b.links??[];if(!Array.isArray(links)||links.length>3||links.some((l:any)=>typeof l.title!=='string'||!l.title.trim()||Array.from(l.title).length>20||!valid(l.url)))throw Error('Use até 3 botões com título e link HTTPS.');if(links.length&&(type!=='message'||url||mediaType||parsed.length||b.parts?.length))throw Error('Use botões de link em uma mensagem de texto separada.');
  // A block destination is the fallback for responses without their own path.
  if(parsed.length&&(type!=='message'||url||mediaType))throw Error('Use opções de resposta em uma mensagem de texto sem link ou mídia.');
  const minutes=Number(b.minutes??60),seconds=b.seconds===undefined?undefined:Number(b.seconds);if(type==='wait'&&(seconds!==undefined?(!Number.isInteger(seconds)||seconds<1||seconds>82800):(!Number.isInteger(minutes)||minutes<1||minutes>1380)))throw Error('Use de 1 a 82.800 segundos ou de 1 a 1.380 minutos.');
  const tag=s('tag',40);if(type==='tag'&&!tag)throw Error('Dê um nome à etiqueta.');
  if(mediaType&&url)throw Error('Separe mídia e botão de link em dois blocos.');
  let cards:Node['cards'];if(type==='carousel'){
   if(!Array.isArray(b.cards)||b.cards.length<1||b.cards.length>10)throw Error('O catálogo precisa de 1 a 10 itens.');
   cards=b.cards.map((c:any)=>{if(typeof c.title!=='string'||!c.title.trim()||c.title.length>80||typeof c.subtitle!=='string'||c.subtitle.length>80||!valid(c.image)||!Array.isArray(c.buttons)||c.buttons.length>3)throw Error('Confira título, descrição, imagem HTTPS e até 3 botões de cada item.');
    const buttons=c.buttons.map((v:any)=>{if(typeof v.title!=='string'||!v.title.trim()||Array.from(v.title).length>20||!valid(v.url))throw Error('Confira os botões do catálogo.');return {title:v.title.trim(),url:v.url};});return {title:c.title.trim(),subtitle:c.subtitle,image:c.image,buttons};});
  }
  let parts:Part[]=[];if(b.parts){if(!Array.isArray(b.parts)||(b.parts.length&&type!=='message')||b.parts.length>12)throw Error('Use até 12 conteúdos adicionais por mensagem.');parts=b.parts.map((p:any)=>{if(!['text','image','audio','video','delay'].includes(p.type))throw Error('Conteúdo inválido.');const text=typeof p.text==='string'?p.text.trim():'',url=typeof p.url==='string'?p.url:'';const seconds=Number(p.seconds||3);if(p.type==='text'&&(!text||text.length>600)||['image','audio','video'].includes(p.type)&&!valid(url)||p.type==='delay'&&(!Number.isInteger(seconds)||seconds<1||seconds>10))throw Error('Confira os conteúdos; pausas curtas devem ter entre 1 e 10 segundos.');return {type:p.type,text,url,seconds};});}
  let sendDelay:Node['sendDelay'];let mediaDuration:number|undefined;
  if(b.sendDelay!==undefined){const d=b.sendDelay;if(!d||!['auto','manual'].includes(d.mode)||!Number.isInteger(d.seconds)||d.seconds<0||d.seconds>82800)throw Error('Confira o tempo de envio da mensagem.');sendDelay={mode:d.mode,seconds:d.seconds};}
  if(b.mediaDuration!==undefined){if(typeof b.mediaDuration!=='number'||!Number.isFinite(b.mediaDuration)||b.mediaDuration<=0||b.mediaDuration>82800)throw Error('Duração do áudio inválida.');mediaDuration=b.mediaDuration;}
  if(mediaType==='audio'&&sendDelay?.mode==='auto'&&!mediaDuration)throw Error('Aguarde carregar a duração do áudio ou defina o tempo manualmente.');
  if(type==='follow'&&Array.from(s('followButton',40)||'Já segui').length>20)throw Error('O botão de verificação deve ter até 20 caracteres.');
  const fileName=s('fileName',200),fileSize=Number(b.fileSize||0);
  if(!Number.isSafeInteger(fileSize)||fileSize<0||fileSize>10485760)throw Error('Tamanho do arquivo inválido.');
  return {followButton:type==='follow'?(s('followButton',40)||'Já segui'):undefined,replyStyle,number,fileName,fileSize,sendDelay,mediaDuration,links:links.map((l:any)=>({title:l.title.trim(),url:l.url})),parts,cards,id,type:type as Node['type'],text,next,choices:parsed,minutes,seconds,url,label:s('label',20)||'Abrir link',mediaType:mediaType as Node['mediaType'],mediaUrl,tag,x:Math.max(0,Math.min(4000,Number(b.x)||0)),y:Math.max(0,Math.min(4000,Number(b.y)||0))};
  }catch(e){throw new BlockError(String(b?.id||''),number,e instanceof Error?e.message:'Confira este bloco.');}
 });
 const ids=new Set(nodes.map(n=>n.id));if(ids.size!==nodes.length||!ids.has(input.start))throw Error('Escolha um bloco inicial válido.');
 const visiting=new Set<string>(),seen=new Set<string>();function visit(id:string){if(!id)return;if(!ids.has(id))throw Error('Há uma conexão apontando para um bloco removido.');if(visiting.has(id))throw Error('O fluxo não pode voltar a um bloco anterior.');if(seen.has(id))return;visiting.add(id);const n=nodes.find(n=>n.id===id)!;visit(n.next);n.choices.forEach(c=>visit(c.next));visiting.delete(id);seen.add(id);}visit(input.start);
 if(seen.size!==nodes.length){const n=nodes.find(n=>!seen.has(n.id))!;throw new BlockError(n.id,n.number!,'Conecte este bloco ao início do fluxo.');}return {start:input.start,nodes};
}
