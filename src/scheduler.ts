import {DurableObject} from 'cloudflare:workers';
import {drain,now,type AppEnv} from './meta';
import {nextWake} from './scheduler-client';
import {profiles,scoped} from './profiles';

/** One persistent wake-up coordinator per connected Instagram profile. */
export class FlowScheduler extends DurableObject<AppEnv> {
 async schedule(profile:string,at:number){
  if(!/^\d{1,30}$/.test(profile)||!Number.isFinite(at))throw Error('Invalid schedule');
  await this.ctx.storage.put('profile',profile);
  await this.ctx.storage.put('revision',(await this.ctx.storage.get<number>('revision')||0)+1);
  const current=await this.ctx.storage.getAlarm();
  if(current===null||at<current)await this.ctx.storage.setAlarm(Math.max(Date.now()+100,at));
 }
 async alarm(){
  const id=await this.ctx.storage.get<string>('profile');
  const p=(await profiles(this.env)).results.find(p=>p.id===id);if(!p)return;
  const revision=await this.ctx.storage.get<number>('revision');
  // Persist a recovery alarm before doing network work. Sending jobs retain the
  // existing uncertain-result protection; an alarm retry never resends them.
  await this.ctx.storage.setAlarm(Date.now()+240000);
  const env={...scoped(this.env,p),IN_FLOW_ALARM:true};
  await drain(env);
  const next=await nextWake(env);
  const changed=revision!==await this.ctx.storage.get<number>('revision');
  const current=await this.ctx.storage.getAlarm();
  if(next===null){if(!changed)await this.ctx.storage.deleteAlarm();}
  else await this.ctx.storage.setAlarm(Math.max(Date.now()+500,Math.min(next*1000,changed&&current!==null?current:Infinity)));
 }
}

