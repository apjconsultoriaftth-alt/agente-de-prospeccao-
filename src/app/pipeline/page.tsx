import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { ETAPAS, ROTULO_ETAPA, type Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Pipeline() {
  const db = await supabaseServer();
  const { data, error } = await db
    .from("leads")
    .select("id,nome,escritorio,cidade,uf,etapa,score,areas_atuacao")
    .neq("etapa", "descartado")
    .order("score", { ascending: false, nullsFirst: false })
    .limit(1000);
  if (error) throw error;
  const leads = data as Pick<Lead, "id" | "nome" | "escritorio" | "cidade" | "uf" | "etapa" | "score" | "areas_atuacao">[];

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Funil</h1>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {ETAPAS.filter((e) => e !== "descartado").map((etapa) => {
          const doEstagio = leads.filter((l) => l.etapa === etapa);
          return (
            <section key={etapa} className="w-64 shrink-0 rounded-lg bg-slate-100 p-2">
              <h2 className="mb-2 flex justify-between px-1 text-sm font-medium">
                {ROTULO_ETAPA[etapa]} <span className="text-slate-500">{doEstagio.length}</span>
              </h2>
              <div className="space-y-2">
                {doEstagio.slice(0, 50).map((l) => (
                  <Link key={l.id} href={`/leads/${l.id}`} className="block rounded border bg-white p-2 text-sm hover:shadow">
                    <div className="font-medium">{l.escritorio || l.nome}</div>
                    <div className="text-xs text-slate-500">
                      {[l.cidade, l.uf].filter(Boolean).join("/")}
                      {l.score != null && ` · score ${l.score}`}
                    </div>
                    {l.areas_atuacao?.length > 0 && (
                      <div className="mt-1 text-xs text-slate-600">{l.areas_atuacao.join(", ")}</div>
                    )}
                  </Link>
                ))}
                {doEstagio.length > 50 && (
                  <Link href={`/leads?etapa=${etapa}`} className="block px-1 text-xs text-slate-600 underline">
                    ver todos
                  </Link>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
