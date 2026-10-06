import {deleteRules} from './bulk-rules';
import {exportRules,restoreRules} from './backups';
import {BlockError} from './map';
import {mediaFormat} from './media-format';


import {profileEnv,profiles,scoped,registerProfile,publicProfiles} from './profiles';
import {boundedText,digest,equal,seal,unseal,signatureValid,validateRule} from './core';
import {account,settings,now,meta,graph,ingest,drain,maintenance,log,type AppEnv,type Settings} from './meta';
import {licenseFor,activateLicense,LicenseServiceError} from './license';
import {readFlow,hasChannel} from './flow';
import {queueInput} from './conversations';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const cookie=(value:string,secure=true,max=86400)=>`dc_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${max}${secure?'; Secure':''}`;
async function session(req:Request,env:AppEnv){const value=req.headers.get('Cookie')?.match(/(?:^|; )dc_session=([^;]+)/)?.[1];if(!value)return null;const id=await digest(value);return await env.DB.prepare('SELECT id FROM sessions WHERE id=? AND expires>?').bind(id,now()).first<{id:string}>();}
const profileCookie=(id:string)=>`dc_profile=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000; Secure`;
const body=async(req:Request)=>JSON.parse(await boundedText(req,65536)) as Record<string,unknown>;
function secure(response:Response){const r=new Response(response.body,response);r.headers.set('X-Content-Type-Options','nosniff');r.headers.set('Referrer-Policy','no-referrer');r.headers.set('X-Frame-Options','DENY');r.headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data:; connect-src 'self'; media-src 'self' https: blob:; frame-ancestors 'none'; form-action 'self'; base-uri 'none'");return r;}
export default {
  async fetch(req:Request,env:AppEnv,ctx:ExecutionContext):Promise<Response>{try{const url=new URL(req.url);if(url.pathname!=='/webhook'){let id=req.headers.get('Cookie')?.match(/(?:^|; )dc_profile=([0-9]+)/)?.[1];if(url.pathname==='/oauth/callback'){const o=await env.DB.prepare('SELECT profile_id FROM oauth WHERE id=?').bind(await digest(url.searchParams.get('state')||'')).first<{profile_id:string}>();if(o)id=o.profile_id;}env=await profileEnv(env,id);}return secure(await handle(req,env,ctx));}catch(e){console.error(JSON.stringify({event:'request_failed',type:e instanceof Error?e.name:'unknown'}));return secure(json({error:'Não foi possível concluir. Confira a configuração e tente novamente.'},500));}},
  async scheduled(_event:ScheduledController,env:AppEnv,ctx:ExecutionContext){ctx.waitUntil((async()=>{const all=(await profiles(env)).results;if(!all.length)await maintenance(env);for(const p of all)await maintenance(scoped(env,p));})().catch(()=>console.error(JSON.stringify({event:'maintenance_failed'}))));}
} satisfies ExportedHandler<AppEnv>;
async function handle(req:Request,env:AppEnv,ctx:ExecutionContext):Promise<Response>{
  const url=new URL(req.url),path=url.pathname;
  if(path.startsWith('/uploads/')){
    const id=path.slice('/uploads/'.length);if(!/^[a-f0-9-]{36}\.(jpg|png|webp|mp4|m4a|mp3|wav|ogg|aac|pdf|doc|docx)$/.test(id)||!['GET','HEAD'].includes(req.method)||!env.FLOW_MEDIA)return new Response(null,{status:404});
    return env.FLOW_MEDIA.getByName(id).fetch(req);
  }
  if(!path.startsWith('/api/')&&!path.startsWith('/oauth/')&&path!=='/webhook')return env.ASSETS.fetch(req);
  if(!env.APP_KEY||!env.ADMIN_PASSWORD)return json({error:'Instalação incompleta. Configure APP_KEY e ADMIN_PASSWORD nos segredos do Worker na Cloudflare ou conclua o instalador do computador.'},503);
  if(path==='/webhook'){
    const cfg=await settings(env);if(!cfg)return json({error:'Conexão não configurada.'},503);
    if(req.method==='GET')return url.searchParams.get('hub.mode')==='subscribe'&&equal(url.searchParams.get('hub.verify_token')||'',cfg.verifyToken)?new Response(url.searchParams.get('hub.challenge')||''):json({error:'Verificação inválida.'},403);
    if(req.method!=='POST')return json({},405);
    let text:string;try{text=await boundedText(req);}catch{return json({},413);}
    if(!await signatureValid(text,req.headers.get('x-hub-signature-256'),cfg.appSecret))return json({error:'Assinatura inválida.'},401);
    try{const payload=JSON.parse(text),all=(await profiles(env)).results;for(const entry of payload.entry||[]){const p=all.find(p=>p.id===entry.id);if(!p)continue;const pe=scoped(env,p);await ingest(pe,{...payload,entry:[entry]});ctx.waitUntil(drain(pe).catch(()=>console.error(JSON.stringify({event:'drain_failed'}))));}}catch(e){if(e instanceof SyntaxError)return json({},400);throw e;}
    return json({received:true});
  }
  if(['POST','PUT','DELETE','PATCH'].includes(req.method)&&req.headers.get('Origin')!==url.origin)return json({error:'Origem inválida.'},403);
  if(path==='/api/login'&&req.method==='POST'){
    const ip=await digest(req.headers.get('CF-Connecting-IP')||'local');
    const rate=await env.DB.prepare('INSERT INTO attempts(id,hits,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET hits=CASE WHEN expires<? THEN 1 ELSE hits+1 END, expires=CASE WHEN expires<? THEN excluded.expires ELSE expires END RETURNING hits').bind(ip,now()+900,now(),now()).first<{hits:number}>();
    if((rate?.hits||0)>10)return json({error:'Muitas tentativas. Aguarde 15 minutos.'},429);
    const b=await body(req);if(typeof b.password!=='string'||!equal(await digest(b.password),await digest(env.ADMIN_PASSWORD)))return json({error:'Senha incorreta.'},401);
    const token=crypto.randomUUID()+crypto.randomUUID();await env.DB.prepare('INSERT INTO sessions(id,expires) VALUES(?,?)').bind(await digest(token),now()+86400).run();
    return new Response('{}',{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':cookie(token,url.protocol==='https:')}});
  }
  if(path==='/api/privacy'&&req.method==='GET'){const cfg=await settings(env);return json({owner:cfg?.owner||'Responsável por esta instalação',contact:cfg?.contact||'Contato ainda não configurado'});}
  const s=await session(req,env);if(!s)return json({error:'Entre no painel para continuar.'},401);
  if(path==='/api/uploads'&&req.method==='POST'){
    if(!env.FLOW_MEDIA)return json({error:'O armazenamento de anexos ainda não foi configurado nesta instalação.'},503);
    const kind=url.searchParams.get('kind')||'',type=(req.headers.get('Content-Type')||'').split(';')[0],format=mediaFormat(type,kind);
    if(!format)return json({error:'Formato de arquivo não suportado.'},415);
    if(Number(req.headers.get('Content-Length'))>10*1024*1024)return json({error:'Use um arquivo de até 10 MB.'},413);
    const id=crypto.randomUUID()+'.'+format.extension;
    const result=await env.FLOW_MEDIA.getByName(id).fetch(new Request('https://media.internal/',{method:'PUT',headers:{'Content-Type':type},body:req.body}));
    if(!result.ok)return json({error:await result.text()},result.status);
    return json({url:url.origin+'/uploads/'+id,...await result.json() as object});
  }
  if(path==='/api/profile-photo'&&req.method==='GET'){
    const a=await account(env);if(!a)return json({url:''});
    const cached=await env.DB.prepare("SELECT value FROM settings WHERE key='profile-photo'").first<{value:string}>();
    let previousPhoto='';if(cached){try{const p=JSON.parse(cached.value);if(typeof p.url==='string'&&p.url.startsWith('https://'))previousPhoto=p.url;if(p.until>now()&&previousPhoto)return json({url:previousPhoto});}catch{}}
    try{const p=await graph(env,a,a.id+'?fields=profile_picture_url');const photo=typeof p.profile_picture_url==='string'&&p.profile_picture_url.startsWith('https://')?p.profile_picture_url:previousPhoto;if(photo)await env.DB.prepare("INSERT INTO settings(key,value) VALUES('profile-photo',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify({url:photo,until:now()+(p.profile_picture_url?3600:60)})).run();return json({url:photo});}catch{return json({url:previousPhoto});}
  }
  if(path==='/api/profile'&&req.method==='POST'){const b=await body(req);const all=await publicProfiles(env);if(typeof b.id!=='string'||!all.some(a=>a.id===b.id))return json({error:'Perfil não encontrado.'},400);return new Response('{}',{headers:{'Content-Type':'application/json','Set-Cookie':profileCookie(b.id),'Cache-Control':'no-store'}});}
  if(path==='/api/logout'&&req.method==='POST'){await env.DB.prepare('DELETE FROM sessions WHERE id=?').bind(s.id).run();return new Response('{}',{headers:{'Set-Cookie':cookie('',url.protocol==='https:',0),'Cache-Control':'no-store'}});}
  if(path==='/api/status'&&req.method==='GET'){
    const a=await account(env),cfg=await settings(env),last=await env.DB.prepare("SELECT value FROM settings WHERE key='last_webhook'").first<{value:string}>();
    const counts=(await env.DB.prepare('SELECT status,count(*) total FROM jobs GROUP BY status').all()).results;
    const license=a?await licenseFor(env,a.id):null;
    return json({licensingPaused:env.LICENSE_ENFORCEMENT!=='enabled',profiles:await publicProfiles(env),license:license?{student:license.student,email:license.email,usedProfiles:license.usedProfiles,maxProfiles:license.maxProfiles,expires:license.expires,temporary:!!license.temporary,paused:!!license.paused}:null,account:a?{id:a.id,username:a.username,expires:a.expires}:null,configured:!!cfg,appId:cfg?.appId||'',owner:cfg?.owner||'',contact:cfg?.contact||'',verifyToken:cfg?.verifyToken||'',callback:url.origin+'/oauth/callback',webhook:url.origin+'/webhook',privacy:url.origin+'/privacy.html',lastWebhook:last?Number(last.value):null,counts});
  }
  if(path==='/api/license'&&req.method==='POST'){
    const a=await account(env);if(!a)return json({error:'Conecte o Instagram para receber o identificador da licença.'},400);
    const b=await body(req);if(typeof b.code!=='string')return json({error:'Informe o código de ativação.'},400);
    try{if(!await activateLicense(env,b.code.trim().toUpperCase(),a.id))return json({error:'Licença inválida, suspensa, vencida ou emitida para outro Instagram.'},400);}catch(e){const code=e instanceof LicenseServiceError?e.code:'LIC-INTERNAL';console.error(JSON.stringify({event:'license_activation_failed',code}));return json({error:(e instanceof LicenseServiceError?e.message:'Falha interna ao ativar a licença.')+' ['+code+']'},503);}
    return json({ok:true});
  }
  if(path==='/api/settings'&&req.method==='POST'){
    if((await publicProfiles(env)).length)return json({error:'Desconecte o Instagram antes de trocar o aplicativo Meta.'},409);
    const b=await body(req);if(typeof b.appId!=='string'||!/^\d{5,30}$/.test(b.appId)||typeof b.appSecret!=='string'||b.appSecret.length<16||b.appSecret.length>200||typeof b.owner!=='string'||!b.owner.trim()||b.owner.length>120||typeof b.contact!=='string'||!/^\S+@\S+\.\S+$/.test(b.contact)||b.contact.length>150)return json({error:'Confira ID, chave secreta, nome e e-mail de contato.'},400);
    const cfg:Settings={appId:b.appId,appSecret:b.appSecret,owner:b.owner,contact:b.contact,verifyToken:crypto.randomUUID()};
    await env.DB.prepare("INSERT INTO settings(key,value) VALUES('meta',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(await seal(JSON.stringify(cfg),env.APP_KEY)).run();return json({ok:true});
  }
  if(path==='/oauth/start'&&req.method==='GET'){
    const cfg=await settings(env);if(!cfg)return json({error:'Salve primeiro as credenciais Meta.'},400);
    const state=crypto.randomUUID();await env.DB.prepare('INSERT INTO oauth(id,session,expires,profile_id,add_account) VALUES(?,?,?,?,?)').bind(await digest(state),s.id,now()+600,env.PROFILE_ID||'',url.searchParams.get('add')==='1'?1:0).run();
    const q=new URLSearchParams({client_id:cfg.appId,redirect_uri:url.origin+'/oauth/callback',response_type:'code',scope:'instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages',state});return Response.redirect('https://www.instagram.com/oauth/authorize?'+q,302);
  }
  if(path==='/oauth/callback'&&req.method==='GET'){
    const state=url.searchParams.get('state')||'',code=url.searchParams.get('code');
    const row=await env.DB.prepare('DELETE FROM oauth WHERE id=? AND session=? AND expires>? RETURNING id,add_account').bind(await digest(state),s.id,now()).first<{id:string;add_account:number}>();
    if(!row||!code)return Response.redirect(url.origin+'/?connection=cancelled#setup',302);
    const cfg=await settings(env);if(!cfg)return json({},400);
    try{
      const short=await meta('https://api.instagram.com/oauth/access_token',{method:'POST',body:new URLSearchParams({client_id:cfg.appId,client_secret:cfg.appSecret,grant_type:'authorization_code',redirect_uri:url.origin+'/oauth/callback',code})});
      const token=await meta('https://graph.instagram.com/access_token?'+new URLSearchParams({grant_type:'ig_exchange_token',client_secret:cfg.appSecret,access_token:short.access_token}));
      if(!token.access_token||!token.expires_in)throw Error('token');
      const a={id:'',username:'',token:await seal(token.access_token,env.APP_KEY),expires:now()+Number(token.expires_in),refreshed:now()};
      const profile=await graph(env,a,'me?fields=user_id,username');a.id=String(profile.user_id);a.username=String(profile.username);if(!/^\d+$/.test(a.id))throw Error('profile');
      const existing=await account(env);if(existing&&existing.id!==a.id&&!row.add_account)return json({error:'Para manter a conta atual, use Conectar outra conta no menu lateral.'},409);
      env=await registerProfile(env,a);
      await env.DB.prepare('INSERT INTO account(id,username,token,expires,refreshed) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET username=excluded.username,token=excluded.token,expires=excluded.expires,refreshed=excluded.refreshed').bind(a.id,a.username,a.token,a.expires,a.refreshed).run();
      try{await graph(env,a,a.id+'/subscribed_apps',{subscribed_fields:['comments','messages','messaging_postbacks']});await log(env,'connection','Instagram conectado. Faça um teste real para confirmar o webhook.');}catch{await log(env,'connection','Conta conectada, mas a assinatura do webhook falhou. Use Verificar conexão.');}
      return new Response(null,{status:302,headers:{Location:url.origin+'/?connection=ok#setup','Set-Cookie':profileCookie(a.id)}});
    }catch{await log(env,'connection','Conexão falhou. Confira o aplicativo, a URL de retorno e as permissões na Meta.');return Response.redirect(url.origin+'/?connection=error#setup',302);}
  }
  if(path==='/api/disconnect'&&req.method==='POST'){
    await env.DB.batch([env.DB.prepare('DELETE FROM contact_tags'),env.DB.prepare('DELETE FROM contacts'),env.DB.prepare('DELETE FROM conversations'),env.DB.prepare('DELETE FROM flow_inputs'),env.DB.prepare('DELETE FROM account'),env.DB.prepare('UPDATE rules SET active=0'),env.DB.prepare('DELETE FROM jobs'),env.DB.prepare('DELETE FROM events'),env.DB.prepare('DELETE FROM oauth'),env.DB.prepare("DELETE FROM settings WHERE key='last_webhook'")]);return json({ok:true});
  }
  if(path==='/api/diagnose'&&req.method==='POST'){
    const a=await account(env);if(!a)return json({error:'Conecte seu Instagram.'},400);
    try{await graph(env,a,'me?fields=user_id,username');await graph(env,a,a.id+'/subscribed_apps',{subscribed_fields:['comments','messages','messaging_postbacks']});return json({message:'Token aceito e conta inscrita em comentários e mensagens. Agora faça um comentário de teste; isso confirma o webhook completo.'});}catch{return json({error:'A Meta recusou a verificação. Confira as permissões e reconecte sua conta.'},400);}
  }
  if(path.startsWith('/api/media/')&&!path.endsWith('/comments')&&req.method==='GET'){
    const id=path.slice('/api/media/'.length);if(!/^\d{1,40}$/.test(id))return json({error:'Publicação inválida.'},400);
    const a=await account(env);if(!a)return json({error:'Conecte o Instagram primeiro.'},400);
    try{return json(await graph(env,a,id+'?fields=id,caption,permalink,media_type,media_url,thumbnail_url,timestamp'));}catch{return json({error:'Não foi possível carregar a prévia da publicação.'},400);}
  }
  if(path.startsWith('/api/media/')&&path.endsWith('/comments')&&req.method==='GET'){
    const id=path.slice('/api/media/'.length,-'/comments'.length);if(!/^\d{1,40}$/.test(id))return json({error:'Publicação inválida.'},400);
    const a=await account(env);if(!a)return json({error:'Conecte o Instagram primeiro.'},400);
    try{const data=await graph(env,a,`${id}/comments?fields=id,text,from,username,profile_picture_url,timestamp&limit=100`);return json({data:data.data||[]});}catch{return json({error:'Não foi possível carregar os comentários deste post. Confira a permissão de comentários.'},400);}
  }
  if(path==='/api/media'&&req.method==='GET'){
    const a=await account(env);if(!a)return json({error:'Conecte o Instagram primeiro.'},400);
    const after=url.searchParams.get('after')||'';if(after.length>1000)return json({},400);
    try{const data=await graph(env,a,`${a.id}/media?fields=id,caption,permalink,media_type,media_url,thumbnail_url,timestamp&limit=25${after?'&after='+encodeURIComponent(after):''}`);return json({data:data.data||[],after:data.paging?.next?data.paging?.cursors?.after:null});}catch{return json({error:'Não foi possível listar os posts. Confira a conexão.'},400);}
  }
  if(path==='/api/stories'&&req.method==='GET'){
    const a=await account(env);if(!a)return json({error:'Conecte o Instagram primeiro.'},400);
    try{const data=await graph(env,a,`${a.id}/stories?fields=id,media_type,media_url,thumbnail_url,timestamp&limit=100`);return json({data:data.data||[]});}catch{return json({error:'Não foi possível listar os stories. Confira a conexão e se há stories ativos.'},400);}
  }
  if(path==='/api/rules-bulk-delete'&&req.method==='POST'){try{return json(await deleteRules(env,(await body(req)).ids));}catch(e){return json({error:e instanceof Error?e.message:'Falha ao excluir.'},400);}}
  if(path==='/api/rules-backup'&&req.method==='GET')return json(exportRules((await env.DB.prepare('SELECT * FROM rules ORDER BY created DESC').all<any>()).results));
  if(path==='/api/rules-backup'&&req.method==='POST'){
    try{return json(await restoreRules(env,JSON.parse(await boundedText(req,4*1024*1024))));}catch(e){return json({error:e instanceof Error?e.message:'Não foi possível importar o backup.'},400);}
  }
  if(path==='/api/rules'&&req.method==='GET')return json((await env.DB.prepare('SELECT * FROM rules ORDER BY created DESC').all()).results);
  if(path==='/api/manual-dispatch'&&req.method==='POST'){
    const b=await body(req),mediaId=typeof b.mediaId==='string'?b.mediaId.trim():'',commentId=typeof b.commentId==='string'?b.commentId.trim():'',userId=typeof b.userId==='string'?b.userId.trim():'',ruleId=typeof b.ruleId==='string'?b.ruleId.trim():'';
    if(!/^\d{1,40}$/.test(mediaId)||!/^\d{1,80}$/.test(commentId)||!/^\d{1,80}$/.test(userId)||!/^[a-f0-9-]{36}$/.test(ruleId))return json({error:'Selecione um post, uma pessoa e um fluxo válidos.'},400);
    const a=await account(env);if(!a)return json({error:'Conecte o Instagram primeiro.'},400);if(!await licenseFor(env,a.id))return json({error:'Ative sua licença para disparar o fluxo.'},400);
    const rule=await env.DB.prepare('SELECT * FROM rules WHERE id=? AND active=1').bind(ruleId).first<any>(),flow=rule&&readFlow(rule);
    if(!rule||!flow||!hasChannel(rule,'comment'))return json({error:'Selecione um fluxo ativo que aceite comentários.'},400);
    try{
      const comment=await graph(env,a,`${commentId}?fields=id,from,media`),from=comment?.from?.id,media=comment?.media?.id;
      if(String(comment?.id)!==commentId||String(from)!==userId||(media&&String(media)!==mediaId))return json({error:'O comentário selecionado não está mais disponível neste post.'},409);
    }catch{return json({error:'Não foi possível confirmar esse comentário na Meta. Atualize a lista e tente novamente.'},409);}
    const inputId='manual:'+commentId+':'+ruleId,existing=await env.DB.prepare('SELECT status FROM flow_inputs WHERE id=?').bind(inputId).first<{status:string}>();
    if(existing)return json({ok:true,already:true,message:existing.status==='done'?'Este comentário já recebeu este fluxo.':'Este disparo já está na fila.'});
    const t=now();await queueInput(env,a,inputId,userId,ruleId,'start',{comment:commentId,manual:true},t,t+7*86400);
    await env.DB.prepare('INSERT INTO events(kind,detail,created) VALUES(?,?,?)').bind('manual_dispatch',JSON.stringify({eventId:inputId,userId,commentId,mediaId,ruleId}),t).run();
    ctx.waitUntil(drain(env).catch(()=>{}));
    return json({ok:true,queued:true,message:'Disparo colocado na fila. Acompanhe em Atividade.'});
  }
  if(path==='/api/rules'&&req.method==='POST'){
    let r;const b=await body(req);try{if(b.flow&&typeof b.flow==='object'&&(b.flow as any).nextPostAt){const previous=typeof b.id==='string'?await env.DB.prepare('SELECT flow FROM rules WHERE id=?').bind(b.id).first<{flow:string}>():null;(b.flow as any).nextPostAt=previous&&readFlow(previous)?.nextPostAt||now();b.media_id='';}r=validateRule(b);}catch(e){return json({error:(e as Error).message,...(e instanceof BlockError?{nodeId:e.nodeId,blockNumber:e.blockNumber}:{})},400);}
    const a=await account(env);
    if(r.active&&!a)return json({error:'Nenhum Instagram conectado neste perfil. Abra Configuração e conecte sua conta.'},400);
    if(r.active&&a&&!await licenseFor(env,a.id))return json({error:'O Instagram está conectado, mas o acesso não está liberado. Ative a licença ou confira TEST_ACCESS_UNTIL nas variáveis do Worker após a última implantação.'},400);
    if(r.active&&a&&(JSON.parse(r.flow||'{}').requireFollow||JSON.parse(r.flow||'{}').map?.nodes?.some((n:any)=>n.type==='follow'||n.replyStyle==='buttons'&&n.choices?.length))){
      try{await graph(env,a,a.id+'/subscribed_apps',{subscribed_fields:['comments','messages','messaging_postbacks']});}catch{return json({error:'Não foi possível ativar os cliques dos botões no Instagram. Confira messaging_postbacks nos webhooks do app e use Verificar conexão. Seu fluxo ainda não foi alterado.'},400);}
    }
    const id=typeof b.id==='string'?b.id:crypto.randomUUID();if(!/^[a-f0-9-]{36}$/.test(id))return json({},400);
    await env.DB.prepare('INSERT INTO rules(id,name,trigger,media_id,keywords,message,link,public_reply,active,created,flow) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,trigger=excluded.trigger,media_id=excluded.media_id,keywords=excluded.keywords,message=excluded.message,link=excluded.link,public_reply=excluded.public_reply,active=excluded.active,flow=excluded.flow').bind(id,r.name,r.trigger,r.media_id,r.keywords,r.message,r.link,r.public_reply,r.active,now(),r.flow||'{}').run();return json({id});
  }
  if(path.startsWith('/api/rules/')&&req.method==='DELETE'){await env.DB.prepare('DELETE FROM rules WHERE id=?').bind(path.split('/').pop()).run();return json({ok:true});}
  if(path==='/api/contacts'&&req.method==='GET')return json((await env.DB.prepare("SELECT c.user_id,c.name,c.email,c.created,c.updated,(SELECT group_concat(tag, ', ') FROM contact_tags t WHERE t.user_id=c.user_id AND t.account_id=c.account_id) tags FROM contacts c UNION SELECT t.user_id,'','',min(t.created),max(t.created),group_concat(t.tag, ', ') FROM contact_tags t WHERE NOT EXISTS(SELECT 1 FROM contacts c WHERE c.user_id=t.user_id AND c.account_id=t.account_id) GROUP BY t.user_id ORDER BY updated DESC LIMIT 1000").all()).results);
  if(path.startsWith('/api/contacts/')&&req.method==='DELETE'){const uid=decodeURIComponent(path.split('/').pop()!);await env.DB.batch([env.DB.prepare('DELETE FROM contacts WHERE user_id=?').bind(uid),env.DB.prepare('DELETE FROM contact_tags WHERE user_id=?').bind(uid),env.DB.prepare('DELETE FROM conversations WHERE user_id=?').bind(uid),env.DB.prepare("UPDATE jobs SET status='cancelled' WHERE recipient=? AND status='pending'").bind(uid)]);return json({ok:true});}
  if(path==='/api/activity'&&req.method==='GET')return json({jobs:(await env.DB.prepare("SELECT j.id,j.kind,j.status,j.created,j.updated,j.detail,j.text,j.payload,j.recipient,j.rule_id,j.phase AS node_id,COALESCE(c.user_id,j.recipient) AS user_id,(SELECT COALESCE(json_extract(n.value,'$.number'),CAST(n.key AS INTEGER)+1) FROM json_each(c.config,'$.map.nodes') n WHERE json_extract(n.value,'$.id')=j.phase LIMIT 1) AS block_number FROM jobs j LEFT JOIN conversations c ON c.id=j.conversation_id ORDER BY j.created DESC LIMIT 50").all()).results,events:(await env.DB.prepare('SELECT kind,detail,created FROM events ORDER BY created DESC,id DESC LIMIT 100').all()).results});
  return json({error:'Rota não encontrada.'},404);
}
