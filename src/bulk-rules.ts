import type {AppEnv} from './meta';
export async function deleteRules(env:AppEnv,input:unknown){
 if(!Array.isArray(input)||!input.length||input.some(id=>typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id)))throw Error('Selecione os itens válidos que deseja excluir.');
 const ids=[...new Set<string>(input)],slots='SELECT value FROM json_each(?)',payload=JSON.stringify(ids),time=Math.floor(Date.now()/1000);
 const result=await env.DB.batch([
  env.DB.prepare(`UPDATE jobs SET status='cancelled',detail='Automação excluída.',updated=? WHERE rule_id IN (${slots}) AND status='pending'`).bind(time,payload),
  env.DB.prepare(`UPDATE conversations SET stage='done',updated=? WHERE rule_id IN (${slots})`).bind(time,payload),
  env.DB.prepare(`UPDATE flow_inputs SET status='failed',payload='{}',updated=? WHERE rule_id IN (${slots}) AND status='pending'`).bind(time,payload),
  env.DB.prepare(`DELETE FROM rules WHERE id IN (${slots})`).bind(payload)
 ]);
 return {deleted:result[3].meta.changes};
}
