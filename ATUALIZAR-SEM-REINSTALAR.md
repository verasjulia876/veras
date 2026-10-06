# Atualizar o DirectCA$H sem reinstalar

A atualização deve ser feita no repositório e no Worker que você já usa. O link do painel continua igual. As automações, fluxos, contatos, licença e conexão ficam no banco existente.

## Antes de começar

1. No painel, exporte os fluxos importantes como cópia extra.
2. Não apague o Worker nem o banco D1.
3. Não gere outra APP_KEY nem outra senha. Não desconecte o Instagram para atualizar.

## Pelo GitHub

Se o repositório já tem a ação **Atualizar DirectCA$H**:

1. Abra **seu repositório** do DirectCA$H no GitHub.
2. Toque em **Actions → Atualizar DirectCA$H → Run workflow**.
3. Escolha a branch usada pela Cloudflare (normalmente `main`) e confirme **Run workflow**.
4. Aguarde a ação ficar verde. Ela cria um commit com a atualização, preservando a configuração da sua instalação.
5. Na Cloudflare, abra **Workers e Pages → seu DirectCA$H → Builds** e aguarde o build desse novo commit terminar. A integração Git deve estar conectada à mesma branch. Se não houver build, confira essa conexão antes de continuar.
6. Abra o mesmo link do painel e recarregue. No computador, use Ctrl+F5. Confira se o Instagram continua conectado e se seus fluxos aparecem.

**Instalações antigas que ainda não têm a ação:** abra o arquivo `.github/workflows/atualizar-directcash.yml` do modelo oficial; copie seu conteúdo. No **seu** repositório, use **Add file → Create new file**, dê esse mesmo nome completo ao arquivo, cole o conteúdo e salve em **Commit changes**. Depois siga os passos acima. Em repositórios com proteção de branch, a pessoa administradora deve aprovar a alteração conforme as regras daquele repositório.

## Se você usa o kit no computador, sem GitHub

1. Guarde uma cópia da pasta atual.
2. Copie `src`, `public`, `scripts`, `migrations`, `package.json` e `package-lock.json` do kit atualizado para a pasta atual. **Preserve seu `wrangler.jsonc` e todos os arquivos de segredos.**
3. Na pasta atual, execute `npm ci`, depois `node scripts/update-config.mjs`.
4. Execute `npx wrangler login` se a sessão expirou. Confira a conta com `npx wrangler whoami`.
5. Execute `npm run deploy`. Use o mesmo Worker e o mesmo banco; este caminho não executa o assistente de nova instalação.
6. Aguarde a confirmação e recarregue seu painel.

## O que conferir depois

- Seus fluxos e automações continuam listados.
- O Instagram continua conectado e a licença aparece.
- O editor mostra busca de emojis e o tempo abaixo da mensagem.
- Fluxos antigos mantêm envio sem pausa adicional. Configure o tempo nas etapas desejadas.
- Anexos: até 10 MB por arquivo. Áudio é enviado como anexo de áudio; a ferramenta não promete o indicador “gravando” ou “digitando”.
- Os tempos são aproximados: rede, limites de envio e disponibilidade da Meta podem atrasar a entrega.

Se uma etapa de atualização falhar, guarde o erro e peça suporte antes de apagar ou reinstalar. Atualizar a página sozinha só carrega uma versão que já tenha sido publicada na sua instalação. O link de instalação é para instalações novas.
