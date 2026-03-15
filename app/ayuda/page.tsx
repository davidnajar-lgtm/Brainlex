// ============================================================================
// app/ayuda/page.tsx
//
// @role: @Frontend-UX + @Knowledge-Librarian
// @spec: Fase 10.09 — Página de inicio del Centro de Ayuda
// ============================================================================

import Link from "next/link";
import { BookOpen, ArrowRight } from "lucide-react";
import { getArticlesByCategory } from "@/lib/services/manual.service";

export default function AyudaPage() {
  const groups = getArticlesByCategory();

  return (
    <div>
      {/* Hero */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10">
            <BookOpen className="h-5 w-5 text-orange-400" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">
            Centro de Ayuda
          </h1>
        </div>
        <p className="text-sm text-zinc-500 max-w-lg">
          Aprende a usar BrainLex paso a paso. Selecciona un tema del menú
          lateral o explora las categorías a continuación.
        </p>
      </div>

      {/* Category cards */}
      <div className="space-y-8">
        {groups.map(({ category, articles }) => (
          <section key={category}>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-600">
              {category}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {articles.map((article) => (
                <Link
                  key={article.slug}
                  href={`/ayuda/${article.slug}`}
                  className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-800/50"
                >
                  <h3 className="text-sm font-semibold text-zinc-200 group-hover:text-orange-400 transition-colors">
                    {article.title}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-600 line-clamp-2">
                    {article.description}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-zinc-600 group-hover:text-orange-400/70 transition-colors">
                    Leer artículo
                    <ArrowRight className="h-3 w-3" />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
