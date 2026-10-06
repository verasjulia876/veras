# Validação da edição 1.1

Verificação local em 15/09/2026.

## Executado com sucesso

- TypeScript: `npm run check` sem erros.
- Testes automatizados: palavras-chave, links seguros, regras inválidas, criptografia, HMAC, tamanho de requisição e licença online (produto, conta, validade, cache e falhas de comunicação).
- Integração com D1 no runtime local Cloudflare/Miniflare: login, cookie, proteção de origem, licença obrigatória, criação de regra, eventos repetidos/concorrrentes, ignorar conta própria e evento antigo, envio privado antes da resposta pública, pausa, resultado incerto sem reenvio automático e exclusão ao desconectar.
- Compilação Workers: `wrangler deploy --dry-run`, sem publicação. Pacote do Worker pequeno, sem framework de renderização no servidor.
- Navegador Chromium local: login, painel, criação de rascunho, configuração, licença, privacidade e tela de 390 px. Sem erros JavaScript e sem rolagem horizontal do documento.

## Ainda não validado externamente

- Criação de recursos e publicação pelo instalador em uma conta Cloudflare real.
- OAuth, assinatura da conta nos webhooks e envios reais na API da Meta.
- Renovação de token com um token real de longa duração.
- App Review/acesso ao público real de cada instalação.
- Carga e limites gratuitos sob tráfego real.

Os testes de envio usam respostas simuladas da Meta. Nenhuma mensagem foi enviada a terceiros durante a criação deste kit. O teste anterior do DirectPro não equivale a validar esta implementação nova.

Distribua às alunas depois do piloto completo na conta da responsável.

## Integração central

9 testes do DirectCA$H passaram, incluindo cache e bloqueio após sua expiração. Worker central executado em runtime Cloudflare local com D1: emissão, ativação concorrente, Instagram incorreto, suspensão, restauração, renovação, vitalícia, exclusão e isolamento das três ferramentas anteriores. A interface foi testada localmente com API simulada: quarta aba, criação, suspensão e retorno ao CA$H LOOP. Nenhuma licença real foi criada ou alterada.

## Limite de perfis por licença
Servidor central testado com quatro ativações concorrentes para duas vagas, reativação sem nova vaga, vencimento comum de 24 horas, aumento de limite, bloqueio de redução abaixo dos vínculos, suspensão e migração reaplicável. O aplicativo continua com uma conta por instalação.

## Instalação simplificada e navegador
- Windows: confirmação com Enter, migração sem pergunta extra, tentativa de abrir o painel e atalho HTML local sem senha.
- Cloudflare Deploy Button: configuração de build/deploy preparada conforme documentação oficial, incluindo D1 e segredos sem valores padrão.
- Pendente: repositório público, link real e teste completo de instalação pelo navegador/celular. Nenhuma instalação real nova foi criada nesta atualização.
