/**
 * Cliente Gmail via REST com OAuth (refresh token).
 * Escopos necessários: gmail.send e gmail.readonly.
 */

let cache: { token: string; expira: number } | null = null;

async function tokenAcesso(): Promise<string> {
  if (cache && cache.expira > Date.now() + 60_000) return cache.token;
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env;
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) throw new Error("Gmail não configurado (GMAIL_*)");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
      refresh_token: GMAIL_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`Gmail OAuth: ${j.error_description ?? j.error}`);
  cache = { token: j.access_token, expira: Date.now() + j.expires_in * 1000 };
  return cache.token;
}

async function api<T>(caminho: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${caminho}`, {
    ...init,
    headers: { Authorization: `Bearer ${await tokenAcesso()}`, "Content-Type": "application/json", ...init?.headers },
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`Gmail ${res.status}: ${j.error?.message ?? ""}`);
  return j as T;
}

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");
const cabecalhoUtf8 = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s).toString("base64")}?=`);

export type EmailEnvio = {
  para: string;
  assunto: string;
  texto: string;
  linkDescadastro?: string;
  threadId?: string;
  emRespostaA?: string; // Message-ID do e-mail anterior, para manter a conversa
};

/** Monta a mensagem MIME (texto puro). Exportado para teste. */
export function montarMime(e: EmailEnvio, de: string): string {
  const corpo = e.linkDescadastro
    ? `${e.texto}\n\n--\nNão quer mais receber nossos e-mails? ${e.linkDescadastro}`
    : e.texto;
  const h = [
    `From: ${de}`,
    `To: ${e.para}`,
    `Subject: ${cabecalhoUtf8(e.assunto)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
  ];
  if (e.linkDescadastro) {
    h.push(`List-Unsubscribe: <${e.linkDescadastro}>`, "List-Unsubscribe-Post: List-Unsubscribe=One-Click");
  }
  if (e.emRespostaA) h.push(`In-Reply-To: ${e.emRespostaA}`, `References: ${e.emRespostaA}`);
  return `${h.join("\r\n")}\r\n\r\n${Buffer.from(corpo).toString("base64").replace(/.{76}/g, "$&\r\n")}`;
}

export async function enviarEmail(e: EmailEnvio): Promise<{ id: string; threadId: string }> {
  const de = process.env.GMAIL_FROM;
  if (!de) throw new Error("GMAIL_FROM não configurado");
  return api("/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw: b64url(montarMime(e, de)), threadId: e.threadId }),
  });
}

type Parte = { mimeType?: string; body?: { data?: string }; parts?: Parte[] };
export type MsgGmail = {
  id: string;
  threadId: string;
  internalDate: string;
  labelIds?: string[];
  payload: Parte & { headers: { name: string; value: string }[] };
};

export async function lerThread(threadId: string): Promise<MsgGmail[]> {
  const t = await api<{ messages: MsgGmail[] }>(`/threads/${threadId}?format=full`);
  return t.messages ?? [];
}

export function cabecalho(m: MsgGmail, nome: string) {
  return m.payload.headers.find((h) => h.name.toLowerCase() === nome.toLowerCase())?.value ?? null;
}

/** Texto puro do e-mail, sem o histórico citado. */
export function textoDoEmail(m: MsgGmail): string {
  const achar = (p: Parte): string | null => {
    if (p.mimeType === "text/plain" && p.body?.data) return Buffer.from(p.body.data, "base64url").toString("utf8");
    for (const f of p.parts ?? []) {
      const t = achar(f);
      if (t) return t;
    }
    return null;
  };
  const bruto = achar(m.payload) ?? "";
  const linhas = [];
  for (const l of bruto.split(/\r?\n/)) {
    if (/^(Em .+ escreveu:|On .+ wrote:)$/.test(l.trim()) || l.startsWith(">")) break;
    linhas.push(l);
  }
  return linhas.join("\n").trim();
}
