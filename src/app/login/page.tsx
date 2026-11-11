"use client";

import { useActionState } from "react";
import { entrar } from "../actions";

export default function Login() {
  const [estado, acao, pendente] = useActionState(entrar, null);
  return (
    <form action={acao} className="mx-auto mt-16 max-w-sm space-y-4 rounded-lg border bg-white p-6">
      <h1 className="text-lg font-semibold">Entrar no CRM</h1>
      <input name="email" type="email" required placeholder="E-mail" className="w-full rounded border px-3 py-2" />
      <input name="senha" type="password" required placeholder="Senha" className="w-full rounded border px-3 py-2" />
      {estado?.erro && <p className="text-sm text-red-600">{estado.erro}</p>}
      <button disabled={pendente} className="w-full rounded bg-slate-900 py-2 text-white disabled:opacity-50">
        {pendente ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
