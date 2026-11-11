import type { SupabaseClient } from "@supabase/supabase-js";

/** Normaliza telefone brasileiro para E.164 sem "+": 55 + DDD + número. */
export function normalizarTelefone(bruto: string | null | undefined): string | null {
  if (!bruto) return null;
  let d = bruto.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1); // 0 de operadora/DDD
  if (d.length === 10 || d.length === 11) d = "55" + d;
  if (!d.startsWith("55") || d.length < 12 || d.length > 13) return null;
  return d;
}

export function normalizarEmail(bruto: string | null | undefined): string | null {
  const e = bruto?.trim().toLowerCase();
  return e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

export type NovoLead = {
  nome: string;
  escritorio?: string | null;
  areas_atuacao?: string[];
  oab?: string | null;
  telefone?: string | null;
  email?: string | null;
  site?: string | null;
  cidade?: string | null;
  uf?: string | null;
  endereco?: string | null;
  avaliacao?: number | null;
  total_avaliacoes?: number | null;
  origem: string;
  origem_id?: string | null;
  dados_brutos?: unknown;
};

export type ResultadoImportacao = { inseridos: number; duplicados: number; bloqueados: number; invalidos: number };

/**
 * Insere leads ignorando: sem nome/contato, bloqueados (LGPD) e duplicados
 * (mesmo telefone, e-mail ou origem_id). Usado pela importação CSV e pelo Apify.
 */
export async function importarLeads(db: SupabaseClient, entrada: NovoLead[]): Promise<ResultadoImportacao> {
  const r: ResultadoImportacao = { inseridos: 0, duplicados: 0, bloqueados: 0, invalidos: 0 };

  const limpos = entrada
    .map((l) => ({
      ...l,
      nome: l.nome?.trim(),
      telefone: normalizarTelefone(l.telefone),
      email: normalizarEmail(l.email),
      uf: l.uf?.trim().toUpperCase().slice(0, 2) || null,
    }))
    .filter((l) => {
      const ok = !!l.nome && (!!l.telefone || !!l.email);
      if (!ok) r.invalidos++;
      return ok;
    });
  if (!limpos.length) return r;

  const telefones = limpos.map((l) => l.telefone).filter(Boolean) as string[];
  const emails = limpos.map((l) => l.email).filter(Boolean) as string[];

  const [bloq, existentes] = await Promise.all([
    db.from("bloqueios").select("telefone,email").or(filtroOr(telefones, emails)),
    db.from("leads").select("telefone,email,origem,origem_id").or(filtroOr(telefones, emails)),
  ]);
  if (bloq.error) throw bloq.error;
  if (existentes.error) throw existentes.error;

  const bloqueados = new Set(bloq.data.flatMap((b) => [b.telefone, b.email?.toLowerCase()]).filter(Boolean));
  const vistos = new Set(existentes.data.flatMap((e) => [e.telefone, e.email?.toLowerCase()]).filter(Boolean));

  const novos = [];
  for (const l of limpos) {
    if ((l.telefone && bloqueados.has(l.telefone)) || (l.email && bloqueados.has(l.email))) {
      r.bloqueados++;
      continue;
    }
    if ((l.telefone && vistos.has(l.telefone)) || (l.email && vistos.has(l.email))) {
      r.duplicados++;
      continue;
    }
    if (l.telefone) vistos.add(l.telefone);
    if (l.email) vistos.add(l.email);
    novos.push(l);
  }

  for (let i = 0; i < novos.length; i += 500) {
    const lote = novos.slice(i, i + 500);
    const { data, error } = await db
      .from("leads")
      .upsert(lote, { onConflict: "origem,origem_id", ignoreDuplicates: true })
      .select("id,origem");
    if (error) throw error;
    r.inseridos += data.length;
    r.duplicados += lote.length - data.length;
    if (data.length) {
      await db.from("atividades").insert(
        data.map((d) => ({ lead_id: d.id, tipo: "importacao", descricao: `Lead importado (${d.origem})` })),
      );
    }
  }
  return r;
}

function filtroOr(telefones: string[], emails: string[]) {
  const partes = [];
  if (telefones.length) partes.push(`telefone.in.(${telefones.join(",")})`);
  if (emails.length) partes.push(`email.in.(${emails.map((e) => `"${e}"`).join(",")})`);
  return partes.join(",") || "id.is.null";
}
