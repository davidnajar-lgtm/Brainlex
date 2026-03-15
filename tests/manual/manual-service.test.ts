// ============================================================================
// tests/manual/manual-service.test.ts
//
// @role: @QA-Engineer + @Knowledge-Librarian
// @spec: Fase 10.09 — Tests del servicio del manual de usuario
//
// Casos:
//   1. getArticles devuelve todos los artículos ordenados
//   2. getArticle devuelve contenido para slug válido
//   3. getArticle devuelve null para slug inexistente
//   4. searchArticles filtra por título
//   5. searchArticles filtra por descripción
//   6. searchArticles devuelve vacío para query corta (<2 chars)
//   7. getArticlesByCategory agrupa correctamente
//   8. getAdjacentArticles devuelve prev/next correctos
//   9. Todos los artículos en _meta tienen su archivo .md correspondiente
// ============================================================================

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  getArticles,
  getArticle,
  getArticleSlugs,
  searchArticles,
  getArticlesByCategory,
  getAdjacentArticles,
} from "@/lib/services/manual.service";
import { ARTICLES } from "@/content/manual_usuario/_meta";

describe("manual.service — getArticles", () => {
  it("devuelve todos los artículos del _meta", () => {
    const articles = getArticles();
    expect(articles.length).toBe(ARTICLES.length);
  });

  it("devuelve los artículos ordenados por order", () => {
    const articles = getArticles();
    for (let i = 1; i < articles.length; i++) {
      expect(articles[i].order).toBeGreaterThanOrEqual(articles[i - 1].order);
    }
  });
});

describe("manual.service — getArticle", () => {
  it("devuelve contenido para un slug válido", () => {
    const result = getArticle("crear-contacto");
    expect(result).not.toBeNull();
    expect(result!.meta.slug).toBe("crear-contacto");
    expect(result!.content).toContain("# Crear un nuevo contacto");
  });

  it("devuelve null para un slug inexistente", () => {
    const result = getArticle("slug-que-no-existe");
    expect(result).toBeNull();
  });
});

describe("manual.service — searchArticles", () => {
  it("filtra por título", () => {
    const results = searchArticles("contacto");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.slug === "crear-contacto")).toBe(true);
  });

  it("filtra por descripción", () => {
    const results = searchArticles("duplicados");
    expect(results.length).toBeGreaterThan(0);
  });

  it("devuelve vacío para query menor de 2 caracteres", () => {
    expect(searchArticles("a")).toEqual([]);
    expect(searchArticles("")).toEqual([]);
  });
});

describe("manual.service — getArticlesByCategory", () => {
  it("agrupa artículos por categoría", () => {
    const groups = getArticlesByCategory();
    expect(groups.length).toBeGreaterThan(0);

    for (const group of groups) {
      expect(group.category).toBeTruthy();
      expect(group.articles.length).toBeGreaterThan(0);
      for (const article of group.articles) {
        expect(article.category).toBe(group.category);
      }
    }
  });
});

describe("manual.service — getAdjacentArticles", () => {
  it("devuelve prev y next correctos", () => {
    const articles = getArticles();
    if (articles.length < 3) return; // skip si no hay suficientes

    const middle = articles[1];
    const { prev, next } = getAdjacentArticles(middle.slug);
    expect(prev).not.toBeNull();
    expect(prev!.slug).toBe(articles[0].slug);
    expect(next).not.toBeNull();
    expect(next!.slug).toBe(articles[2].slug);
  });

  it("primer artículo no tiene prev", () => {
    const articles = getArticles();
    const { prev } = getAdjacentArticles(articles[0].slug);
    expect(prev).toBeNull();
  });

  it("último artículo no tiene next", () => {
    const articles = getArticles();
    const { next } = getAdjacentArticles(articles[articles.length - 1].slug);
    expect(next).toBeNull();
  });
});

describe("manual.service — integridad de archivos", () => {
  it("todos los artículos en _meta tienen archivo .md correspondiente", () => {
    const contentDir = path.join(process.cwd(), "content", "manual_usuario");
    for (const article of ARTICLES) {
      const filePath = path.join(contentDir, `${article.slug}.md`);
      expect(
        fs.existsSync(filePath),
        `Falta archivo: ${article.slug}.md`,
      ).toBe(true);
    }
  });

  it("getArticleSlugs coincide con ARTICLES", () => {
    const slugs = getArticleSlugs();
    expect(slugs.length).toBe(ARTICLES.length);
    for (const article of ARTICLES) {
      expect(slugs).toContain(article.slug);
    }
  });
});
