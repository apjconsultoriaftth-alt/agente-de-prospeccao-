"use client";

import { useActionState } from "react";
import { importarCsv } from "../actions";

export default function Importar() {
  const [estado, acao, pendente] = useActionState(importarCsv, null);
  const r = estado && "resultado" in estado ? estado.resultado : null;
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">Importar leads (CSV)</h1>
      <p className="text-sm text-slate-600">
        Colunas aceitas: nome, escritorio, telefone, email, site, cidade, uf, oab, endereco, areas. Separador
        vírgula ou ponto e vírgula. Contatos bloqueados e duplicados são ignorados.
      </p>
      <form action={acao} className="space-y-3 rounded-lg border bg-white p-4">
        <input type="file" name="arquivo" accept=".csv,text/csv" className="text-sm" />
        <button disabled={pendente} className="block rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50">
          {pendente ? "Importando..." : "Importar"}
        </button>
      </form>
      {estado && "erro" in estado && <p className="text-sm text-red-600">{estado.erro}</p>}
      {r && (
        <p className="text-sm">
          {r.inseridos} importados, {r.duplicados} duplicados, {r.bloqueados} bloqueados, {r.invalidos} sem contato válido.
        </p>
      )}
    </div>
  );
}
