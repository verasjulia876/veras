/* Imported files are data. Nothing is executed and every rule is saved paused. */
function decodeFlowFile(data){
 if(data?.format==='directcash-flow'&&data.version===1&&Array.isArray(data.map?.nodes)){
  if(!data.map.nodes.length||data.map.nodes.length>30||typeof data.map.start!=='string')throw Error('Mapa inválido.');
  for(const n of data.map.nodes){if(!n||typeof n.id!=='string'||!['message','carousel','wait','email','follow','tag'].includes(n.type)||typeof n.text!=='string'||!Array.isArray(n.choices)||n.choices.some(c=>!c||typeof c.title!=='string'||typeof c.next!=='string')||(n.parts!==undefined&&!Array.isArray(n.parts))||(n.type==='carousel'&&!Array.isArray(n.cards)))throw Error('Bloco inválido no arquivo.');}
  return [data];
 }
 if(data?.formato!==1||!Array.isArray(data.fluxos)||!data.fluxos.length)throw Error('Use um fluxo DirectCA$H ou um pacote de fluxos.');
 return data.fluxos.map(f=>{
  if(!Array.isArray(f.nodes)||!Array.isArray(f.edges)||f.nodes.length>31)throw Error('Estrutura de fluxo inválida.');
  const start=f.nodes.find(n=>n.kind==='start');
  const next=(id,handle='next')=>f.edges.find(e=>e.from===id&&e.handle===handle)?.to||'';
  const nodes=f.nodes.filter(n=>n.kind!=='start').map(n=>{
   const type=({message:'message',delay:'wait',ask_email:'email',follow_gate:'follow',tag:'tag'})[n.kind];
   if(!type)throw Error('Tipo de bloco não reconhecido: '+String(n.kind));
   const buttons=n.buttons||[];
   if(!Array.isArray(buttons)||buttons.length>3)throw Error('Use até três botões por mensagem.');

   return {id:n.id,type,text:String(n.text||'').replace(/\{\{first_name\|[^}]+\}\}/g,'{{first_name}}'),next:n.buttonMode==='reply'&&buttons.length?'':next(n.id),choices:n.buttonMode==='reply'?buttons.map((b,i)=>({title:b.label,next:next(n.id,'btn:'+i)})):[],minutes:n.minutes??60,seconds:n.seconds,links:n.buttonMode==='url'&&buttons.length>1?buttons.map(b=>({title:b.label,url:b.url})):[],url:n.buttonMode==='url'&&buttons.length===1?buttons[0]?.url||'':'',label:n.buttonMode==='url'?buttons[0]?.label||'Abrir link':'Abrir link',mediaType:'',mediaUrl:'',parts:[],tag:n.tag||'',x:Number(n.x)||0,y:Number(n.y)||0};
  });
  return {format:'directcash-flow',version:1,name:f.name,trigger:f.trigger,channels:[f.trigger],keywords:Array.isArray(f.keywords)?f.keywords.join(', '):String(f.keywords||''),match:f.match_type||'contains',public_reply:(f.public_replies||[]).join('\n'),map:{start:next(start?.id),nodes}};
 });
}
