# Agente de Prospecção + CRM

CRM próprio e agente de prospecção para escritórios de advocacia.

- **Leads:** Apify (Google Maps e outras fontes)
- **WhatsApp:** Evolution API
- **E-mail:** Gmail API
- **CRM:** Next.js + Supabase (Postgres)
- **Agente:** Claude (Anthropic API) em TypeScript

## Fases

| Fase | Entrega | Status |
|------|---------|--------|
| 1 | CRM base: banco, funil, leads, importação CSV, opt-out/LGPD | pronto |
| 2 | Envio e recebimento por WhatsApp (Evolution) e Gmail, com limites diários | pronto |
| 3 | Agente: busca no Apify, qualificação e mensagens personalizadas | a fazer |
| 4 | Cadências automáticas, classificação de respostas e métricas | a fazer |

## Como rodar (Fase 1)

1. Crie um projeto no [Supabase](https://supabase.com).
2. No SQL Editor do Supabase, rode `supabase/migrations/0001_crm_base.sql`.
3. Em Authentication > Users, crie seu usuário (e-mail e senha).
4. Copie `.env.example` para `.env.local` e preencha as chaves do Supabase.
5. `npm install` e `npm run dev`. Abra http://localhost:3000.

## Configurar a Fase 2 (WhatsApp e Gmail)

1. Rode `supabase/migrations/0002_envios.sql` no SQL Editor.
2. Preencha no `.env.local` (e na hospedagem) as variáveis de `APP_URL`, segredos, Evolution e Gmail do `.env.example`.
3. **Evolution API:** na sua instância, configure o webhook
   - URL: `{APP_URL}/api/webhooks/evolution?token={EVOLUTION_WEBHOOK_TOKEN}`
   - Eventos: `MESSAGES_UPSERT` e `MESSAGES_UPDATE`
   - Exemplo: `curl -X POST "$EVOLUTION_API_URL/webhook/set/$EVOLUTION_INSTANCE" -H "apikey: $EVOLUTION_API_KEY" -H "Content-Type: application/json" -d '{"webhook":{"enabled":true,"url":"https://SEU-CRM/api/webhooks/evolution?token=SEU_TOKEN","events":["MESSAGES_UPSERT","MESSAGES_UPDATE"]}}'`
   - A Evolution precisa alcançar o CRM pela internet (o CRM deve estar publicado, ou use um túnel como ngrok em testes).
4. **Gmail:** no Google Cloud, ative a Gmail API, crie um cliente OAuth do tipo "App para computador" e rode
   `GMAIL_CLIENT_ID=... GMAIL_CLIENT_SECRET=... node scripts/gmail-token.mjs` para obter o `GMAIL_REFRESH_TOKEN`.
5. **Respostas de e-mail:** agende `GET {APP_URL}/api/jobs/gmail-sync` a cada 10-15 min com o header
   `Authorization: Bearer {CRON_SECRET}` (cron da VPS, cron-job.org ou Vercel Cron).

### Regras de envio

- Nunca envia para quem fez opt-out ou está na lista de bloqueio.
- Envios automáticos só em dias úteis, das 8h às 18h (Brasília), até `LIMITE_DIARIO_WHATSAPP` / `LIMITE_DIARIO_EMAIL` por dia.
- Envio manual pela ficha do lead ignora o horário, mas respeita bloqueio e limite.
- Resposta "SAIR" (ou parar, remover, descadastrar...) em qualquer canal aplica opt-out automático.
- Qualquer outra resposta move o lead para "Respondeu" e pausa as cadências.
- Mensagens que você responde pelo celular também entram no histórico.
- Todo e-mail sai com link de descadastro e cabeçalho `List-Unsubscribe` (exigido pelo Gmail para envio em volume).

## Estrutura

- `supabase/migrations/` — esquema do banco (leads, mensagens, cadências, atividades, bloqueios)
- `src/app/pipeline` — funil em colunas por etapa
- `src/app/leads` — lista, busca, cadastro e detalhe do lead (conversa + linha do tempo)
- `src/app/importar` — importação CSV
- `src/lib/envio.ts` — regras de envio (bloqueio, limite diário, horário)
- `src/lib/recebimento.ts` — respostas recebidas, opt-out automático
- `src/lib/canais/` — clientes da Evolution API e do Gmail
- `src/app/api/webhooks/evolution` — webhook do WhatsApp
- `src/app/api/jobs/gmail-sync` — busca respostas de e-mail
- `src/lib/leads.ts` — normalização de telefone/e-mail e importação com deduplicação e checagem da lista de bloqueio

## LGPD

Toda mensagem inicial oferece a opção "responda SAIR". O opt-out (`aplicar_opt_out`) marca o lead,
cancela as cadências e adiciona telefone e e-mail à tabela `bloqueios`, que é checada em toda importação.
