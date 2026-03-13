"use client";

// ============================================================================
// app/contactos/_modules/ficha/CloneStructureButton.tsx
//
// @role: @Frontend-UX
// @spec: Consolidacion Point 3 — Copiar estructura de otro contacto
//
// Boton + modal para buscar un contacto origen y copiar sus etiquetas
// al contacto actual (destino).
// ============================================================================

import { useState, useEffect, useTransition } from "react";
import { Copy, Search, X, Check, User, Building2 } from "lucide-react";
import {
  searchContactosForPicker,
  type ContactoPickerItem,
} from "@/lib/modules/entidades/actions/relaciones.actions";
import { cloneStructureFromContacto } from "@/lib/modules/entidades/actions/etiquetas.actions";

export function CloneStructureButton({ contactoId }: { contactoId: string }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContactoPickerItem[]>([]);
  const [selected, setSelected] = useState<ContactoPickerItem | null>(null);
  const [, startSearch] = useTransition();
  const [isCloning, startClone] = useTransition();
  const [result, setResult] = useState<{ cloned: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const timer = setTimeout(() => {
      startSearch(async () => {
        const res = await searchContactosForPicker(query, contactoId);
        if (res.ok) setResults(res.data);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, contactoId]);

  const handleClone = () => {
    if (!selected) return;
    startClone(async () => {
      const res = await cloneStructureFromContacto(selected.id, contactoId);
      if (res.ok) {
        setResult({ cloned: res.cloned, skipped: res.skipped });
        setError(null);
      } else {
        setError(res.error);
      }
    });
  };

  const reset = () => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setSelected(null);
    setResult(null);
    setError(null);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-zinc-800 px-2.5 py-1 text-[10px] font-medium text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
        title="Copiar estructura de otro contacto"
      >
        <Copy className="h-3 w-3" />
        Copiar estructura
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Copiar estructura</h3>
                <p className="text-[11px] text-zinc-500">
                  Selecciona un contacto origen para copiar sus etiquetas a este contacto.
                </p>
              </div>
              <button onClick={reset} className="rounded p-1 text-zinc-500 hover:text-zinc-300">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Result message */}
              {result && (
                <div className="rounded-md border border-green-800/40 bg-green-950/20 px-3 py-2 text-[11px] text-green-400 flex items-center gap-2">
                  <Check className="h-3.5 w-3.5" />
                  {result.cloned} etiqueta{result.cloned !== 1 ? "s" : ""} copiada{result.cloned !== 1 ? "s" : ""}
                  {result.skipped > 0 && `, ${result.skipped} ya existente${result.skipped !== 1 ? "s" : ""}`}
                </div>
              )}

              {error && (
                <div className="rounded-md border border-red-800/40 bg-red-950/20 px-3 py-2 text-[11px] text-red-400">
                  {error}
                </div>
              )}

              {/* Search */}
              {!result && (
                <>
                  {selected ? (
                    <div className="flex items-center gap-2 rounded-md border border-orange-500/30 bg-orange-500/5 px-3 py-2">
                      {selected.tipo === "PERSONA_JURIDICA"
                        ? <Building2 className="h-3.5 w-3.5 text-orange-400" />
                        : <User className="h-3.5 w-3.5 text-orange-400" />
                      }
                      <span className="text-xs font-medium text-zinc-200">{selected.displayName}</span>
                      {selected.fiscal_id && (
                        <span className="font-mono text-[10px] text-zinc-500">{selected.fiscal_id}</span>
                      )}
                      <button
                        onClick={() => setSelected(null)}
                        className="ml-auto text-zinc-500 hover:text-zinc-300"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar contacto por nombre o NIF..."
                        autoFocus
                        className="w-full rounded-md border border-zinc-700 bg-zinc-800 py-2 pl-8 pr-3 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30"
                      />
                      {results.length > 0 && (
                        <div className="absolute z-10 mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 shadow-xl max-h-48 overflow-y-auto">
                          {results.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => { setSelected(item); setQuery(""); setResults([]); }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-800 transition-colors"
                            >
                              {item.tipo === "PERSONA_JURIDICA"
                                ? <Building2 className="h-3 w-3 shrink-0 text-zinc-500" />
                                : <User className="h-3 w-3 shrink-0 text-zinc-500" />
                              }
                              <span className="truncate">{item.displayName}</span>
                              {item.fiscal_id && (
                                <span className="ml-auto shrink-0 font-mono text-[10px] text-zinc-600">
                                  {item.fiscal_id}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 border-t border-zinc-800 px-4 py-3">
              <button
                onClick={reset}
                className="rounded-md px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition-colors hover:text-zinc-200"
              >
                {result ? "Cerrar" : "Cancelar"}
              </button>
              {!result && (
                <button
                  onClick={handleClone}
                  disabled={!selected || isCloning}
                  className="rounded-md bg-orange-600 px-4 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isCloning ? "Copiando..." : "Copiar etiquetas"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
