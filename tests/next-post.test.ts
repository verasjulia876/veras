import {test} from 'node:test';
import assert from 'node:assert/strict';
import {firstPostAfter} from '../src/next-post';
import {validateFlow} from '../src/flow';
import {validateMap} from '../src/map';
import {validateRule,seal} from '../src/core';
import {bindNextPosts,now,type AppEnv} from '../src/meta';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readFileSync} from 'node:fs';

const item=(id:string,time:number)=>({id,timestamp:new Date(time*1000).toISOString()});
test('next post selects oldest new media across pages; excludes old posts and never guesses on incomplete pagination',async()=>{
 const cursors:unknown[]=[];
 assert.equal(await firstPostAfter(100,async cursor=>{cursors.push(cursor);return cursor?{data:[item('2',101),item('1',100)]}:{data:[item('3',200)],paging:{next:'yes',cursors:{after:'page2'}}};}),'2');
 assert.deepEqual(cursors,[undefined,'page2']);
 assert.equal(await firstPostAfter(100,async()=>({data:[item('1',100)]})),undefined);
 await assert.rejects(firstPostAfter(100,async()=>({data:[item('3',200)],paging:{next:'yes'}})),/Paginação/);
});
test('pending rule accepts no media, disables all-post matching, and emoji titles and hours survive validation',()=>{
 const r=validateRule({name:'Próximo',trigger:'comment',keywords:'quero',media_id:'',message:'Olá',link:'',public_reply:'',active:true,flow:{version:1,nextPostAt:100,allPosts:true,linkEnabled:false}});
 assert.equal(JSON.parse(r.flow!).allPosts,false);
 assert.equal(validateFlow({version:1,welcomeButton:'😊'.repeat(20)}).welcomeButton,'😊'.repeat(20));
 const map=validateMap({start:'a',nodes:[{id:'a',type:'message',text:'oi',links:[{title:'😊'.repeat(20),url:'https://example.com'}],next:'b'},{id:'b',type:'wait',minutes:120}]});
 assert.equal(map.nodes[1].minutes,120);
});
test('binding persists once, is scoped to the account and respects concurrent edits',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("ok")}}',compatibilityDate:'2026-09-15',d1Databases:['DB'],bindings:{APP_KEY:'test-key',GRAPH_VERSION:'v25.0'}}));const old=globalThis.fetch;
 try{
  const env=await mf.getBindings<AppEnv>();for(const file of ['0001_initial.sql','0002_conversations.sql'])for(const sql of readFileSync('migrations/'+file,'utf8').split(';').map(s=>s.trim()).filter(Boolean))await env.DB.prepare(sql).run();
  const at=now()-100,flow=JSON.stringify({version:1,nextPostAt:at,linkEnabled:false});
  await env.DB.prepare('INSERT INTO rules(id,name,trigger,media_id,keywords,message,link,public_reply,active,created,flow) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind('r','Next','comment','','quero','oi','','',1,at,flow).run();
  const a={id:'123',username:'secondary',token:await seal('fake',env.APP_KEY),expires:now()+86400,refreshed:now()};let calls=0;
  globalThis.fetch=async input=>{calls++;assert.match(String(input),/\/123\/media\?/);return Response.json({data:[item('30',at+30),item('20',at+20),item('10',at-1)]});};
  await bindNextPosts(env,a);const saved=await env.DB.prepare('SELECT media_id,flow FROM rules WHERE id=?').bind('r').first<any>();assert.equal(saved.media_id,'20');assert.equal(JSON.parse(saved.flow).nextPostAt,undefined);
  await bindNextPosts(env,a);assert.equal(calls,1);
  await env.DB.prepare('UPDATE rules SET flow=? WHERE id=?').bind(flow,'r').run();
  globalThis.fetch=async()=>{await env.DB.prepare('UPDATE rules SET flow=?,media_id=? WHERE id=?').bind(saved.flow,'99','r').run();return Response.json({data:[item('40',at+40)]});};
  await bindNextPosts(env,a);assert.equal((await env.DB.prepare('SELECT media_id FROM rules WHERE id=?').bind('r').first<any>()).media_id,'99');
 }finally{globalThis.fetch=old;await mf.dispose();}
});
