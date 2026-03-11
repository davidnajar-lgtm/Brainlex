"use client";

// ============================================================================
// app/admin/taxonomia/TaxonomiaClient.tsx — Motor SALI: Interactividad
//
// @role: Agente de Frontend (Client Component)
// @spec: Motor de Clasificación Multidimensional — Panel de Admin
//
// UI interactiva para gestionar CategoriaEtiqueta + Etiqueta.
// Optimistic UI: las listas se actualizan localmente sin esperar al servidor.
//
// Features:
//   - CRUD etiquetas (crear, editar nombre/color, borrar)
//   - Blueprint editor (subcarpetas para etiquetas Constructor)
//   - Scope selector (GLOBAL / LEXCONOMY / LAWTECH) con badges visuales
// ============================================================================

import { useState, useTransition } from "react";
import { Plus, Tag, Folder, ChevronDown, ChevronRight, Check, X, Pencil, Lock, FolderTree, Globe, Building2 } from "lucide-react";
import {
  createEtiqueta,
  deleteEtiqueta,
  updateEtiqueta,
  updateBlueprint,
  updateEtiquetaScope,
} from "@/lib/modules/entidades/actions/etiquetas.actions";
import type { CategoriaConEtiquetas } from "@/lib/modules/entidades/repositories/etiqueta.repository";
import type { Etiqueta } from "@prisma/client";
import { getCategoriaTipo } from "@/lib/config/categoriaTipos";

// ─── Cajones SALI — estructura rígida (5 fijos, no ampliable) ──────────────

const CAJONES_VALIDOS = new Set(["Identidad", "Departamento", "Servicio", "Estado", "Inteligencia"]);

const ORDEN_VISUAL: Record<string, number> = {
  "Departamento": 1,
  "Servicio":     2,
  "Identidad":    3,
  "Estado":       4,
  "Inteligencia": 5,
};

// ─── Scope config — colores y labels corporativos ─────────────────────────────

type ScopeValue = "GLOBAL" | "LEXCONOMY" | "LAWTECH";

