-- CRM base do agente de prospecção
-- Foco inicial: escritórios de advocacia / advogados

create extension if not exists "pgcrypto";

-- Etapas do funil
create type lead_stage as enum (
  'novo',          -- acabou de entrar (Apify, importação, manual)
  'qualificado',   -- passou na qualificação do agente
  'contatado',     -- recebeu a primeira mensagem
  'respondeu',     -- respondeu em algum canal
  'reuniao',       -- reunião marcada
  'ganho',
  'perdido',
  'descartado'     -- fora do perfil ou pediu para sair
);

create type channel as enum ('whatsapp', 'email', 'nota');
create type direction as enum ('saida', 'entrada');
create type message_status as enum ('pendente', 'enviada', 'entregue', 'lida', 'falhou', 'recebida');

-- Leads (um escritório ou advogado)
create table leads (
  id uuid primary key default gen_random_uuid(),
  nome text not null,                 -- nome do advogado ou do escritório
  escritorio text,
  areas_atuacao text[] default '{}',  -- ex.: {trabalhista, tributário}
  oab text,                           -- número OAB, se disponível
  telefone text,                      -- formato E.164 sem +, ex.: 5511999999999
  whatsapp_valido boolean,
  email text,
  site text,
  cidade text,
  uf char(2),
  endereco text,
  avaliacao numeric(2,1),             -- nota do Google, quando vier do Maps
  total_avaliacoes int,
  origem text not null default 'manual',  -- apify:google-maps, csv, manual
  origem_id text,                         -- id externo (ex.: placeId) para evitar duplicados
  etapa lead_stage not null default 'novo',
  score int,                          -- 0-100, dado pelo agente
  motivo_score text,
  responsavel text,
  opt_out boolean not null default false,
  opt_out_em timestamptz,
  proximo_contato_em timestamptz,
  dados_brutos jsonb,                 -- payload original da fonte
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (origem, origem_id)
);

create index leads_etapa_idx on leads (etapa);
create index leads_telefone_idx on leads (telefone);
create index leads_email_idx on leads (lower(email));
create index leads_proximo_contato_idx on leads (proximo_contato_em) where opt_out = false;

-- Lista de bloqueio (LGPD): nunca contatar
create table bloqueios (
  id uuid primary key default gen_random_uuid(),
  telefone text,
  email text,
  motivo text,
  criado_em timestamptz not null default now(),
  check (telefone is not null or email is not null)
);
create unique index bloqueios_telefone_uq on bloqueios (telefone) where telefone is not null;
create unique index bloqueios_email_uq on bloqueios (lower(email)) where email is not null;

-- Mensagens trocadas (histórico de todos os canais)
create table mensagens (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  canal channel not null,
  direcao direction not null,
  assunto text,                 -- e-mail
  corpo text not null,
  status message_status not null default 'pendente',
  id_externo text,              -- id da Evolution API / Gmail
  thread_externo text,          -- threadId do Gmail
  erro text,
  passo_cadencia_id uuid,
  enviada_em timestamptz,
  criado_em timestamptz not null default now()
);
create index mensagens_lead_idx on mensagens (lead_id, criado_em desc);
create index mensagens_externo_idx on mensagens (id_externo);

-- Cadências de nutrição
create table cadencias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);

create table passos_cadencia (
  id uuid primary key default gen_random_uuid(),
  cadencia_id uuid not null references cadencias(id) on delete cascade,
  ordem int not null,
  dias_apos_anterior int not null default 0,
  canal channel not null,
  instrucao text not null,      -- instrução para o agente escrever a mensagem
  modelo text,                  -- texto base opcional com {{variaveis}}
  unique (cadencia_id, ordem)
);

alter table mensagens
  add constraint mensagens_passo_fk foreign key (passo_cadencia_id) references passos_cadencia(id) on delete set null;

create type enrollment_status as enum ('ativa', 'pausada', 'concluida', 'cancelada');

create table inscricoes_cadencia (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  cadencia_id uuid not null references cadencias(id) on delete cascade,
  status enrollment_status not null default 'ativa',
  proximo_passo int not null default 1,
  executar_em timestamptz not null default now(),
  motivo_pausa text,
  criado_em timestamptz not null default now(),
  unique (lead_id, cadencia_id)
);
create index inscricoes_fila_idx on inscricoes_cadencia (executar_em) where status = 'ativa';

