import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {validateFlow,hasChannel,keywordMatches} from '../src/flow';
import {validateRule} from '../src/core';
import {validateMap} from '../src/map';
const block={id:'a',type:'message',text:'Olá',next:'',choices:[],minutes:60,url:'',label:'Abrir',mediaType:'',mediaUrl:'',tag:'',x:0,y:0};
test('multiple channels persist and legacy rules retain their channel',()=>{
 const flow=validateFlow({version:1,channels:['dm','story','comment'],match:'any',allPosts:true});
 assert(hasChannel({trigger:'dm',flow:JSON.stringify(flow)},'comment'));
 assert(!hasChannel({trigger:'dm',flow:'{}'},'comment'));
 assert(keywordMatches('Olá','','any'));assert(!keywordMatches('   ','','any'));
 assert.throws(()=>validateFlow({version:1,channels:[]}));
 assert.throws(()=>validateFlow({version:1,storyId:'https://bad'}));
 const base={name:'Teste',trigger:'dm',media_id:'',keywords:'',message:'Olá',link:'https://example.com',public_reply:'Enviado',active:false,flow};
 assert.equal(validateRule(base).public_reply,'Enviado');
 assert.doesNotThrow(()=>validateRule({...base,flow:{...flow,map:{start:'a',nodes:[{...block,next:'b'},{...block,id:'b'}]}}}));
});
test('wait seconds survive validation; legacy minutes and bounds are enforced',()=>{
 for(const seconds of [1,10,45,82800])assert.equal(validateMap({start:'a',nodes:[{...block,type:'wait',seconds}]}).nodes[0].seconds,seconds);
 for(const seconds of [0,-1,1.5,82801])assert.throws(()=>validateMap({start:'a',nodes:[{...block,type:'wait',seconds}]}));
 assert.equal(validateMap({start:'a',nodes:[{...block,type:'wait',minutes:7}]}).nodes[0].minutes,7);
});
test('external import preserves button destinations, words, public replies and waits',()=>{
 const context=vm.createContext({});vm.runInContext(readFileSync('public/flow-import.js','utf8'),context);
 const input={formato:1,fluxos:[{name:'Modelo',trigger:'comment',keywords:['quero'],public_replies:['Enviado'],nodes:[{id:'start',kind:'start'},{id:'m',kind:'message',text:'Oi {{first_name|amiga}}',buttonMode:'reply',buttons:[{label:'Sim'}]},{id:'w',kind:'delay',minutes:3}],edges:[{from:'start',handle:'next',to:'m'},{from:'m',handle:'btn:0',to:'w'}]}]};
 const [f]=context.decodeFlowFile(input);assert.equal(f.map.start,'m');assert.equal(f.map.nodes[0].choices[0].next,'w');assert.equal(f.map.nodes[0].text,'Oi {{first_name}}');assert.equal(f.public_reply,'Enviado');assert.equal(validateMap(f.map).nodes[1].minutes,3);
});
test('ten public reply variations are accepted; eleven and long lines rejected',()=>{
 const b={name:'Replies',trigger:'comment',media_id:'',keywords:'quero',message:'Oi',link:'https://example.com',public_reply:Array(10).fill('a'.repeat(300)).join('\n'),active:false,flow:{version:1,allPosts:true}};
 assert.equal(validateRule(b).public_reply.split('\n').length,10);
 assert.throws(()=>validateRule({...b,public_reply:Array(11).fill('Oi').join('\n')}),/10/);
 assert.throws(()=>validateRule({...b,public_reply:'a'.repeat(301)}),/300/);
});
test('multiple link buttons are safe and terminal choices can end a path',()=>{
 const links=[{title:'A',url:'https://example.com/a'},{title:'B',url:'https://example.com/b'}];
 assert.equal(validateMap({start:'a',nodes:[{...block,links}]}).nodes[0].links?.length,2);
 assert.throws(()=>validateMap({start:'a',nodes:[{...block,links:[{title:'Bad',url:'javascript:alert(1)'}]}]}));
 assert.equal(validateMap({start:'a',nodes:[{...block,choices:[{title:'Fim',next:''}]}]}).nodes[0].choices[0].next,'');
});
