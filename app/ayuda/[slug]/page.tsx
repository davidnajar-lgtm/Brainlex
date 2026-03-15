// ============================================================================
// app/ayuda/[slug]/page.tsx
//
// @role: @Frontend-UX + @Knowledge-Librarian
// @spec: Fase 10.09 — Página de artículo individual del Centro de Ayuda
// ============================================================================

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  getArticle,
  getArticleSlugs,
  getAdjacentArticles,
} from "@/lib/services/manual.service";
import { MarkdownRenderer } from "../_components/MarkdownRenderer";

// ── Static params for build-time generation ─────────────────────────────────

export function generateStaticParams() {
  return getArticleSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return { title: "Artículo no encontrado" };
  return {
    title: `${article.meta.title} — Centro de Ayuda`,
    description: article.meta.description,
  };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const { prev, next } = getAdjacentArticles(slug);

  return (
    <article>
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-xs text-zinc-600">
        <Link
          href="/ayuda"
          className="hover:text-zinc-400 transition-colors"
        >
          Centro de Ayuda
        </Link>
        <span>/</span>
        <span className="text-zinc-500">{article.meta.category}</span>
        <span>/</span>
        <span className="text-zinc-400">{article.meta.title}</span>
      </div>

      {/* Category badge */}
      <span className="inline-block rounded-full bg-zinc-800 px-2.5 py-0.5 text-[10px] font-medium text-zinc-500 ring-1 ring-zinc-700 mb-3">
        {article.meta.category}
      </span>

      {/* Content */}
      <MarkdownRenderer content={article.content} />

      {/* ── Prev / Next navigation ─────────────────────────────────── */}
      <div className="mt-12 flex items-stretch gap-3 border-t border-zinc-800 pt-6">
        {prev ? (
          <Link
            href={`/ayuda/${prev.slug}`}
            className="group flex-1 rounded-lg border border-zinc-800 p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-800/30"
          >
            <span className="flex items-center gap-1 text-[10px] font-medium text-zinc-600">
              <ArrowLeft className="h-3 w-3" />
              Anterior
            </span>
            <p className="mt-1 text-sm font-medium text-zinc-400 group-hover:text-zinc-200 transition-colors">
              {prev.title}
            </p>
          </Link>
        ) : (
          <div className="flex-1" />
        )}

        {next ? (
          <Link
            href={`/ayuda/${next.slug}`}
            className="group flex-1 rounded-lg border border-zinc-800 p-4 text-right transition-colors hover:border-zinc-700 hover:bg-zinc-800/30"
          >
            <span className="flex items-center justify-end gap-1 text-[10px] font-medium text-zinc-600">
              Siguiente
              <ArrowRight className="h-3 w-3" />
            </span>
            <p className="mt-1 text-sm font-medium text-zinc-400 group-hover:text-zinc-200 transition-colors">
              {next.title}
            </p>
          </Link>
        ) : (
          <div className="flex-1" />
        )}
      </div>
    </article>
  );
}
