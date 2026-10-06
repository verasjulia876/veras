import {profileSchema} from './profile-schema';
import {type AppEnv,type Account} from './meta';
export type Profile={id:string;prefix:string};
const tables=['settings','account','rules','jobs','events','flow_inputs','conversations','contacts','contact_tags'];
export function scoped(env:AppEnv,p:Profile):AppEnv{
 const root=env.ROOT_DB||env.DB;
 if(!p.prefix)return {...env,DB:root,ROOT_DB:root,PROFILE_ID:p.id};
 if(!/^p\d{1,30}_$/.test(p.prefix))throw Error('Invalid profile prefix');
 const pattern=new RegExp('\\b('+tables.join('|')+')\\b','g');
 const db=new Proxy(root,{get(target,key){if(key==='prepare')return (sql:string)=>target.prepare(sql.replace(pattern,p.prefix+'$1'));const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
 return {...env,DB:db,ROOT_DB:root,PROFILE_ID:p.id};
}
export const profiles=(env:AppEnv)=>(env.ROOT_DB||env.DB).prepare('SELECT id,prefix FROM profiles ORDER BY rowid').all<Profile>();
export async function profileEnv(env:AppEnv,id?:string){const all=(await profiles(env)).results;const p=all.find(p=>p.id===id)||all[0];return p?scoped(env,p):{...env,ROOT_DB:env.ROOT_DB||env.DB};}
export async function registerProfile(env:AppEnv,a:Account){
 const root=env.ROOT_DB||env.DB,existing=await root.prepare('SELECT id,prefix FROM profiles WHERE id=?').bind(a.id).first<Profile>();
 if(existing)return scoped(env,existing);
 if((await profiles(env)).results.length>=10)throw Error('Limite de dez perfis nesta instalação.');
 const p={id:a.id,prefix:'p'+a.id+'_'};if(!/^p\d{1,30}_$/.test(p.prefix))throw Error('Invalid profile ID');
 const names=[...tables,'jobs_pending','jobs_updated','events_created','flow_inputs_pending','flow_inputs_user','conversations_user'];const pattern=new RegExp('\\b('+names.join('|')+')\\b','g');
 const sql=profileSchema.map(s=>root.prepare(s.replace(pattern,p.prefix+'$1')));
 const meta=await env.DB.prepare("SELECT value FROM settings WHERE key='meta'").first<{value:string}>();
 if(meta)sql.push(root.prepare('INSERT INTO '+p.prefix+"settings(key,value) VALUES('meta',?)").bind(meta.value));
 sql.push(root.prepare('INSERT INTO profiles(id,prefix) VALUES(?,?)').bind(p.id,p.prefix));await root.batch(sql);
 return scoped(env,p);
}
export async function publicProfiles(env:AppEnv){const result=[];for(const p of (await profiles(env)).results){const e=scoped(env,p),a=await e.DB.prepare('SELECT id,username,expires FROM account LIMIT 1').first<{id:string;username:string;expires:number}>();if(a)result.push(a);}return result;}
