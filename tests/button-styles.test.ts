import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {validateMap} from '../src/map';
import {validateRule,seal} from '../src/core';
import {ingest,drain,now,type AppEnv} from '../src/meta';

test('button style defaults to quick and rejects over three attached buttons without truncation',()=>{
 const node={id:'start',type:'message',text:'Escolha',choices:Array.from({length:4},(_,i)=>({title:'Opção '+i,next:''}))};
 assert.equal(validateMap({start:'start',nodes:[node]}).nodes[0].replyStyle,'quick');
 assert.throws(()=>validateMap({start:'start',nodes:[{...node,replyStyle:'buttons'}]}),/até 3/);
 assert.equal(node.choices.length,4);
});

test('link actions round-trip and reject unsafe URLs, conflicting destinations and over three mixed buttons',()=>{
 const link={title:'Abrir 😊',action:'link',url:'https://example.com',next:''};
 const map={start:'a',nodes:[{id:'a',type:'message',text:'Olá',choices:[link,{title:'Continuar',next:'b'}]},{id:'b',type:'message',text:'Próxima etapa'}]};
 const saved=validateMap(map);assert.equal(saved.nodes[0].replyStyle,'buttons');assert.equal(validateMap(JSON.parse(JSON.stringify(saved))).nodes[0].choices[0].url,link.url);
 for(const bad of [{...link,url:'javascript:alert(1)'},{...link,url:'https://name:password@example.com'},{...link,url:''},{...link,next:'b'}])assert.throws(()=>validateMap({...map,nodes:[{...map.nodes[0],choices:[bad]},map.nodes[1]]}),/HTTPS/);
 assert.throws(()=>validateMap({start:'a',nodes:[{...map.nodes[0],choices:[link,link,link,link]}]}),/até 3/);
});

for(const style of ['quick','buttons','mixed'] as const)test(style+' routes a real click once and ignores wrong users and old clicks',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("ok")}}',compatibilityDate:'2026-09-15',d1Databases:['DB'],bindings:{LICENSE_ENFORCEMENT:'disabled',APP_KEY:'test-key',GRAPH_VERSION:'v25.0'}}));const old=globalThis.fetch;
 try{
 const env=await mf.getBindings<AppEnv>();for(const file of ['0001_initial.sql','0002_conversations.sql','0003_profiles.sql'])for(const sql of readFileSync('migrations/'+file,'utf8').split(';').map(s=>s.trim()).filter(Boolean))await env.DB.prepare(sql).run();
 await env.DB.prepare('INSERT INTO account VALUES(?,?,?,?,?)').bind('12345','test',await seal('fake',env.APP_KEY),now()+86400,now()).run();
 const r=validateRule({name:'Test',trigger:'dm',keywords:'quero',media_id:'',message:'Fluxo',link:'',public_reply:'',active:true,flow:{version:1,allPosts:true,linkEnabled:false,map:{start:'a',nodes:[{id:'a',type:'message',text:'Escolha',next:style==='mixed'?'b':'c',replyStyle:style==='mixed'?'buttons':style,choices:style==='mixed'?[{title:'Visitar',next:'',action:'link',url:'https://example.com'},{title:'Segundo',next:'c'},{title:'Primeiro',next:'b'}]:[{title:'Primeiro',next:'b'},{title:'Segundo',next:''}]},{id:'b',type:'message',text:'Caminho um'},{id:'c',type:'message',text:'Caminho dois'}]}}});
 await env.DB.prepare('INSERT INTO rules(id,name,trigger,media_id,keywords,message,link,public_reply,active,created,flow) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind('r',r.name,r.trigger,r.media_id,r.keywords,r.message,r.link,r.public_reply,r.active,now(),r.flow!).run();
 const sends:any[]=[];globalThis.fetch=async(_input,init)=>{if(!init?.body)return Response.json({name:'Teste'});sends.push(JSON.parse(String(init.body)));return Response.json({message_id:'sent'+sends.length});};
 await ingest(env,{object:'instagram',entry:[{id:'12345',messaging:[{sender:{id:'222'},timestamp:Date.now(),message:{mid:'start',text:'quero'}}]}]});await drain(env);
 assert.equal(sends.length,1);const message=sends[0].message;
 if(style!=='quick'){assert.equal(message.attachment.payload.template_type,'button');assert.equal(message.attachment.payload.buttons[1].type,'postback');assert.equal(message.quick_replies,undefined);}else assert.equal(message.quick_replies[1].content_type,'text');
 const payload=style!=='quick'?message.attachment.payload.buttons[1].payload:message.quick_replies[1].payload;
 if(style==='mixed'){
  assert.deepEqual(message.attachment.payload.buttons[0],{type:'web_url',title:'Visitar',url:'https://example.com'});
  const fake=payload.slice(0,payload.lastIndexOf(':')+1)+'0';
  await ingest(env,{object:'instagram',entry:[{id:'12345',messaging:[{sender:{id:'222'},timestamp:Date.now(),postback:{mid:'fake-link',title:'Visitar',payload:fake}}]}]});await drain(env);assert.equal(sends.length,1);
 }
 const click=(user:string,id:string)=>({object:'instagram',entry:[{id:'12345',messaging:[{sender:{id:user},timestamp:Date.now(),...(style!=='quick'?{postback:{mid:id,title:'Segundo',payload}}:{message:{mid:id,text:'Segundo',quick_reply:{payload}}})}]}]});
 await ingest(env,click('333','wrong-user'));await drain(env);assert.equal(sends.length,1);
 const event=click('222','real-click');await ingest(env,event);await drain(env);assert.equal(sends.length,2);assert.equal(sends[1].message.text,'Caminho dois');
 await ingest(env,event);await drain(env);await ingest(env,click('222','old-click'));await drain(env);assert.equal(sends.length,2);
 }finally{globalThis.fetch=old;await mf.dispose();}
});
