import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {ingest,drain,now,type AppEnv} from '../src/meta';
import {seal,validateRule} from '../src/core';
import {validateFlow,keywordMatches} from '../src/flow';
import {validateMap} from '../src/map';
import {activateLicense} from '../src/license';

test('validation rejects cycles, unsafe catalog URLs and missing engagement',()=>{
 const n={id:'a',type:'message',text:'Hi',next:'a'};assert.throws(()=>validateMap({start:'a',nodes:[n]}),/anterior/);
 assert.throws(()=>validateMap({start:'a',nodes:[{id:'a',type:'carousel',cards:[{title:'X',subtitle:'',image:'javascript:alert(1)',buttons:[]}]}]}),/HTTPS/);
 assert.equal(keywordMatches('QUÉRO!','quero','exact'),true);assert.equal(keywordMatches('eu quero','quero','exact'),false);
 assert.throws(()=>validateRule({name:'A',trigger:'comment',media_id:'',keywords:'quero',message:'Hi',link:'',public_reply:'',active:false,flow:{version:1,allPosts:true,linkEnabled:false,collectEmail:true}}),/boas-vindas/);
});

test('conversation: dedupe, choice ownership, follow gate, email, media and deferred delivery',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("ok")}}',compatibilityDate:'2026-09-15',d1Databases:['DB'],bindings:{LICENSE_ENFORCEMENT:'enabled',APP_KEY:'test-key',ADMIN_PASSWORD:'test-password',GRAPH_VERSION:'v25.0',LICENSE_SERVER_URL:'https://license.example'}}));const old=globalThis.fetch;
 try{
 const env=await mf.getBindings<AppEnv>();for(const file of ['0001_initial.sql','0002_conversations.sql','0003_profiles.sql'])for(const sql of readFileSync('migrations/'+file,'utf8').split(';').map(s=>s.trim()).filter(Boolean))await env.DB.prepare(sql).run();
 await env.DB.prepare('INSERT INTO account VALUES(?,?,?,?,?)').bind('12345','owner',await seal('fake',env.APP_KEY),now()+86400,now()).run();globalThis.fetch=async()=>Response.json({ok:true,product:'directcash',instagramId:'12345',customerName:'Test',isLifetime:true,expiresAt:null});await activateLicense(env,'DC-'+'A'.repeat(32),'12345');
 const f=validateFlow({version:1,allPosts:true,welcomeEnabled:true,requireFollow:true,collectEmail:true,attachmentType:'audio',attachmentUrl:'https://example.com/audio.mp3',followupEnabled:true,followupMinutes:60});
 await env.DB.prepare('INSERT INTO rules(id,name,trigger,media_id,keywords,message,link,public_reply,active,created,flow) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind('r','A','comment','','quero','Aqui está','https://example.com','Fui no Direct\nTe enviei',1,now(),JSON.stringify(f)).run();
 const comment={object:'instagram',entry:[{id:'12345',time:now(),changes:[{field:'comments',value:{id:'c',from:{id:'222'},text:'quero',media:{id:'any'}}}]}]};
 const sent:any[]=[];let follows=false;globalThis.fetch=async(input,init)=>{if(!init?.body)return Response.json(String(input).includes('is_user_follow_business')?{is_user_follow_business:follows}:{name:'Ana Teste'});sent.push(JSON.parse(String(init.body)));return Response.json({message_id:'out'+sent.length});};
 await Promise.all([ingest(env,comment),ingest(env,comment)]);await Promise.all([drain(env),drain(env)]);assert.equal(sent.length,2);assert.deepEqual(sent[0].recipient,{comment_id:'c'});const quick=sent[0].message.quick_replies[0].payload;
 const dm=(mid:string,text:string,quick:string|undefined=undefined,user='222')=>({object:'instagram',entry:[{id:'12345',messaging:[{sender:{id:user},timestamp:Date.now(),message:{mid,text,...(quick?{quick_reply:{payload:quick}}:{})}}]}]});
 await ingest(env,dm('wrong','go',quick,'333'));await drain(env);assert.equal(sent.length,2);
 await ingest(env,dm('click','go',quick));await drain(env);assert.equal(sent.length,3);assert.match(sent[2].message.text,/Siga/);const follow=sent[2].message.quick_replies[0].payload;
 await ingest(env,dm('notyet','Já segui',follow));await drain(env);assert.equal(sent.length,4);assert.match(sent[3].message.text,/Siga/);
 follows=true;await ingest(env,dm('yes','Já segui',follow));await drain(env);assert.equal(sent.length,5);assert.match(sent[4].message.text,/e-mail/);
 await ingest(env,dm('badmail','not an email'));await drain(env);assert.equal(sent.length,6);assert.equal(await env.DB.prepare('SELECT * FROM contacts').first(),null);
 await Promise.all([ingest(env,dm('mail','ana@example.com')),ingest(env,dm('mail','ana@example.com'))]);await drain(env);assert.equal(sent.length,8);assert.equal(sent[6].message.attachment.type,'audio');assert.equal(sent[7].message.attachment.payload.template_type,'button');assert.equal((await env.DB.prepare('SELECT email FROM contacts').first<any>()).email,'ana@example.com');
 await drain(env);assert.equal(sent.length,8);
 const conv=await env.DB.prepare('SELECT * FROM conversations').first<any>();assert.equal(conv.stage,'wait');let cfg=JSON.parse(conv.config);cfg.wake=now()-1;await env.DB.prepare('UPDATE conversations SET config=? WHERE id=?').bind(JSON.stringify(cfg),conv.id).run();await drain(env);assert.equal(sent.length,9);await drain(env);assert.equal(sent.length,9);
 // Expired windows can never emit a deferred job.
 await env.DB.prepare("UPDATE conversations SET stage='wait',expires=?,config=? WHERE id=?").bind(now()-1,JSON.stringify(cfg),conv.id).run();await drain(env);assert.equal(sent.length,9);

 // Story-triggered visual map: multiple content parts, carousel and tags.
 const map=validateMap({start:'intro',nodes:[{id:'intro',type:'message',text:'Bem-vinda',next:'catalog',parts:[{type:'text',text:'Veja as opções:'},{type:'delay',seconds:1},{type:'video',url:'https://example.com/v.mp4'}]},
 {id:'catalog',type:'carousel',next:'label',cards:[{title:'Produto A',subtitle:'Descrição',image:'https://example.com/a.jpg',buttons:[{title:'Comprar',url:'https://example.com/a'}]},{title:'Produto B',subtitle:'Outro item',image:'https://example.com/b.jpg',buttons:[]}]},
 {id:'label',type:'tag',tag:'catálogo',next:''}]});
 await env.DB.prepare('INSERT INTO rules(id,name,trigger,media_id,keywords,message,link,active,created,flow) VALUES(?,?,?,?,?,?,?,?,?,?)').bind('map','Catalog','story','','catálogo','Map','',1,now(),JSON.stringify(validateFlow({version:1,linkEnabled:false,map}))).run();
 const story={object:'instagram',entry:[{id:'12345',messaging:[{sender:{id:'444'},timestamp:Date.now(),message:{mid:'story1',text:'catálogo',reply_to:{story:{id:'555'}}}}]}]};
 const before=sent.length;await ingest(env,story);await drain(env);assert.equal(sent.length,before+4);assert.equal(sent[before+2].message.attachment.type,'video');const catalog=sent[before+3].message.attachment.payload;assert.equal(catalog.template_type,'generic');assert.equal(catalog.elements.length,2);assert.equal(catalog.elements[0].buttons[0].url,'https://example.com/a');assert.equal((await env.DB.prepare('SELECT tag FROM contact_tags WHERE user_id=?').bind('444').first<any>()).tag,'catálogo');
 }finally{globalThis.fetch=old;await mf.dispose();}
});
