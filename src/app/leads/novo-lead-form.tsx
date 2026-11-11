"use client";

import { useState, useTransition } from "react";
import { criarLead } from "../actions";

export function NovoLeadForm() {
  const [aberto, setAberto] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pendente, start] = useTransition();

  if (!aberto)
    return (
      <button onClick={() => setAberto(true)} className="rounded border bg-white px-3 py-1.5 text-sm">
        + Novo lead
      </button>
    );

  return (
    <form
      action={(f) =>
        start(async () => {
          const r = await criarLead(f);
          setMsg(
            r.inseridos ? "Lead criado." : r.bloqueados ? "Contato está na lista de bloqueio." : r.duplicados ? "Lead já existe." : "Informe nome e telefone ou e-mail.",
          );
        })
      }
      className="grid gap-2 rounded-lg border bg-white p-4 text-sm sm:grid-cols-4"
    >
      <input name="nome" required placeholder="Nome *" className="rounded border px-2 py-1.5" />
      <input name="escritorio" placeholder="Escritório" className="rounded border px-2 py-1.5" />
      <input name="telefone" placeholder="WhatsApp (DDD + número)" className="rounded border px-2 py-1.5" />
      <input name="email" type="email" placeholder="E-mail" className="rounded border px-2 py-1.5" />
      <input name="cidade" placeholder="Cidade" className="rounded border px-2 py-1.5" />
      <input name="uf" maxLength={2} placeholder="UF" className="rounded border px-2 py-1.5" />
      <input name="areas" placeholder="Áreas (separadas por vírgula)" className="rounded border px-2 py-1.5 sm:col-span-2" />
      <div className="flex items-center gap-3 sm:col-span-4">
        <button disabled={pendente} className="rounded bg-slate-900 px-3 py-1.5 text-white disabled:opacity-50">Salvar</button>
        <button type="button" onClick={() => setAberto(false)} className="text-slate-600">Cancelar</button>
        {msg && <span className="text-slate-600">{msg}</span>}
      </div>
    </form>
  );
}
