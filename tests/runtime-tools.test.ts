import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {seal} from '../src/core';
import {validateFlow} from '../src/flow';

test('runtime: authenticated uploads, byte ranges and persistent delayed delivery',async()=>{
 const sent:any[]=[];
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:'build/worker.js',compatibilityDate:'2026-09-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],durableObjects:{FLOW_MEDIA:{className:'FlowMedia',useSQLite:true},FLOW_SCHEDULER:{className:'FlowScheduler',useSQLite:true}},bindings:{APP_KEY:'test-key',ADMIN_PASSWORD:'test-password',LICENSE_ENFORCEMENT:'disabled',GRAPH_VERSION:'v25.0'},serviceBindings:{ASSETS:()=>new Response('asset')},outboundService:async(req:Request)=>{if(req.method==='POST'){sent.push(await req.json());return Response.json({message_id:'fake'});}return Response.json({name:'Teste'});}}));
 try{
 const db=await mf.getD1Database('DB');for(const file of ['0001_initial.sql','0002_conversations.sql','0003_profiles.sql'])for(const sql of readFileSync('migrations/'+file,'utf8').split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 const request=(path:string,init:RequestInit={})=>mf.dispatchFetch('http://test.example'+path,init as any);
 const png=readFileSync('public/favicon.png');
 assert.equal((await request('/api/uploads?kind=image',{method:'POST',headers:{Origin:'http://test.example','Content-Type':'image/png'},body:png})).status,401);
 const login=await request('/api/login',{method:'POST',headers:{Origin:'http://test.example'},body:JSON.stringify({password:'test-password'})});assert.equal(login.status,200);
 const Cookie=login.headers.get('Set-Cookie')!.split(';')[0],headers={Cookie,Origin:'http://test.example','Content-Type':'image/png'};
 assert.equal((await request('/api/uploads?kind=image',{method:'POST',headers:{...headers,Origin:'https://foreign.example'},body:png})).status,403);
 assert.equal((await request('/api/uploads?kind=image',{method:'POST',headers,body:'not a png'})).status,415);
 const upload=await request('/api/uploads?kind=image',{method:'POST',headers,body:png});assert.equal(upload.status,200,await upload.clone().text());
 const {url}=await upload.json() as any;assert.ok(url.startsWith('http://test.example/uploads/'));
 const media=await mf.dispatchFetch(url);assert.equal(media.status,200);assert.equal(media.headers.get('Content-Length'),String(png.length));assert.deepEqual(Buffer.from(await media.arrayBuffer()),png);
 const partial=await mf.dispatchFetch(url,{headers:{Range:'bytes=10-30'}});assert.equal(partial.status,206);assert.equal(partial.headers.get('Content-Length'),'21');assert.deepEqual(Buffer.from(await partial.arrayBuffer()),png.subarray(10,31));
 for(const [type,bytes,kind]of [['audio/mpeg',Buffer.from([255,243,228,100,0,31,113,227]),'audio'],['application/pdf',Buffer.from('%PDF-1.7\n test'),'file']] as const){
  const r=await request('/api/uploads?kind='+kind,{method:'POST',headers:{...headers,'Content-Type':type},body:bytes});assert.equal(r.status,200);const result:any=await r.json();const download=await mf.dispatchFetch(result.url);assert.equal(download.headers.get('Content-Type'),type);assert.equal(download.headers.get('Content-Length'),String(bytes.length));assert.deepEqual(Buffer.from(await download.arrayBuffer()),bytes);if(kind==='file')assert.equal(download.headers.get('Content-Disposition'),'attachment');
 }
 const head=await mf.dispatchFetch(url,{method:'HEAD'});assert.equal(head.headers.get('Content-Length'),String(png.length));assert.equal((await head.arrayBuffer()).byteLength,0);
 assert.equal((await mf.dispatchFetch(url,{headers:{Range:'bytes=99999999-'}})).status,416);
 const time=Math.floor(Date.now()/1000);
 await db.prepare('INSERT INTO profiles(id,prefix) VALUES(?,?)').bind('12345','').run();
 await db.prepare('INSERT INTO account VALUES(?,?,?,?,?)').bind('12345','test',await seal('fake-token','test-key'),time+86400,time).run();
 await db.prepare("INSERT INTO rules(id,name,trigger,media_id,keywords,message,link,active,created) VALUES('r','R','dm','','oi','Oi','',1,?)").bind(time).run();
 const due=time+3;
 await db.prepare("INSERT INTO jobs(id,account_id,rule_id,recipient,kind,text,created,expires,updated,not_before) VALUES('delayed','12345','r','222','dm','Teste',?,?,?,?)").bind(time,time+86400,time,due).run();
 const namespace:any=await mf.getDurableObjectNamespace('FLOW_SCHEDULER');const stub:any=namespace.get(namespace.idFromName('12345'));await stub.schedule('12345',due*1000);
 assert.equal(sent.length,0);
 const end=Date.now()+15000;while(!sent.length&&Date.now()<end)await new Promise(r=>setTimeout(r,200));
 assert.equal(sent.length,1);assert.ok(Date.now()>=due*1000);assert.equal((await db.prepare("SELECT status FROM jobs WHERE id='delayed'").first<any>()).status,'sent');
 await stub.schedule('12345',Date.now()+100);await new Promise(r=>setTimeout(r,800));assert.equal(sent.length,1,'alarm retry cannot duplicate sent job');
 const flow=validateFlow({version:1,linkEnabled:false,map:{start:'a',nodes:[{id:'a',type:'message',text:'Mensagem com pausa',sendDelay:{mode:'manual',seconds:2},next:'b'},{id:'b',type:'message',text:'',mediaType:'audio',mediaUrl:'https://example.com/audio.mp3',mediaDuration:1,sendDelay:{mode:'auto',seconds:1}}]}});
 await db.prepare("UPDATE rules SET flow=? WHERE id='r'").bind(JSON.stringify(flow)).run();
 const created=Math.floor(Date.now()/1000);
 await db.prepare("INSERT INTO flow_inputs(id,account_id,user_id,rule_id,kind,payload,created,expires,updated) VALUES('start-delayed','12345','333','r','start','{}',?,?,?)").bind(created,created+86400,created).run();
 await stub.schedule('12345',Date.now()+100);
 const timeout=Date.now()+15000;while(sent.length<3&&Date.now()<timeout)await new Promise(r=>setTimeout(r,200));
 assert.equal(sent.length,3);assert.equal(sent[1].message.text,'Mensagem com pausa');assert.equal(sent[2].message.attachment.type,'audio');
 const delayed=(await db.prepare("SELECT created,not_before,updated FROM jobs WHERE conversation_id<>'' ORDER BY created,id").all<any>()).results;
 assert.equal(delayed.length,2);assert.equal(delayed[0].not_before-delayed[0].created,2);assert.equal(delayed[1].not_before-delayed[1].created,1);for(const job of delayed)assert.ok(job.updated>=job.not_before);
 const activity=await request('/api/activity',{headers:{Cookie}});assert.equal(activity.status,200);const report:any=await activity.json();assert.ok(report.jobs.some((j:any)=>j.node_id==='b'&&j.block_number===2));
 const invalid=await request('/api/rules',{method:'POST',headers:{Cookie,Origin:'http://test.example','Content-Type':'application/json'},body:JSON.stringify({name:'Teste',trigger:'dm',media_id:'',keywords:'teste',message:'Fluxo',link:'',public_reply:'',active:false,flow:{version:1,linkEnabled:false,map:{start:'bad',nodes:[{id:'bad',number:9,type:'message',mediaType:'audio',mediaUrl:'bad'}]}}})});assert.equal(invalid.status,400);const problem:any=await invalid.json();assert.equal(problem.nodeId,'bad');assert.equal(problem.blockNumber,9);
 }finally{await mf.dispose();}
});

