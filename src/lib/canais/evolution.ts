/**
 * Cliente da Evolution API (v2) para WhatsApp.
 * Docs: https://doc.evolution-api.com
 */

function cfg() {
  const url = process.env.EVOLUTION_API_URL?.replace(/\/$/, "");
  const key = process.env.EVOLUTION_API_KEY;
  const instancia = process.env.EVOLUTION_INSTANCE;
  if (!url || !key || !instancia) throw new Error("Evolution API não configurada (EVOLUTION_API_URL/KEY/INSTANCE)");
  return { url, key, instancia: encodeURIComponent(instancia) };
}

async function chamar<T>(caminho: string, corpo: unknown): Promise<T> {
  const { url, key } = cfg();
  const res = await fetch(`${url}${caminho}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key },
    body: JSON.stringify(corpo),
  });
  const texto = await res.text();
  if (!res.ok) throw new Error(`Evolution ${res.status}: ${texto.slice(0, 300)}`);
  return (texto ? JSON.parse(texto) : {}) as T;
}

/** Envia texto. `numero` em E.164 sem "+", ex.: 5511999999999. Retorna o id da mensagem. */
export async function enviarWhatsapp(numero: string, texto: string): Promise<string> {
  const { instancia } = cfg();
  const r = await chamar<{ key?: { id?: string } }>(`/message/sendText/${instancia}`, {
    number: numero,
    text: texto,
    delay: 1200, // mostra "digitando..." antes de enviar
  });
  return r.key?.id ?? "";
}

/** Verifica quais números têm WhatsApp. Retorna mapa numero -> existe. */
export async function verificarWhatsapp(numeros: string[]): Promise<Record<string, boolean>> {
  const { instancia } = cfg();
  const r = await chamar<{ number: string; exists: boolean }[]>(`/chat/whatsappNumbers/${instancia}`, { numbers: numeros });
  return Object.fromEntries(r.map((x) => [x.number.replace(/\D/g, ""), x.exists]));
}

/** Extrai o número de um JID (5511999999999@s.whatsapp.net). Grupos retornam null. */
export function numeroDoJid(jid: string | undefined): string | null {
  if (!jid || !jid.endsWith("@s.whatsapp.net")) return null;
  return jid.split("@")[0].split(":")[0];
}

type ConteudoWhatsapp = {
  conversation?: string;
  extendedTextMessage?: { text?: string };
  imageMessage?: { caption?: string };
  videoMessage?: { caption?: string };
  documentMessage?: { caption?: string };
  audioMessage?: unknown;
};

/** Item do evento MESSAGES_UPSERT / MESSAGES_UPDATE da Evolution API v2. */
export type EventoEvolution = {
  key?: { remoteJid?: string; fromMe?: boolean; id?: string };
  keyId?: string;
  status?: string;
  message?: ConteudoWhatsapp;
  messageTimestamp?: number | string;
};

/** Texto de uma mensagem recebida (texto simples, texto estendido ou legenda de mídia). */
export function textoDaMensagem(m: ConteudoWhatsapp | undefined): string | null {
  if (!m) return null;
  return (
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.imageMessage?.caption ??
    m.videoMessage?.caption ??
    m.documentMessage?.caption ??
    (m.audioMessage ? "[áudio]" : null) ??
    (m.imageMessage ? "[imagem]" : null) ??
    null
  );
}

/** Variantes do número BR com e sem o 9º dígito (WhatsApp às vezes devolve sem). */
export function variantesNumero(n: string): string[] {
  const v = new Set([n]);
  if (n.startsWith("55") && n.length === 13 && n[4] === "9") v.add(n.slice(0, 4) + n.slice(5));
  if (n.startsWith("55") && n.length === 12) v.add(n.slice(0, 4) + "9" + n.slice(4));
  return [...v];
}
