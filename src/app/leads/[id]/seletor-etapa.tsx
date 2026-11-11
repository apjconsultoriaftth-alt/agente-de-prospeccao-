"use client";

import { useTransition } from "react";
import { mudarEtapa } from "../../actions";
import { ETAPAS, ROTULO_ETAPA, type Etapa } from "@/lib/types";

export function SeletorEtapa({ leadId, etapa }: { leadId: string; etapa: Etapa }) {
  const [pendente, start] = useTransition();
  return (
    <select
      defaultValue={etapa}
      disabled={pendente}
      onChange={(e) => start(() => mudarEtapa(leadId, e.target.value as Etapa))}
      className="rounded border px-2 py-1"
    >
      {ETAPAS.map((e) => (
        <option key={e} value={e}>{ROTULO_ETAPA[e]}</option>
      ))}
    </select>
  );
}
