import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {activateLicense,licenseFor} from '../src/license';
import type {AppEnv} from '../src/meta';
test('cache de cinco minutos e bloqueio após revogação ou indisponibilidade',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("ok")}}',compatibilityDate:'2026-09-15',d1Databases:['DB'],bindings:{LICENSE_ENFORCEMENT:'enabled',APP_KEY:'test-key',ADMIN_PASSWORD:'test-password',GRAPH_VERSION:'v25.0',LICENSE_SERVER_URL:'https://license.example'}}));
 const old=globalThis.fetch;
 try{
  const env=await mf.getBindings<AppEnv>();await env.DB.prepare('CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT)').run();
  let requests=0;globalThis.fetch=async(input,init)=>{requests++;assert.equal(new URL(String(input)).hostname,'license.example');assert.equal(new Headers(init?.headers).get('authorization'),null);assert.ok(!String(init?.body).includes('test-key'));return Response.json({ok:true,product:'directcash',instagramId:'1234567',customerName:'Aluna',isLifetime:true,expiresAt:null});};
  const key='DC-'+'B'.repeat(32);assert.ok(await activateLicense(env,key,'1234567'));assert.equal(requests,1);
  const row=await env.DB.prepare("SELECT value FROM settings WHERE key='license-online'").first<{value:string}>();assert.ok(!row?.value.includes(key));
  assert.ok(await licenseFor(env,'1234567'));assert.equal(requests,1);
  globalThis.fetch=async()=>new Response('{}',{status:403});assert.ok(await licenseFor(env,'1234567'));
  await env.DB.prepare("DELETE FROM settings WHERE key='license-cache'").run();assert.equal(await licenseFor(env,'1234567'),null);
  globalThis.fetch=async()=>{throw Error('offline');};assert.equal(await licenseFor(env,'1234567'),null);assert.equal(await licenseFor(env,'9999999'),null);
 }finally{globalThis.fetch=old;await mf.dispose();}
});
