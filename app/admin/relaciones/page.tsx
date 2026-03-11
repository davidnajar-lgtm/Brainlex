"use client";

// ============================================================================
// app/admin/relaciones/page.tsx — Panel de Admin: Tipos de Relación
//
// @role: Agente de Frontend (Client Component — formulario inline)
// @spec: Motor de Clasificación Multidimensional — Grafo de Relaciones
// ============================================================================

import { useEffect, useState, useTransition } from "react";
import { Plus, Trash2, Network, X, Check } from "lucide-react";
import {
  getTiposRelacion,
  createTipoRelacion,
  deleteTipoRelacion,
} from "@/lib/modules/entidades/actions/relaciones.actions";
import type { TipoRelacion } from "@prisma/client";

// ─── Categorías predefinidas (el CEO puede querer estas como punto de partida) ─

const CATEGORIAS_SUGERIDAS = [
  "Societaria", "Procesal", "Laboral", "Familiar", "Contractual", "Otro",
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RelacionesAdminPage() {
  const [tipos,       setTipos]       = useState<TipoRelacion[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [nombre,      setNombre]      = useState("");
  const [color,       setColor]       = useState("#6b7280");
  const [categoria,   setCategoria]   = useState("Otro");
  const [descripcion, setDescripcion] = useState("");
  const [error,       setError]       = useState<string | null>(null);
  const [isPending,   startTransition] = useTransition();

  useEffect(() => {
    getTiposRelacion().then((res) => {
      if (res.ok) setTipos(res.data);
      setLoading(false);
    });
  }, []);

  function handleCreate() {
    if (!nombre.trim()) return;
    setError(null);
    const fd = new FormData();
    fd.set("nombre", nombre.trim());
    fd.set("color", color);
    fd.set("categoria", categoria);
    fd.set("descripcion", descripcion.trim());
    startTransition(async () => {
      const res = await createTipoRelacion(null, fd);
      if (!res.ok) { setError(res.error); return; }
      setTipos((prev) => [
        ...prev,
        { id: res.data.id, nombre: nombre.trim(), color, categoria, descripcion: descripcion.trim() || null, es_sistema: false, created_at: new Date(), updated_at: new Date() },
      ]);
      setNombre(""); setColor("#6b7280"); setCategoria("Otro"); setDescripcion("");
      setShowForm(false);
    });
  }

  function handleDelete(id: string, nombre: string, es_sistema: boolean) {
    if (es_sistema) { setError(`"${nombre}" es de sistema y no puede borrarse.`); return; }
    if (!confirm(`¿Borrar el tipo de relación "${nombre}"? Solo es posible si no hay relaciones activas.`)) return;
    startTransition(async () => {
      const res = await deleteTipoRelacion(id);
      if (!res.ok) { setError(res.error); return; }
      setTipos((prev) => prev.filter((t) => t.id !== id));
    });
  }

  // Agrupar por categoría
  const grupos = tipos.reduce<Record<string, TipoRelacion[]>>((acc, t) => {
    (acc[t.categoria] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Tipos de Relación</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Define cómo se relacionan los Contactos entre sí: Socio, Administrador, Contraparte, etc.
          Estas relaciones forman el grafo del módulo Ecosistema.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div
          className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs"
          style={{
            backgroundColor: "var(--alert-error-bg)",
            borderColor:     "var(--alert-error-border)",
            color:           "var(--alert-error-text)",
          }}
        >
          <X className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--alert-error-icon)" }} />{error}
          <button onClick={() => setError(null)} className="ml-auto" style={{ color: "var(--alert-error-icon)" }}><X className="h-3 w-3" /></button>
        </div>
      )}

      {/* Grupos por categoría */}
      {loading ? (
        <p className="text-sm text-zinc-600">Cargando…</p>
      ) : Object.keys(grupos).length === 0 && !showForm ? (
        <div className="rounded-xl border border-dashed border-zinc-700 py-12 text-center">
          <Network className="mx-auto h-6 w-6 text-zinc-600" />
          <p className="mt-3 text-sm text-zinc-500">Sin tipos de relación. Crea el primero.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grupos).map(([cat, items]) => (
            <div key={cat} className="rounded-xl border border-zinc-800 bg-zinc-900/60">
              <div className="border-b border-zinc-800 px-4 py-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{cat}</span>
              </div>
              <div className="flex flex-wrap gap-2 p-4">
                {items.map((t) => (
                  <span
                    key={t.id}
                    className="group inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset"
                    style={{ backgroundColor: `${t.color}22`, color: t.color }}
                  >
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                    {t.nombre}
                    {t.es_sistema && <span className="text-[9px] opacity-60 uppercase ml-0.5">sys</span>}
                    {!t.es_sistema && (
                      <button
                        onClick={() => handleDelete(t.id, t.nombre, t.es_sistema)}
                        className="opacity-0 transition-opacity group-hover:opacity-70 hover:!opacity-100 ml-0.5"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formulario */}
      {showForm ? (
        <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Nuevo Tipo de Relación</p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
                className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0" title="Color" />
              <input value={nombre} onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre (ej: Socio, Contraparte…)"
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30"
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowForm(false); }}
                autoFocus
              />
            </div>

            <select value={categoria} onChange={(e) => setCategoria(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500/60">
              {CATEGORIAS_SUGERIDAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Descripción opcional"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-400 placeholder-zinc-600 outline-none focus:border-orange-500/60"
          />

          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={!nombre.trim() || isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50">
              <Check className="h-3.5 w-3.5" /> Crear
            </button>
            <button onClick={() => { setShowForm(false); setNombre(""); }}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-700 px-4 py-2.5 text-xs font-medium text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-300">
          <Plus className="h-3.5 w-3.5" />
          Nuevo Tipo de Relación
        </button>
      )}
    </div>
  );
}
