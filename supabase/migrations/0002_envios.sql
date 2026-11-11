-- Fase 2: envio e recebimento (WhatsApp via Evolution API e Gmail)

-- Evita gravar a mesma mensagem recebida duas vezes (webhook reenviado, sync repetido)
-- (constraint completa, não índice parcial, para o upsert do PostgREST funcionar; NULLs não conflitam)
alter table mensagens add constraint mensagens_canal_externo_uq unique (canal, id_externo);
create index mensagens_envios_hoje_idx on mensagens (canal, enviada_em) where direcao = 'saida';
create index mensagens_thread_idx on mensagens (thread_externo) where thread_externo is not null;

-- Registra resposta do lead: muda etapa e pausa cadências ativas
create or replace function registrar_resposta(p_lead uuid) returns void as $$
begin
  update leads set etapa = 'respondeu'
  where id = p_lead and etapa in ('novo', 'qualificado', 'contatado');
  update inscricoes_cadencia set status = 'pausada', motivo_pausa = 'lead respondeu'
  where lead_id = p_lead and status = 'ativa';
end; $$ language plpgsql;
