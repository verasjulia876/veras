import {validateFlow} from './flow';
import { timingSafeEqual } from 'node:crypto';
export function equal(a:string,b:string) {const x=new TextEncoder().encode(a), y=new TextEncoder().encode(b); return x.length===y.length && timingSafeEqual(x,y);}
export const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function matches(text:string, keywords:string) {
  const words=normalize(text).replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  return keywords.split(',').some(k=>{const n=normalize(k).replace(/[^\p{L}\p{N}]+/gu,' ').trim();return n && (' '+words+' ').includes(' '+n+' ');});
}
export function safeLink(value:string) {try {const u=new URL(value);return u.protocol==='https:' && !u.username && !u.password;}catch{return false;}}
export type Rule={id:string;name:string;trigger:string;media_id:string;keywords:string;message:string;link:string;public_reply:string;active:number;created:number;flow?:string};
export function validateRule(b:Record<string,unknown>):Omit<Rule,'id'|'created'> {
  const field=(key:string,max:number)=>{if(typeof b[key]!=='string'||(b[key] as string).length>max)throw Error('Campo inválido: '+key);return (b[key] as string).trim();};
  const name=field('name',80), trigger=field('trigger',20), media_id=field('media_id',100), keywords=field('keywords',160), message=field('message',600), link=field('link',350), public_reply=field('public_reply',3009);
  const flow=b.flow===undefined||b.flow==='{}'?null:validateFlow(b.flow);
  const comment=(flow?.channels||[trigger]).includes('comment');
  if(!name||!message||(!keywords&&flow?.match!=='any')||!['comment','dm','story'].includes(trigger)||(flow?(!flow.map&&flow.linkEnabled&&!safeLink(link)):!safeLink(link))||typeof b.active!=='boolean')throw Error('Preencha nome, palavra-chave, mensagem e um link HTTPS válido.');
  if(comment&&!flow?.nextPostAt&&!flow?.allPosts&&!/^\d+$/.test(media_id))throw Error('Escolha um post para a automação de comentários.');
  if(flow&&!flow.map&&comment&&!flow.welcomeEnabled&&!flow.requireFollow&&(flow.collectEmail||flow.attachmentType||flow.followupEnabled))throw Error('Ative a DM de boas-vindas para usar condições, mídia ou acompanhamento após um comentário.');
  if(flow?.map&&comment){const start=flow.map.nodes.find(n=>n.id===flow.map!.start)!;if(!['message','follow'].includes(start.type)||start.mediaType||start.parts?.length)throw Error(`Bloco ${start.number} — Após um comentário, comece com uma mensagem de texto ou a etapa Seguir. A continuação aguarda a resposta da pessoa.`);}
  if(public_reply.split('\n').filter(x=>x.trim()).some(x=>x.length>300)||public_reply.split('\n').filter(x=>x.trim()).length>10)throw Error('Use até 10 respostas públicas, com até 300 caracteres por linha.');
  return {...(flow?{flow:JSON.stringify(flow)}:{}),name,trigger,media_id:comment?media_id:'',keywords,message,link,public_reply:comment?public_reply:'',active:b.active?1:0};
}
export async function boundedText(request:Request|Response, max=262144) {
  if(!request.body)return ''; const reader=request.body.getReader(); const chunks:Uint8Array[]=[];let length=0;
  while(true){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>max){await reader.cancel();throw Error('Conteúdo acima do limite.');}chunks.push(part.value);}
  const all=new Uint8Array(length);let offset=0;for(const part of chunks){all.set(part,offset);offset+=part.length;}return new TextDecoder().decode(all);
}
const b64=(x:Uint8Array)=>Buffer.from(x).toString('base64url');
async function key(secret:string){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret)),'AES-GCM',false,['encrypt','decrypt']);}
export async function seal(value:string,secret:string){const iv=crypto.getRandomValues(new Uint8Array(12));const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(secret),new TextEncoder().encode(value));return b64(iv)+'.'+b64(new Uint8Array(bytes));}
export async function unseal(value:string,secret:string){const [iv,data]=value.split('.');return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:Buffer.from(iv,'base64url')},await key(secret),Buffer.from(data,'base64url')));}
export async function digest(value:string){return b64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))));}
export async function signatureValid(body:string,signature:string|null,secret:string){if(!signature?.match(/^sha256=[a-f0-9]{64}$/))return false;const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const sig=await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(body));return equal('sha256='+Buffer.from(sig).toString('hex'),signature);}
