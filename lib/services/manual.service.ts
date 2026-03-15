// ============================================================================
// lib/services/manual.service.ts
//
// @role: @Knowledge-Librarian + @Backend-Agent
// @spec: Fase 10.09 — Servicio de lectura del manual de usuario
//
// Lee archivos .md de /content/manual_usuario/ y expone funciones para
// obtener artículos individuales, listar todos, y buscar por texto.
// ============================================================================

import fs from "fs";
import path from "path";
import {
  ARTICLES,
  CATEGORIES,
  type ArticleMeta,
  type Category,
} from "@/content/manual_usuario/_meta";

const CONTENT_DIR = path.join(process.cwd(), "content", "manual_usuario");

// ─── Public API ─────────────────────────────────────────────────────────────

/** Returns all articles sorted by order. */
export function getArticles(): ArticleMeta[] {
  return [...ARTICLES].sort((a, b) => a.order - b.order);
}

/** Returns articles grouped by category, preserving CATEGORIES order. */
export function getArticlesByCategory(): { category: Category; articles: ArticleMeta[] }[] {
  const sorted = getArticles();
  return CATEGORIES.filter((cat) => sorted.some((a) => a.category === cat)).map(
    (category) => ({
      category,
      articles: sorted.filter((a) => a.category === category),
    }),
  );
}

/** Returns a single article by slug, with its raw markdown content. */
export function getArticle(
  slug: string,
): { meta: ArticleMeta; content: string } | null {
  const meta = ARTICLES.find((a) => a.slug === slug);
  if (!meta) return null;

  const filePath = path.join(CONTENT_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, "utf-8");
  return { meta, content };
}

/** Returns all article slugs — used by generateStaticParams. */
export function getArticleSlugs(): string[] {
  return ARTICLES.map((a) => a.slug);
}

/** Simple text search across title and description. */
export function searchArticles(query: string): ArticleMeta[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];

  return getArticles().filter(
    (a) =>
      a.title.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q),
  );
}

/** Returns the previous and next article relative to the given slug. */
export function getAdjacentArticles(slug: string): {
  prev: ArticleMeta | null;
  next: ArticleMeta | null;
} {
  const sorted = getArticles();
  const idx = sorted.findIndex((a) => a.slug === slug);
  return {
    prev: idx > 0 ? sorted[idx - 1] : null,
    next: idx < sorted.length - 1 ? sorted[idx + 1] : null,
  };
}
