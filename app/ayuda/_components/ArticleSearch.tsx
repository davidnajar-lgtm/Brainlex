// ============================================================================
// app/ayuda/_components/ArticleSearch.tsx
//
// @role: @Frontend-UX
// @spec: Fase 10.09 — Buscador del Centro de Ayuda (client-side)
// ============================================================================
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import type { ArticleMeta } from "@/content/manual_usuario/_meta";

type Props = {
  articles: ArticleMeta[];
};

export function ArticleSearch({ articles }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const results = query.trim().length >= 2
    ? articles.filter(
        (a) =>
          a.title.toLowerCase().includes(query.toLowerCase()) ||
          a.description.toLowerCase().includes(query.toLowerCase()),
      )
    : [];

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(slug: string) {
    setQuery("");
    setOpen(false);
    router.push(`/ayuda/${slug}`);
  }

  return (
    <div ref={panelRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar en el manual..."
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 py-2 pl-9 pr-8 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500 transition-colors"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-600 hover:text-zinc-400"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-zinc-600">
              Sin resultados para &ldquo;{query}&rdquo;
            </p>
          ) : (
            <ul>
              {results.map((r) => (
                <li key={r.slug}>
                  <button
                    type="button"
                    onClick={() => handleSelect(r.slug)}
                    className="w-full px-4 py-2.5 text-left transition-colors hover:bg-zinc-800"
                  >
                    <p className="text-sm font-medium text-zinc-200">
                      {r.title}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-600 line-clamp-1">
                      {r.description}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
