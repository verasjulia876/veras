# Instalar pelo celular ou pelo navegador

## Disponibilidade

O kit está preparado para o botão oficial Deploy to Cloudflare. A responsável precisa publicar o repositório público e configurar o link antes de distribuí-lo. O botão não está ativo enquanto isso não acontecer.

## Para a aluna

1. Abra o link de instalação publicado pelo Creator IA Club no navegador (Chrome ou Safari, por exemplo).
2. Tenha uma conta Cloudflare e uma conta GitHub. Autorize somente suas próprias contas.
3. Na página de instalação do Club, use **Gerar meu acesso** e guarde a senha do painel e a chave de proteção no gerenciador de senhas. Se estiver usando diretamente o botão no GitHub, gere duas senhas aleatórias no seu gerenciador: ADMIN_PASSWORD com 16 caracteres ou mais e APP_KEY com 32 caracteres ou mais.
4. Toque **Instalar meu DirectCA$H** e siga as autorizações. Escolha um nome para o aplicativo e mantenha a criação automática do banco.
5. Preencha ADMIN_PASSWORD e APP_KEY com seus valores privados. Não use a licença do Club como senha nem chave.
6. Mantenha o comando de publicação **npm run deploy**. Ele cria as tabelas e publica o painel. Aguarde a conclusão e abra o endereço workers.dev exibido.
7. Entre com sua senha, configure a Meta, conecte o Instagram e cole sua licença do Club.

Se uma tela externa não couber no celular, use a opção **Versão para computador** do navegador. O fluxo externo precisa ser testado no aparelho antes de distribuir a instalação para a turma.

Cada instalação mantém um perfil. Para outro perfil simultâneo, repita o processo com outro nome de Worker e outro banco, usando a mesma licença até o limite permitido.

A instalação não ativa planos pagos, mas as cotas Cloudflare continuam se aplicando. A configuração e as autorizações da Meta continuam necessárias.

## Para a responsável: habilitar o botão uma vez

1. Crie sua conta no GitHub e um repositório público para o DirectCA$H. O código ficará visível; os segredos devem ficar exclusivamente na Cloudflare de cada aluna.
2. Use uma cópia limpa do kit, nunca a pasta já instalada. Ela deve estar sem .dev.vars, .install-secrets.json, node_modules, .wrangler e sem os dados privados do seu banco.
3. Configure o link na cópia limpa com `npm run configure:browser -- https://github.com/SUA-CONTA/SEU-REPOSITORIO`.
4. Publique o conteúdo do kit na raiz do repositório. O arquivo .dev.vars.example deve permanecer com valores vazios: a Cloudflare solicitará os segredos na instalação.
5. Teste o botão **Instalar meu DirectCA$H** exibido no README do GitHub com uma instalação nova. Confirme que o banco foi criado, a publicação concluiu e o login funciona. Teste também pelo celular.
6. Depois, distribua o link do botão ou a página `/instalar.html` da sua instalação atualizada. Essa página orienta a aluna e permite gerar os dois valores privados no navegador.

Não faça upload do ZIP inteiro como um único arquivo no GitHub: o código precisa estar extraído na raiz. Não publique arquivos do painel administrativo de licenças.

Documentação oficial: https://developers.cloudflare.com/workers/platform/deploy-buttons/
