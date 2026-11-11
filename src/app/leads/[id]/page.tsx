import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { ROTULO_ETAPA, type Atividade, type Lead, type Mensagem } from "@/lib/types";
import { adicionarNota, marcarOptOut } from "../../actions";
import { SeletorEtapa } from "./seletor-etapa";

export const dynamic = "force-dynamic";

export default async function LeadDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await supabaseServer();
  const [{ data: lead }, { data: msgs }, { data: ativ }] = await Promise.all([
    db.from("leads").select("*").eq("id", id).maybeSingle(),
    db.from("mensagens").select("*").eq("lead_id", id).order("criado_em", { ascending: true }),
    db.from("atividades").select("*").eq("lead_id", id).order("criado_em", { ascending: false }).limit(100),
  ]);
  if (!lead) notFound();
  const l = lead as Lead;
  const mensagens = (msgs ?? []) as Mensagem[];
  const atividades = (ativ ?? []) as Atividade[];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="space-y-3 rounded-lg border bg-white p-4 text-sm">
        <h1 className="text-lg font-semibold">{l.nome}</h1>
        {l.escritorio && <p className="text-slate-600">{l.escritorio}</p>}
        <dl className="grid grid-cols-3 gap-y-1">
          <dt className="text-slate-500">WhatsApp</dt><dd className="col-span-2">{l.telefone ?? "-"}</dd>
          <dt className="text-slate-500">E-mail</dt><dd className="col-span-2 break-all">{l.email ?? "-"}</dd>
          <dt className="text-slate-500">Site</dt><dd className="col-span-2 break-all">{l.site ?? "-"}</dd>
          <dt className="text-slate-500">Cidade</dt><dd className="col-span-2">{[l.cidade, l.uf].filter(Boolean).join("/") || "-"}</dd>
          <dt className="text-slate-500">Áreas</dt><dd className="col-span-2">{l.areas_atuacao?.join(", ") || "-"}</dd>
          <dt className="text-slate-500">OAB</dt><dd className="col-span-2">{l.oab ?? "-"}</dd>
          <dt className="text-slate-500">Google</dt><dd className="col-span-2">{l.avaliacao != null ? `${l.avaliacao} (${l.total_avaliacoes ?? 0})` : "-"}</dd>
          <dt className="text-slate-500">Origem</dt><dd className="col-span-2">{l.origem}</dd>
          <dt className="text-slate-500">Score</dt><dd className="col-span-2">{l.score ?? "-"}{l.motivo_score && <div className="text-xs text-slate-500">{l.motivo_score}</div>}</dd>
        </dl>
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Etapa</span>
          <SeletorEtapa leadId={l.id} etapa={l.etapa} />
        </div>
        {l.opt_out ? (
          <p className="rounded bg-red-50 p-2 text-red-700">Pediu para não ser contatado (opt-out).</p>
        ) : (
          <form action={marcarOptOut.bind(null, l.id)}>
            <button className="text-xs text-red-600 underline">Marcar opt-out e bloquear contato</button>
          </form>
        )}
      </section>

      <section className="rounded-lg border bg-white p-4 text-sm lg:col-span-2">
        <h2 className="mb-3 font-medium">Conversa</h2>
        <div className="space-y-2">
          {mensagens.map((m) => (
            <div key={m.id} className={`max-w-[80%] rounded-lg p-2 ${m.direcao === "saida" ? "ml-auto bg-emerald-50" : "bg-slate-100"}`}>
              <div className="mb-1 text-xs text-slate-500">
                {m.canal === "whatsapp" ? "WhatsApp" : m.canal === "email" ? "E-mail" : "Nota"} ·{" "}
                {new Date(m.enviada_em ?? m.criado_em).toLocaleString("pt-BR")} · {m.status}
              </div>
              {m.assunto && <div className="font-medium">{m.assunto}</div>}
              <div className="whitespace-pre-wrap">{m.corpo}</div>
            </div>
          ))}
          {!mensagens.length && <p className="text-slate-500">Nenhuma mensagem ainda.</p>}
        </div>

        <h2 className="mb-2 mt-6 font-medium">Linha do tempo</h2>
        <form action={adicionarNota.bind(null, l.id)} className="mb-3 flex gap-2">
          <input name="nota" placeholder="Adicionar nota" className="flex-1 rounded border px-2 py-1.5" />
          <button className="rounded bg-slate-900 px-3 text-white">Salvar</button>
        </form>
        <ul className="space-y-1">
          {atividades.map((a) => (
            <li key={a.id} className="flex gap-2">
              <span className="w-32 shrink-0 text-xs text-slate-500">{new Date(a.criado_em).toLocaleString("pt-BR")}</span>
              <span>{a.descricao}</span>
              <span className="text-xs text-slate-400">({a.autor})</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-slate-400">Etapa atual: {ROTULO_ETAPA[l.etapa]}</p>
      </section>
    </div>
  );
}
