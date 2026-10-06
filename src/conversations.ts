import {sendDelaySeconds} from './timing';
import {type Rule} from './core';
import {readFlow,fillVariables,emailValid,textMessage,quickMessage,type Flow} from './flow';
import {type Node,type MapFlow} from './map';
import {graph,now,type AppEnv,type Account} from './meta';
type Input={id:string;account_id:string;user_id:string;rule_id:string;kind:string;payload:string;created:number;expires:number};
type Conversation={id:string;account_id:string;user_id:string;rule_id:string;stage:string;config:string;created:number;expires:number};
type Config={map:MapFlow;node:string;name:string;comment:string;engaged:boolean;step:number;job:string;next:string;wake:number;publicReply:string;followup:boolean};
export async function queueInput(env:AppEnv,a:Account,id:string,user:string,rule:string,kind:string,payload:unknown,created:number,expires:number){await env.DB.prepare('INSERT OR IGNORE INTO flow_inputs(id,account_id,user_id,rule_id,kind,payload,created,expires,updated) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,a.id,user,rule,kind,JSON.stringify(payload),created,expires,now()).run();}
function compile(r:Rule,f:Flow):MapFlow{
 if(f.map){const nodes:Node[]=[];for(const source of f.map.nodes){const n={...source,parts:[]};if(!source.parts?.length){nodes.push(n);continue;}const chain:Node[]=[{...n,next:'',choices:[],url:'',label:'Abrir link'}];for(const [i,p]of source.parts.entries())chain.push({...n,id:n.id+'_part'+i,type:p.type==='delay'?'wait':'message',text:p.type==='text'?p.text:'',mediaType:['image','audio','video'].includes(p.type)?p.type as Node['mediaType']:'',mediaUrl:p.url,seconds:p.type==='delay'?p.seconds:undefined,choices:[],next:'',url:''});for(let i=0;i<chain.length-1;i++)chain[i].next=chain[i+1].id;const last=chain[chain.length-1];if(n.choices.length||n.url){chain.push({...n,id:n.id+'_buttons',parts:[],text:'Escolha como continuar:',mediaType:'',mediaUrl:''});last.next=chain[chain.length-1].id;}else last.next=n.next;nodes.push(...chain);}return {start:f.map.start,nodes};}
 const nodes:Node[]=[];
 const add=(id:string,type:Node['type'],text='',extra:Partial<Node>={})=>{const n:Node={id,type,text,next:'',choices:[],minutes:60,url:'',label:'Abrir link',mediaType:'',mediaUrl:'',tag:'',x:0,y:0,...extra};if(nodes.length)nodes[nodes.length-1].next=id;nodes.push(n);return n;};
 if(f.welcomeEnabled)add('welcome','message',f.welcomeText);
 if(f.requireFollow)add('follow','follow',f.followText);
 if(f.collectEmail)add('email','email',f.emailText);
 if(f.attachmentType)add('media','message','Seu conteúdo',{mediaType:f.attachmentType,mediaUrl:f.attachmentUrl});
 add('final','message',r.message,{url:f.linkEnabled?r.link:'',label:f.linkLabel});
 if(f.followupEnabled){add('delay','wait','',{minutes:f.followupMinutes});add('followup','message',f.followupText,{url:f.followupLink,label:f.followupLabel});}
 if(f.welcomeEnabled){nodes[0].choices=[{title:f.welcomeButton,next:nodes[0].next}];nodes[0].next='';}
 return {start:nodes[0].id,nodes};
}
export async function processInputs(env:AppEnv,a:Account,deadline=now()+18){
 // A claimed input serializes planning for this sender. Planning writes and completion commit together.
 await env.DB.prepare("UPDATE flow_inputs SET status='failed',payload='{}' WHERE status='processing' AND updated<?").bind(now()-180).run();
 await env.DB.prepare("UPDATE flow_inputs SET status='expired',payload='{}' WHERE status='pending' AND expires<=?").bind(now()).run();
 // Reconcile successful sends after interruptions; each completion is an idempotent input.
 const waiting=(await env.DB.prepare("SELECT * FROM conversations WHERE account_id=? AND (stage='sending' OR (stage='wait' AND json_extract(config,'$.wake')<=unixepoch())) AND expires>? LIMIT 100").bind(a.id,now()).all<Conversation>()).results;
 for(const c of waiting){const cfg:Config=JSON.parse(c.config);if(c.stage==='sending'){const j=await env.DB.prepare('SELECT status FROM jobs WHERE id=?').bind(cfg.job).first<{status:string}>();if(j&&['failed','uncertain','cancelled','expired'].includes(j.status))await env.DB.prepare("UPDATE conversations SET stage='done' WHERE id=? AND stage='sending'").bind(c.id).run();if(j?.status==='sent')await queueInput(env,a,'ack:'+cfg.job,c.user_id,c.rule_id,'ack',{conversation:c.id,job:cfg.job},now(),c.expires);}else if(cfg.wake<=now())await queueInput(env,a,'wake:'+c.id+':'+cfg.step,c.user_id,c.rule_id,'wake',{conversation:c.id,step:cfg.step},now(),c.expires);}
 for(let i=0;i<12&&now()<deadline;i++){
  const input=await env.DB.prepare("UPDATE flow_inputs SET status='processing',updated=? WHERE id=(SELECT f.id FROM flow_inputs f WHERE f.status='pending' AND f.account_id=? AND f.expires>? AND NOT EXISTS (SELECT 1 FROM flow_inputs p WHERE p.status='processing' AND p.account_id=f.account_id AND p.user_id=f.user_id) ORDER BY f.created,f.id LIMIT 1) AND status='pending' RETURNING *").bind(now(),a.id,now()).first<Input>();
  if(!input)break;
  try{await plan(env,a,input,deadline);}catch{await env.DB.prepare("UPDATE flow_inputs SET status='failed',payload='{}',updated=? WHERE id=?").bind(now(),input.id).run();await env.DB.prepare("INSERT INTO events(kind,detail,created) VALUES('flow','Não foi possível avançar uma conversa. Confira conexão e permissões. Nenhum reenvio automático foi feito.',?)").bind(now()).run();}
 }
}
async function plan(env:AppEnv,a:Account,input:Input,deadline:number){
 const data=JSON.parse(input.payload);const statements:D1PreparedStatement[]=[];
 const finish=()=>env.DB.prepare("UPDATE flow_inputs SET status='done',payload='{}',updated=? WHERE id=?").bind(now(),input.id);
 let c:Conversation|null=null, cfg:Config;let verifyFollow=false;
 if(input.kind==='start'){
  const r=await env.DB.prepare('SELECT * FROM rules WHERE id=? AND active=1').bind(input.rule_id).first<Rule>(),f=r&&readFlow(r);if(!r||!f){await finish().run();return;}
  const map=compile(r,f);cfg={map,node:map.start,name:'',comment:data.comment||'',engaged:!data.comment,step:0,job:'',next:'',wake:0,publicReply:r.public_reply,followup:false};
  c={id:crypto.randomUUID(),account_id:a.id,user_id:input.user_id,rule_id:r.id,stage:'run',config:'',created:input.created,expires:input.expires};
  // A new trigger supersedes previous conversation for this sender to avoid ambiguous email replies.
  statements.push(env.DB.prepare("UPDATE conversations SET stage='done',updated=? WHERE account_id=? AND user_id=?").bind(now(),a.id,input.user_id),env.DB.prepare("UPDATE jobs SET status='cancelled',detail='Uma nova conversa substituiu este envio.',updated=? WHERE status='pending' AND conversation_id IN (SELECT id FROM conversations WHERE account_id=? AND user_id=?)").bind(now(),a.id,input.user_id));
 }else{
  const cid=typeof data.conversation==='string'?data.conversation:typeof data.quick==='string'?data.quick.split(':')[1]:'';
  c=cid?await env.DB.prepare('SELECT * FROM conversations WHERE id=? AND account_id=? AND user_id=? AND expires>?').bind(cid,a.id,input.user_id,now()).first<Conversation>():await env.DB.prepare("SELECT * FROM conversations WHERE account_id=? AND user_id=? AND stage<>'done' AND expires>? ORDER BY created DESC LIMIT 1").bind(a.id,input.user_id,now()).first<Conversation>();
  if(!c||!await env.DB.prepare('SELECT id FROM rules WHERE id=? AND active=1').bind(c.rule_id).first()){await finish().run();return;}
  cfg=JSON.parse(c.config);
  const node=cfg.map.nodes.find(n=>n.id===cfg.node);
  if(input.kind==='ack'){
   if(c.stage!=='sending'||cfg.job!==data.job){await finish().run();return;}
   c.stage=cfg.next;
   if(c.stage==='run'){cfg.node=node?.next||'';}
  }else if(input.kind==='wake'){
   if(c.stage!=='wait'||data.step!==cfg.step){await finish().run();return;}c.stage='run';cfg.node=node?.next||'';
  }else{
   // Only a genuine inbound message extends the response window.
   if(c.stage==='sending'){const sent=await env.DB.prepare("SELECT id FROM jobs WHERE id=? AND status='sent'").bind(cfg.job).first();if(sent)c.stage=cfg.next;}
   if(c.stage==='sending'||c.stage==='done'){await finish().run();return;}
   c.expires=input.expires;cfg.engaged=true;
   if(c.stage==='choice'){
    const prefix='dc:'+c.id+':'+cfg.node+':';if(typeof data.quick!=='string'||!data.quick.startsWith(prefix)){await finish().run();return;}
    const choice=node?.choices[Number(data.quick.slice(prefix.length))];if(!choice||choice.action==='link'||choice.url){await finish().run();return;}cfg.node=choice.next||node?.next||'';c.stage='run';
   }else if(c.stage==='engagement'){
    cfg.node=node?.next||'';c.stage='run';
   }else if(c.stage==='follow'){
    if(data.quick!=='dc:'+c.id+':'+cfg.node+':follow'){await finish().run();return;}verifyFollow=true;c.stage='run';
   }else if(c.stage==='email'){
    if(!emailValid(String(data.text||'').trim())){c.stage='run';}else{
     const email=String(data.text).trim().toLowerCase();statements.push(env.DB.prepare('INSERT INTO contacts(account_id,user_id,name,email,rule_id,created,updated) VALUES(?,?,?,?,?,?,?) ON CONFLICT(account_id,user_id) DO UPDATE SET name=excluded.name,email=excluded.email,rule_id=excluded.rule_id,updated=excluded.updated').bind(a.id,c.user_id,cfg.name,email,c.rule_id,now(),now()));cfg.node=node?.next||'';c.stage='run';
    }
   }else if(c.stage==='wait'){
    // A reply cancels a scheduled follow-up; it never starts an unsolicited second sequence.
    c.stage='done';
   }else {await finish().run();return;}
  }
 }
 if(cfg.engaged&&!cfg.name){try{const p=await graph(env,a,encodeURIComponent(c.user_id)+'?fields=name');cfg.name=typeof p.name==='string'?p.name.slice(0,100):'';}catch{}}
 const send=(message:Record<string,unknown>,after:string)=>{
  cfg.step++;const id='flow:'+c!.id+':'+cfg.step;const privateReply=!!cfg.comment&&!cfg.engaged;
  statements.push(env.DB.prepare('INSERT OR IGNORE INTO jobs(id,account_id,rule_id,recipient,kind,text,payload,created,expires,updated,conversation_id,phase,not_before) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,a.id,c!.rule_id,privateReply?cfg.comment:c!.user_id,privateReply?'private':'dm','',JSON.stringify(message),now(),c!.expires,now(),c!.id,cfg.node,now()+sendDelaySeconds(cfg.map.nodes.find(n=>n.id===cfg.node)!)));
  if(privateReply&&cfg.publicReply){const replies=cfg.publicReply.split('\n').map(s=>s.trim()).filter(Boolean);const reply=replies[Math.floor(Math.random()*replies.length)];if(reply)statements.push(env.DB.prepare('INSERT OR IGNORE INTO jobs(id,account_id,rule_id,recipient,kind,text,parent,created,expires,updated,conversation_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id+':public',a.id,c!.rule_id,cfg.comment,'public',fillVariables(reply,cfg.name),id,now(),c!.expires,now(),c!.id));}
  cfg.job=id;cfg.next=after;c!.stage='sending';
 };
 for(let step=0;c.stage==='run'&&step<35;step++){
  const n=cfg.map.nodes.find(n=>n.id===cfg.node);if(!n){c.stage='done';break;}
  if(!cfg.engaged&&n.type!=='message'&&n.type!=='follow'){c.stage='done';break;}
  if(n.type==='carousel'){send({attachment:{type:'template',payload:{template_type:'generic',elements:n.cards!.map(card=>({title:fillVariables(card.title,cfg.name),subtitle:fillVariables(card.subtitle,cfg.name),image_url:card.image,...(card.buttons.length?{buttons:card.buttons.map(b=>({type:'web_url',url:b.url,title:b.title}))}:{})}))}}},'run');}
  else if(n.type==='message'){
   const text=fillVariables(n.text,cfg.name);let message:Record<string,unknown>;
   if(n.choices.length){const payload=(index:number)=>'dc:'+c!.id+':'+n.id+':'+index;message=(n.replyStyle==='buttons'||n.choices.some(ch=>ch.action==='link'||ch.url))?{attachment:{type:'template',payload:{template_type:'button',text,buttons:n.choices.map((ch,index)=>ch.action==='link'||ch.url?{type:'web_url',title:ch.title,url:ch.url}:{type:'postback',title:ch.title,payload:payload(index)})}}}:{text,quick_replies:n.choices.map((ch,index)=>({content_type:'text',title:ch.title,payload:payload(index)}))};}
   else if(n.links?.length)message={attachment:{type:'template',payload:{template_type:'button',text,buttons:n.links.map(l=>({type:'web_url',url:l.url,title:l.title}))}}};
   else if(n.mediaType==='file')message={text:(n.fileName||'Baixar documento')+'\n'+n.mediaUrl};
   else if(n.mediaType)message={attachment:{type:n.mediaType,payload:{url:n.mediaUrl}}};else message=textMessage(text,n.url,n.label);
   send(message,n.choices.some(ch=>ch.action!=='link'&&!ch.url)?'choice':cfg.engaged?'run':n.next?'engagement':'done');
  }else if(n.type==='wait'){if(n.seconds){if(env.FLOW_SCHEDULER||n.seconds>10||now()+n.seconds>deadline){cfg.step++;cfg.wake=now()+n.seconds;c.stage='wait';break;}await new Promise(resolve=>setTimeout(resolve,n.seconds!*1000));if(now()>=c.expires){c.stage='done';break;}cfg.node=n.next;continue;}cfg.step++;cfg.wake=now()+n.minutes*60;c.stage=cfg.wake<c.expires?'wait':'done';}
  else if(n.type==='email'){send({text:fillVariables(n.text,cfg.name)},'email');}
  else if(n.type==='follow'){
   let prompt=fillVariables(n.text,cfg.name);
   if(verifyFollow){
    verifyFollow=false;
    try{const profile=await graph(env,a,encodeURIComponent(c.user_id)+'?fields=is_user_follow_business');
     if(profile.is_user_follow_business===true){cfg.node=n.next;continue;}
     prompt=profile.is_user_follow_business===false?'Ainda não consegui confirmar que você segue o perfil. Siga e toque no botão novamente.':'Não foi possível verificar agora. Tente novamente em instantes.';
    }catch{prompt='Não foi possível verificar agora. Tente novamente em instantes.';}
   }
   const buttons:any[]=[];
   if(/^[a-zA-Z0-9_.]{1,30}$/.test(a.username))buttons.push({type:'web_url',title:'Ver perfil',url:'https://www.instagram.com/'+a.username+'/'});
   buttons.push({type:'postback',title:n.followButton||'Já segui',payload:'dc:'+c.id+':'+n.id+':follow'});
   send({attachment:{type:'template',payload:{template_type:'button',text:prompt,buttons}}},'follow');
  }else if(n.type==='tag'){statements.push(env.DB.prepare('INSERT OR IGNORE INTO contact_tags(account_id,user_id,tag,created) VALUES(?,?,?,?)').bind(a.id,c.user_id,n.tag,now()));cfg.node=n.next;}
 }
 c.config=JSON.stringify(cfg);statements.push(env.DB.prepare('INSERT INTO conversations(id,account_id,user_id,rule_id,stage,config,created,expires,updated) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET stage=excluded.stage,config=excluded.config,expires=excluded.expires,updated=excluded.updated').bind(c.id,a.id,c.user_id,c.rule_id,c.stage,c.config,c.created,c.expires,now()),finish());await env.DB.batch(statements);
}
