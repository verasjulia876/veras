# Atualização DirectCA$H — passo a passo para alunas

**Código da atualização: `editor-2026-10-02`**

Inclui duplicação de blocos, emojis nos botões, espera em horas e Automatizar próximo post.

## 1. Preparar o botão de atualização (uma vez)

1. Abra seu repositório do DirectCA$H no GitHub.
2. Abra o arquivo `.github/workflows/atualizar-directcash.yml` e clique no lápis para editar.
3. Copie todo o [código de atualização oficial](https://github.com/rhaianebarreto/directcash/blob/editor-2026-10-02/.github/workflows/atualizar-directcash.yml), substitua o conteúdo do seu arquivo e confirme em **Commit changes**.

Se esse arquivo não existir: **Add file → Create new file**, escreva o nome completo `.github/workflows/atualizar-directcash.yml`, cole o mesmo conteúdo e confirme.

Se você já instalou a revisão `editor-2026-09-25-r2` com o código de atualização daquela revisão, pode pular essa preparação. Nas versões anteriores, substitua o arquivo conforme acima para aceitar o código com `-r10`.

## 2. Aplicar a atualização

1. No seu repositório, abra **Actions → Atualizar DirectCA$H → Run workflow**.
2. Escolha a branch conectada à Cloudflare (geralmente **main**).
3. No campo do código, coloque **editor-2026-10-02** e confirme **Run workflow**.
4. Aguarde a execução ficar verde.
5. Na sua Cloudflare, abra **Workers e Pages → seu painel → Builds** e aguarde o build desse novo commit terminar com sucesso.
6. Abra o mesmo endereço do seu painel e recarregue.

Para conferir a versão, acrescente `/version.json` ao endereço do painel. Deve aparecer `editor-2026-10-02`.

Se o build não começar: confira em **Configurações → Builds** se o repositório e a branch são os mesmos usados acima. O comando de implantação desta versão é `npm run deploy`. Uma execução verde no GitHub, sozinha, não confirma a publicação na Cloudflare.

**Não precisa reinstalar, criar outro banco ou reconectar o Instagram. Preserve seu Worker, banco, APP_KEY, senha e demais configurações. Cada aluna atualiza sua própria instalação.**

## Usar as novidades

- **Duplicar:** clique em Duplicar no bloco. Conecte a cópia no mapa antes de salvar.
- **Emojis:** clique em 😊 Emojis junto ao texto do botão.
- **Horas:** no bloco Espera, selecione a unidade Horas (até 23 horas).
- **Próximo post:** marque Automatizar próximo post e salve com a automação ativa antes de publicar. Ela aguardará o primeiro post ou Reel publicado após salvar, no perfil selecionado.

## Novidade desta revisão: ação dos botões

1. Abra Fluxos e edite o bloco de mensagem.
2. Em Botões desta mensagem, preencha o texto e escolha Ao clicar.
3. Escolha Ir para o próximo passo e selecione o bloco de destino, ou Abrir um link e cole o endereço HTTPS.
4. Salve o fluxo.

Você pode combinar as duas ações em uma mensagem de até três botões. Botões de link abrem o endereço; não acionam outro passo do fluxo. Quando a mensagem tem somente botões de link, use Continuar após esta mensagem ou a bolinha dourada da caixa no mapa. Ao trocar a única resposta por link, sua conexão é preservada como continuação do bloco. Se há várias respostas com caminhos diferentes, adicione o link como outro botão para preservar esses caminhos.

## Conectar qualquer caixa

Toda caixa tem uma bolinha dourada no canto inferior direito, sem texto. Arraste essa bolinha até a entrada da próxima caixa e salve.

Sem botões de resposta, o fluxo segue essa conexão. Com botões de resposta, ela funciona como destino comum para as respostas sem caminho próprio; as respostas com destino próprio mantêm seu caminho. Botões de link continuam abrindo o endereço.

## Backup, ordem dos botões e verificação de seguidores

- **Backup:** em Configurações → Backup de fluxos e automações, clique em Exportar backup para baixar um JSON com os dois tipos do perfil atual. Para restaurar, clique em Importar backup, escolha o JSON e confirme. São criadas cópias pausadas, sem substituir as existentes. Revise e ative quando estiverem prontas. O backup guarda configurações e links dos anexos; não copia os arquivos de mídia nem senhas ou contatos.
- **Ordem dos botões:** edite a mensagem e use Subir ou Descer junto a cada botão. O texto, o link e o destino se movem juntos. Salve o fluxo.
- **Seguir antes de entregar:** adicione Só para quem segue, configure o texto e o botão de verificação. No mapa, defina essa caixa como início ou ligue o início a ela. Conecte sua bolinha à entrega e salve o fluxo ativo. A pessoa recebe Ver perfil e Já segui (ou seu texto personalizado). O clique consulta a Meta e só libera a próxima etapa se a resposta confirmar que segue. Se não for possível verificar, a pessoa pode tentar novamente; o conteúdo fica bloqueado. Em automações simples, marque a condição de seguir e desative as boas-vindas se quiser começar diretamente por ela.
- **Palavras-chave:** QUERO, Quero e quero são equivalentes em comentários, Direct e stories, tanto em fluxos quanto em automações. Não cadastre as três variações.

A verificação real depende de a Meta disponibilizar essa informação e das permissões da conta conectada. Os testes automatizados simulam essas respostas; após atualizar, teste a etapa com outro perfil antes de usar em uma campanha.

## Excluir vários itens

Abra Fluxos ou Automações, marque os itens desejados (ou Selecionar todos os exibidos) e clique em Excluir selecionados. Confira os nomes na confirmação e confirme apenas os itens que deseja apagar. A exclusão é permanente. Os envios ainda pendentes desses itens são cancelados; mensagens já enviadas não são apagadas do Instagram. O backup fica em Configurações.

## Sem limite fixo de 30 itens

Esta versão remove o limite de 30 fluxos e automações salvos por perfil, incluindo importação de backups e exclusão em massa. Os itens existentes são preservados. O limite de tamanho dos arquivos de backup e os limites de uso da infraestrutura continuam valendo.

A fila também deixa de parar por uma contagem local de 60 envios/hora. Quando a Meta informa limite de requisições, o envio recusado permanece na fila e é tentado novamente após uma pausa. Erros com resultado incerto não são reenviados automaticamente. Isso não elimina limites e permissões definidos pela Meta ou pela Cloudflare.
