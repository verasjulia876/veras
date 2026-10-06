import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline/promises';
import {randomBytes} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');process.chdir(root);
const rl=createInterface({input:process.stdin,output:process.stdout});
const ask=async(text)=>String(await rl.question(text)).trim();
function wrangler(args,{capture=false,input}={}){const result=spawnSync(process.execPath,[resolve('node_modules/wrangler/bin/wrangler.js'),...args],{cwd:root,encoding:'utf8',input,stdio:input!==undefined||capture?['pipe','pipe','pipe']:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});if(result.status!==0){if(result.stderr)console.error(result.stderr.replace(/access_token[^\s]*/g,'[redigido]'));throw Error('O comando falhou: '+args.join(' ')+'. Corrija o erro e execute o instalador novamente.');}return result.stdout||'';}
try{
 console.log('\nDIRECTCA$H · CREATOR IA CLUB\nInstalação individual em Cloudflare Workers + D1\n');
 console.log('Este assistente cria um banco e publica o painel na SUA conta Cloudflare.\nNão contrata planos pagos. Use Workers Free e acompanhe os limites.\nVocê precisa de uma conta Cloudflare e, depois, um aplicativo na Meta.\n');
 if((await ask('Pressione ENTER para instalar ou digite SAIR para cancelar: ')).toUpperCase()==='SAIR')process.exit(0);
 if(!existsSync('node_modules/wrangler/bin/wrangler.js'))throw Error('Execute npm install antes do assistente.');
 const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
 const selected=await ask(`Nome da instalação [${config.name}]: `)||config.name;
 if(!/^[a-z][a-z0-9-]{2,40}$/.test(selected))throw Error('Use de 3 a 41 caracteres: letras minúsculas, números e hífen.');
 if(config.d1_databases[0].database_id!=='00000000-0000-0000-0000-000000000000'&&selected!==config.name)throw Error('Esta pasta já tem um banco configurado. Use uma cópia nova do kit para criar outra instalação.');
 config.name=selected;
 console.log('\n1/5 · Autorize o acesso à Cloudflare no navegador.');wrangler(['login']);
 console.log('\n2/5 · Banco de dados');
 if(config.d1_databases[0].database_id==='00000000-0000-0000-0000-000000000000'){
  const databaseName=selected+'-'+randomBytes(3).toString('hex');
  const output=wrangler(['d1','create',databaseName],{capture:true});
  const id=output.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
  if(!id){console.log(output);throw Error('Banco criado, mas ID não identificado. Copie o ID mostrado para wrangler.jsonc antes de continuar.');}
  config.d1_databases[0].database_name=databaseName;config.d1_databases[0].database_id=id;
 }
 writeFileSync('wrangler.jsonc',JSON.stringify(config,null,2)+'\n');
 wrangler(['d1','migrations','apply','DB','--remote'],{capture:true});
 console.log('\n3/5 · Preparar acesso privado');
 const secretPath='.install-secrets.json';
 let secrets;
 if(existsSync(secretPath)){secrets=JSON.parse(readFileSync(secretPath,'utf8'));if(!secrets.APP_KEY||!secrets.ADMIN_PASSWORD)throw Error('Arquivo local de segredos incompleto. Não apague a chave de uma instalação existente.');}
 else{secrets={APP_KEY:randomBytes(32).toString('base64url'),ADMIN_PASSWORD:randomBytes(18).toString('base64url')};writeFileSync(secretPath,JSON.stringify(secrets,null,2),{mode:0o600});}
 console.log('\n4/5 · Publicar painel e registrar segredos');
 const deployed=wrangler(['deploy'],{capture:true});
 console.log(deployed);
 const panelUrl=deployed.match(/https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev\b/i)?.[0];
 for(const name of ['APP_KEY','ADMIN_PASSWORD'])wrangler(['secret','put',name],{input:secrets[name]+'\n',capture:true});
 console.log('\n5/5 · Instalação concluída\n');
 if(panelUrl){
  writeFileSync('ABRIR-MEU-PAINEL.html','<!doctype html><meta charset="utf-8"><title>Meu DirectCA$H</title><p><a href="'+panelUrl+'">Abrir meu painel DirectCA$H</a></p>');
  console.log('SEU PAINEL: '+panelUrl);
  try {
   const opener=process.platform==='win32'?spawnSync('rundll32.exe',['url.dll,FileProtocolHandler',panelUrl],{windowsHide:true}):spawnSync(process.platform==='darwin'?'open':'xdg-open',[panelUrl]);
   if(opener.error||opener.status!==0)console.log('Abra o link acima no navegador.');
  }catch{console.log('Abra o link acima no navegador.');}
 }else console.log('Abra o endereço workers.dev exibido na publicação acima.');
 console.log('SUA SENHA DO PAINEL: '+secrets.ADMIN_PASSWORD);
 console.log('\nGuarde a senha em um gerenciador de senhas. A chave APP_KEY é necessária para ler os tokens.\nA cópia local está em .install-secrets.json. Nunca compartilhe este arquivo nem esta pasta já configurada.\nPara as alunas, distribua somente o ZIP original, sem credenciais.\n');
 console.log('Próximo passo: Configuração → siga o guia para conectar a Meta.\nO painel publicado ainda não envia nada: crie e ative uma automação após conectar.');
}catch(e){console.error('\nNão foi possível concluir: '+e.message);process.exitCode=1;}finally{rl.close();}

