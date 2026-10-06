# Atualização: blocos e próximo post

Implementada e testada localmente. Ainda não publicada no GitHub ou Cloudflare.

## Como usar

- **Duplicar:** no bloco, clique em Duplicar (ou Duplicar bloco no inspector). A cópia mantém textos, mídias, botões, tempos e destinos, com identificação própria. Conecte a cópia ao caminho desejado em Ver mapa antes de salvar. Editar a cópia não altera o original.
- **Emojis:** clique em 😊 Emojis junto ao texto do botão. O limite de texto é verificado ao salvar, considerando os caracteres Unicode.
- **Horas:** no bloco Espera, escolha Horas no campo Unidade. O limite existente de 23 horas foi mantido. As esperas já salvas continuam funcionando.
- **Automatizar próximo post:** em Automações ou Fluxos, selecione o canal Comentário, marque Automatizar próximo post e salve com a automação ativa antes de publicar. A primeira publicação ou Reel posterior ao salvamento será vinculada automaticamente. O vínculo permanece nessa publicação. Stories não entram nessa seleção.

O próximo post é consultado na rotina existente de manutenção (a cada 5 minutos) e ao receber uma interação. A disponibilidade depende de a Meta disponibilizar a publicação pela API. Não houve teste de publicação ou envio em uma conta real; os testes usaram respostas simuladas da Meta.

## Implantar pelo GitHub

1. Extraia o ZIP desta atualização. Ele contém as pastas `public` e `src`.
2. No repositório conectado ao seu Worker, atualize os arquivos nas mesmas pastas. Mescle as pastas, preservando os demais arquivos do projeto.
3. Confirme o commit na branch usada pelo Cloudflare.
4. No Cloudflare, acompanhe o build desse commit até concluir. Só depois abra o painel atualizado.

É necessário publicar tanto `public` quanto `src`: a interface e a vinculação automática trabalham juntas. O pacote não altera senhas, tokens, banco ou configuração da instalação. Não exige nova migração D1.

## Arquivos da atualização

public/block-updates.js (novo)
public/index.html
public/editor-upgrade.js
public/guided-editor.js
public/simple-flow.js
public/visual-map.js
src/next-post.ts (novo)
src/core.ts
src/flow.ts
src/index.ts
src/map.ts
src/meta.ts

## Verificações

- TypeScript: sem erros.
- 14 testes automatizados: aprovados (validação, botões, tempos e vínculo automático).
- Navegador Chrome: duplicação independente, inclusão de emoji, horas nos dois modos do editor, opção de próximo post, largura de celular e ausência de erros JavaScript.