const SCOPE_CONFIG: Record<ScopeValue, { label: string; shortLabel: string; color: string; bg: string }> = {
  GLOBAL:    { label: "Global",     shortLabel: "ALL", color: "#71717a", bg: "#71717a15" },
  LEXCONOMY: { label: "Lexconomy",  shortLabel: "LX",  color: "#FF8C00", bg: "#FF8C0015" },
  LAWTECH:   { label: "Lawtech",    shortLabel: "LW",  color: "#9B1B30", bg: "#9B1B3015" },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface TaxonomiaClientProps {
  initialCategorias: CategoriaConEtiquetas[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ColorDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-3 w-3 rounded-full border border-white/10 shrink-0"
      style={{ backgroundColor: color }}
    />
  );
}

function ScopeBadge({ scope, small = false }: { scope: string; small?: boolean }) {
  const cfg = SCOPE_CONFIG[scope as ScopeValue] ?? SCOPE_CONFIG.GLOBAL;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-sm font-bold uppercase tracking-wider ${
        small ? "px-1 py-[1px] text-[8px]" : "px-1.5 py-0.5 text-[9px]"
      }`}
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
      title={`Visible para: ${cfg.label}`}
    >
      {scope === "GLOBAL" ? (
        <Globe className={small ? "h-2 w-2" : "h-2.5 w-2.5"} />
      ) : (
        <Building2 className={small ? "h-2 w-2" : "h-2.5 w-2.5"} />
      )}
      {cfg.shortLabel}
    </span>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function TaxonomiaClient({ initialCategorias }: TaxonomiaClientProps) {
  const [categorias,   setCategorias]   = useState(() =>
    initialCategorias
      .filter((c) => CAJONES_VALIDOS.has(c.nombre))
      .sort((a, b) => (ORDEN_VISUAL[a.nombre] ?? 99) - (ORDEN_VISUAL[b.nombre] ?? 99))
  );
  const [expandedIds,  setExpandedIds]  = useState<Set<string>>(new Set());
  const [error,        setError]        = useState<string | null>(null);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <div
          className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs"
          style={{
            backgroundColor: "var(--alert-error-bg)",
            borderColor:     "var(--alert-error-border)",
            color:           "var(--alert-error-text)",
          }}
        >
          <X className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--alert-error-icon)" }} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto" style={{ color: "var(--alert-error-icon)" }}>
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2.5 text-xs text-zinc-500">
        <Lock className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
        Arquitectura de 5 cajones fijos. No se pueden crear ni eliminar categorias.
      </div>

      {categorias.map((cat, idx) => {
        const catTipo = getCategoriaTipo(cat.nombre);
        const showSeparator = idx > 0 && (ORDEN_VISUAL[categorias[idx - 1]?.nombre] ?? 0) <= 2 && (ORDEN_VISUAL[cat.nombre] ?? 0) >= 3;
        return (
          <div key={cat.id}>
            {showSeparator && (
              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-zinc-700/50" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Atributos</span>
                <div className="h-px flex-1 bg-zinc-700/50" />
              </div>
            )}
          <CategoriaCard
            cat={cat}
            catTipo={catTipo}
            expanded={expandedIds.has(cat.id)}
            onToggle={() => toggleExpand(cat.id)}
            onEtiquetaCreated={(etiqueta) => {
              setCategorias((prev) =>
                prev.map((c) =>
                  c.id === cat.id ? { ...c, etiquetas: [...c.etiquetas, etiqueta] } : c
                )
              );
            }}
            onEtiquetaDeleted={(etiquetaId) => {
              setCategorias((prev) =>
                prev.map((c) =>
                  c.id === cat.id
                    ? { ...c, etiquetas: c.etiquetas.filter((e: { id: string }) => e.id !== etiquetaId) }
                    : c
                )
              );
            }}
            onEtiquetaUpdated={(id, data) => {
              setCategorias((prev) =>
                prev.map((c) =>
                  c.id === cat.id
                    ? { ...c, etiquetas: c.etiquetas.map((e) => e.id === id ? { ...e, ...data } : e) }
                    : c
                )
              );
            }}
            setError={setError}
          />
          </div>
        );
      })}
    </div>
  );
}

// ─── BlueprintEditor — Editor inline de subcarpetas para etiquetas Constructor ─

function BlueprintEditor({
  etiquetaId,
  initialBlueprint,
  onClose,
  setError,
}: {
  etiquetaId: string;
  initialBlueprint: string[];
  onClose: () => void;
  setError: (msg: string | null) => void;
}) {
  const [folders, setFolders] = useState<string[]>(initialBlueprint);
  const [newFolder, setNewFolder] = useState("");
  const [isPending, startTransition] = useTransition();

  function addFolder() {
    const name = newFolder.trim();
    if (!name || folders.includes(name)) return;
    setFolders((prev) => [...prev, name]);
    setNewFolder("");
  }

  function removeFolder(idx: number) {
    setFolders((prev) => prev.filter((_, i) => i !== idx));
  }

  function save() {
    startTransition(async () => {
      const res = await updateBlueprint(etiquetaId, folders);
      if (!res.ok) { setError(res.error); return; }
      onClose();
    });
  }

  return (
    <div className="mt-2 rounded-lg border border-amber-500/30 bg-zinc-900/80 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <FolderTree className="h-3.5 w-3.5 text-amber-500" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-500">
          Blueprint de subcarpetas
        </span>
        <button onClick={onClose} className="ml-auto text-zinc-600 hover:text-zinc-300">
          <X className="h-3 w-3" />
        </button>
      </div>

      {folders.length === 0 && (
        <p className="text-[10px] text-zinc-600 italic">Sin subcarpetas definidas (se usara la estructura por defecto).</p>
      )}

      <div className="space-y-1">
        {folders.map((f, idx) => (
          <div key={idx} className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-800/50 px-2 py-1">
            <Folder className="h-3 w-3 text-amber-500/60 shrink-0" />
            <span className="flex-1 text-xs text-zinc-300">{f}</span>
            <button onClick={() => removeFolder(idx)} className="text-zinc-600 hover:text-red-400">
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          value={newFolder}
          onChange={(e) => setNewFolder(e.target.value)}
          placeholder="Nueva subcarpeta..."
          className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-amber-500/60"
          onKeyDown={(e) => { if (e.key === "Enter") addFolder(); }}
        />
        <button onClick={addFolder} disabled={!newFolder.trim()}
          className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-600 disabled:opacity-40">
          <Plus className="h-3 w-3" />
        </button>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose}
          className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-500 hover:text-zinc-300">
          Cancelar
        </button>
        <button onClick={save} disabled={isPending}
          className="rounded bg-amber-500 px-3 py-1 text-xs font-semibold text-black hover:bg-amber-400 disabled:opacity-50">
          Guardar blueprint
        </button>
      </div>
    </div>
  );
}

// ─── ScopeSelector — Selector visual de scope (GLOBAL / LX / LW) ───────────

function ScopeSelector({
  etiquetaId,
  currentScope,
  onScopeChanged,
  onClose,
  setError,
}: {
  etiquetaId: string;
  currentScope: string;
  onScopeChanged: (scope: string) => void;
  onClose: () => void;
  setError: (msg: string | null) => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleSelect(scope: ScopeValue) {
    if (scope === currentScope) { onClose(); return; }
    startTransition(async () => {
      const res = await updateEtiquetaScope(etiquetaId, scope);
      if (!res.ok) { setError(res.error); return; }
      onScopeChanged(scope);
      onClose();
    });
  }

  return (
    <div className="mt-2 rounded-lg border border-zinc-700 bg-zinc-900/90 p-2 space-y-1.5">
      <div className="flex items-center gap-2">
        <Globe className="h-3 w-3 text-zinc-500" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Visibilidad
        </span>
        <button onClick={onClose} className="ml-auto text-zinc-600 hover:text-zinc-300">
          <X className="h-3 w-3" />
        </button>
      </div>

      <div className="flex gap-1.5">
        {(["GLOBAL", "LEXCONOMY", "LAWTECH"] as const).map((scope) => {
          const cfg = SCOPE_CONFIG[scope];
          const isActive = currentScope === scope;
          return (
            <button
              key={scope}
              onClick={() => handleSelect(scope)}
              disabled={isPending}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md border-2 px-2 py-2 text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 ${
                isActive ? "ring-1 ring-offset-1 ring-offset-zinc-900" : "opacity-60 hover:opacity-100"
              }`}
              style={{
                borderColor: isActive ? cfg.color : `${cfg.color}30`,
                backgroundColor: isActive ? `${cfg.color}20` : "transparent",
                color: cfg.color,
                ...(isActive ? { ringColor: cfg.color } : {}),
              }}
            >
              {scope === "GLOBAL" ? (
                <Globe className="h-3.5 w-3.5" />
              ) : (
                <Building2 className="h-3.5 w-3.5" />
              )}
              <span>{cfg.label}</span>
              {isActive && <Check className="h-3 w-3" />}
            </button>
          );
        })}
      </div>

      <p className="text-[9px] text-zinc-600 text-center">
        {currentScope === "GLOBAL"
          ? "Visible para Lexconomy y Lawtech"
          : `Solo visible para ${SCOPE_CONFIG[currentScope as ScopeValue]?.label ?? currentScope}`}
      </p>
    </div>
  );
}

