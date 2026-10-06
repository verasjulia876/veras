const repo=window.DIRECTCASH_INSTALL?.repository||'';
if(/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)){
 const link=document.querySelector('#deploy');link.href='https://deploy.workers.cloudflare.com/?url='+encodeURIComponent(repo);link.hidden=false;document.querySelector('#unavailable').hidden=true;
}
const random=bytes=>Array.from(crypto.getRandomValues(new Uint8Array(bytes)),x=>x.toString(16).padStart(2,'0')).join('');
document.querySelector('#generate').onclick=()=>{
 if(document.querySelector('#password').value&&!confirm('Gerar novos valores? Se já instalou o aplicativo, mantenha os valores anteriores.'))return;
 document.querySelector('#password').value=random(16);document.querySelector('#key').value=random(32);document.querySelector('#credentials').hidden=false;
};
for(const button of document.querySelectorAll('[data-copy]'))button.onclick=async()=>{
 const field=document.getElementById(button.dataset.copy);try{await navigator.clipboard.writeText(field.value);document.querySelector('#copy-status').textContent='Copiado. Guarde no seu gerenciador de senhas.';}catch{field.type='text';field.focus();field.select();document.querySelector('#copy-status').textContent='Selecione o valor acima e use Copiar no seu navegador.';}
};
document.querySelector('#reveal').onclick=()=>{
 const show=document.querySelector('#password').type==='password';for(const id of ['password','key'])document.getElementById(id).type=show?'text':'password';document.querySelector('#reveal').textContent=show?'Ocultar valores':'Mostrar valores';
};
