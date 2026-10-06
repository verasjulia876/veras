import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const url=process.argv[2]?.replace(/\/$/,'');
if(!url||!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(url)){console.error('Use: npm run configure:browser -- https://github.com/SUA-CONTA/SEU-REPOSITORIO');process.exit(1);}
writeFileSync(resolve(root,'public/install-config.js'),'window.DIRECTCASH_INSTALL='+JSON.stringify({repository:url})+';\n');
const file=resolve(root,'README.md');let doc=readFileSync(file,'utf8');const begin='<!-- DIRECTCASH-BROWSER-START -->',end='<!-- DIRECTCASH-BROWSER-END -->';const content=begin+'\n## Instalar pelo navegador (celular ou computador)\n\n[Instalar meu DirectCA$H](https://deploy.workers.cloudflare.com/?url='+encodeURIComponent(url)+')\n\nUse contas Cloudflare e GitHub. Informe uma senha privada ADMIN_PASSWORD e uma chave aleatória APP_KEY (32 caracteres ou mais); mantenha o comando npm run deploy. Depois abra seu endereço workers.dev. Consulte INSTALAR-PELO-CELULAR.md.\n'+end;
if(doc.includes(begin))doc=doc.slice(0,doc.indexOf(begin))+content+doc.slice(doc.indexOf(end)+end.length);else doc=content+'\n\n'+doc;
writeFileSync(file,doc);console.log('Link de instalação configurado. Publique estes arquivos no repositório e teste uma instalação real antes de distribuir.');
