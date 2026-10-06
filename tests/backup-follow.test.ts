import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {validateRule,seal,matches,type Rule} from '../src/core';
import {keywordMatches} from '../src/flow';
import {exportRules,decodeBackup,restoreRules} from '../src/backups';
import {ingest,drain,now,type AppEnv} from '../src/meta';
import {queueInput} from '../src/conversations';
import {deleteRules} from '../src/bulk-rules';
import worker from '../src/index';
import {digest} from '../src/core';
import {nextWake} from '../src/scheduler-client';

const rule=()=>validateRule({name:'Entrega',trigger:'comment',keywords:'QuErO',media_id:'',message:'Conteúdo',link:'',public_reply:'',active:true,flow:{version:1,allPosts:true,linkEnabled:false,map:{start:'gate',nodes:[{id:'gate',type:'follow',text:'Siga para receber',followButton:'Já segui ✅',next:'content'},{id:'content',type:'message',text:'CONTEUDO LIBERADO'}]}}});
test('keywords ignore letter case for exact, contains and legacy rules',()=>{
 for(const text of ['quero','QUERO','QuErO'])for(const key of ['quero','QUERO','Quero']){assert.ok(matches(text,key));assert.ok(keywordMatches(text,key,'exact'));assert.ok(keywordMatches('Eu '+text+' agora',key,'contains'));}
 assert.ok(keywordMatches('AÇÃO','ação','exact'));assert.equal(keywordMatches('nãoquero','quero'),false);
});
async function setup(){
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("ok")}}',compatibilityDate:'2026-09-15',d1Databases:['DB'],bindings:{LICENSE_ENFORCEMENT:'disabled',APP_KEY:'test-key',GRAPH_VERSION:'v25.0'}}));
 const env=await mf.getBindings<AppEnv>();for(const file of ['0001_initial.sql','0002_conversations.sql','0003_profiles.sql'])for(const sql of readFileSync('migrations/'+file,'utf8').split(';').map(s=>s.trim()).filter(Boolean))await env.DB.prepare(sql).run();
 return {mf,env};
}
test('bulk deletion validates selection, preserves other rules and cancels only selected pending work',async()=>{
 const {mf,env}=await setup();try{
  await restoreRules(env,exportRules([{...rule(),id:'a',created:now()},{...rule(),name:'Preservar',id:'b',created:now()}]));
  const rows=(await env.DB.prepare('SELECT id FROM rules ORDER BY name').all<{id:string}>()).results;const [chosen,other]=rows.map(r=>r.id);
  for(const [i,id] of [chosen,other].entries())await env.DB.prepare('INSERT INTO jobs(id,account_id,rule_id,recipient,kind,text,created,expires,updated) VALUES(?,?,?,?,?,?,?,?,?)').bind('j'+i,'1',id,'2','dm','Teste',now(),now()+86400,now()).run();
  await env.DB.prepare("INSERT INTO conversations VALUES('c','1','2',?,'wait','{}',?,?,?)").bind(chosen,now(),now()+86400,now()).run();
  await env.DB.prepare("INSERT INTO flow_inputs(id,account_id,user_id,rule_id,kind,payload,created,expires,updated) VALUES('i','1','2',?,'start','{}',?,?,?)").bind(chosen,now(),now()+86400,now()).run();
  await assert.rejects(()=>deleteRules(env,[]));await assert.rejects(()=>deleteRules(env,[chosen,'invalid']));assert.equal((await env.DB.prepare('SELECT count(*) n FROM rules').first<any>()).n,2);
  assert.equal((await deleteRules(env,[chosen,chosen])).deleted,1);
  assert.equal((await env.DB.prepare('SELECT id FROM rules').first<any>()).id,other);
  assert.equal((await env.DB.prepare("SELECT status FROM jobs WHERE id='j0'").first<any>()).status,'cancelled');
  assert.equal((await env.DB.prepare("SELECT status FROM jobs WHERE id='j1'").first<any>()).status,'pending');
  assert.equal((await env.DB.prepare("SELECT stage FROM conversations WHERE id='c'").first<any>()).stage,'done');
  assert.equal((await env.DB.prepare("SELECT status FROM flow_inputs WHERE id='i'").first<any>()).status,'failed');
 }finally{await mf.dispose();}
});
test('more than 30 rules can be restored, created through API, exported and bulk deleted',async()=>{
 const {mf,env}=await setup();try{
  const rows=Array.from({length:125},(_,i)=>({...rule(),name:'Fluxo '+i,id:String(i),created:now()}));
  assert.equal((await restoreRules(env,exportRules(rows))).imported,125);
  env.ADMIN_PASSWORD='test-password';await env.DB.prepare('INSERT INTO sessions(id,expires) VALUES(?,?)').bind(await digest('test-session'),now()+86400).run();
  const created=await worker.fetch(new Request('https://test/api/rules',{method:'POST',headers:{Origin:'https://test',Cookie:'dc_session=test-session','Content-Type':'application/json'},body:JSON.stringify({...rule(),active:false})}),env,{} as ExecutionContext);
  assert.equal(created.status,200,await created.clone().text());
  const all=(await env.DB.prepare('SELECT * FROM rules').all<Rule>()).results;assert.equal(all.length,126);assert.equal(exportRules(all).rules.length,126);
  const kept=all[0].id;assert.equal((await deleteRules(env,all.slice(1).map(r=>r.id))).deleted,125);
  assert.equal((await env.DB.prepare('SELECT id FROM rules').first<any>()).id,kept);
 }finally{await mf.dispose();}
});
test('comments continue after 60 sends; Meta throttling pauses and resumes without duplicating',async()=>{
 const {mf,env}=await setup(),old=globalThis.fetch;try{
  await env.DB.prepare('INSERT INTO account VALUES(?,?,?,?,?)').bind('12345','test',await seal('fake',env.APP_KEY),now()+86400,now()).run();
  const r=validateRule({name:'Teste',trigger:'comment',keywords:'quero',media_id:'',message:'Entrega',link:'',public_reply:'',active:true,flow:{version:1,allPosts:true,linkEnabled:false,map:{start:'a',nodes:[{id:'a',type:'message',text:'Aqui está'}]}}});
  await env.DB.prepare('INSERT INTO rules(id,name,trigger,media_id,keywords,message,link,public_reply,active,created,flow) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind('r',r.name,r.trigger,r.media_id,r.keywords,r.message,r.link,r.public_reply,r.active,now(),r.flow!).run();
  await env.DB.prepare("INSERT INTO jobs(id,account_id,rule_id,recipient,kind,text,status,created,expires,updated) SELECT 'old'||value,'12345','r','222','dm','ok','sent',?,?,? FROM json_each(?)").bind(now(),now()+86400,now(),JSON.stringify(Array.from({length:61},(_,i)=>i))).run();
  let attempts=0,mode='limited';globalThis.fetch=async(_input,init)=>{if(!init?.body)return Response.json({name:'Teste'});attempts++;if(mode==='limited')return Response.json({error:{code:4,message:'Rate limit'}},{status:429});if(mode==='unknown')throw Error('timeout');return Response.json({message_id:'sent'+attempts});};
  const comment=(id:string)=>({object:'instagram',entry:[{id:'12345',time:now(),changes:[{field:'comments',value:{id,from:{id:'222'},text:'QUERO',media:{id:'post'}}}]}]});
  await ingest(env,comment('c1'));await drain(env);assert.equal(attempts,1);assert.equal((await env.DB.prepare("SELECT count(*) n FROM jobs WHERE status='pending'").first<any>()).n,1);assert.ok((await nextWake(env))!>now());
  await drain(env);assert.equal(attempts,1);
  await env.DB.prepare("UPDATE settings SET value='0' WHERE key='send_retry_after'").run();await env.DB.prepare("UPDATE jobs SET not_before=0 WHERE status='pending'").run();mode='ok';await drain(env);assert.equal(attempts,2);
  await ingest(env,comment('c1'));await drain(env);assert.equal(attempts,2);
  mode='unknown';await ingest(env,comment('c2'));await drain(env);assert.equal(attempts,3);await drain(env);assert.equal(attempts,3);assert.equal((await env.DB.prepare("SELECT count(*) n FROM jobs WHERE status='uncertain'").first<any>()).n,1);
 }finally{globalThis.fetch=old;await mf.dispose();}
});
test('backup round-trips maps and simple automations as paused copies and rejects invalid batches',async()=>{
 const {mf,env}=await setup();try{
  const r={...rule(),id:'original',created:now()} as Rule;
  const simple={...r,name:'Simples',flow:'{}',link:'https://example.com',media_id:'123'};
  const backup=exportRules([r,simple]);assert.equal('id' in backup.rules[0],false);assert.equal(decodeBackup(backup)[0].active,0);
  await restoreRules(env,backup);const rows=(await env.DB.prepare('SELECT * FROM rules').all<Rule>()).results;assert.equal(rows.length,2);assert.ok(rows.every(r=>r.active===0));assert.deepEqual(JSON.parse(rows[0].flow!),JSON.parse(r.flow!));
  await assert.rejects(()=>restoreRules(env,{...backup,rules:[backup.rules[0],{...backup.rules[1],link:'javascript:bad'}]}));assert.equal((await env.DB.prepare('SELECT count(*) n FROM rules').first<any>()).n,2);
  await restoreRules(env,backup);assert.equal((await env.DB.prepare('SELECT count(*) n FROM rules').first<any>()).n,4);
 }finally{await mf.dispose();}
});
test('follow first after comment waits for verified click; false, unknown and errors never release content',async()=>{
 const {mf,env}=await setup(),old=globalThis.fetch;try{
  const a={id:'12345',username:'test',token:await seal('fake',env.APP_KEY),expires:now()+86400,refreshed:now()};await env.DB.prepare('INSERT INTO account VALUES(?,?,?,?,?)').bind(a.id,a.username,a.token,a.expires,a.refreshed).run();
  const r=rule();await env.DB.prepare('INSERT INTO rules(id,name,trigger,media_id,keywords,message,link,public_reply,active,created,flow) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind('r',r.name,r.trigger,r.media_id,r.keywords,r.message,r.link,r.public_reply,r.active,now(),r.flow!).run();
  let follows:any=false,checks=0;const sends:any[]=[];globalThis.fetch=async(input,init)=>{
   if(String(input).includes('is_user_follow_business')){checks++;if(follows==='error')throw Error('offline');return Response.json(follows===undefined?{}:{is_user_follow_business:follows});}
   if(!init?.body)return Response.json({name:'Teste'});sends.push(JSON.parse(String(init.body)));return Response.json({message_id:'sent'+sends.length});
  };
  await queueInput(env,a,'start','222','r','start',{comment:'999'},now(),now()+7*86400);await drain(env);
  assert.equal(sends.length,1);assert.equal(checks,0);assert.equal(sends[0].recipient.comment_id,'999');
  const buttons=sends[0].message.attachment.payload.buttons;assert.equal(buttons[0].url,'https://www.instagram.com/test/');assert.equal(buttons[1].title,'Já segui ✅');const payload=buttons[1].payload;
  const click=(id:string,user='222')=>({object:'instagram',entry:[{id:a.id,messaging:[{sender:{id:user},timestamp:Date.now(),postback:{mid:id,title:'Já segui ✅',payload}}]}]});
  await ingest(env,click('wrong','333'));await drain(env);assert.equal(checks,0);
  for(const [i,status] of [false,undefined,'error'].entries()){follows=status;await ingest(env,click('click'+i));await drain(env);assert.ok(sends.every(s=>s.message.text!=='CONTEUDO LIBERADO'));}
  follows=true;await ingest(env,click('verified'));await drain(env);assert.equal(sends.at(-1).message.text,'CONTEUDO LIBERADO');const count=sends.length;
  await ingest(env,click('verified'));await drain(env);await ingest(env,click('stale'));await drain(env);assert.equal(sends.length,count);
 }finally{globalThis.fetch=old;await mf.dispose();}
});
