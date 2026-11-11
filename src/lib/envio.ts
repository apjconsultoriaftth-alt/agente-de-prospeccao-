import type { SupabaseClient } from "@supabase/supabase-js";
import { enviarWhatsapp } from "./canais/evolution";
import { enviarEmail } from "./canais/gmail";
import { linkDescadastro } from "./descadastro";

/**
 * Regras de envio, iguais para o agente, as cadências e o envio manual:
 * - nunca envia para opt-out ou contato na lista de bloqueio
 * - respeita limite diário por canal (protege o número e o domínio)
 * - só envia em horário comercial (seg-sex, 8h-18h, horário de Brasília), exceto envio manual
 */

export const LIMITES = {
  whatsapp: Number(process.env.LIMITE_DIARIO_WHATSAPP ?? 30),
  email: Number(process.env.LIMITE_DIARIO_EMAIL ?? 80),
};

export type Canal = "whatsapp" | "email";

export type PedidoEnvio = {
  leadId: string;
  canal: Canal;
  corpo: string;
  assunto?: string;
  passoCadenciaId?: string;
  manual?: boolean; // envio feito por você no CRM: ignora horário, mas não ignora bloqueio
  autor?: "agente" | "usuario" | "cadencia";
};

export type ResultadoEnvio =
  | { ok: true; mensagemId: string }
  | { ok: false; motivo: "opt_out" | "bloqueado" | "sem_contato" | "limite_diario" | "fora_do_horario" | "erro"; detalhe?: string };

export function dentroDoHorario(agora = new Date()): boolean {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(agora);
  const dia = partes.find((p) => p.type === "weekday")?.value;
  const hora = Number(partes.find((p) => p.type === "hour")?.value);
  return dia !== "Sat" && dia !== "Sun" && hora >= 8 && hora < 18;
}

function inicioDoDiaBrasilia(agora = new Date()) {
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora); // AAAA-MM-DD
  return new Date(`${d}T00:00:00-03:00`).toISOString();
}

export async function enviosHoje(db: SupabaseClient, canal: Canal): Promise<number> {
  const { count, error } = await db
    .from("mensagens")
    .select("id", { count: "exact", head: true })
    .eq("canal", canal)
    .eq("direcao", "saida")
    .in("status", ["enviada", "entregue", "lida"])
    .gte("enviada_em", inicioDoDiaBrasilia());
  if (error) throw error;
  return count ?? 0;
}

export async function enviar(db: SupabaseClient, p: PedidoEnvio): Promise<ResultadoEnvio> {
  const { data: lead, error } = await db
    .from("leads")
    .select("id,nome,telefone,email,opt_out,etapa")
    .eq("id", p.leadId)
    .single();
  if (error) throw error;

  if (lead.opt_out) return { ok: false, motivo: "opt_out" };
  const destino = p.canal === "whatsapp" ? lead.telefone : lead.email;
  if (!destino) return { ok: false, motivo: "sem_contato" };

  const campo = p.canal === "whatsapp" ? "telefone" : "email";
  const { count: bloq } = await db.from("bloqueios").select("id", { count: "exact", head: true }).eq(campo, destino);
  if (bloq) return { ok: false, motivo: "bloqueado" };

  if (!p.manual && !dentroDoHorario()) return { ok: false, motivo: "fora_do_horario" };
  if ((await enviosHoje(db, p.canal)) >= LIMITES[p.canal]) return { ok: false, motivo: "limite_diario" };

  // Para e-mail, continua na mesma conversa se já houver uma
  let threadId: string | undefined;
  let assunto = p.assunto ?? "";
  if (p.canal === "email") {
    const { data: ult } = await db
      .from("mensagens")
      .select("thread_externo,assunto")
      .eq("lead_id", p.leadId)
      .eq("canal", "email")
      .not("thread_externo", "is", null)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    threadId = ult?.thread_externo ?? undefined;
    if (!assunto && ult?.assunto) assunto = ult.assunto.startsWith("Re:") ? ult.assunto : `Re: ${ult.assunto}`;
    if (!assunto) assunto = "Contato";
  }

  const { data: msg, error: e1 } = await db
    .from("mensagens")
    .insert({
      lead_id: p.leadId,
      canal: p.canal,
      direcao: "saida",
      assunto: p.canal === "email" ? assunto : null,
      corpo: p.corpo,
      status: "pendente",
      passo_cadencia_id: p.passoCadenciaId ?? null,
    })
    .select("id")
    .single();
  if (e1) throw e1;

  try {
    let idExterno: string;
    let thread: string | null = null;
    if (p.canal === "whatsapp") {
      idExterno = await enviarWhatsapp(destino, p.corpo);
    } else {
      const r = await enviarEmail({
        para: destino,
        assunto,
        texto: p.corpo,
        threadId,
        linkDescadastro: linkDescadastro(p.leadId),
      });
      idExterno = r.id;
      thread = r.threadId;
    }
    await db
      .from("mensagens")
      .update({ status: "enviada", id_externo: idExterno || null, thread_externo: thread, enviada_em: new Date().toISOString() })
      .eq("id", msg.id);
    if (["novo", "qualificado"].includes(lead.etapa)) {
      await db.from("leads").update({ etapa: "contatado" }).eq("id", p.leadId);
    }
    await db.from("atividades").insert({
      lead_id: p.leadId,
      tipo: "mensagem_enviada",
      descricao: `${p.canal === "whatsapp" ? "WhatsApp" : "E-mail"} enviado`,
      autor: p.autor ?? (p.manual ? "usuario" : "sistema"),
    });
    return { ok: true, mensagemId: msg.id };
  } catch (err) {
    const detalhe = err instanceof Error ? err.message : String(err);
    await db.from("mensagens").update({ status: "falhou", erro: detalhe }).eq("id", msg.id);
    return { ok: false, motivo: "erro", detalhe };
  }
}
