import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { tokenValido } from "@/lib/descadastro";

async function descadastrar(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const t = req.nextUrl.searchParams.get("t") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id) || !tokenValido(id, t)) return false;
  const db = supabaseAdmin();
  const { data } = await db.from("leads").select("opt_out").eq("id", id).maybeSingle();
  if (data && !data.opt_out) await db.rpc("aplicar_opt_out", { p_lead: id, p_motivo: "descadastro pelo link do e-mail" });
  return !!data;
}

const pagina = (msg: string) =>
  new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Descadastro</title><body style="font-family:sans-serif;max-width:480px;margin:80px auto;padding:0 16px"><p>${msg}</p></body>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

// Clique no link do e-mail
export async function GET(req: NextRequest) {
  return pagina((await descadastrar(req)) ? "Pronto. Você não receberá mais nossas mensagens." : "Link inválido.");
}

// Descadastro em um clique (List-Unsubscribe-Post, usado pelo Gmail)
export async function POST(req: NextRequest) {
  return NextResponse.json({ ok: await descadastrar(req) });
}
