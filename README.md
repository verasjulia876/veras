# DirectCA$H — versão atual

[Instalar DirectCA$H](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Frhaianebarreto%2Fdirectcash)

Inclui editor visual de fluxos, múltiplos perfis, prévia de mensagens, histórico de envios e interações, instalação como aplicativo e licença online.

## Instalação
Crie suas contas GitHub e Cloudflare. No instalador, informe ADMIN_PASSWORD e APP_KEY, mantenha a criação automática do D1 e o comando `npm run deploy`. Guarde os dois segredos. Não troque APP_KEY depois de conectar o Instagram.

Abra o endereço workers.dev, entre com sua senha e siga Configuração. Use o ID e a chave do **app do Instagram**, cadastre as URLs da sua instalação na Meta, configure as permissões e webhooks e conclua a autorização. Contas testadoras precisam aceitar o convite. Publicação e níveis de acesso da Meta continuam aplicáveis.

## Licença
A exigência vem habilitada. Ative a licença recebida após conectar o Instagram. Licenças anuais começam na primeira ativação; reconectar não reinicia o prazo. O cartão exibe titular, e-mail, vencimento e perfis vinculados ao limite. Verificações têm cache de até cinco minutos. O administrador central nunca deve compartilhar ADMIN_SECRET com alunas.

## Atualizações
As migrações são aplicadas por `npm run deploy`. Preserve os bindings, o banco e os segredos da instalação existente. Atualizar este modelo não atualiza automaticamente cópias já criadas em outros repositórios.

## Verificação
Node 22 ou superior. Execute `npm ci`, `npm run check` e `npm test`. Para desenvolvimento local, configure segredos fictícios em .dev.vars (nunca publicar esse arquivo). O wrangler.jsonc distribuído contém um ID de banco placeholder para novas instalações.

A Atividade usa “Aceito pela Meta” para confirmação da API, sem prometer entrega ou leitura. Interações anteriores não registradas não são recuperadas. Faça um teste real com outra conta antes de distribuir.
Reconectado ao Cloudflare.
