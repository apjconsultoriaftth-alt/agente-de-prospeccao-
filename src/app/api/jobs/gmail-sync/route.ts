import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cabecalho, lerThread, textoDoEmail } from "@/lib/canais/gmail";
import { registrarRecebida } from "@/lib/recebimento";

/**
 * Busca respostas de e-mail nas conversas iniciadas pelo CRM (últimos 30 dias).
 * Agende a cada 10-15 min chamando GET com header "Authorization: Bearer {CRON_SECRET}".
 */
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }
  const db = supabaseAdmin();
  const desde = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data, error } = await db
    .from("mensagens")
    .select("lead_id,thread_externo")
    .eq("canal", "email")
    .eq("direcao", "saida")
    .not("thread_externo", "is", null)
    .gte("enviada_em", desde);
  if (error) throw error;

  const threads = new Map(data.map((m) => [m.thread_externo as string, m.lead_id as string]));
  const meuEmail = (process.env.GMAIL_FROM ?? "").toLowerCase().match(/[^<\s]+@[^>\s]+/)?.[0] ?? "";
  let novas = 0;
  const erros: string[] = [];

  for (const [threadId, leadId] of threads) {
    try {
      for (const m of await lerThread(threadId)) {
        if (m.labelIds?.includes("SENT")) continue;
        const de = (cabecalho(m, "From") ?? "").toLowerCase();
        if (meuEmail && de.includes(meuEmail)) continue;
        const ok = await registrarRecebida(db, {
          leadId,
          canal: "email",
          corpo: textoDoEmail(m) || "(e-mail sem texto)",
          assunto: cabecalho(m, "Subject"),
          idExterno: m.id,
          threadExterno: threadId,
          recebidaEm: new Date(Number(m.internalDate)).toISOString(),
        });
        if (ok) novas++;
      }
    } catch (e) {
      erros.push(`${threadId}: ${e instanceof Error ? e.message : e}`);
    }
  }
  return NextResponse.json({ threads: threads.size, novas, erros });
}
