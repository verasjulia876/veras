import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateMap} from '../src/map';
import {sendDelaySeconds} from '../src/timing';
const message=(extra:object={})=>validateMap({start:'a',nodes:[{id:'a',type:'message',text:'Olá!',...extra}]}).nodes[0];
test('old flows have no new pauses; new settings survive validation',()=>{
 assert.equal(sendDelaySeconds(message()),0);
 assert.equal(sendDelaySeconds(message({sendDelay:{mode:'auto',seconds:0}})),2);
 assert.equal(sendDelaySeconds(message({text:'x'.repeat(120),sendDelay:{mode:'auto',seconds:0}})),10);
 assert.equal(sendDelaySeconds(message({sendDelay:{mode:'manual',seconds:7}})),7);
 assert.equal(sendDelaySeconds(message({text:'',mediaType:'image',mediaUrl:'https://example.com/image.png',sendDelay:{mode:'auto',seconds:0}})),2);
 assert.equal(sendDelaySeconds(message({text:'',mediaType:'audio',mediaUrl:'https://example.com/a.mp3',mediaDuration:3.4,sendDelay:{mode:'auto',seconds:0}})),4);
 assert.throws(()=>message({mediaType:'audio',mediaUrl:'https://example.com/a.mp3',sendDelay:{mode:'auto',seconds:0}}),/duração/);
 assert.throws(()=>message({sendDelay:{mode:'manual',seconds:-1}}),/tempo/);
 assert.throws(()=>message({sendDelay:{mode:'manual',seconds:82801}}),/tempo/);
 assert.equal(message({choices:Array.from({length:13},(_,i)=>({title:String(i),next:''}))}).choices.length,13);
 assert.throws(()=>message({choices:Array.from({length:14},(_,i)=>({title:String(i),next:''}))}),/13/);
});