// ─── CategoriaCard ────────────────────────────────────────────────────────────

function CategoriaCard({
  cat,
  catTipo,
  expanded,
  onToggle,
  onEtiquetaCreated,
  onEtiquetaDeleted,
  onEtiquetaUpdated,
  setError,
}: {
  cat: CategoriaConEtiquetas;
  catTipo: "CONSTRUCTOR" | "ATRIBUTO";
  expanded: boolean;
  onToggle: () => void;
  onEtiquetaCreated: (e: Etiqueta) => void;
  onEtiquetaDeleted: (id: string) => void;
  onEtiquetaUpdated: (id: string, data: Partial<Etiqueta>) => void;
  setError: (msg: string | null) => void;
}) {
  const [showNewEtiqueta, setShowNewEtiqueta] = useState(false);
  const [newName,         setNewName]         = useState("");
  const [newColor,        setNewColor]        = useState("#6b7280");
  const [editingId,       setEditingId]       = useState<string | null>(null);
  const [editName,        setEditName]        = useState("");
  const [editColor,       setEditColor]       = useState("#6b7280");
  const [blueprintEditId, setBlueprintEditId] = useState<string | null>(null);
  const [scopeEditId,     setScopeEditId]     = useState<string | null>(null);
  const [isPending,       startTransition]    = useTransition();

  function startEdit(e: { id: string; nombre: string; color: string }) {
    setEditingId(e.id);
    setEditName(e.nombre);
    setEditColor(e.color);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditColor("#6b7280");
  }

  function handleUpdateEtiqueta(id: string) {
    if (!editName.trim()) return;
    const fd = new FormData();
    fd.set("nombre", editName.trim());
    fd.set("color", editColor);
    startTransition(async () => {
      const res = await updateEtiqueta(id, null, fd);
      if (!res.ok) { setError(res.error); return; }
      onEtiquetaUpdated(id, { nombre: editName.trim(), color: editColor });
      cancelEdit();
    });
  }

  function handleCreateEtiqueta() {
    if (!newName.trim()) return;
    const fd = new FormData();
    fd.set("nombre", newName.trim());
    fd.set("color", newColor);
    fd.set("categoria_id", cat.id);
    startTransition(async () => {
      const res = await createEtiqueta(null, fd);
      if (!res.ok) { setError(res.error); return; }
      onEtiquetaCreated({
        id: res.data.id, nombre: newName.trim(), color: newColor,
        categoria_id: cat.id, es_sistema: false, scope: "GLOBAL" as const,
        blueprint: null,
        created_at: new Date(), updated_at: new Date(),
      });
      setNewName("");
      setNewColor("#6b7280");
      setShowNewEtiqueta(false);
    });
  }

  function handleDeleteEtiqueta(id: string, nombre: string, es_sistema: boolean) {
    if (es_sistema) { setError(`"${nombre}" es una etiqueta de sistema y no puede borrarse.`); return; }
    if (!confirm(`¿Borrar la etiqueta "${nombre}"? Se quitará de todas las entidades que la tienen asignada.`)) return;
    startTransition(async () => {
      const res = await deleteEtiqueta(id);
      if (!res.ok) { setError(res.error); return; }
      onEtiquetaDeleted(id);
    });
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60">
      {/* Header de categoría */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={onToggle} className="flex flex-1 items-center gap-2.5 text-left">
          {expanded
            ? <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
            : <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />}
          {catTipo === "CONSTRUCTOR" ? (
            <Folder className="h-4 w-4 shrink-0 text-amber-500" />
          ) : (
            <Tag className="h-4 w-4 shrink-0 text-violet-500" />
          )}
          <span className="text-sm font-medium text-zinc-200">{cat.nombre}</span>
          <span className="rounded-full bg-zinc-700/60 px-2 py-0.5 text-[10px] text-zinc-500 tabular-nums">
            {cat.etiquetas.length}
          </span>
          <span className={`rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
            catTipo === "CONSTRUCTOR"
              ? "bg-amber-500/10 text-amber-500/70"
              : "bg-violet-500/10 text-violet-500/70"
          }`}>
            {catTipo === "CONSTRUCTOR" ? "Carpeta" : "Atributo"}
          </span>
        </button>
        {cat.descripcion && (
          <span className="hidden truncate max-w-xs text-xs text-zinc-600 md:block">{cat.descripcion}</span>
        )}
      </div>

      {/* Etiquetas expandidas */}
      {expanded && (
        <div className="border-t border-zinc-800 px-4 pb-3 pt-3 space-y-2">
          {cat.etiquetas.length === 0 && !showNewEtiqueta && (
            <p className="text-xs text-zinc-600 py-1">Sin etiquetas en esta categoría.</p>
          )}

          <div className="flex flex-wrap gap-2">
            {cat.etiquetas.map((e) => (
              editingId === e.id ? (
                <div key={e.id} className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800 px-2 py-1">
                  <input
                    type="color"
                    value={editColor}
                    onChange={(ev) => setEditColor(ev.target.value)}
                    className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0 shrink-0"
                  />
                  <input
                    value={editName}
                    onChange={(ev) => setEditName(ev.target.value)}
                    className="w-28 rounded bg-transparent text-xs text-zinc-100 outline-none placeholder-zinc-600"
                    onKeyDown={(ev) => { if (ev.key === "Enter") handleUpdateEtiqueta(e.id); if (ev.key === "Escape") cancelEdit(); }}
                    autoFocus
                  />
                  <button onClick={() => handleUpdateEtiqueta(e.id)} disabled={!editName.trim() || isPending}
                    className="text-zinc-400 transition-colors hover:text-orange-400 disabled:opacity-40" title="Guardar">
                    <Check className="h-3 w-3" />
                  </button>
                  <button onClick={cancelEdit} className="text-zinc-600 transition-colors hover:text-zinc-300" title="Cancelar">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <span
                  key={e.id}
                  className="group inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset"
                  style={{ backgroundColor: `${e.color}22`, color: e.color }}
                >
                  <ColorDot color={e.color} />
                  {e.nombre}
                  {/* Scope badge — clickable para editar */}
                  {!e.es_sistema ? (
                    <button
                      onClick={() => setScopeEditId(scopeEditId === e.id ? null : e.id)}
                      className="transition-opacity hover:opacity-100"
                      title="Cambiar visibilidad (scope)"
                    >
                      <ScopeBadge scope={e.scope} small />
                    </button>
                  ) : (
                    <ScopeBadge scope={e.scope} small />
                  )}
                  {e.es_sistema && (
                    <span className="text-[9px] font-semibold opacity-60 uppercase">sys</span>
                  )}
                  {!e.es_sistema && (
                    <>
                      {catTipo === "CONSTRUCTOR" && (
                        <button
                          onClick={() => { setBlueprintEditId(blueprintEditId === e.id ? null : e.id); setScopeEditId(null); }}
                          className={`ml-0.5 transition-opacity ${
                            blueprintEditId === e.id
                              ? "opacity-100 text-amber-500"
                              : "opacity-0 group-hover:opacity-70 hover:!opacity-100"
                          }`}
                          title="Editar blueprint de subcarpetas"
                        >
                          <FolderTree className="h-2.5 w-2.5" />
                        </button>
                      )}
                      <button
                        onClick={() => startEdit(e)}
                        className="ml-0.5 opacity-0 transition-opacity group-hover:opacity-70 hover:!opacity-100"
                        title="Editar etiqueta"
                      >
                        <Pencil className="h-2.5 w-2.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteEtiqueta(e.id, e.nombre, e.es_sistema)}
                        className="opacity-0 transition-opacity group-hover:opacity-70 hover:!opacity-100"
                        title="Borrar etiqueta"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </>
                  )}
                </span>
              )
            ))}
          </div>

          {/* Scope selector inline */}
          {scopeEditId && (() => {
            const etq = cat.etiquetas.find((e) => e.id === scopeEditId);
            if (!etq || etq.es_sistema) return null;
            return (
              <ScopeSelector
                etiquetaId={scopeEditId}
                currentScope={etq.scope}
                onScopeChanged={(scope) => onEtiquetaUpdated(scopeEditId, { scope: scope as "GLOBAL" | "LEXCONOMY" | "LAWTECH" })}
                onClose={() => setScopeEditId(null)}
                setError={setError}
              />
            );
          })()}

          {/* Blueprint editor inline — solo para CONSTRUCTOR */}
          {blueprintEditId && catTipo === "CONSTRUCTOR" && (() => {
            const etq = cat.etiquetas.find((e) => e.id === blueprintEditId);
            if (!etq) return null;
            const bp = (etq as Etiqueta & { blueprint?: string[] | null }).blueprint;
            return (
              <BlueprintEditor
                etiquetaId={blueprintEditId}
                initialBlueprint={Array.isArray(bp) ? bp : []}
                onClose={() => setBlueprintEditId(null)}
                setError={setError}
              />
            );
          })()}

          {/* Nueva etiqueta inline */}
          {showNewEtiqueta ? (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
                title="Color de la etiqueta"
              />
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nombre de la etiqueta"
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-orange-500/60"
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateEtiqueta(); if (e.key === "Escape") { setShowNewEtiqueta(false); setNewName(""); } }}
                autoFocus
              />
              <button onClick={handleCreateEtiqueta} disabled={!newName.trim() || isPending}
                className="rounded-lg bg-orange-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50">
                <Check className="h-3 w-3" />
              </button>
              <button onClick={() => { setShowNewEtiqueta(false); setNewName(""); }}
                className="rounded-lg border border-zinc-700 px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-300">
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewEtiqueta(true)}
              className="inline-flex items-center gap-1 text-xs text-zinc-600 transition-colors hover:text-orange-400"
            >
              <Plus className="h-3 w-3" />
              Añadir etiqueta
            </button>
          )}
        </div>
      )}
    </div>
  );
}
