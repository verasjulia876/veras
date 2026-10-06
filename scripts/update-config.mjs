import {readFileSync,writeFileSync} from 'node:fs';
// Used only inside an existing installation. Identity, secrets, D1 and all
// unrelated options remain untouched. Never run the new-install wizard here.
const file=process.argv[2]||'wrangler.jsonc';
const config=JSON.parse(readFileSync(file,'utf8'));
if(!config.name||!config.d1_databases?.some(d=>d.binding==='DB'))throw Error('Configuração da instalação não encontrada.');
config.main='src/worker.ts';
config.assets??={directory:'./public',binding:'ASSETS'};
if(config.assets.run_worker_first!==true)config.assets.run_worker_first=[...new Set([...(config.assets.run_worker_first||[]),'/api/*','/oauth/*','/webhook','/uploads/*'])];
config.durable_objects??={bindings:[]};config.durable_objects.bindings??=[];
for(const [name,class_name]of [['FLOW_SCHEDULER','FlowScheduler'],['FLOW_MEDIA','FlowMedia']]){
 const existing=config.durable_objects.bindings.find(b=>b.name===name);
 if(existing&&existing.class_name!==class_name)throw Error('Vinculação existente incompatível: '+name);
 if(!existing)config.durable_objects.bindings.push({name,class_name});
}
config.migrations??=[];
const classes=['FlowScheduler','FlowMedia'].filter(c=>!config.migrations.some(m=>(m.new_sqlite_classes||[]).includes(c)));
if(classes.length){if(config.migrations.some(m=>m.tag==='flow-tools-v1'))throw Error('Migração existente incompatível.');config.migrations.push({tag:'flow-tools-v1',new_sqlite_classes:classes});}
config.keep_vars=true;
writeFileSync(file,JSON.stringify(config,null,2)+'\n');
console.log('Editor atualizado na configuração. Nome, banco e variáveis da instalação preservados.');
