"use client";

import { useActionState, useState } from "react";
import { enviarManual } from "../../actions";

export function EnviarForm({ leadId, temWhatsapp, temEmail }: { leadId: string; temWhatsapp: boolean; temEmail: boolean }) {
  const [canal, setCanal] = useState(temWhatsapp ? "whatsapp" : "email");
  const [estado, acao, pendente] = useActionState(enviarManual.bind(null, leadId), null);
  if (!temWhatsapp && !temEmail) return null;
  return (
    <form action={acao} className="mt-4 space-y-2 border-t pt-4">
      <div className="flex gap-2">
        <select name="canal" value={canal} onChange={(e) => setCanal(e.target.value)} className="rounded border px-2 py-1">
          {temWhatsapp && <option value="whatsapp">WhatsApp</option>}
          {temEmail && <option value="email">E-mail</option>}
        </select>
        {canal === "email" && <input name="assunto" placeholder="Assunto (vazio = responder na conversa)" className="flex-1 rounded border px-2 py-1" />}
      </div>
      <textarea name="corpo" rows={3} placeholder="Escreva sua mensagem" className="w-full rounded border px-2 py-1.5" />
      <div className="flex items-center gap-3">
        <button disabled={pendente} className="rounded bg-emerald-600 px-3 py-1.5 text-white disabled:opacity-50">
          {pendente ? "Enviando..." : "Enviar"}
        </button>
        {estado && "erro" in estado && <span className="text-red-600">{estado.erro}</span>}
        {estado && "ok" in estado && <span className="text-emerald-700">Enviada.</span>}
      </div>
    </form>
  );
}
