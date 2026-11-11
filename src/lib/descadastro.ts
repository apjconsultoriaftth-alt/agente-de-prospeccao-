import { createHmac, timingSafeEqual } from "node:crypto";

const segredo = () => {
  const s = process.env.DESCADASTRO_SECRET;
  if (!s) throw new Error("DESCADASTRO_SECRET não configurado");
  return s;
};

const assinar = (leadId: string) => createHmac("sha256", segredo()).update(leadId).digest("base64url").slice(0, 32);

export function linkDescadastro(leadId: string) {
  const base = process.env.APP_URL?.replace(/\/$/, "");
  if (!base) throw new Error("APP_URL não configurado");
  return `${base}/api/publico/descadastro?id=${leadId}&t=${assinar(leadId)}`;
}

export function tokenValido(leadId: string, token: string) {
  const a = Buffer.from(assinar(leadId));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
