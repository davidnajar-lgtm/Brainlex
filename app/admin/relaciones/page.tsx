"use client";

// ============================================================================
// app/admin/relaciones/page.tsx — Panel de Admin: Tipos de Relación
//
// @role: Agente de Frontend (Client Component — formulario inline)
// @spec: Motor de Clasificación Multidimensional + FASE 13.07 (Scope)
//
// Soporte completo: Crear, Editar inline (click en pill), Eliminar.
// Scope selector: GLOBAL / LEXCONOMY / LAWTECH (patrón Taxonomía).
// ============================================================================

import { useEffect, useState, useTransition } from "react";
import { Plus, Trash2, Pencil, Network, X, Check, Globe, Building2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  getTiposRelacion,
  createTipoRelacion,
  updateTipoRelacion,
  deleteTipoRelacion,
  updateTipoRelacionScope,
} from "@/lib/modules/entidades/actions/relaciones.actions";
import type { TipoRelacion, EtiquetaScope } from "@prisma/client";

// ─── Constantes ─────────────────────────────────────────────────────────────

const CATEGORIAS_SUGERIDAS = [
  "Societaria", "Procesal", "Laboral", "Familiar", "Contractual", "Otro",
];

const SCOPE_CONFIG: Record<EtiquetaScope, { label: string; shortLabel: string; color: string; bg: string; icon: typeof Globe }> = {
  GLOBAL:    { label: "Global",    shortLabel: "ALL", color: "#71717a", bg: "#71717a15", icon: Globe },
  LEXCONOMY: { label: "Lexconomy", shortLabel: "LX",  color: "#FF8C00", bg: "#FF8C0015", icon: Building2 },
  LAWTECH:   { label: "Lawtech",   shortLabel: "LW",  color: "#9B1B30", bg: "#9B1B3015", icon: Building2 },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RelacionesAdminPage() {
  const [tipos,       setTipos]       = useState<TipoRelacion[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [isPending,   startTransition] = useTransition();

  // ── Crear ──────────────────────────────────────────────────────────────
  const [nombre,      setNombre]      = useState("");
  const [color,       setColor]       = useState("#6b7280");
  const [categoria,   setCategoria]   = useState("Otro");
  const [descripcion, setDescripcion] = useState("");
  const [createScope, setCreateScope] = useState<EtiquetaScope>("GLOBAL");

  // ── Editar inline ──────────────────────────────────────────────────────
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [editNombre,   setEditNombre]   = useState("");
  const [editColor,    setEditColor]    = useState("#6b7280");
  const [editCategoria, setEditCategoria] = useState("Otro");
  const [editDescripcion, setEditDescripcion] = useState("");

  // ── Modal de confirmación de borrado ──────────────────────────────────
  const [deleteModal, setDeleteModal] = useState<{ id: string; nombre: string } | null>(null);

  // ── Load ───────────────────────────────────────────────────────────────
  useEffect(() => {
    getTiposRelacion().then((res) => {
      if (res.ok) setTipos(res.data);
      setLoading(false);
    });
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────

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
      // Set scope after creation
      if (createScope !== "GLOBAL") {
        await updateTipoRelacionScope(res.data.id, createScope);
      }
      setTipos((prev) => [
        ...prev,
        { id: res.data.id, nombre: nombre.trim(), color, categoria, descripcion: descripcion.trim() || null, es_sistema: false, scope: createScope, created_at: new Date(), updated_at: new Date() },
      ]);
      setNombre(""); setColor("#6b7280"); setCategoria("Otro"); setDescripcion(""); setCreateScope("GLOBAL");
      setShowForm(false);
    });
  }

  function startEdit(t: TipoRelacion) {
    setEditingId(t.id);
    setEditNombre(t.nombre);
    setEditColor(t.color);
    setEditCategoria(t.categoria);
    setEditDescripcion(t.descripcion ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditNombre("");
    setEditColor("#6b7280");
    setEditCategoria("Otro");
    setEditDescripcion("");
  }

  function handleUpdate() {
    if (!editingId || !editNombre.trim()) return;
    setError(null);
    const fd = new FormData();
    fd.set("nombre", editNombre.trim());
    fd.set("color", editColor);
    fd.set("categoria", editCategoria);
    fd.set("descripcion", editDescripcion.trim());
    const id = editingId;
    startTransition(async () => {
      const res = await updateTipoRelacion(id, null, fd);
      if (!res.ok) { setError(res.error); return; }
      setTipos((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, nombre: editNombre.trim(), color: editColor, categoria: editCategoria, descripcion: editDescripcion.trim() || null }
            : t
        )
      );
      cancelEdit();
    });
  }

  function handleScopeChange(id: string, newScope: EtiquetaScope) {
    setError(null);
    startTransition(async () => {
      const res = await updateTipoRelacionScope(id, newScope);
      if (!res.ok) { setError(res.error); return; }
      setTipos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, scope: newScope } : t))
      );
    });
  }

  function handleDeleteConfirm() {
    if (!deleteModal) return;
    const { id } = deleteModal;
    startTransition(async () => {
      const res = await deleteTipoRelacion(id);
      if (!res.ok) { setError(res.error); setDeleteModal(null); return; }
      setTipos((prev) => prev.filter((t) => t.id !== id));
      setDeleteModal(null);
    });
  }

  // ── Agrupar por categoría ──────────────────────────────────────────────
  const grupos = tipos.reduce<Record<string, TipoRelacion[]>>((acc, t) => {
    (acc[t.categoria] ??= []).push(t);
    return acc;
  }, {});

  // ── Scope badge ─────────────────────────────────────────────────────────
  function ScopeBadge({ scope, tipoId }: { scope: EtiquetaScope; tipoId: string }) {
    const cfg = SCOPE_CONFIG[scope];
    const Icon = cfg.icon;
    return (
      <div className="inline-flex items-center gap-0.5">
        {(["GLOBAL", "LEXCONOMY", "LAWTECH"] as const).map((s) => {
          const sc = SCOPE_CONFIG[s];
          const active = scope === s;
          return (
            <button
              key={s}
              onClick={(e) => { e.stopPropagation(); handleScopeChange(tipoId, s); }}
              className={`rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider transition-all ${
                active
                  ? "ring-1"
                  : "opacity-30 hover:opacity-70"
              }`}
              style={{
                backgroundColor: active ? sc.bg : "transparent",
                color: sc.color,
                ...(active ? { boxShadow: `inset 0 0 0 1px ${sc.color}40` } : {}),
              }}
              title={`${active ? "Activo" : "Cambiar a"}: ${sc.label}`}
              disabled={isPending}
            >
              {sc.shortLabel}
            </button>
          );
        })}
      </div>
    );
  }

  // ── Render pill o inline edit ──────────────────────────────────────────
  function renderTipoPill(t: TipoRelacion) {
    if (editingId === t.id) {
      return (
        <div
          key={t.id}
          className="flex flex-wrap items-center gap-2 rounded-lg border border-orange-500/40 bg-zinc-800/80 px-3 py-2 w-full"
        >
          <input
            type="color"
            value={editColor}
            onChange={(e) => setEditColor(e.target.value)}
            className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
          />
          <input
            value={editNombre}
            onChange={(e) => setEditNombre(e.target.value)}
            className="flex-1 min-w-[120px] rounded-md border border-zinc-600 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-orange-500/60"
            onKeyDown={(e) => { if (e.key === "Enter") handleUpdate(); if (e.key === "Escape") cancelEdit(); }}
            autoFocus
          />
          <select
            value={editCategoria}
            onChange={(e) => setEditCategoria(e.target.value)}
            className="rounded-md border border-zinc-600 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-orange-500/60"
          >
            {CATEGORIAS_SUGERIDAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            value={editDescripcion}
            onChange={(e) => setEditDescripcion(e.target.value)}
            placeholder="Descripción"
            className="flex-1 min-w-[100px] rounded-md border border-zinc-600 bg-zinc-900 px-2 py-1 text-xs text-zinc-400 placeholder-zinc-600 outline-none focus:border-orange-500/60"
          />
          <button
            onClick={handleUpdate}
            disabled={!editNombre.trim() || isPending}
            className="rounded-md bg-orange-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-orange-500 disabled:opacity-50"
          >
            <Check className="h-3 w-3" />
          </button>
          <button
            onClick={cancelEdit}
            className="rounded-md border border-zinc-600 px-2 py-1 text-zinc-500 hover:text-zinc-300"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      );
    }

    return (
      <div key={t.id} className="inline-flex items-center gap-1.5">
        <span
          className="group inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset cursor-pointer transition-colors hover:ring-2"
          style={{ backgroundColor: `${t.color}22`, color: t.color }}
          onClick={() => startEdit(t)}
          title="Click para editar"
        >
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
          {t.nombre}
          <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-50 transition-opacity" />
          <button
            onClick={(e) => { e.stopPropagation(); setDeleteModal({ id: t.id, nombre: t.nombre }); }}
            className="opacity-0 transition-opacity group-hover:opacity-70 hover:!opacity-100 ml-0.5"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
        <ScopeBadge scope={t.scope} tipoId={t.id} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Tipos de Relación</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Define cómo se relacionan los Contactos entre sí: Socio, Administrador, Contraparte, etc.
          Estas relaciones forman el grafo del módulo Ecosistema.
          <span className="text-zinc-600"> — Click en una pill para editarla. Scope: </span>
          <span className="text-zinc-500 font-mono text-[11px]">ALL</span>
          <span className="text-zinc-600"> = ambas matrices, </span>
          <span className="font-mono text-[11px]" style={{ color: "#FF8C00" }}>LX</span>
          <span className="text-zinc-600"> / </span>
          <span className="font-mono text-[11px]" style={{ color: "#9B1B30" }}>LW</span>
          <span className="text-zinc-600"> = solo esa matriz.</span>
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
                {items.map((t) => renderTipoPill(t))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formulario de creación */}
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción opcional"
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-400 placeholder-zinc-600 outline-none focus:border-orange-500/60"
            />
            {/* Scope selector */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Scope:</span>
              {(["GLOBAL", "LEXCONOMY", "LAWTECH"] as const).map((s) => {
                const sc = SCOPE_CONFIG[s];
                const active = createScope === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setCreateScope(s)}
                    className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${
                      active ? "ring-1" : "opacity-40 hover:opacity-70"
                    }`}
                    style={{
                      backgroundColor: active ? sc.bg : "transparent",
                      color: sc.color,
                      ...(active ? { boxShadow: `inset 0 0 0 1px ${sc.color}40` } : {}),
                    }}
                  >
                    {sc.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

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

      {/* ── Modal de confirmación de borrado ──────────────────────────────── */}
      {deleteModal && (
        <ConfirmDialog
          open
          variant="danger"
          icon={<Trash2 className="h-4 w-4" />}
          title={`Eliminar "${deleteModal.nombre}"`}
          confirmLabel="Eliminar"
          cancelLabel="Cancelar"
          loading={isPending}
          onClose={() => setDeleteModal(null)}
          onConfirm={handleDeleteConfirm}
        >
          <p>
            Se eliminará el tipo de relación <strong className="text-zinc-200">{deleteModal.nombre}</strong>.
            Solo es posible si no hay relaciones activas que lo usen.
          </p>
          <p className="mt-1.5">
            Esta acción es <strong className="text-red-400">permanente e irreversible</strong>.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
