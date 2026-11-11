import type { SupabaseClient } from "@supabase/supabase-js";

const PALAVRAS_SAIR = /^\s*(sair|parar|pare|stop|cancelar|descadastrar|remover|n[aã]o quero( mais)?( receber)?)\s*[.!]*\s*$/i;

/** O lead pediu para sair? Só considera mensagens curtas, para não confundir com conversa. */
export function pediuParaSair(texto: string) {
  return PALAVRAS_SAIR.test(texto);
}

export type Recebida = {
  leadId: string;
  canal: "whatsapp" | "email";
  corpo: string;
  idExterno: string;
  threadExterno?: string | null;
  assunto?: string | null;
  recebidaEm?: string;
};

/**
 * Grava a mensagem recebida e aplica as regras:
 * "SAIR" -> opt-out + bloqueio; qualquer outra resposta -> etapa "respondeu" e cadências pausadas.
 * Retorna false se a mensagem já tinha sido gravada.
 */
export async function registrarRecebida(db: SupabaseClient, r: Recebida): Promise<boolean> {
  const { error } = await db.from("mensagens").insert({
    lead_id: r.leadId,
    canal: r.canal,
    direcao: "entrada",
    corpo: r.corpo,
    assunto: r.assunto ?? null,
    status: "recebida",
    id_externo: r.idExterno,
    thread_externo: r.threadExterno ?? null,
    enviada_em: r.recebidaEm ?? new Date().toISOString(),
  });
  if (error) {
    if (error.code === "23505") return false; // duplicada
    throw error;
  }

  if (pediuParaSair(r.corpo)) {
    await db.rpc("aplicar_opt_out", { p_lead: r.leadId, p_motivo: `pediu para sair (${r.canal})` });
  } else {
    await db.rpc("registrar_resposta", { p_lead: r.leadId });
    await db.from("atividades").insert({
      lead_id: r.leadId,
      tipo: "resposta",
      descricao: `Respondeu por ${r.canal === "whatsapp" ? "WhatsApp" : "e-mail"}`,
    });
  }
  return true;
}
