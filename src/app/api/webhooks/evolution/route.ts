import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { type EventoEvolution, numeroDoJid, textoDaMensagem, variantesNumero } from "@/lib/canais/evolution";
import { registrarRecebida } from "@/lib/recebimento";

/**
 * Webhook da Evolution API.
 * Configure na instância: URL = {APP_URL}/api/webhooks/evolution?token={EVOLUTION_WEBHOOK_TOKEN}
 * Eventos: MESSAGES_UPSERT e MESSAGES_UPDATE.
 */

const STATUS: Record<string, string> = {
  SERVER_ACK: "enviada",
  DELIVERY_ACK: "entregue",
  READ: "lida",
  PLAYED: "lida",
};

export async function POST(req: NextRequest) {
  const token = process.env.EVOLUTION_WEBHOOK_TOKEN;
  if (!token || req.nextUrl.searchParams.get("token") !== token) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const corpo = await req.json().catch(() => null);
  if (!corpo) return NextResponse.json({ erro: "json inválido" }, { status: 400 });

  const evento = String(corpo.event ?? "").toLowerCase().replace("_", ".");
  const itens: EventoEvolution[] = (Array.isArray(corpo.data) ? corpo.data : [corpo.data]).filter(Boolean);
  const db = supabaseAdmin();

  if (evento === "messages.update") {
    for (const d of itens) {
      const id = d?.keyId ?? d?.key?.id;
      const status = d?.status ? STATUS[d.status] : undefined;
      if (id && status) {
        await db.from("mensagens").update({ status }).eq("canal", "whatsapp").eq("id_externo", id).eq("direcao", "saida");
      }
    }
    return NextResponse.json({ ok: true });
  }

  if (evento !== "messages.upsert") return NextResponse.json({ ok: true, ignorado: evento });

  for (const d of itens) {
    const numero = numeroDoJid(d?.key?.remoteJid);
    const texto = textoDaMensagem(d?.message);
    const id = d?.key?.id;
    if (!numero || !texto || !id) continue;

    const { data: lead } = await db
      .from("leads")
      .select("id")
      .in("telefone", variantesNumero(numero))
      .limit(1)
      .maybeSingle();
    if (!lead) continue; // conversa que não é de um lead do CRM

    const quando = d.messageTimestamp ? new Date(Number(d.messageTimestamp) * 1000).toISOString() : undefined;

    if (d.key?.fromMe) {
      // Você respondeu pelo celular: grava no histórico (ignorado se foi o próprio CRM que enviou)
      await db.from("mensagens").upsert(
        {
          lead_id: lead.id,
          canal: "whatsapp",
          direcao: "saida",
          corpo: texto,
          status: "enviada",
          id_externo: id,
          enviada_em: quando ?? new Date().toISOString(),
        },
        { onConflict: "canal,id_externo", ignoreDuplicates: true },
      );
      continue;
    }

    await registrarRecebida(db, { leadId: lead.id, canal: "whatsapp", corpo: texto, idExterno: id, recebidaEm: quando });
  }

  return NextResponse.json({ ok: true });
}
