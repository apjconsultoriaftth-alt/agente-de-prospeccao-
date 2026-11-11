import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { ETAPAS, ROTULO_ETAPA, type Etapa, type Lead } from "@/lib/types";
import { NovoLeadForm } from "./novo-lead-form";

export const dynamic = "force-dynamic";

export default async function Leads({ searchParams }: { searchParams: Promise<{ q?: string; etapa?: string }> }) {
  const { q, etapa } = await searchParams;
  const db = await supabaseServer();
  let query = db.from("leads").select("*").order("criado_em", { ascending: false }).limit(200);
  if (etapa && ETAPAS.includes(etapa as Etapa)) query = query.eq("etapa", etapa);
  if (q) {
    const termo = q.replace(/[%,()]/g, " ");
    query = query.or(`nome.ilike.%${termo}%,escritorio.ilike.%${termo}%,cidade.ilike.%${termo}%,email.ilike.%${termo}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  const leads = data as Lead[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-xl font-semibold">Leads</h1>
        <form className="flex gap-2 text-sm">
          <input name="q" defaultValue={q} placeholder="Buscar nome, cidade, e-mail" className="rounded border px-3 py-1.5" />
          <select name="etapa" defaultValue={etapa ?? ""} className="rounded border px-2 py-1.5">
            <option value="">Todas as etapas</option>
            {ETAPAS.map((e) => (
              <option key={e} value={e}>{ROTULO_ETAPA[e]}</option>
            ))}
          </select>
          <button className="rounded bg-slate-900 px-3 py-1.5 text-white">Filtrar</button>
        </form>
      </div>

      <NovoLeadForm />

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="p-2">Nome / Escritório</th>
              <th className="p-2">Áreas</th>
              <th className="p-2">Cidade</th>
              <th className="p-2">Contato</th>
              <th className="p-2">Etapa</th>
              <th className="p-2">Score</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-t hover:bg-slate-50">
                <td className="p-2">
                  <Link href={`/leads/${l.id}`} className="font-medium hover:underline">{l.nome}</Link>
                  {l.escritorio && <div className="text-xs text-slate-500">{l.escritorio}</div>}
                </td>
                <td className="p-2 text-xs">{l.areas_atuacao?.join(", ")}</td>
                <td className="p-2">{[l.cidade, l.uf].filter(Boolean).join("/")}</td>
                <td className="p-2 text-xs">
                  {l.telefone && <div>{l.telefone}</div>}
                  {l.email && <div>{l.email}</div>}
                </td>
                <td className="p-2">
                  {ROTULO_ETAPA[l.etapa]}
                  {l.opt_out && <span className="ml-1 rounded bg-red-100 px-1 text-xs text-red-700">opt-out</span>}
                </td>
                <td className="p-2">{l.score ?? "-"}</td>
              </tr>
            ))}
            {!leads.length && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-500">Nenhum lead encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
