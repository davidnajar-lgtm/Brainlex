// ============================================================================
// app/ayuda/layout.tsx
//
// @role: @Frontend-UX + @Knowledge-Librarian
// @spec: Fase 10.09 — Layout del Centro de Ayuda
//
// 2-column layout: sidebar izquierdo con navegación + buscador,
// área principal con el contenido del artículo.
// ============================================================================

import { getArticles, getArticlesByCategory } from "@/lib/services/manual.service";
import { ArticleSidebar } from "./_components/ArticleSidebar";
import { ArticleSearch } from "./_components/ArticleSearch";

export const metadata = {
  title: "Centro de Ayuda — BrainLex",
};

export default function AyudaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const groups = getArticlesByCategory();
  const allArticles = getArticles();

  return (
    <div className="flex h-full min-h-0">
      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <aside className="hidden w-72 flex-shrink-0 border-r border-zinc-800 bg-zinc-950/50 md:flex md:flex-col overflow-y-auto">
        <div className="px-4 pt-5 pb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Centro de Ayuda
          </h2>
        </div>

        <div className="px-3">
          <ArticleSearch articles={allArticles} />
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          <ArticleSidebar groups={groups} />
        </div>
      </aside>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-8 md:px-10 md:py-12">
          {children}
        </div>
      </main>
    </div>
  );
}
