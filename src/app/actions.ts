"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { importarLeads, type NovoLead } from "@/lib/leads";
import { ETAPAS, type Etapa } from "@/lib/types";
import { lerCsv } from "@/lib/csv";

export async function entrar(_: unknown, form: FormData) {
  const db = await supabaseServer();
  const { error } = await db.auth.signInWithPassword({
    email: String(form.get("email")),
    password: String(form.get("senha")),
  });
  if (error) return { erro: "E-mail ou senha inválidos." };
  redirect("/pipeline");
}

export async function sair() {
  const db = await supabaseServer();
  await db.auth.signOut();
  redirect("/login");
}

export async function mudarEtapa(leadId: string, etapa: Etapa) {
  if (!ETAPAS.includes(etapa)) throw new Error("Etapa inválida");
  const db = await supabaseServer();
  const { error } = await db.from("leads").update({ etapa }).eq("id", leadId);
  if (error) throw error;
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/pipeline");
}

export async function adicionarNota(leadId: string, form: FormData) {
  const texto = String(form.get("nota") ?? "").trim();
  if (!texto) return;
  const db = await supabaseServer();
  await db.from("atividades").insert({ lead_id: leadId, tipo: "nota", descricao: texto, autor: "usuario" });
  revalidatePath(`/leads/${leadId}`);
}

export async function marcarOptOut(leadId: string) {
  const db = await supabaseServer();
  const { error } = await db.rpc("aplicar_opt_out", { p_lead: leadId, p_motivo: "marcado manualmente" });
  if (error) throw error;
  revalidatePath(`/leads/${leadId}`);
}

export async function criarLead(form: FormData) {
  const db = await supabaseServer();
  const lead: NovoLead = {
    nome: String(form.get("nome") ?? ""),
    escritorio: (form.get("escritorio") as string) || null,
    telefone: (form.get("telefone") as string) || null,
    email: (form.get("email") as string) || null,
    cidade: (form.get("cidade") as string) || null,
    uf: (form.get("uf") as string) || null,
    areas_atuacao: String(form.get("areas") ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    origem: "manual",
  };
  const r = await importarLeads(db, [lead]);
  revalidatePath("/leads");
  return r;
}

const COLUNAS: Record<string, keyof NovoLead> = {
  nome: "nome",
  escritorio: "escritorio",
  "escritório": "escritorio",
  telefone: "telefone",
  celular: "telefone",
  whatsapp: "telefone",
  email: "email",
  "e-mail": "email",
  site: "site",
  cidade: "cidade",
  uf: "uf",
  estado: "uf",
  oab: "oab",
  endereco: "endereco",
  "endereço": "endereco",
};

export async function importarCsv(_: unknown, form: FormData) {
  const arquivo = form.get("arquivo") as File | null;
  if (!arquivo || !arquivo.size) return { erro: "Escolha um arquivo CSV." };
  const linhas = lerCsv(await arquivo.text());
  if (linhas.length < 2) return { erro: "O arquivo está vazio." };

  const cab = linhas[0].map((c) => c.trim().toLowerCase());
  const leads: NovoLead[] = linhas.slice(1).map((cols) => {
    const l: Record<string, unknown> = { origem: "csv" };
    cab.forEach((c, i) => {
      if (c === "areas" || c === "áreas" || c === "area" || c === "área") {
        l.areas_atuacao = (cols[i] ?? "").split(/[;,]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
      } else if (COLUNAS[c]) {
        l[COLUNAS[c]] = cols[i]?.trim() || null;
      }
    });
    return l as NovoLead;
  });

  const db = await supabaseServer();
  const r = await importarLeads(db, leads);
  revalidatePath("/leads");
  revalidatePath("/pipeline");
  return { resultado: r };
}
