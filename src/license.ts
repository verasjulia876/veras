import {boundedText,seal,unseal} from './core';
import {now,type AppEnv} from './meta';
export class LicenseServiceError extends Error {
 constructor(public code:string,message:string){super(message);this.name='LicenseServiceError';}
}
export type License={student:string;email?:string;usedProfiles?:number;maxProfiles?:number;accountId:string;expires:number|null;temporary?:boolean;paused?:boolean};
export function parseRemoteLicense(data:Record<string,unknown>,accountId:string):License|null{
  if(data.ok!==true||data.product!=='directcash'||data.instagramId!==accountId||typeof data.customerName!=='string'||data.customerName.length>160||typeof data.isLifetime!=='boolean')return null;
  const expires=data.isLifetime?null:typeof data.expiresAt==='string'?Math.floor(Date.parse(data.expiresAt)/1000):NaN;
  if(expires!==null&&(!Number.isFinite(expires)||expires<=now()))return null;
  return {student:data.customerName,usedProfiles:Number.isSafeInteger(data.usedProfiles)?Number(data.usedProfiles):undefined,maxProfiles:Number.isSafeInteger(data.maxProfiles)?Number(data.maxProfiles):undefined,email:typeof data.customerEmail==='string'?data.customerEmail:undefined,accountId,expires};
}
export async function remoteLicense(env:AppEnv,code:string,accountId:string,activate=false):Promise<License|null>{
  let url:URL;
  try{url=new URL(env.LICENSE_SERVER_URL);if(url.protocol!=='https:'||url.username||url.password)throw Error();}
  catch{throw new LicenseServiceError('LIC-CONFIG','Endereço do servidor de licenças inválido. Confira LICENSE_SERVER_URL na Cloudflare.');}
  let result:Response;
  try{result=await fetch(new URL(activate?'/activate':'/heartbeat',url),{method:'POST',redirect:'manual',headers:{'Content-Type':'application/json','x-livecash-tool':'directcash'},body:JSON.stringify({app:'directcash',key:code,instagramId:accountId}),signal:AbortSignal.timeout(15000)});}
  catch(e){const timeout=e instanceof Error&&['TimeoutError','AbortError'].includes(e.name);throw new LicenseServiceError(timeout?'LIC-TIMEOUT':'LIC-NETWORK',timeout?'O servidor de licenças não respondeu em 15 segundos.':'A instalação não conseguiu acessar o servidor de licenças. Confira o endereço e a implantação ativa na Cloudflare.');}
  if([400,401,403,404].includes(result.status))return null;
  if(!result.ok)throw new LicenseServiceError('LIC-HTTP-'+result.status,'O servidor de licenças respondeu com erro HTTP '+result.status+'.');
  let data:Record<string,unknown>;
  try{data=JSON.parse(await boundedText(result,16384));if(!data||typeof data!=='object')throw Error();}
  catch{throw new LicenseServiceError('LIC-RESPONSE','O endereço de licenças retornou uma resposta inesperada. Confira LICENSE_SERVER_URL.');}
  const license=parseRemoteLicense(data,accountId);
  if(!license&&data.ok===true)throw new LicenseServiceError('LIC-CONTRACT','A resposta do servidor não corresponde ao perfil ou ao formato de validade esperado.');
  return license;
}
export async function cacheLicense(env:AppEnv,license:License){await env.DB.prepare("INSERT INTO settings(key,value) VALUES('license-cache',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify({license,until:Math.min(now()+300,license.expires??Infinity)})).run();}
export async function activateLicense(env:AppEnv,code:string,accountId:string){
  if(!/^DC-[A-F0-9]{32}$/.test(code))return null;
  const license=await remoteLicense(env,code,accountId,true);if(!license)return null;
  try{await env.DB.batch([env.DB.prepare("INSERT INTO settings(key,value) VALUES('license-online',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(await seal(code,env.APP_KEY)),env.DB.prepare("DELETE FROM settings WHERE key IN ('license','license-cache')")]);
  await cacheLicense(env,license);}catch{throw new LicenseServiceError('LIC-SAVE','A licença foi aceita pelo servidor, mas não foi possível salvá-la nesta instalação. Confira o banco DB e a configuração APP_KEY, sem trocar a chave existente.');}return license;
}
export function temporaryAccess(env:Pick<AppEnv,'TEST_ACCESS_UNTIL'>,accountId:string,at=now()):License|null{
  const value=env.TEST_ACCESS_UNTIL;
  if(!accountId||!value||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value))return null;
  const millis=Date.parse(value),expires=Math.floor(millis/1000);
  if(!Number.isFinite(millis)||new Date(millis).toISOString()!==value.replace('Z','.000Z')||expires<=at)return null;
  return {student:'Teste temporário',accountId,expires,temporary:true};
}
export async function licenseFor(env:AppEnv,accountId:string):Promise<License|null>{
  if(!accountId)return null;
  // Owner-requested suspension. Re-enable centrally in this installation with LICENSE_ENFORCEMENT=enabled.
  if(env.LICENSE_ENFORCEMENT!=='enabled')return {student:'Acesso liberado',accountId,expires:null,paused:true};
  const temporary=temporaryAccess(env,accountId);if(temporary)return temporary;
  const row=await env.DB.prepare("SELECT value FROM settings WHERE key='license-online'").first<{value:string}>();if(!row)return null;
  const cached=await env.DB.prepare("SELECT value FROM settings WHERE key='license-cache'").first<{value:string}>();
  if(cached){try{const {license,until}=JSON.parse(cached.value);if(license.accountId===accountId&&until>now()&&(license.expires===null||license.expires>now()))return license;}catch{/* validate online */}}
  try{const license=await remoteLicense(env,await unseal(row.value,env.APP_KEY),accountId);if(license){await cacheLicense(env,license);return license;}}catch{/* Fail closed after cache expiration. */}
  await env.DB.prepare("DELETE FROM settings WHERE key='license-cache'").run();return null;
}