-- Linha do tempo (mudança de etapa, notas, ações do agente)
create table atividades (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  tipo text not null,           -- etapa_alterada, nota, agente, opt_out, importacao
  descricao text not null,
  autor text not null default 'sistema',  -- sistema, agente, usuario
  dados jsonb,
  criado_em timestamptz not null default now()
);
create index atividades_lead_idx on atividades (lead_id, criado_em desc);

-- atualizado_em automático
create or replace function set_atualizado_em() returns trigger as $$
begin new.atualizado_em = now(); return new; end; $$ language plpgsql;

create trigger leads_atualizado_em before update on leads
for each row execute function set_atualizado_em();

-- Registrar mudança de etapa na linha do tempo
create or replace function log_mudanca_etapa() returns trigger as $$
begin
  if new.etapa is distinct from old.etapa then
    insert into atividades (lead_id, tipo, descricao, dados)
    values (new.id, 'etapa_alterada', 'Etapa: ' || old.etapa || ' → ' || new.etapa,
            jsonb_build_object('de', old.etapa, 'para', new.etapa));
  end if;
  return new;
end; $$ language plpgsql;

create trigger leads_log_etapa after update of etapa on leads
for each row execute function log_mudanca_etapa();

-- Opt-out: marca o lead, cancela cadências e adiciona à lista de bloqueio
create or replace function aplicar_opt_out(p_lead uuid, p_motivo text default 'pediu para sair')
returns void as $$
declare l leads;
begin
  update leads set opt_out = true, opt_out_em = now(), etapa = 'descartado'
  where id = p_lead returning * into l;
  update inscricoes_cadencia set status = 'cancelada', motivo_pausa = p_motivo
  where lead_id = p_lead and status in ('ativa', 'pausada');
  if l.telefone is not null then
    insert into bloqueios (telefone, motivo) values (l.telefone, p_motivo) on conflict do nothing;
  end if;
  if l.email is not null then
    insert into bloqueios (email, motivo) values (l.email, p_motivo) on conflict do nothing;
  end if;
  insert into atividades (lead_id, tipo, descricao) values (p_lead, 'opt_out', p_motivo);
end; $$ language plpgsql;

-- Segurança: só usuários logados acessam (o agente usa a service role)
alter table leads enable row level security;
alter table bloqueios enable row level security;
alter table mensagens enable row level security;
alter table cadencias enable row level security;
alter table passos_cadencia enable row level security;
alter table inscricoes_cadencia enable row level security;
alter table atividades enable row level security;

do $$
declare t text;
begin
  foreach t in array array['leads','bloqueios','mensagens','cadencias','passos_cadencia','inscricoes_cadencia','atividades'] loop
    execute format('create policy "autenticados" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Cadência inicial para advogados
insert into cadencias (id, nome, descricao) values
  ('00000000-0000-0000-0000-000000000001', 'Advogados - primeira abordagem',
   'WhatsApp no dia 0, e-mail no dia 2, follow-up no WhatsApp no dia 5, e-mail de encerramento no dia 10.');

insert into passos_cadencia (cadencia_id, ordem, dias_apos_anterior, canal, instrucao) values
  ('00000000-0000-0000-0000-000000000001', 1, 0, 'whatsapp',
   'Primeira mensagem curta e pessoal, citando a área de atuação do escritório. Uma pergunta aberta no final. Sem links. Termine com: "Se preferir não receber mensagens, responda SAIR."'),
  ('00000000-0000-0000-0000-000000000001', 2, 2, 'email',
   'E-mail de apresentação com um problema comum do nicho do escritório e como resolvemos. Assunto curto. Rodapé com opção de descadastro.'),
  ('00000000-0000-0000-0000-000000000001', 3, 3, 'whatsapp',
   'Follow-up leve retomando a primeira mensagem, oferecendo uma conversa de 15 minutos.'),
  ('00000000-0000-0000-0000-000000000001', 4, 5, 'email',
   'E-mail de encerramento educado, deixando a porta aberta.');
