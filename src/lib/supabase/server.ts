import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Cliente Supabase com a sessão do usuário logado (respeita RLS). */
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // chamado de um Server Component: o middleware renova a sessão
          }
        },
      },
    },
  );
}
