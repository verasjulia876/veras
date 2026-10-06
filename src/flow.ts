import {validateMap,type MapFlow} from './map';
export type Flow={version:1;nextPostAt?:number;map?:MapFlow;match:'contains'|'exact'|'any';channels?:string[];storyId?:string;allPosts:boolean;welcomeEnabled:boolean;welcomeText:string;welcomeButton:string;requireFollow:boolean;followText:string;collectEmail:boolean;emailText:string;linkEnabled:boolean;linkLabel:string;attachmentType:''|'image'|'audio'|'video'|'file';attachmentUrl:string;followupEnabled:boolean;followupMinutes:number;followupText:string;followupLink:string;followupLabel:string};
const https=(value:string)=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}};
export function validateFlow(input:unknown):Flow{
 let b:any=input;if(typeof b==='string'){try{b=JSON.parse(b);}catch{throw Error('Configuração da conversa inválida.');}}
 if(!b||typeof b!=='object'||Array.isArray(b)||b.version!==1)throw Error('Configuração da conversa inválida.');
 const str=(k:string,fallback:string,max:number)=>{const v=b[k]??fallback;if(typeof v!=='string'||(['welcomeButton','linkLabel','followupLabel'].includes(k)?Array.from(v).length:v.length)>max)throw Error('Campo inválido: '+k);return v.trim();};
 const bool=(k:string,fallback=false)=>{const v=b[k]??fallback;if(typeof v!=='boolean')throw Error('Opção inválida: '+k);return v;};
 const match=str('match','contains',10);if(!['contains','exact','any'].includes(match))throw Error('Correspondência inválida.');
 const attachmentType=str('attachmentType','',10);if(!['','image','audio','video','file'].includes(attachmentType))throw Error('Tipo de mídia inválido.');
 const f:Flow={version:1,match:match as Flow['match'],allPosts:bool('allPosts'),welcomeEnabled:bool('welcomeEnabled'),welcomeText:str('welcomeText','Oi! Toque abaixo para receber seu link.',600),welcomeButton:str('welcomeButton','Quero o link!',20),requireFollow:bool('requireFollow'),followText:str('followText','Siga nosso perfil e toque em Já segui para continuar.',600),collectEmail:bool('collectEmail'),emailText:str('emailText','Qual é seu e-mail para receber este conteúdo? Ao responder, você autoriza salvar esse contato para esta entrega.',600),linkEnabled:bool('linkEnabled',true),linkLabel:str('linkLabel','Abrir link',20),attachmentType:attachmentType as Flow['attachmentType'],attachmentUrl:str('attachmentUrl','',500),followupEnabled:bool('followupEnabled'),followupMinutes:Number(b.followupMinutes??60),followupText:str('followupText','Conseguiu acessar? Aqui está o link novamente.',600),followupLink:str('followupLink','',350),followupLabel:str('followupLabel','Abrir link',20)};
 if(f.welcomeEnabled&&(!f.welcomeText||!f.welcomeButton))throw Error('Preencha as boas-vindas e o texto do botão.');
 if(f.requireFollow&&!f.followText||f.collectEmail&&!f.emailText)throw Error('Preencha as mensagens das condições.');
 if(f.linkEnabled&&!f.linkLabel)throw Error('Informe o texto do botão com link.');
 if(f.attachmentType&&!https(f.attachmentUrl))throw Error('Informe uma URL HTTPS pública da mídia.');
 if(f.followupEnabled&&(!Number.isInteger(f.followupMinutes)||f.followupMinutes<1||f.followupMinutes>1380||!f.followupText||(f.followupLink&&!https(f.followupLink))||(f.followupLink&&!f.followupLabel)))throw Error('Acompanhamento: use de 1 a 1380 minutos, mensagem e link HTTPS válido, se houver.');
 if(b.channels!==undefined){if(!Array.isArray(b.channels)||!b.channels.length||b.channels.length>3||b.channels.some((c:unknown)=>!['comment','story','dm'].includes(String(c))))throw Error('Selecione pelo menos um canal válido.');f.channels=[...new Set<string>(b.channels)];}
 f.storyId=str('storyId','',100);if(f.storyId&&!/^\d+$/.test(f.storyId))throw Error('Escolha um story válido.');
 if(b.nextPostAt!==undefined){if(!Number.isSafeInteger(b.nextPostAt)||b.nextPostAt<1)throw Error('Data do próximo post inválida.');f.nextPostAt=b.nextPostAt;f.allPosts=false;}
 if(b.map)f.map=validateMap(b.map);
 return f;
}
export function readFlow(rule:{flow?:string}):Flow|null{if(!rule.flow||rule.flow==='{}')return null;try{return validateFlow(rule.flow);}catch{return null;}}
export function fillVariables(text:string,name=''){return text.replace(/\{\{\s*first_name\s*\}\}/g,name.trim().split(/\s+/)[0]||'você');}
export function keywordMatches(text:string,keys:string,mode='contains'){
 if(mode==='any')return !!text.trim();
 const n=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();const value=n(text);
 return keys.split(',').some(k=>{const word=n(k);return !!word&&(mode==='exact'?value===word:(' '+value+' ').includes(' '+word+' '));});
}
export function hasChannel(rule:{trigger:string;flow?:string},channel:string){return (readFlow(rule)?.channels||[rule.trigger]).includes(channel);}
export const emailValid=(s:string)=>s.length<=200&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
export function textMessage(text:string,link='',label='Abrir link'):Record<string,unknown>{return link?{attachment:{type:'template',payload:{template_type:'button',text,buttons:[{type:'web_url',url:link,title:label}]}}}:{text};}
export function quickMessage(text:string,title:string,payload:string){return {text,quick_replies:[{content_type:'text',title,payload}]};}
