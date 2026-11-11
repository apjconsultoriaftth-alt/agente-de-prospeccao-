import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM de Prospecção",
  description: "CRM e agente de prospecção para escritórios de advocacia",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <header className="border-b bg-white">
          <nav className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 text-sm">
            <Link href="/pipeline" className="font-semibold">
              CRM de Prospecção
            </Link>
            <Link href="/pipeline" className="text-slate-600 hover:text-slate-900">Funil</Link>
            <Link href="/leads" className="text-slate-600 hover:text-slate-900">Leads</Link>
            <Link href="/importar" className="text-slate-600 hover:text-slate-900">Importar</Link>
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
