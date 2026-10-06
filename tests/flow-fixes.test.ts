import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {validateMap,BlockError} from '../src/map';
import {validateRule,seal} from '../src/core';
import {ingest,drain,now,type AppEnv} from '../src/meta';
import {mediaFormat,mediaSignature} from '../src/media-format';
test('stable block numbers and actionable media errors',()=>{
 const input={start:'a',nodes:[{id:'a',number:7,type:'message',text:'oi',next:'b'},{id:'b',number:12,type:'message',mediaType:'file',mediaUrl:'https://example.com/a.pdf',fileName:'Guia.pdf',fileSize:100}]};
 const first=validateMap(input);assert.deepEqual(first.nodes.map(n=>n.number),[7,12]);assert.equal(first.nodes[1].fileName,'Guia.pdf');assert.deepEqual(validateMap({...first,nodes:[...first.nodes].reverse()}).nodes.map(n=>n.number),[12,7]);
 assert.throws(()=>validateMap({...input,nodes:[input.nodes[0],{...input.nodes[1],mediaUrl:'bad'}]}),(e:any)=>e instanceof BlockError&&e.nodeId==='b'&&e.blockNumber===12&&/HTTPS/.test(e.message));
 assert.equal(mediaFormat('application/pdf','file')?.extension,'pdf');assert.equal(mediaFormat('application/pdf','audio'),null);assert.equal(mediaSignature(new TextEncoder().encode('not pdf'),'application/pdf'),false);
});
test('plain private reply waits for engagement; audio and document continue once without duplicates',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("ok")}}',compatibilityDate:'2026-09-15',d1Databases:['DB'],bindings:{LICENSE_ENFORCEMENT:'disabled',APP_KEY:'test-key',GRAPH_VERSION:'v25.0'}}));const old=globalThis.fetch;
 try{
 const env=await mf.getBindings<AppEnv>();for(const file of ['0001_initial.sql','0002_conversations.sql','0003_profiles.sql'])for(const sql of readFileSync('migrations/'+file,'utf8').split(';').map(s=>s.trim()).filter(Boolean))await env.DB.prepare(sql).run();
 await env.DB.prepare('INSERT INTO account VALUES(?,?,?,?,?)').bind('12345','test',await seal('fake',env.APP_KEY),now()+86400,now()).run();
 const r=validateRule({name:'Test',trigger:'comment',keywords:'quero',media_id:'',message:'Fluxo',link:'',public_reply:'',active:true,flow:{version:1,allPosts:true,linkEnabled:false,map:{start:'a',nodes:[{id:'a',type:'message',text:'Responda para receber',next:'audio'},{id:'audio',number:4,type:'message',mediaType:'audio',mediaUrl:'https://example.com/a.mp3',next:'doc'},{id:'doc',type:'message',mediaType:'file',mediaUrl:'https://example.com/a.pdf',fileName:'Guia.pdf',next:'end'},{id:'end',type:'message',text:'Pronto'}]}}});
 await env.DB.prepare('INSERT INTO rules(id,name,trigger,media_id,keywords,message,link,public_reply,active,created,flow) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind('r',r.name,r.trigger,r.media_id,r.keywords,r.message,r.link,r.public_reply,r.active,now(),r.flow!).run();
 const sends:any[]=[];globalThis.fetch=async(_input,init)=>{if(!init?.body)return Response.json({name:'Teste'});sends.push(JSON.parse(String(init.body)));return Response.json({message_id:'sent'+sends.length});};
 await ingest(env,{object:'instagram',entry:[{id:'12345',time:now(),changes:[{field:'comments',value:{id:'c',from:{id:'222'},text:'quero'}}]}]});await drain(env);assert.equal(sends.length,1);assert.equal(sends[0].message.quick_replies,undefined);await drain(env);assert.equal(sends.length,1);assert.equal((await env.DB.prepare('SELECT stage FROM conversations').first<any>()).stage,'engagement');
 const reply={object:'instagram',entry:[{id:'12345',messaging:[{sender:{id:'222'},timestamp:Date.now(),message:{mid:'reply',text:'sim'}}]}]};await ingest(env,reply);await drain(env);assert.equal(sends.length,4);assert.equal(sends[1].message.attachment.type,'audio');assert.equal(sends[2].message.text,'Guia.pdf\nhttps://example.com/a.pdf');assert.equal(sends[3].message.text,'Pronto');await ingest(env,reply);await drain(env);assert.equal(sends.length,4);
 // A rejected audio remains visibly failed; subsequent messages are not falsely sent.
 await env.DB.prepare("UPDATE rules SET trigger='dm',keywords='audio',flow=? WHERE id='r'").bind(JSON.stringify({version:1,linkEnabled:false,map:{start:'audio',nodes:[{id:'audio',number:4,type:'message',mediaType:'audio',mediaUrl:'https://example.com/a.mp3',next:'end'},{id:'end',number:5,type:'message',text:'Pronto'}]}})).run();
 globalThis.fetch=async(_input,init)=>init?.body?Response.json({error:{code:100,error_subcode:2534080,message:'Unsupported audio media'}},{status:400}):Response.json({name:'Teste'});
 await ingest(env,{object:'instagram',entry:[{id:'12345',messaging:[{sender:{id:'333'},timestamp:Date.now(),message:{mid:'audio-test',text:'audio'}}]}]});await drain(env);const failed=await env.DB.prepare("SELECT status,detail FROM jobs WHERE status='failed'").first<any>();assert.match(failed.detail,/Bloco 4 — Áudio/);assert.match(failed.detail,/Unsupported audio/);assert.equal((await env.DB.prepare("SELECT count(*) AS n FROM jobs WHERE recipient='333'").first<any>()).n,1);
 }finally{globalThis.fetch=old;await mf.dispose();}
});
