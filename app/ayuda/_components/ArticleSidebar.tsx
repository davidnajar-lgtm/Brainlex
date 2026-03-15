// ============================================================================
// app/ayuda/_components/ArticleSidebar.tsx
//
// @role: @Frontend-UX
// @spec: Fase 10.09 — Navegación lateral del Centro de Ayuda
// ============================================================================
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChevronDown } from "lucide-react";
import { useState } from "react";
import type { ArticleMeta, Category } from "@/content/manual_usuario/_meta";

type Props = {
  groups: { category: Category; articles: ArticleMeta[] }[];
};

export function ArticleSidebar({ groups }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function toggleCategory(cat: string) {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }

  return (
    <nav className="flex flex-col gap-1 py-4">
      {/* Home link */}
      <Link
        href="/ayuda"
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          pathname === "/ayuda"
            ? "bg-orange-500/10 text-orange-400"
            : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        }`}
      >
        <BookOpen className="h-4 w-4" />
        Inicio
      </Link>

      {/* Category groups */}
      {groups.map(({ category, articles }) => (
        <div key={category} className="mt-3">
          <button
            type="button"
            onClick={() => toggleCategory(category)}
            className="flex w-full items-center justify-between px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            {category}
            <ChevronDown
              className={`h-3 w-3 transition-transform ${
                collapsed[category] ? "-rotate-90" : ""
              }`}
            />
          </button>

          {!collapsed[category] && (
            <ul className="mt-0.5 space-y-0.5">
              {articles.map((article) => {
                const href = `/ayuda/${article.slug}`;
                const isActive = pathname === href;
                return (
                  <li key={article.slug}>
                    <Link
                      href={href}
                      className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                        isActive
                          ? "bg-orange-500/10 text-orange-400 font-medium"
                          : "text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300"
                      }`}
                    >
                      {article.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </nav>
  );
}
