import {now,account,type AppEnv} from './meta';
import {licenseFor} from './license';
export async function nextWake(env:AppEnv):Promise<number|null>{
 const cooldown=await env.DB.prepare("SELECT value FROM settings WHERE key='send_retry_after'").first<{value:string}>();
 const rows=await env.DB.prepare(`SELECT min(wake) wake FROM (
  SELECT max(not_before,?) wake FROM jobs WHERE status='pending' AND expires>? AND rule_id IN (SELECT id FROM rules WHERE active=1) AND (parent IS NULL OR parent IN (SELECT id FROM jobs WHERE status='sent'))
  UNION ALL SELECT CAST(json_extract(config,'$.wake') AS INTEGER) wake FROM conversations WHERE stage='wait' AND expires>? AND rule_id IN (SELECT id FROM rules WHERE active=1)
  UNION ALL SELECT updated+181 wake FROM jobs WHERE status='sending' AND expires>?
  UNION ALL SELECT ? wake FROM flow_inputs WHERE status='pending' AND expires>?
 )`).bind(now(),now(),now(),now(),now(),now()).first<{wake:number|null}>();
 if(rows?.wake==null)return null;
 const connected=await account(env);if(!connected||!await licenseFor(env,connected.id))return null;
 return Math.max(rows.wake,Number(cooldown?.value||0));
}
export async function schedulePending(env:AppEnv){
 if(!env.FLOW_SCHEDULER||env.IN_FLOW_ALARM||!env.PROFILE_ID)return;
 const next=await nextWake(env);if(next===null)return;
 await env.FLOW_SCHEDULER.getByName(env.PROFILE_ID).schedule(env.PROFILE_ID,next*1000);
}

