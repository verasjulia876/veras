import {validateRule,type Rule} from './core';
import type {AppEnv} from './meta';

export function exportRules(rows:Rule[]){
 return {format:'directcash-backup',version:1,created:new Date().toISOString(),rules:rows.map(r=>({name:r.name,trigger:r.trigger,media_id:r.media_id,keywords:r.keywords,message:r.message,link:r.link,public_reply:r.public_reply,active:!!r.active,flow:r.flow||'{}'}))};
}
export function decodeBackup(data:any){
 if(data?.format!=='directcash-backup'||data.version!==1||!Array.isArray(data.rules)||!data.rules.length)throw Error('Use um backup DirectCA$H válido.');
 return data.rules.map((r:any)=>{if(!r||typeof r!=='object')throw Error('Automação inválida no backup.');return validateRule({...r,active:false});});
}
export async function restoreRules(env:AppEnv,data:unknown){
 const rows=decodeBackup(data),created=Math.floor(Date.now()/1000);
 // Keep each bound JSON value small, while committing the entire restore atomically.
 const chunks:string[]=[];let chunk:string[]=[],bytes=2;const encoder=new TextEncoder();
 for(const r of rows){const value=JSON.stringify({...r,id:crypto.randomUUID(),created,active:0}),size=encoder.encode(value).length+1;if(chunk.length&&bytes+size>500000){chunks.push('['+chunk.join(',')+']');chunk=[];bytes=2;}chunk.push(value);bytes+=size;}
 if(chunk.length)chunks.push('['+chunk.join(',')+']');
 await env.DB.batch(chunks.map(payload=>env.DB.prepare(`INSERT INTO rules(id,name,trigger,media_id,keywords,message,link,public_reply,active,created,flow)
 SELECT json_extract(value,'$.id'),json_extract(value,'$.name'),json_extract(value,'$.trigger'),json_extract(value,'$.media_id'),json_extract(value,'$.keywords'),json_extract(value,'$.message'),json_extract(value,'$.link'),json_extract(value,'$.public_reply'),0,json_extract(value,'$.created'),COALESCE(json_extract(value,'$.flow'),'{}') FROM json_each(?)`).bind(payload)));
 return {imported:rows.length};
}
