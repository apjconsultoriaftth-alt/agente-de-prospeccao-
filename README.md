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
| 2 | Envio e recebimento por WhatsApp (Evolution) e Gmail, com limites diários | a fazer |
| 3 | Agente: busca no Apify, qualificação e mensagens personalizadas | a fazer |
| 4 | Cadências automáticas, classificação de respostas e métricas | a fazer |

## Como rodar (Fase 1)

1. Crie um projeto no [Supabase](https://supabase.com).
2. No SQL Editor do Supabase, rode `supabase/migrations/0001_crm_base.sql`.
3. Em Authentication > Users, crie seu usuário (e-mail e senha).
4. Copie `.env.example` para `.env.local` e preencha as chaves do Supabase.
5. `npm install` e `npm run dev`. Abra http://localhost:3000.

## Estrutura

- `supabase/migrations/` — esquema do banco (leads, mensagens, cadências, atividades, bloqueios)
- `src/app/pipeline` — funil em colunas por etapa
- `src/app/leads` — lista, busca, cadastro e detalhe do lead (conversa + linha do tempo)
- `src/app/importar` — importação CSV
- `src/lib/leads.ts` — normalização de telefone/e-mail e importação com deduplicação e checagem da lista de bloqueio

## LGPD

Toda mensagem inicial oferece a opção "responda SAIR". O opt-out (`aplicar_opt_out`) marca o lead,
cancela as cadências e adiciona telefone e e-mail à tabela `bloqueios`, que é checada em toda importação.
