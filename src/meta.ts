import {schedulePending} from './scheduler-client';
import {firstPostAfter} from './next-post';
import {readFlow,keywordMatches,hasChannel} from './flow';
import {queueInput,processInputs} from './conversations';
import { boundedText, digest, matches, seal, unseal, type Rule } from './core';
import {licenseFor} from './license';
export type AppEnv=Omit<Env,'FLOW_SCHEDULER'|'FLOW_MEDIA'> & {FLOW_SCHEDULER?:DurableObjectNamespace<import('./scheduler').FlowScheduler>;FLOW_MEDIA?:DurableObjectNamespace<import('./media-store').FlowMedia>;ADMIN_PASSWORD:string;APP_KEY:string;TEST_ACCESS_UNTIL?:string;LICENSE_ENFORCEMENT?:string;ROOT_DB?:D1Database;PROFILE_ID?:string;IN_FLOW_ALARM?:boolean};
export type Account={id:string;username:string;token:string;expires:number;refreshed:number};
export type Settings={appId:string;appSecret:string;verifyToken:string;contact:string;owner:string};
export const now=()=>Math.floor(Date.now()/1000);
export async function settings(env:AppEnv):Promise<Settings|null>{const row=await env.DB.prepare("SELECT value FROM settings WHERE key='meta'").first<{value:string}>();return row?JSON.parse(await unseal(row.value,env.APP_KEY)):null;}
export const account=(env:AppEnv)=>env.DB.prepare('SELECT * FROM account LIMIT 1').first<Account>();
export async function log(env:AppEnv,kind:string,detail:string){await env.DB.prepare('INSERT INTO events(kind,detail,created) VALUES(?,?,?)').bind(kind,detail.slice(0,350),now()).run();}
export class MetaError extends Error{constructor(public status:number,public code:number,public subcode:number,description=''){super(`Meta: HTTP ${status}, código ${code}${subcode?' / '+subcode:''}. ${description?description.replace(/https?:\/\/\S+/g,'[endereço]').replace(/Bearer\s+\S+|access_token[=:]\S+/gi,'[credencial]').slice(0,300):'Confira o arquivo, as permissões e a conexão.'}`);}}
export async function meta(url:string,init:RequestInit={},timeout=12000) {
  const response=await fetch(url,{...init,signal:AbortSignal.timeout(timeout)});
  const data=JSON.parse(await boundedText(response,1048576));
  if(!response.ok||data.error)throw new MetaError(response.status,Number(data.error?.code||0),Number(data.error?.error_subcode||0),String(data.error?.error_user_msg||data.error?.message||''));
  return data;
}
export async function graph(env:AppEnv,a:Account,path:string,body?:unknown,timeout=12000){return meta(`https://graph.instagram.com/${env.GRAPH_VERSION}/${path}`,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+await unseal(a.token,env.APP_KEY),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})},timeout);}
async function recordInteraction(env:AppEnv,kind:string,id:string,userId:string,text:string,created:number,username=''){
 const detail=JSON.stringify({eventId:id,userId,username:username.slice(0,100),text:text.slice(0,2000)});
 await env.DB.prepare('INSERT INTO events(kind,detail,created) SELECT ?,?,? WHERE NOT EXISTS(SELECT 1 FROM events WHERE kind=? AND detail=?)').bind(kind,detail,created,kind,detail).run();
}
export async function bindNextPosts(env:AppEnv,a:Account){
 const pending=(await env.DB.prepare("SELECT id,flow FROM rules WHERE active=1 AND json_extract(flow,'$.nextPostAt') IS NOT NULL").all<{id:string;flow:string}>()).results;
 if(!pending.length)return;
 // Share pages between pending rules, without retaining credentials or profile data globally.
 const pages=new Map<string,Promise<any>>();
 const page=(after='')=>{if(!pages.has(after))pages.set(after,graph(env,a,`${a.id}/media?fields=id,timestamp&limit=100${after?'&after='+encodeURIComponent(after):''}`));return pages.get(after)!;};
 try{
  for(const rule of pending){
   const flow=readFlow(rule);if(!flow?.nextPostAt)continue;
   const id=await firstPostAfter(flow.nextPostAt,page);if(!id)continue;
   delete flow.nextPostAt;flow.allPosts=false;
   // A concurrent save, pause or webhook must never overwrite a newer selection.
   await env.DB.prepare('UPDATE rules SET media_id=?,flow=? WHERE id=? AND flow=? AND active=1').bind(id,JSON.stringify(flow),rule.id,rule.flow).run();
  }
 }catch(error){console.error('next-post binding failed',error instanceof Error?error.message:'unknown error');}
}
export async function ingest(env:AppEnv, payload:{object?:string;entry?:Entry[]}) {
  if(payload.object!=='instagram')return;
  const a=await account(env);if(!a||!await licenseFor(env,a.id))return;
  await bindNextPosts(env,a);
  const rules=(await env.DB.prepare('SELECT * FROM rules WHERE active=1 ORDER BY created ASC').all<Rule>()).results;
  for(const entry of (payload.entry||[]).slice(0,100)){
    if(entry.id!==a.id)continue;
    for(const change of (entry.changes||[]).slice(0,100)){
      if(change.field!=='comments')continue;
      const c=change.value;
      if(!c?.id||!c.from?.id||c.from.id===a.id||c.parent_id||c.media?.media_product_type==='LIVE')continue;
      const created=Number(entry.time);if(!Number.isFinite(created)||created>now()+300||now()-created>7*86400)continue;
      await recordInteraction(env,'comment','comment:'+c.id,c.from.id,c.text||'',created,c.from.username||'');
      const r=rules.find(r=>hasChannel(r,'comment')&&(readFlow(r)?.allPosts||r.media_id===c.media?.id)&&keywordMatches(c.text||'',r.keywords,readFlow(r)?.match));
      if(r){if(readFlow(r))await queueInput(env,a,'comment:'+c.id,c.from.id,r.id,'start',{comment:c.id},created,created+7*86400);else await enqueue(env,a,r,'private',c.id,created+7*86400,'comment:'+c.id);}
    }
    for(const m of (entry.messaging||[]).slice(0,100)){
      if(m.postback?.payload&&m.sender?.id&&m.sender.id!==a.id){
       const created=Math.floor(Number(m.timestamp)/1000),quick=m.postback.payload;if(!Number.isFinite(created)||created>now()+300||now()-created>86400||quick.length>200||!quick.startsWith('dc:'))continue;
       const eventId='postback:'+await digest(JSON.stringify([m.sender.id,m.postback.mid||m.timestamp,quick]));
       await recordInteraction(env,'button',eventId,m.sender.id,m.postback.title||'',created);
       await queueInput(env,a,eventId,m.sender.id,'','reply',{text:m.postback.title||'',quick},created,created+86400);continue;
      }
      if(!m.sender?.id||m.sender.id===a.id||m.message?.is_echo||!m.message?.mid||(!m.message.text&&!m.message.quick_reply?.payload))continue;
      const created=Math.floor(Number(m.timestamp)/1000);if(!Number.isFinite(created)||created>now()+300||now()-created>86400)continue;
      const quick=m.message.quick_reply?.payload;
      await recordInteraction(env,quick?'button':m.message.reply_to?.story?'story':'dm','dm:'+m.message.mid,m.sender.id,m.message.text||'',created);
      const conversation=await env.DB.prepare("SELECT id FROM conversations WHERE account_id=? AND user_id=? AND stage<>'done' AND expires>? LIMIT 1").bind(a.id,m.sender.id,now()).first();
      if(quick||conversation){await queueInput(env,a,'dm:'+m.message.mid,m.sender.id,'','reply',{text:m.message.text||'',quick:quick||''},created,created+86400);continue;}
      const trigger=m.message.reply_to?.story?'story':'dm';
      const r=rules.find(r=>hasChannel(r,trigger)&&(trigger!=='story'||!readFlow(r)?.storyId||readFlow(r)?.storyId===m.message?.reply_to?.story?.id)&&keywordMatches(m.message!.text||'',r.keywords,readFlow(r)?.match));
      if(r){if(readFlow(r))await queueInput(env,a,'dm:'+m.message.mid,m.sender.id,r.id,'start',{},created,created+86400);else await enqueue(env,a,r,'dm',m.sender.id,created+86400,'dm:'+m.message.mid);}
    }
  }
  await env.DB.prepare("INSERT INTO settings(key,value) VALUES('last_webhook',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(String(now())).run();
}
type Entry={id?:string;time?:number;changes?:{field?:string;value?:{id?:string;text?:string;from?:{id?:string;username?:string};parent_id?:string;media?:{id?:string;media_product_type?:string}}}[];messaging?:{sender?:{id?:string};timestamp?:number;postback?:{mid?:string;title?:string;payload?:string};message?:{mid?:string;text?:string;is_echo?:boolean;quick_reply?:{payload?:string};reply_to?:{story?:{id?:string;url?:string}}}}[]};
async function enqueue(env:AppEnv,a:Account,r:Rule,kind:string,recipient:string,expires:number,id:string){
  const statements=[env.DB.prepare('INSERT OR IGNORE INTO jobs(id,account_id,rule_id,recipient,kind,text,created,expires,updated) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,a.id,r.id,recipient,kind,r.message+'\n\n'+r.link,now(),expires,now())];
  if(kind==='private'&&r.public_reply)statements.push(env.DB.prepare('INSERT OR IGNORE INTO jobs(id,account_id,rule_id,recipient,kind,text,parent,created,expires,updated) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id+':public',a.id,r.id,recipient,'public',r.public_reply,id,now(),expires,now()));
  await env.DB.batch(statements);
}
type Job={id:string;account_id:string;rule_id:string;recipient:string;kind:string;text:string;parent:string|null;expires:number;payload?:string;phase?:string;conversation_id?:string};
export async function drain(env:AppEnv){try{await drainPending(env);}finally{await schedulePending(env);}}
async function drainPending(env:AppEnv){
  const a=await account(env);if(!a||!await licenseFor(env,a.id))return;
  const deadline=now()+18;await processInputs(env,a,deadline);
  // Never automatically retry a send with an unknown result: Meta has no idempotency key.
  await env.DB.prepare("UPDATE jobs SET status='uncertain',detail='Envio interrompido. Confira o Instagram antes de reenviar.',updated=? WHERE status='sending' AND updated<?").bind(now(),now()-180).run();
  await env.DB.prepare("UPDATE jobs SET status='expired',detail='Prazo de resposta encerrado.',updated=? WHERE status='pending' AND expires<=?").bind(now(),now()).run();
  await env.DB.prepare("UPDATE jobs SET status='cancelled',detail='Automação pausada, excluída ou conta desconectada.',updated=? WHERE status='pending' AND (account_id<>? OR rule_id NOT IN (SELECT id FROM rules WHERE active=1))").bind(now(),a.id).run();
  const cooldown=await env.DB.prepare("SELECT value FROM settings WHERE key='send_retry_after'").first<{value:string}>();
  if(Number(cooldown?.value||0)>now())return;
  for(let i=0;i<12&&now()<deadline;i++){
    const job=await env.DB.prepare("UPDATE jobs SET status='sending',updated=? WHERE id=(SELECT id FROM jobs WHERE status='pending' AND expires>? AND not_before<=unixepoch() AND (parent IS NULL OR parent IN (SELECT id FROM jobs WHERE status='sent')) ORDER BY created,id LIMIT 1) AND status='pending' RETURNING *").bind(now(),now()).first<Job>();
    if(!job)break;
    try{
      if(job.kind==='public')await graph(env,a,encodeURIComponent(job.recipient)+'/replies',{message:job.text});
      else await graph(env,a,a.id+'/messages',{recipient:job.kind==='private'?{comment_id:job.recipient}:{id:job.recipient},message:job.payload?JSON.parse(job.payload):{text:job.text}},job.payload&&['audio','video','image'].includes(JSON.parse(job.payload)?.attachment?.type)?45000:12000);
      await env.DB.prepare("UPDATE jobs SET status='sent',detail='Aceito pela API da Meta.',updated=? WHERE id=?").bind(now(),job.id).run();
      await processInputs(env,a,deadline).catch(()=>{});
    }catch(e){
      if(e instanceof MetaError&&(e.status===429||[4,17,32,613].includes(e.code))){
        const retry=now()+60;
        await env.DB.batch([
          env.DB.prepare("UPDATE jobs SET status='pending',not_before=?,detail='A Meta pediu uma pausa. Nova tentativa agendada.',updated=? WHERE id=?").bind(retry,now(),job.id),
          env.DB.prepare("INSERT INTO settings(key,value) VALUES('send_retry_after',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(String(retry))
        ]);break;
      }
      const known=e instanceof MetaError&&e.status>=400&&e.status<500;
      const status=known?'failed':'uncertain';
      let block='';
      if(job.conversation_id&&job.phase){const c=await env.DB.prepare('SELECT config FROM conversations WHERE id=?').bind(job.conversation_id).first<{config:string}>();const n=c&&JSON.parse(c.config).map.nodes.find((n:any)=>n.id===job.phase);if(n)block=`Bloco ${n.number||n.id} — ${n.mediaType==='audio'?'Áudio':n.mediaType==='video'?'Vídeo':n.mediaType==='image'?'Imagem':n.mediaType==='file'?'Documento':'Mensagem'}: `;}
      const detail=known?(e as Error).message:'A Meta não confirmou o envio dentro do prazo. Confira a conversa no Instagram antes de reenviar.';
      await env.DB.prepare('UPDATE jobs SET status=?,detail=?,updated=? WHERE id=?').bind(status,block+detail,now(),job.id).run();
    }
  }
}
export async function maintenance(env:AppEnv){
  await drain(env);
  const a=await account(env);
  if(a)await bindNextPosts(env,a);
  if(a&&a.expires>now()&&a.refreshed<now()-86400&&a.expires<now()+20*86400){
    try{const p=new URLSearchParams({grant_type:'ig_refresh_token',access_token:await unseal(a.token,env.APP_KEY)});const token=await meta('https://graph.instagram.com/refresh_access_token?'+p);if(!token.access_token||!token.expires_in)throw Error('token');await env.DB.prepare('UPDATE account SET token=?,expires=?,refreshed=? WHERE id=?').bind(await seal(token.access_token,env.APP_KEY),now()+Number(token.expires_in),now(),a.id).run();await log(env,'connection','Acesso ao Instagram renovado.');}catch{await log(env,'connection','Renovação falhou. Reconecte o Instagram.');}
  }
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE expires<?').bind(now()),env.DB.prepare('DELETE FROM oauth WHERE expires<?').bind(now()),env.DB.prepare('DELETE FROM attempts WHERE expires<?').bind(now()),
    env.DB.prepare('DELETE FROM conversations WHERE expires<?').bind(now()-86400),env.DB.prepare('DELETE FROM flow_inputs WHERE created<?').bind(now()-30*86400),
    env.DB.prepare('DELETE FROM events WHERE created<?').bind(now()-30*86400),
    env.DB.prepare("DELETE FROM jobs WHERE created<? AND status<>'pending' AND status<>'sending'").bind(now()-30*86400)
  ]);
}
