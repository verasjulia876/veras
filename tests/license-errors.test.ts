import {test} from 'node:test';
import assert from 'node:assert/strict';
import {remoteLicense,activateLicense,LicenseServiceError} from '../src/license';
import type {AppEnv} from '../src/meta';
test('diagnóstico da licença distingue rede, resposta, configuração e gravação sem expor segredos',async()=>{
 const old=globalThis.fetch;const env={LICENSE_SERVER_URL:'https://license.example',APP_KEY:'private-test',DB:{prepare(){throw Error('private database detail');}}} as unknown as AppEnv;
 const key='DC-'+'A'.repeat(32);
 const expectCode=async(code:string,action=()=>remoteLicense(env,key,'12345',true))=>assert.rejects(action,e=>e instanceof LicenseServiceError&&e.code===code&&!e.message.includes(key)&&!e.message.includes('private-test'));
 try{
 await expectCode('LIC-CONFIG',()=>remoteLicense({...env,LICENSE_SERVER_URL:'[broken]'},key,'12345',true));
 globalThis.fetch=async()=>{throw Error('secret diagnostic');};await expectCode('LIC-NETWORK');
 globalThis.fetch=async()=>{throw new DOMException('timeout','TimeoutError');};await expectCode('LIC-TIMEOUT');
 globalThis.fetch=async()=>new Response('offline',{status:503});await expectCode('LIC-HTTP-503');
 globalThis.fetch=async()=>new Response('<html>Login</html>');await expectCode('LIC-RESPONSE');
 globalThis.fetch=async()=>Response.json({ok:true});await expectCode('LIC-CONTRACT');
 globalThis.fetch=async()=>Response.json({ok:false},{status:403});assert.equal(await remoteLicense(env,key,'12345',true),null);
 globalThis.fetch=async()=>Response.json({ok:true,product:'directcash',instagramId:'12345',customerName:'Test',isLifetime:true,expiresAt:null});await expectCode('LIC-SAVE',()=>activateLicense(env,key,'12345'));
 }finally{globalThis.fetch=old;}
});
